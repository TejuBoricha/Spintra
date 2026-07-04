import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fireConfetti } from "@/components/celebration";
import type { User, ChatMessage, RoomParticipant, RoomType, ActivityEvent } from "@/lib/types";

interface UseRoomSubscriptionProps {
  roomCode: string;
  currentUser: User;
  localCreatorId: string | null;
  authReady: boolean;
  addIncomingMessage: (msg: ChatMessage) => void;
}

export function useRoomSubscription({
  roomCode,
  currentUser,
  localCreatorId,
  authReady,
  addIncomingMessage,
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
  const [isClosingRoom, setIsClosingRoom] = useState(false);

  // Refs
  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const closingRoomRef = useRef(false);
  const activeActivityRef = useRef(activeActivity);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const listenersRef = useRef<Set<(event: ActivityEvent) => void>>(new Set());

  // Derived Values
  // We determine isHost from roomHostId (database) or localCreatorId (local fallback)
  const isHost = roomHostId ? roomHostId === currentUser.id : localCreatorId === currentUser.id;
  const isHostRef = useRef(isHost);

  // Sync refs
  useEffect(() => {
    activeActivityRef.current = activeActivity;
  }, [activeActivity]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Listener management for sub-activities
  const registerEventListener = useCallback((listener: (event: ActivityEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const handleActivityEvent = useCallback((payload: ActivityEvent) => {
    listenersRef.current.forEach((listener) => listener(payload));
  }, []);

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
    }
  }, [postLocalMessage]);

  const sendActivityEvent = useCallback((event: ActivityEvent) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      postLocalMessage("ACTIVITY_EVENT", event);
    } else {
      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.send({
          type: "broadcast",
          event: "activity_event",
          payload: event,
        });
      }
    }
    handleActivityEvent(event);
  }, [postLocalMessage, handleActivityEvent]);

  // Lock Room Handler
  const toggleLock = useCallback(async () => {
    const nextValue = !isLocked;
    setIsLocked(nextValue);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`spintra-room-lock-${roomCode}`, nextValue.toString());
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

        const { data: roomRow } = await supabaseClient
          .from("rooms")
          .select("is_locked, max_participants, host_id")
          .eq("code", roomCode)
          .maybeSingle();

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

        // 1. Query for existing participant row to handle reconnection safely without deleting
        const { data: existingParticipant } = await supabaseClient
          .from("room_participants")
          .select("id, role")
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .maybeSingle();

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
              username: currentUser.username,
              avatar_url: currentUser.avatar_url,
              xp: currentUser.xp,
              rank: currentUser.rank,
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
              username: currentUser.username,
              avatar_url: currentUser.avatar_url,
              xp: currentUser.xp,
              rank: currentUser.rank,
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
                username: currentUser.username,
                avatar_url: currentUser.avatar_url,
                xp: currentUser.xp,
                rank: currentUser.rank,
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
                username: currentUser.username,
                avatar_url: currentUser.avatar_url,
                xp: currentUser.xp,
                rank: currentUser.rank,
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
                username: currentUser.username,
                avatar_url: currentUser.avatar_url,
                xp: currentUser.xp,
                rank: currentUser.rank,
                created_at: currentUser.created_at,
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
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient
          .from("rooms")
          .select("name, type, is_locked, max_participants, host_id")
          .eq("code", roomCode)
          .maybeSingle();
        if (error) {
          console.error("Failed to load room details:", error);
          return;
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
        }
      } catch (e) {
        console.error("Failed to load room details:", e);
      }
    };

    const runSetup = async () => {
      await loadRoomDetails();
      await loadParticipants();
      await trackSelf();
    };

    runSetup();

    return () => {
      isMounted = false;
    };
  }, [roomCode, currentUser, electHostIfNeeded, router, authReady]);

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

          if (isHostRef.current) {
            const supabaseClient = getSupabaseBrowserClient();
            if (supabaseClient) {
              const crashed = prev.filter(
                (p) => p.is_online && !onlineIds.has(p.user_id) && p.user_id !== currentUser.id
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
          const updated = payload.new as RoomParticipant;
          setParticipants((prev) => {
            const next = prev.map((participant) =>
              participant.id === updated.id ? { ...participant, ...updated } : participant
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
          const newParticipant = payload.new as RoomParticipant;
          setParticipants((prev) => {
            if (prev.some((participant) => participant.id === newParticipant.id)) {
              return prev;
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
          const removed = payload.old as { id: string; user_id?: string };
          setParticipants((prev) => {
            const selfParticipant = prev.find((p) => p.user_id === currentUser.id);
            const isSelf =
              (selfParticipant && selfParticipant.id === removed.id) ||
              removed.user_id === currentUser.id;
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
          if (updated.type) setRoomType(updated.type);
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
      }
    });

    return () => {
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
  };
}
