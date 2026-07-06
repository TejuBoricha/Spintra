import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fireConfetti } from "@/components/celebration";
import { banUserFromRoom } from "@/lib/room-bans";
import type { User, ChatMessage, RoomParticipant, RoomType, ActivityEvent } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";

interface PrefetchedRoom {
  name: string;
  type: string;
  is_locked: boolean;
  max_participants: number;
  host_id: string;
  activity_state: unknown;
}

interface UseRoomSubscriptionProps {
  roomCode: string;
  currentUser: User;
  localCreatorId: string | null;
  authReady: boolean;
  addIncomingMessage: (msg: ChatMessage) => void;
  // Already fetched once by room-client.tsx's pre-entry verifyAccess gate —
  // reused here instead of re-querying the same rooms row / the same
  // "am I already a participant" question a second time right after.
  // `undefined` for the existing-participant check means verifyAccess's
  // host early-exit path never checked it, so it's still checked here.
  prefetchedRoom?: PrefetchedRoom | null;
  prefetchedExistingParticipant?: { id: string; role: string } | null;
}

export function useRoomSubscription({
  roomCode,
  currentUser,
  localCreatorId,
  authReady,
  addIncomingMessage,
  prefetchedRoom,
  prefetchedExistingParticipant,
}: UseRoomSubscriptionProps) {
  const router = useRouter();

  // Basic Room States
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [roomType, setRoomType] = useState<RoomType>("party");
  const [roomName, setRoomName] = useState<string>("Game Room");
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [activeActivity, setActiveActivity] = useState<{
    type: string;
    state: unknown;
  } | null>(null);
  const [maxParticipantsLimit, setMaxParticipantsLimit] = useState<number | null>(null);

  // Realtime Status States
  const [isRealtimeReady, setIsRealtimeReady] = useState<boolean | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  // Screen-reader-only announcements (participant join/leave, activity/game
  // changes) — found missing entirely in the Session 41 audit. Deliberately
  // separate from `notification` above: that one is a persistent, visible
  // banner meant for a handful of durable states (host promotion, connection
  // loss), not a stream of transient join/leave chatter that would make it
  // noisy and misleading if repurposed for this instead.
  const [roomAnnouncement, setRoomAnnouncement] = useState<string | null>(null);
  const [isClosingRoom, setIsClosingRoom] = useState(false);

  // Refs
  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const closingRoomRef = useRef(false);
  const activeActivityRef = useRef(activeActivity);
  const roomTypeRef = useRef(roomType);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const listenersRef = useRef<Set<(event: ActivityEvent) => void>>(new Set());
  // Escalates the "trying to reconnect" notification if the channel stays
  // unsubscribed for too long — supabase-js retries the underlying socket
  // connection on its own (no need to reimplement that here), but it isn't
  // guaranteed to eventually succeed, and the notification used to sit at
  // "Trying to reconnect..." indefinitely either way with no further
  // guidance for the user.
  const realtimeReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ordered log of this activity session's events, capped at 200. Replayed to
  // any listener the moment it registers (a fresh mount, a reconnect, or a
  // late joiner) so state is reconstructed identically to how a live client
  // would have built it — no per-activity persistence code needed. Cleared
  // on activity_reset and on switching activities; (re)populated from
  // `rooms.activity_state` on initial load if it matches the current type.
  const activityEventLogRef = useRef<ActivityEvent[]>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ACTIVITY_EVENT_LOG_CAP = 200;

  const persistActivityEventLog = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const type = activeActivityRef.current?.type ?? null;
      const payload = type ? { type, events: activityEventLogRef.current } : null;
      supabase
        .from("rooms")
        .update({ activity_state: payload as unknown as Json })
        .eq("code", roomCode)
        .then();
    }, 600);
  }, [roomCode]);

  // Derived Values
  // We determine isHost from roomHostId (database) or localCreatorId (local fallback)
  const isHost = roomHostId ? roomHostId === currentUser.id : localCreatorId === currentUser.id;
  const isHostRef = useRef(isHost);

  // Sync refs
  useEffect(() => {
    activeActivityRef.current = activeActivity;
  }, [activeActivity]);
  useEffect(() => {
    roomTypeRef.current = roomType;
  }, [roomType]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Lets the participants/reconciliation effect below key off currentUser.id
  // only, instead of the whole currentUser object — editing a display name
  // (room-client.tsx's handleUpdateUsername creates a new currentUser object
  // identity) used to re-trigger that entire effect: reloading participants,
  // re-running electHostIfNeeded, and tearing down/recreating the 20s
  // reconciliation interval, just to persist a name. The username update
  // itself is already handled by handleUpdateUsername's own direct
  // `.update({ username })` call, so this effect only needs the *latest*
  // profile fields at the moment it actually runs (mount/reconnect), not a
  // re-run on every edit.
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Read by the reconciliation interval below so it can skip its poll
  // entirely while realtime is healthy, instead of hitting the DB every 20s
  // for the lifetime of every open room regardless of connection state.
  const isRealtimeReadyRef = useRef(isRealtimeReady);
  useEffect(() => {
    isRealtimeReadyRef.current = isRealtimeReady;
  }, [isRealtimeReady]);
  const realtimeErrorRef = useRef(realtimeError);
  useEffect(() => {
    realtimeErrorRef.current = realtimeError;
  }, [realtimeError]);

  // Listener management for sub-activities. Replays this activity's event
  // log to a newly-registering listener first, so a fresh mount (page load,
  // reconnect, or a late joiner) recovers current state before it starts
  // receiving new live events, instead of starting blank.
  const registerEventListener = useCallback((listener: (event: ActivityEvent) => void) => {
    for (const event of activityEventLogRef.current) {
      listener(event);
    }
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // Single dispatch point for every activity event regardless of origin
  // (sent locally by this client, or received via realtime broadcast/
  // BroadcastChannel from another client) — so every client's local event
  // log stays complete and any of them persisting it to the DB writes the
  // same shared history, not just the subset of events this client happened
  // to originate itself.
  const handleActivityEvent = useCallback((payload: ActivityEvent) => {
    if (payload.kind === "activity_reset") {
      activityEventLogRef.current = [];
    } else {
      activityEventLogRef.current = [...activityEventLogRef.current, payload].slice(
        -ACTIVITY_EVENT_LOG_CAP
      );
    }
    persistActivityEventLog();
    listenersRef.current.forEach((listener) => listener(payload));
  }, [persistActivityEventLog]);

  // Post broadcast locally when using BroadcastChannel fallback
  const postLocalMessage = useCallback((type: string, payload: unknown) => {
    if (broadcastRef.current) {
      broadcastRef.current.postMessage({
        type,
        payload,
        senderId: currentUser.id,
      });
    }
  }, [currentUser.id]);

  // Host election helper
  const electHostIfNeeded = useCallback(
    async (
      supabase: ReturnType<typeof getSupabaseBrowserClient> | null,
      currentParticipants: RoomParticipant[]
    ) => {
      if (!supabase) return;

      const hasOnlineHost = currentParticipants.some(
        (participant) => participant.role === "host" && participant.is_online
      );
      if (hasOnlineHost) return;

      const onlineParticipants = currentParticipants
        .filter((participant) => participant.is_online)
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

      if (!onlineParticipants.length) return;

      const earliest = onlineParticipants[0];
      if (earliest.user_id !== currentUser.id) return;

      // Verify the room still exists to prevent host promotion if the room is being closed/deleted
      const { data: roomExists } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", roomCode)
        .maybeSingle();

      if (!roomExists) return;

      // Promote our participant row to 'host'
      const { error: partError } = await supabase
        .from("room_participants")
        .update({ role: "host" })
        .eq("room_id", roomCode)
        .eq("user_id", currentUser.id);

      if (partError) {
        if (partError.message?.includes("already has an online host")) {
          console.warn("Host election conflict detected. Another online participant was elected first.");
        } else {
          console.error("Failed to elect participant as host in database:", partError.message || partError);
        }
        return;
      }

      // Update rooms table host_id to match the new host
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ host_id: currentUser.id })
        .eq("code", roomCode);

      if (roomError) {
        console.error("Failed to update rooms host_id in database:", roomError.message || roomError);
      } else {
        setRoomHostId(currentUser.id);
        setParticipants((prev) =>
          prev.map((participant) =>
            participant.user_id === currentUser.id
              ? { ...participant, role: "host" as const }
              : participant
          )
        );
        toast.success("You are now the host.");
        setNotification("The previous host left, and you have been promoted to host.");
        fireConfetti();
      }
    },
    [currentUser.id, roomCode]
  );

  // Switch Game / Activity Handler
  const changeActivity = useCallback((type: string | null) => {
    const nextActivity = type ? { type, state: null } : null;
    setActiveActivity(nextActivity);

    // Switching games starts a fresh session — the previous activity's
    // recorded history must not leak into the new one.
    activityEventLogRef.current = [];
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      postLocalMessage("ACTIVITY_CHANGE", nextActivity);
    } else {
      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.send({
          type: "broadcast",
          event: "activity_change",
          payload: nextActivity,
        });
      }
      supabase.from("rooms").update({ activity_state: null }).eq("code", roomCode).then();
    }
  }, [postLocalMessage, roomCode]);

  const sendActivityEvent = useCallback((event: ActivityEvent) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      postLocalMessage("ACTIVITY_EVENT", event);
    } else if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: "broadcast",
        event: "activity_event",
        payload: event,
      });
    }
    handleActivityEvent(event);
  }, [postLocalMessage, handleActivityEvent]);

  // Lock Room Handler
  const toggleLock = useCallback(async () => {
    const nextValue = !isLocked;
    setIsLocked(nextValue);

    if (typeof window !== "undefined") {
      postLocalMessage("LOCK_CHANGE", nextValue);
    }

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("rooms")
          .update({ is_locked: nextValue })
          .eq("code", roomCode);
        if (error) throw error;
      } catch (error) {
        console.error("Failed to update room lock state in DB:", error);
      }
    }

    toast.success(nextValue ? "Room locked" : "Room unlocked");
  }, [roomCode, isLocked, postLocalMessage]);

  // Kick Participant Handler
  const handleKickParticipant = useCallback(
    async (participant: RoomParticipant) => {
      if (!isHost || participant.user_id === currentUser.id) return;

      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          await supabase
            .from("room_participants")
            .delete()
            .eq("room_id", roomCode)
            .eq("user_id", participant.user_id);

          // Best-effort: prevents the kicked user from immediately rejoining.
          // Kick itself has already succeeded above, so a failure here doesn't
          // block the primary action — just logged for visibility.
          const { error: banError } = await supabase.from("room_bans").insert({
            room_id: roomCode,
            user_id: participant.user_id,
            banned_by: currentUser.id,
          });
          if (banError) {
            console.error("Failed to record room ban:", banError);
          }
        } catch (error) {
          console.error("Failed to remove participant:", error);
          toast.error("Unable to remove participant.");
          return;
        }
      } else {
        banUserFromRoom(roomCode, participant.user_id);
        postLocalMessage("KICKED", participant.user_id);
      }

      setParticipants((prev) => prev.filter((p) => p.user_id !== participant.user_id));
      toast.success(`Removed ${participant.user?.username || "participant"} from the room.`);
    },
    [isHost, currentUser.id, roomCode, postLocalMessage]
  );

  // Close Room Handler
  const handleCloseRoom = useCallback(async () => {
    if (!isHost) return;
    setIsClosingRoom(true);
    closingRoomRef.current = true;

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      try {
        const { error } = await supabase.from("rooms").delete().eq("code", roomCode);
        if (error) throw error;
      } catch (error) {
        console.error("Failed to close room:", error);
        toast.error("Unable to close the room. Please try again.");
        setIsClosingRoom(false);
        closingRoomRef.current = false;
        return;
      }
    } else {
      postLocalMessage("ROOM_CLOSED", null);
    }

    toast.success("Room closed for everyone.");
    router.push("/explore");
  }, [isHost, roomCode, router, postLocalMessage]);

  // Load room details, participants list, and register self in database
  useEffect(() => {
    if (!authReady) return;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);
    const supabase = getSupabaseBrowserClient();
    if (supabase && !isUUID) return;

    let isMounted = true;

    const loadParticipants = async () => {
      try {
        const supabaseClient = getSupabaseBrowserClient();
        if (!supabaseClient) return;

        const { data, error } = await supabaseClient
          .from("room_participants")
          .select("id, room_id, user_id, role, is_online, joined_at, username, avatar_url, xp, rank")
          .eq("room_id", roomCode)
          .order("joined_at", { ascending: true });

        if (error) {
          console.error("Failed to load room participants:", error);
          if (isMounted) toast.error("Couldn't load participants. Try refreshing the page.");
          return;
        }

        if (isMounted && data) {
          const loadedParticipants = data.map((item) => ({
            id: item.id,
            room_id: item.room_id,
            user_id: item.user_id,
            role: item.role as RoomParticipant["role"],
            is_online: item.is_online,
            joined_at: item.joined_at,
            user: {
              id: item.user_id,
              username: item.username ?? "Guest",
              avatar_url: item.avatar_url ?? undefined,
              xp: item.xp ?? 0,
              rank: item.rank as User["rank"],
              created_at: item.joined_at,
            },
          }));

          setParticipants(loadedParticipants);
          await electHostIfNeeded(supabaseClient, loadedParticipants);
        }
      } catch (cause) {
        console.error("Participant load failed:", cause);
      }
    };

    const trackSelf = async () => {
      try {
        const supabaseClient = getSupabaseBrowserClient();
        if (!supabaseClient) return;

        // Reuse room-client.tsx's verifyAccess fetch instead of re-querying
        // the same row again — falls back to a real fetch if it's somehow
        // unavailable (e.g. this hook ever runs without that gate).
        const roomRow =
          prefetchedRoom ??
          (
            await supabaseClient
              .from("rooms")
              .select("is_locked, max_participants, host_id")
              .eq("code", roomCode)
              .maybeSingle()
          ).data;

        if (!roomRow) {
          if (isMounted) {
            toast.error("This room does not exist.");
            router.push("/explore");
          }
          return;
        }

        const isRoomHost = roomRow.host_id === currentUser.id;
        const role = isRoomHost ? ("host" as const) : ("participant" as const);
        const joined_at = new Date().toISOString();

        // 1. Existing participant row (reconnection safety) — reuse
        // verifyAccess's check when it ran one (every path except the host
        // early-exit, which skips it since a host never needs ban/lock/
        // capacity checks against themselves).
        const existingParticipant =
          prefetchedExistingParticipant !== undefined
            ? prefetchedExistingParticipant
            : (
                await supabaseClient
                  .from("room_participants")
                  .select("id, role")
                  .eq("room_id", roomCode)
                  .eq("user_id", currentUser.id)
                  .maybeSingle()
              ).data;

        // 2. If new join, check room lock status
        if (!existingParticipant && !isRoomHost && roomRow.is_locked) {
          if (isMounted) {
            toast.error("This room is locked by the host.");
            router.push("/explore");
          }
          return;
        }

        let upsertResult;
        if (existingParticipant) {
          // Reconnection: update status without trigger limit validation
          upsertResult = await supabaseClient
            .from("room_participants")
            .update({
              is_online: true,
              role: isRoomHost ? "host" : existingParticipant.role,
              username: currentUserRef.current.username,
              avatar_url: currentUserRef.current.avatar_url,
              xp: currentUserRef.current.xp,
              rank: currentUserRef.current.rank,
            })
            .eq("id", existingParticipant.id)
            .select("id, room_id, user_id, role, is_online, joined_at, username, avatar_url, xp, rank");
        } else {
          // New join: perform upsert (triggers db-level max limit check on insert)
          // Using upsert handles the race condition gracefully where another call
          // already inserted the row before this one finished.
          upsertResult = await supabaseClient
            .from("room_participants")
            .upsert({
              room_id: roomCode,
              user_id: currentUser.id,
              role,
              is_online: true,
              joined_at,
              username: currentUserRef.current.username,
              avatar_url: currentUserRef.current.avatar_url,
              xp: currentUserRef.current.xp,
              rank: currentUserRef.current.rank,
            }, { onConflict: "room_id,user_id" })
            .select("id, room_id, user_id, role, is_online, joined_at, username, avatar_url, xp, rank");
        }

        // Graceful fallback for host promotion conflict
        if (upsertResult.error && upsertResult.error.message?.includes("already has an online host")) {
          console.warn("Host election conflict detected. Retrying registration as regular participant.");
          if (existingParticipant) {
            upsertResult = await supabaseClient
              .from("room_participants")
              .update({
                is_online: true,
                role: "participant",
                username: currentUserRef.current.username,
                avatar_url: currentUserRef.current.avatar_url,
                xp: currentUserRef.current.xp,
                rank: currentUserRef.current.rank,
              })
              .eq("id", existingParticipant.id)
              .select("id, room_id, user_id, role, is_online, joined_at, username, avatar_url, xp, rank");
          } else {
            upsertResult = await supabaseClient
              .from("room_participants")
              .upsert({
                room_id: roomCode,
                user_id: currentUser.id,
                role: "participant",
                is_online: true,
                joined_at,
                username: currentUserRef.current.username,
                avatar_url: currentUserRef.current.avatar_url,
                xp: currentUserRef.current.xp,
                rank: currentUserRef.current.rank,
              }, { onConflict: "room_id,user_id" })
              .select("id, room_id, user_id, role, is_online, joined_at, username, avatar_url, xp, rank");
          }
        }

        const { data, error } = upsertResult;

        if (error) {
          console.error("Failed to register participant in DB:", error.message);
          if (isMounted) {
            const message = error.message.includes("banned")
              ? "You have been banned from this room by the host."
              : error.message.includes("limit")
              ? "This room has reached its participant limit."
              : "Unable to join room.";
            toast.error(message);
            router.push("/explore");
          }
          return;
        }

        const participantRow = data?.[0];
        if (participantRow && isMounted) {
          setParticipants((prev) => [
            ...prev.filter((participant) => participant.user_id !== currentUser.id),
            {
              id: participantRow.id,
              room_id: participantRow.room_id,
              user_id: participantRow.user_id,
              role: participantRow.role as RoomParticipant["role"],
              is_online: participantRow.is_online,
              joined_at: participantRow.joined_at,
              user: {
                id: currentUser.id,
                username: currentUserRef.current.username,
                avatar_url: currentUserRef.current.avatar_url,
                xp: currentUserRef.current.xp,
                rank: currentUserRef.current.rank,
                created_at: currentUserRef.current.created_at,
              },
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to register participant details in database:", error);
        if (isMounted) toast.error("Unable to join room. Please try again.");
      }
    };

    const loadRoomDetails = async () => {
      try {
        const supabaseClient = getSupabaseBrowserClient();
        if (!supabaseClient) {
          // Demo mode: no DB to query — fall back to what create-client.tsx
          // wrote to localStorage at creation time (spintra-room-type-{code},
          // spintra-room-name-{code}), since nothing else populates
          // activeActivity in this mode and the room would otherwise be
          // stuck on the idle "choose an activity" screen forever.
          if (!isMounted) return;
          const storedType = window.localStorage.getItem(`spintra-room-type-${roomCode}`) as RoomType | null;
          const storedName = window.localStorage.getItem(`spintra-room-name-${roomCode}`);
          if (storedName) setRoomName(storedName);
          if (storedType) {
            setRoomType(storedType);
            if (storedType !== "party" && storedType !== "classroom") {
              setActiveActivity((prev) => prev || { type: storedType, state: null });
            }
          }
          return;
        }
        // Reuse room-client.tsx's verifyAccess fetch (which already selects
        // every column below) instead of re-querying the same rooms row a
        // second time — falls back to a real fetch if unavailable.
        let data = prefetchedRoom;
        if (!data) {
          const result = await supabaseClient
            .from("rooms")
            .select("name, type, is_locked, max_participants, host_id, activity_state")
            .eq("code", roomCode)
            .maybeSingle();
          if (result.error) {
            console.error("Failed to load room details:", result.error);
            return;
          }
          data = result.data;
        }
        if (isMounted && data) {
          setRoomName(data.name);
          setRoomType(data.type as RoomType);
          setIsLocked(!!data.is_locked);
          setRoomHostId(data.host_id);
          if (typeof data.max_participants === "number") setMaxParticipantsLimit(data.max_participants);
          if (data.type !== "party" && data.type !== "classroom") {
            setActiveActivity((prev) => prev || { type: data.type, state: null });
          }
          // Recover this room's in-progress game (if any) so a refresh or
          // reconnect doesn't drop back to a blank activity screen — see
          // registerEventListener's replay and handleActivityEvent's logging.
          const persisted = data.activity_state as { type?: string; events?: ActivityEvent[] } | null;
          if (persisted?.type === data.type && Array.isArray(persisted.events)) {
            activityEventLogRef.current = persisted.events.slice(-ACTIVITY_EVENT_LOG_CAP);
          }
        }
      } catch (e) {
        console.error("Failed to load room details:", e);
      }
    };

    const runSetup = async () => {
      // loadRoomDetails is synchronous when prefetchedRoom is available (no
      // network call at all); loadParticipants and trackSelf don't depend
      // on each other's results, so they run concurrently instead of
      // serially — part of the Session 41 fix for 9 redundant serial round
      // trips on every room join.
      await loadRoomDetails();
      await Promise.all([loadParticipants(), trackSelf()]);
    };

    runSetup();

    // Periodic reconciliation, real-Supabase mode only: postgres_changes
    // delivery has no delivery guarantee if a client's websocket briefly
    // drops mid-reconnect (or, observed in CI against a freshly-started
    // Supabase instance, if the Realtime service's logical-replication
    // connection is still warming up) — an INSERT/UPDATE/DELETE missed that
    // way would otherwise leave every client's participant list silently
    // stale forever, with nothing to self-heal it. Demo mode's
    // BroadcastChannel fallback doesn't need this: it's synchronous and
    // same-machine, with no equivalent "missed while reconnecting" gap.
    //
    // The tick itself is cheap and always scheduled, but the actual
    // `room_participants` fetch only fires while realtime is degraded
    // (`isRealtimeReadyRef` false, or a `realtimeErrorRef` is set) — a
    // healthy room shouldn't cost a DB round trip every 20s for its entire
    // lifetime just to guard against a rare missed-event edge case that
    // reconnection already flags via those refs.
    const reconciliationInterval = supabase
      ? setInterval(() => {
          if (!isRealtimeReadyRef.current || realtimeErrorRef.current) {
            loadParticipants();
          }
        }, 20_000)
      : null;

    return () => {
      isMounted = false;
      if (reconciliationInterval) clearInterval(reconciliationInterval);
    };
  }, [roomCode, currentUser.id, electHostIfNeeded, router, authReady, prefetchedRoom, prefetchedExistingParticipant]);

  // Subscriptions & Fallback Setup Effect
  useEffect(() => {
    if (!authReady) return;
    const supabase = getSupabaseBrowserClient();

    // ──────────────── LOCAL BROADCAST FALLBACK MODE ────────────────
    if (!supabase) {
      const channelName = `spintra_room_${roomCode}`;
      const bc = new BroadcastChannel(channelName);
      broadcastRef.current = bc;

      const selfParticipant: RoomParticipant = {
        id: `local_${currentUser.id}`,
        room_id: roomCode,
        user_id: currentUser.id,
        role: localCreatorId === currentUser.id ? "host" : "participant",
        is_online: true,
        joined_at: currentUser.created_at,
        user: currentUser,
      };

      queueMicrotask(() => {
        setIsRealtimeReady(true);
        setRealtimeError(null);
        setNotification(null);
        setParticipants((prev) => {
          if (prev.some((p) => p.user_id === currentUser.id)) {
            return prev.map((p) => (p.user_id === currentUser.id ? { ...p, is_online: true } : p));
          }
          return [...prev, selfParticipant];
        });
      });

      bc.postMessage({
        type: "PONG",
        payload: selfParticipant,
        senderId: currentUser.id,
      });

      bc.postMessage({
        type: "PING",
        senderId: currentUser.id,
      });

      bc.onmessage = (event) => {
        const { type, payload, senderId } = event.data;
        if (senderId === currentUser.id) return;

        switch (type) {
          case "PING":
            bc.postMessage({
              type: "PONG",
              payload: {
                id: `local_${currentUser.id}`,
                room_id: roomCode,
                user_id: currentUser.id,
                role: localCreatorId === currentUser.id ? "host" : "participant",
                is_online: true,
                joined_at: currentUser.created_at,
                user: currentUser,
              },
              senderId: currentUser.id,
            });
            if (isHostRef.current && activeActivityRef.current) {
              bc.postMessage({
                type: "ACTIVITY_CHANGE",
                payload: activeActivityRef.current,
                senderId: currentUser.id,
              });
            }
            break;

          case "PONG":
            if (payload) {
              setParticipants((prev) => {
                const filtered = prev.filter((p) => p.user_id !== payload.user_id);
                return [...filtered, payload];
              });
            }
            break;

          case "CHAT":
            if (payload) {
              addIncomingMessage(payload);
            }
            break;

          case "ACTIVITY_CHANGE":
            setActiveActivity(payload);
            break;

          case "ACTIVITY_EVENT":
            if (payload) {
              handleActivityEvent(payload);
            }
            break;

          case "LOCK_CHANGE":
            setIsLocked(!!payload);
            break;

          case "KICKED":
            if (payload === currentUser.id) {
              toast.error("You were removed from the room by the host.", { id: "kicked-toast" });
              router.push("/explore");
              return;
            }
            setParticipants((prev) => prev.filter((p) => p.user_id !== payload));
            break;

          case "ROOM_CLOSED":
            toast.error("The host closed this room.", { id: "room-closed-toast" });
            router.push("/explore");
            break;

          case "HOST_PROMOTED":
            if (payload) {
              setParticipants((prev) =>
                prev.map((p) =>
                  p.user_id === payload
                    ? { ...p, role: "host" as const }
                    : p.role === "host"
                    ? { ...p, role: "participant" as const }
                    : p
                )
              );
            }
            break;

          case "OFFLINE":
            if (payload) {
              setParticipants((prev) => {
                const updated = prev.map((p) =>
                  p.user_id === payload ? { ...p, is_online: false } : p
                );

                const hasOnlineHost = updated.some((p) => p.role === "host" && p.is_online);
                if (!hasOnlineHost) {
                  const online = updated
                    .filter((p) => p.is_online)
                    .sort(
                      (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
                    );
                  if (online.length && online[0].user_id === currentUser.id) {
                    bc.postMessage({
                      type: "HOST_PROMOTED",
                      payload: currentUser.id,
                      senderId: currentUser.id,
                    });
                    toast.success("You are now the host.");
                    setNotification("The previous host left, and you have been promoted to host.");
                    return updated.map((p) =>
                      p.user_id === currentUser.id ? { ...p, role: "host" as const } : p
                    );
                  }
                }
                return updated;
              });
            }
            break;
        }
      };

      const handleUnload = () => {
        bc.postMessage({
          type: "OFFLINE",
          payload: currentUser.id,
          senderId: currentUser.id,
        });
      };

      window.addEventListener("beforeunload", handleUnload);
      window.addEventListener("pagehide", handleUnload);

      return () => {
        window.removeEventListener("beforeunload", handleUnload);
        window.removeEventListener("pagehide", handleUnload);
        handleUnload();
        bc.close();
        broadcastRef.current = null;
      };
    }

    // ──────────────── SUPABASE REALTIME MODE ────────────────
    const channel = supabase
      .channel(`room:${roomCode}`)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set(
          Object.values(state)
            .flat()
            .map((p) => (p as unknown as { user_id: string }).user_id)
        );
        setParticipants((prev) => {
          const updated = prev.map((participant) => ({
            ...participant,
            is_online: onlineIds.has(participant.user_id),
          }));

          // Any connected participant (not just the host) reconciles stale
          // is_online rows against live presence — otherwise a crashed
          // host's own row could never be corrected by anyone (nobody else
          // is permitted to touch it), permanently blocking host succession.
          // If the current user has zero presence entries, the room is empty:
          // also reconcile any stale row belonging to the current user's
          // own previous session (crashed singleton case).
          const supabaseClient = getSupabaseBrowserClient();
          if (supabaseClient) {
            const crashed = prev.filter(
              (p) =>
                p.is_online &&
                !onlineIds.has(p.user_id) &&
                (p.user_id !== currentUser.id || onlineIds.size === 0)
            );
            if (crashed.length > 0) {
              supabaseClient
                .from("room_participants")
                .update({ is_online: false })
                .in(
                  "user_id",
                  crashed.map((p) => p.user_id)
                )
                .eq("room_id", roomCode)
                .then();
            }
          }

          return updated;
        });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomCode}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          addIncomingMessage(incoming);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${roomCode}`,
        },
        (payload) => {
          // Like the INSERT handler below: the raw row has flat
          // username/avatar_url/xp/rank columns, not the app-level
          // RoomParticipant type's nested `user` object. Spreading it
          // directly onto the participant (the previous behavior) silently
          // never updated the displayed profile — it wrote a stray top-level
          // `username` field the UI never reads, instead of `.user.username`.
          const updated = payload.new as RoomParticipant & {
            username?: string;
            avatar_url?: string;
            xp?: number;
            rank?: string;
          };
          setParticipants((prev) => {
            const next = prev.map((participant) =>
              participant.id === updated.id
                ? {
                    ...participant,
                    role: updated.role,
                    is_online: updated.is_online,
                    user: {
                      ...participant.user,
                      id: participant.user?.id ?? updated.user_id,
                      username: updated.username ?? participant.user?.username ?? "Guest",
                      avatar_url: updated.avatar_url ?? participant.user?.avatar_url,
                      xp: updated.xp ?? participant.user?.xp ?? 0,
                      rank: (updated.rank ?? participant.user?.rank) as User["rank"],
                      created_at: participant.user?.created_at ?? participant.joined_at,
                    },
                  }
                : participant
            );
            if (updated.role !== "host" || !updated.is_online) {
              electHostIfNeeded(supabase, next);
            }
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${roomCode}`,
        },
        (payload) => {
          // The raw row (unlike the app-level RoomParticipant type) has a
          // flat `username` column, not a nested `user` object.
          const newParticipant = payload.new as RoomParticipant & { username?: string };
          setParticipants((prev) => {
            if (prev.some((participant) => participant.id === newParticipant.id)) {
              return prev;
            }
            if (newParticipant.user_id !== currentUser.id) {
              setRoomAnnouncement(`${newParticipant.username || "A participant"} joined the room.`);
            }
            const next = [...prev, newParticipant];
            electHostIfNeeded(supabase, next);
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${roomCode}`,
        },
        (payload) => {
          const removed = payload.old as { id: string; user_id?: string; username?: string };
          setParticipants((prev) => {
            const selfParticipant = prev.find((p) => p.user_id === currentUser.id);
            const isSelf =
              (selfParticipant && selfParticipant.id === removed.id) ||
              removed.user_id === currentUser.id;
            if (!isSelf) {
              setRoomAnnouncement(`${removed.username || "A participant"} left the room.`);
            }
            if (isSelf) {
              setTimeout(async () => {
                const supabaseClient = getSupabaseBrowserClient();
                let roomExists = false;
                if (supabaseClient) {
                  const { data } = await supabaseClient
                    .from("rooms")
                    .select("id")
                    .eq("code", roomCode)
                    .maybeSingle();
                  roomExists = !!data;
                }
                if (roomExists) {
                  toast.error("You were removed from the room by the host.", { id: "kicked-toast" });
                } else {
                  toast.error("The host closed this room.", { id: "room-closed-toast" });
                }
                router.push("/explore");
              }, 0);
              return prev;
            }
            const next = prev.filter((participant) => participant.id !== removed.id);
            electHostIfNeeded(supabase, next);
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${roomCode}` },
        (payload) => {
          const updated = payload.new as {
            name?: string;
            type?: RoomType;
            is_locked?: boolean;
            max_participants?: number;
            host_id?: string;
          };
          if (updated.name) setRoomName(updated.name);
          if (updated.type) {
            if (updated.type !== roomTypeRef.current) {
              setRoomAnnouncement(`Game changed to ${updated.type.replace(/-/g, " ")}.`);
            }
            setRoomType(updated.type);
          }
          if (typeof updated.is_locked === "boolean") setIsLocked(updated.is_locked);
          if (typeof updated.max_participants === "number")
            setMaxParticipantsLimit(updated.max_participants);
          if (updated.host_id) setRoomHostId(updated.host_id);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "rooms", filter: `code=eq.${roomCode}` },
        () => {
          if (closingRoomRef.current) return;
          toast.error("The host closed this room.", { id: "room-closed-toast" });
          router.push("/explore");
        }
      )
      .on("broadcast", { event: "activity_change" }, ({ payload }) => {
        if (payload) {
          setActiveActivity(payload);
        }
      })
      .on("broadcast", { event: "activity_event" }, ({ payload }) => {
        if (payload) {
          handleActivityEvent(payload);
        }
      });

    supabaseChannelRef.current = channel;

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        if (realtimeReconnectTimerRef.current) {
          clearTimeout(realtimeReconnectTimerRef.current);
          realtimeReconnectTimerRef.current = null;
        }
        setIsRealtimeReady(true);
        setRealtimeError(null);
        setNotification(null);
        channel.track({ user_id: currentUser.id });
        if (isHostRef.current && activeActivityRef.current) {
          channel.send({
            type: "broadcast",
            event: "activity_change",
            payload: activeActivityRef.current,
          });
        }
      } else {
        setIsRealtimeReady(false);
        setRealtimeError("Realtime subscription failed.");
        setNotification("Realtime connection lost. Trying to reconnect...");
        // supabase-js keeps retrying the socket connection on its own; if it
        // hasn't recovered after 20s, upgrade the guidance instead of
        // leaving "Trying to reconnect..." showing forever with no next
        // step for the user.
        if (!realtimeReconnectTimerRef.current) {
          realtimeReconnectTimerRef.current = setTimeout(() => {
            realtimeReconnectTimerRef.current = null;
            setNotification(
              "Still having trouble reconnecting. If this continues, try refreshing the page."
            );
          }, 20_000);
        }
      }
    });

    return () => {
      if (realtimeReconnectTimerRef.current) {
        clearTimeout(realtimeReconnectTimerRef.current);
        realtimeReconnectTimerRef.current = null;
      }
      supabase.removeChannel(channel);
      supabaseChannelRef.current = null;
    };
  }, [
    roomCode,
    electHostIfNeeded,
    currentUser,
    localCreatorId,
    router,
    addIncomingMessage,
    authReady,
    handleActivityEvent,
  ]);

  useEffect(() => {
    return () => {
      // A pending activity-state persistence debounce shouldn't fire after
      // this room unmounts — harmless in practice (discarded result), but a
      // stray timer issuing a write against a room the user just left.
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const supabase = getSupabaseBrowserClient();
      if (supabase && currentUser?.id) {
        supabase
          .from("room_participants")
          .update({ is_online: false })
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .then();
      }
    };
  }, [roomCode, currentUser?.id]);

  const isLocalOnlyMode = getSupabaseBrowserClient() === null;
  const realtimeStatusLabel = realtimeError
    ? "Offline"
    : isRealtimeReady
    ? isLocalOnlyMode
      ? "Live (this device only)"
      : "Live"
    : "Connecting...";

  const realtimeStatusClass = realtimeError
    ? "bg-red-500/10 text-red-300"
    : isRealtimeReady
    ? "bg-emerald-500/10 text-emerald-300"
    : "bg-amber-500/10 text-amber-300";

  return {
    participants,
    setParticipants,
    roomType,
    setRoomType,
    roomName,
    setRoomName,
    roomHostId,
    setRoomHostId,
    isLocked,
    setIsLocked,
    activeActivity,
    setActiveActivity,
    maxParticipantsLimit,
    setMaxParticipantsLimit,
    isRealtimeReady,
    realtimeError,
    notification,
    roomAnnouncement,
    isClosingRoom,
    isHost,
    changeActivity,
    sendActivityEvent,
    registerEventListener,
    handleActivityEvent,
    postLocalMessage,
    toggleLock,
    handleKickParticipant,
    handleCloseRoom,
    realtimeStatusLabel,
    realtimeStatusClass,
    isLocalOnlyMode,
  };
}
