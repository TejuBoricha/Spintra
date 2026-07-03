"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Component, ReactNode, ErrorInfo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Send, Crown, MessageCircle, Lock, Unlock,
  Copy, Check, Smile, UserX, Wifi,
  Shuffle, RotateCcw, DoorClosed, Volume2, VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Emoji, renderTextWithEmoji, EMOJI_UNICODE } from "@/components/emoji";
import type { User, ChatMessage, RoomParticipant, RoomType, ActivityEvent } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOrCreateRoomUser, getLocalRoomCreatorId } from "@/lib/room-user";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { fireConfetti } from "@/components/celebration";
import { IdleScreen } from "./activities/idle-screen";
import { AggregateIdleScreen } from "./activities/aggregate-idle-screen";
import { ActivityPickerDialog } from "./activities/activity-picker-dialog";
import { ACTIVITY_REGISTRY } from "./activities/activity-registry";
import { RoomActivityContext, RoomParticipantsContext } from "./context/room-activity-context";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Activity Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function generateUUID() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const REACTION_NAMES = [
  "thumbs_up", "red_heart", "face_with_tears_of_joy", "party_popper",
  "fire", "hundred_points", "eyes", "raising_hands",
] as const;

function isDuplicateMessage(messages: ChatMessage[], candidate: ChatMessage) {
  return messages.some(
    (message) =>
      message.id === candidate.id ||
      (message.user_id === candidate.user_id &&
        new Date(message.created_at).getTime() === new Date(candidate.created_at).getTime() &&
        message.content === candidate.content)
  );
}

const MAX_MESSAGE_LENGTH = 500;

export default function RoomClient({ code: roomCode }: { code: string }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User>(getOrCreateRoomUser);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }

    const signIn = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let sessionUser = sessionData.session?.user;

        if (!sessionUser) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          sessionUser = data?.user || undefined;
        }

        if (sessionUser) {
          setCurrentUser((prev) => {
            if (prev.id === sessionUser.id) return prev;
            const updated = { ...prev, id: sessionUser.id };
            if (typeof window !== "undefined") {
              window.localStorage.setItem("spintra-room-user", JSON.stringify(updated));
            }
            return updated;
          });
        }
      } catch (err) {
        console.error("Failed to initialize Supabase anonymous session:", err);
        const errMsg = (err as { message?: string })?.message || "";
        if (errMsg.includes("Anonymous sign-ins are disabled")) {
          toast.error(
            "Anonymous sign-ins are disabled in your Supabase project. Please enable 'Allow Anonymous Sign-ins' in your Supabase Dashboard (Settings -> Authentication)."
          );
        }
      } finally {
        setAuthReady(true);
      }
    };

    signIn();
  }, []);
  const [maxParticipantsLimit, setMaxParticipantsLimit] = useState<number | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [localCreatorId] = useState<string | null>(() => {
    return getLocalRoomCreatorId(roomCode);
  });

  const [roomType, setRoomType] = useState<RoomType>("party");
  const [roomName, setRoomName] = useState<string>("Game Room");
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeActivity, setActiveActivity] = useState<{
    type: string;
    state: unknown;
  } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Sub-game states are now fully modularised and localized to each activity component.

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [newMessage, setNewMessage] = useState("");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isRealtimeReady, setIsRealtimeReady] = useState<boolean | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isCloseRoomDialogOpen, setIsCloseRoomDialogOpen] = useState(false);
  const [isClosingRoom, setIsClosingRoom] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("spintra-room-sound");
      if (saved !== null) {
        setTimeout(() => {
          setSoundEnabled(saved === "true");
        }, 0);
      }
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("spintra-room-sound", String(next));
      }
      toast.info(next ? "Sound effects enabled!" : "Sound effects muted!");
      return next;
    });
  }, []);

  const isHost = hasMounted && (roomHostId ? roomHostId === currentUser.id : localCreatorId === currentUser.id);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const listenersRef = useRef<Set<(event: ActivityEvent) => void>>(new Set());
  const registerEventListener = useCallback((listener: (event: ActivityEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);
  const handleActivityEvent = useCallback((payload: ActivityEvent) => {
    listenersRef.current.forEach((listener) => listener(payload));
  }, []);
  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const closingRoomRef = useRef(false);
  const activeActivityRef = useRef(activeActivity);
  const isHostRef = useRef(isHost);
  const showParticipantsRef = useRef(showParticipants);
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Sync client-only values from localStorage/environment post-mount to prevent hydration mismatches
  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => {
      if (!isMounted) return;
      setHasMounted(true);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setIsRealtimeReady(false);
        setRealtimeError("Supabase is not configured.");
      }

      const savedType = window.localStorage.getItem(`spintra-room-type-${roomCode}`) as RoomType;
      if (savedType) {
        setRoomType(savedType);
        if (savedType !== "party" && savedType !== "classroom") {
          setActiveActivity({ type: savedType, state: null });
        }
      }

      const savedName = window.localStorage.getItem(`spintra-room-name-${roomCode}`);
      if (savedName) {
        setRoomName(savedName);
      }

      const savedLock = window.localStorage.getItem(`spintra-room-lock-${roomCode}`);
      if (savedLock) {
        setIsLocked(savedLock === "true");
      }
    });

    return () => {
      isMounted = false;
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

  useEffect(() => {
    activeActivityRef.current = activeActivity;
  }, [activeActivity]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    showParticipantsRef.current = showParticipants;
  }, [showParticipants]);

  useEffect(() => {
    isMobileSidebarOpenRef.current = isMobileSidebarOpen;
  }, [isMobileSidebarOpen]);

  const markMessageUnreadIfHidden = useCallback(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const chatIsVisible = isMobile
      ? isMobileSidebarOpenRef.current && !showParticipantsRef.current
      : !showParticipantsRef.current;
    if (!chatIsVisible) {
      setHasUnreadMessages(true);
    }
  }, []);

  const changeActivity = useCallback((type: string | null) => {
    const nextActivity = type ? { type, state: null } : null;
    setActiveActivity(nextActivity);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type: "ACTIVITY_CHANGE",
          payload: nextActivity,
          senderId: currentUser.id,
        });
      }
    } else {
      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.send({
          type: "broadcast",
          event: "activity_change",
          payload: nextActivity,
        });
      }
    }
  }, [currentUser.id]);

  const sendActivityEvent = useCallback((event: ActivityEvent) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type: "ACTIVITY_EVENT",
          payload: event,
          senderId: currentUser.id,
        });
      }
    } else {
      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.send({
          type: "broadcast",
          event: "activity_event",
          payload: event,
        });
      }
    }
  }, [currentUser.id]);



  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);



  const isLocalOnlyMode = getSupabaseBrowserClient() === null;
  const realtimeStatusLabel = realtimeError
    ? "Offline"
    : isRealtimeReady
    ? (isLocalOnlyMode ? "Live (this device only)" : "Live")
    : "Connecting...";
  const realtimeStatusClass = realtimeError
    ? "bg-red-500/10 text-red-300"
    : isRealtimeReady
    ? "bg-emerald-500/10 text-emerald-300"
    : "bg-amber-500/10 text-amber-300";

  // Local tab sync fallback via BroadcastChannel when Supabase is not configured
  useEffect(() => {
    if (!authReady) return;
    const supabase = getSupabaseBrowserClient();
    if (supabase) return;

    const channelName = `spintra_room_${roomCode}`;
    const bc = new BroadcastChannel(channelName);
    broadcastRef.current = bc;

    // Self registration row
    const selfParticipant: RoomParticipant = {
      id: `local_${currentUser.id}`,
      room_id: roomCode,
      user_id: currentUser.id,
      role: (localCreatorId === currentUser.id) ? "host" : "participant",
      is_online: true,
      joined_at: currentUser.created_at,
      user: currentUser,
    };

    // Deferred so this doesn't set state synchronously within the effect body.
    queueMicrotask(() => {
      setIsRealtimeReady(true);
      setRealtimeError(null);
      setNotification(null);
      setParticipants((prev) => {
        if (prev.some((p) => p.user_id === currentUser.id)) {
          return prev.map((p) => p.user_id === currentUser.id ? { ...p, is_online: true } : p);
        }
        return [...prev, selfParticipant];
      });
    });

    // Notify other tabs that we are online and request status updates
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
          // Send back our current participant row
          bc.postMessage({
            type: "PONG",
            payload: {
              id: `local_${currentUser.id}`,
              room_id: roomCode,
              user_id: currentUser.id,
              role: (localCreatorId === currentUser.id) ? "host" : "participant",
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
            setMessages((prev) => {
              if (isDuplicateMessage(prev, payload)) return prev;
              return [...prev, payload];
            });
            // A rare duplicate re-delivery here just flips a badge that's
            // already on; not worth extra plumbing to avoid.
            markMessageUnreadIfHidden();
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
            toast.error("You were removed from the room by the host.");
            router.push("/explore");
            return;
          }
          setParticipants((prev) => prev.filter((p) => p.user_id !== payload));
          break;

        case "ROOM_CLOSED":
          toast.error("The host closed this room.");
          router.push("/explore");
          break;

        case "HOST_PROMOTED":
          if (payload) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user_id === payload
                  ? { ...p, role: "host" }
                  : p.role === "host"
                  ? { ...p, role: "participant" }
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

              // Host promotion fallback if the host disconnects
              const hasOnlineHost = updated.some((p) => p.role === "host" && p.is_online);
              if (!hasOnlineHost) {
                const online = updated
                  .filter((p) => p.is_online)
                  .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
                if (online.length && online[0].user_id === currentUser.id) {
                  bc.postMessage({
                    type: "HOST_PROMOTED",
                    payload: currentUser.id,
                    senderId: currentUser.id,
                  });
                  toast.success("You are now the host.");
                  setNotification("The previous host left, and you have been promoted to host.");
                  return updated.map((p) =>
                    p.user_id === currentUser.id ? { ...p, role: "host" } : p
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
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("room_participants")
          .update({ is_online: false })
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .then();
      }
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
  }, [roomCode, currentUser, localCreatorId, router, markMessageUnreadIfHidden, authReady, handleActivityEvent]);

  const sendMessage = useCallback(async () => {
    if (isLocked && !isHost) {
      toast.error("The room is locked by the host.");
      return;
    }

    const trimmed = newMessage.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    const msg: ChatMessage = {
      id: generateUUID(),
      room_id: roomCode,
      user_id: currentUser.id,
      content: trimmed,
      created_at: new Date().toISOString(),
      user: currentUser,
    };

    setMessages((prev) => [...prev, msg]);
    setNewMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type: "CHAT",
          payload: msg,
          senderId: currentUser.id,
        });
      }
      return;
    }

    try {
      await supabase.from("chat_messages").insert({
        id: msg.id,
        room_id: roomCode,
        user_id: currentUser.id,
        content: msg.content,
        created_at: msg.created_at,
      });
    } catch (error) {
      console.error("Chat insert failed:", error);
      toast.error("Unable to send message. Please try again.");
    }
  }, [newMessage, currentUser, roomCode, isHost, isLocked]);

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`);
      setCopied(true);
      toast.success("Room link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy room link:", error);
      toast.error("Unable to copy link. Please copy it manually.");
    }
  };

  const toggleLock = () => {
    setIsLocked((prev) => {
      const nextValue = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`spintra-room-lock-${roomCode}`, nextValue.toString());
        if (broadcastRef.current) {
          broadcastRef.current.postMessage({
            type: "LOCK_CHANGE",
            payload: nextValue,
            senderId: currentUser.id,
          });
        }
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        supabase
          .from("rooms")
          .update({ is_locked: nextValue })
          .eq("code", roomCode)
          .then(({ error }) => {
            if (error) console.error("Failed to sync room lock state:", error);
          });
      }

      toast.success(nextValue ? "Room locked" : "Room unlocked");
      return nextValue;
    });
  };

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
          // The removed participant's own client picks this up via the DELETE
          // subscription on room_participants (see channel effect below).
        } catch (error) {
          console.error("Failed to remove participant:", error);
          toast.error("Unable to remove participant.");
          return;
        }
      } else if (broadcastRef.current) {
        broadcastRef.current.postMessage({
          type: "KICKED",
          payload: participant.user_id,
          senderId: currentUser.id,
        });
      }

      setParticipants((prev) => prev.filter((p) => p.user_id !== participant.user_id));
      toast.success(`Removed ${participant.user?.username || "participant"} from the room.`);
    },
    [isHost, currentUser.id, roomCode]
  );

  const handleCloseRoom = useCallback(async () => {
    if (!isHost) return;
    setIsClosingRoom(true);
    closingRoomRef.current = true;

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      try {
        // Deleting the room row is the single source of truth: every other
        // participant's client picks it up via the "rooms" DELETE subscription
        // below, and a DB trigger (see migrations) cascades the delete to that
        // room's participants/messages rows since they aren't linked by a
        // foreign key.
        const { error } = await supabase.from("rooms").delete().eq("code", roomCode);
        if (error) throw error;
      } catch (error) {
        console.error("Failed to close room:", error);
        toast.error("Unable to close the room. Please try again.");
        setIsClosingRoom(false);
        closingRoomRef.current = false;
        return;
      }
    } else if (broadcastRef.current) {
      broadcastRef.current.postMessage({ type: "ROOM_CLOSED", senderId: currentUser.id });
    }

    toast.success("Room closed for everyone.");
    router.push("/explore");
  }, [isHost, roomCode, currentUser.id, router]);

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

      // 1. Promote our participant row to 'host'
      const { error: partError } = await supabase
        .from("room_participants")
        .update({ role: "host" })
        .eq("room_id", roomCode)
        .eq("user_id", currentUser.id);

      if (partError) {
        console.error("Failed to elect participant as host in database:", partError);
        return;
      }

      // 2. Update rooms table host_id to match the new host
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ host_id: currentUser.id })
        .eq("code", roomCode);

      if (roomError) {
        console.error("Failed to update rooms host_id in database:", roomError);
      } else {
        setRoomHostId(currentUser.id);
        setParticipants((prev) =>
          prev.map((participant) =>
            participant.user_id === currentUser.id
              ? { ...participant, role: "host" }
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

  useEffect(() => {
    if (!authReady) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

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

          // Self-healing presence logic: if we are host, update any crashed participants to is_online = false in the DB
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
                  .in("user_id", crashed.map((p) => p.user_id))
                  .eq("room_id", roomCode)
                  .then();
              }
            }
          }

          return updated;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomCode}` }, (payload) => {
        const incoming = payload.new as ChatMessage;
        setMessages((prev) => {
          if (isDuplicateMessage(prev, incoming)) {
            return prev;
          }
          return [...prev, incoming];
        });
        if (incoming.user_id !== currentUser.id) {
          markMessageUnreadIfHidden();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_participants", filter: `room_id=eq.${roomCode}` }, (payload) => {
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
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_participants", filter: `room_id=eq.${roomCode}` }, (payload) => {
        const newParticipant = payload.new as RoomParticipant;
        setParticipants((prev) => {
          if (prev.some((participant) => participant.id === newParticipant.id)) {
            return prev;
          }
          const next = [...prev, newParticipant];
          electHostIfNeeded(supabase, next);
          return next;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_participants", filter: `room_id=eq.${roomCode}` }, (payload) => {
        const removed = payload.old as { id: string; user_id?: string };
        setParticipants((prev) => {
          const selfParticipant = prev.find((p) => p.user_id === currentUser.id);
          const isSelf = (selfParticipant && selfParticipant.id === removed.id) || (removed.user_id === currentUser.id);
          if (isSelf) {
            setTimeout(() => {
              toast.error("You were removed from the room by the host.");
              router.push("/explore");
            }, 0);
            return prev;
          }
          const next = prev.filter((participant) => participant.id !== removed.id);
          electHostIfNeeded(supabase, next);
          return next;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${roomCode}` }, (payload) => {
        const updated = payload.new as { name?: string; type?: RoomType; is_locked?: boolean; max_participants?: number; host_id?: string };
        if (updated.name) setRoomName(updated.name);
        if (updated.type) setRoomType(updated.type);
        if (typeof updated.is_locked === "boolean") setIsLocked(updated.is_locked);
        if (typeof updated.max_participants === "number") setMaxParticipantsLimit(updated.max_participants);
        if (updated.host_id) setRoomHostId(updated.host_id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "rooms", filter: `code=eq.${roomCode}` }, () => {
        // The host's own client already redirected itself in handleCloseRoom;
        // this subscription is what tells everyone else the room is gone.
        if (closingRoomRef.current) return;
        toast.error("The host closed this room.");
        router.push("/explore");
      })
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
        // If we are host, broadcast current active activity to anyone else
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
  }, [roomCode, electHostIfNeeded, currentUser.id, router, markMessageUnreadIfHidden, authReady, handleActivityEvent]);

  useEffect(() => {
    if (!authReady) return;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);
    const supabase = getSupabaseBrowserClient();
    if (supabase && !isUUID) return;

    let isMounted = true;

    const loadParticipants = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return;
        }

        const { data, error } = await supabase
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
              username: item.username,
              avatar_url: item.avatar_url,
              xp: item.xp ?? 0,
              rank: item.rank as User["rank"],
              created_at: item.joined_at,
            },
          }));

          setParticipants(loadedParticipants);
          await electHostIfNeeded(supabase, loadedParticipants);
        }
      } catch (cause) {
        console.error("Participant load failed:", cause);
      }
    };

    const markSelfOffline = () => {
      // With Realtime Presence, database-level offline writes on page unload are obsolete.
      // Connection closure is handled automatically by the server-side presence heartbeat timeout.
    };

    const trackSelf = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;

        const { data: existingRow } = await supabase
          .from("room_participants")
          .select("id, role")
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        const { data: roomRow } = await supabase
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

        // Only new joiners are subject to the lock/capacity check — participants
        // already tracked (e.g. reconnecting) should always be able to rejoin.
        if (!existingRow) {
          if (roomRow.is_locked && !isRoomHost) {
            if (isMounted) {
              toast.error("This room is locked by the host.");
              router.push("/explore");
            }
            return;
          }

          if (typeof roomRow.max_participants === "number") {
            const { count } = await supabase
              .from("room_participants")
              .select("id", { count: "exact", head: true })
              .eq("room_id", roomCode)
              .eq("is_online", true);

            if ((count ?? 0) >= roomRow.max_participants) {
              if (isMounted) {
                toast.error("This room is full.");
                router.push("/explore");
              }
              return;
            }
          }
        }

        const role = isRoomHost ? ("host" as const) : ("participant" as const);
        const joined_at = new Date().toISOString();
        let upsertResult = await supabase
          .from("room_participants")
          .upsert(
            {
              room_id: roomCode,
              user_id: currentUser.id,
              role,
              is_online: true,
              joined_at,
              username: currentUser.username,
              avatar_url: currentUser.avatar_url,
              xp: currentUser.xp,
              rank: currentUser.rank,
            },
            { onConflict: "room_id,user_id" }
          )
          .select("id, room_id, user_id, role, is_online, joined_at, username, avatar_url, xp, rank");

        // Graceful fallback: if another user was elected host in a concurrent request,
        // retry registration as a regular participant.
        if (upsertResult.error && upsertResult.error.message?.includes("already has an online host")) {
          console.warn("Host election conflict detected. Retrying registration as regular participant.");
          upsertResult = await supabase
            .from("room_participants")
            .upsert(
              {
                room_id: roomCode,
                user_id: currentUser.id,
                role: "participant",
                is_online: true,
                joined_at,
                username: currentUser.username,
                avatar_url: currentUser.avatar_url,
                xp: currentUser.xp,
                rank: currentUser.rank,
              },
              { onConflict: "room_id,user_id" }
            )
            .select("id, room_id, user_id, role, is_online, joined_at, username, avatar_url, xp, rank");
        }

        const { data, error } = upsertResult;

        if (error) {
          console.error("Failed to register participant:", error.message, "Details:", error.details, "Code:", error.code, "User ID:", currentUser.id);
          return;
        }

        const participantRow = data?.[0];
        if (participantRow) {
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
      } catch (cause) {
        console.error("Failed to register participant:", cause);
      }
    };

    const loadRoomDetails = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;
        const { data, error } = await supabase
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

    loadRoomDetails();
    loadParticipants();
    trackSelf();

    if (typeof window !== "undefined") {
      const handleUnload = () => {
        markSelfOffline();
      };

      window.addEventListener("beforeunload", handleUnload);
      window.addEventListener("pagehide", handleUnload);

      return () => {
        isMounted = false;
        window.removeEventListener("beforeunload", handleUnload);
        window.removeEventListener("pagehide", handleUnload);
        markSelfOffline();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [roomCode, currentUser, electHostIfNeeded, localCreatorId, router, authReady]);

  useEffect(() => {
    if (!authReady) return;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);
    const supabase = getSupabaseBrowserClient();
    if (supabase && !isUUID) return;

    let isMounted = true;

    const loadMessages = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;

        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, room_id, user_id, content, created_at")
          .eq("room_id", roomCode)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("Failed to load chat messages:", error);
          if (isMounted) toast.error("Couldn't load chat history. Try refreshing the page.");
          return;
        }

        if (isMounted && data) {
          const formattedMessages = data.map((item) => ({
            ...item,
            user: {
              id: item.user_id,
              username: item.user_id === currentUser.id ? "You" : "Guest",
              avatar_url: "",
              xp: 0,
              rank: "rookie" as const,
              created_at: item.created_at,
            },
          }));
          formattedMessages.reverse();
          setMessages(formattedMessages);
        }
      } catch (cause) {
        console.error("Message load failed:", cause);
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [roomCode, currentUser.id, authReady]);

  const sidebarContent = (
    <div className="flex-1 flex flex-col h-full bg-background/50 backdrop-blur-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/5 shrink-0">
        <button
          onClick={() => {
            setShowParticipants(false);
            setHasUnreadMessages(false);
          }}
          className={`relative flex-1 py-3 text-sm font-medium transition-colors ${!showParticipants ? "text-white border-b-2 border-purple-500" : "text-muted-foreground"}`}
        >
          <span className="relative inline-flex">
            <MessageCircle className="w-4 h-4" />
            {hasUnreadMessages && (
              <span
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500"
                aria-hidden="true"
              />
            )}
          </span>
          <span className="ml-2">Chat</span>
          {hasUnreadMessages && <span className="sr-only"> (new messages)</span>}
        </button>
        <button
          onClick={() => setShowParticipants(true)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${showParticipants ? "text-white border-b-2 border-purple-500" : "text-muted-foreground"}`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          People ({participants.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!showParticipants ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col overflow-hidden h-full"
          >
            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4 overflow-y-auto">
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const participant = participants.find((p) => p.user_id === msg.user_id);
                    const username = msg.user_id === currentUser.id 
                      ? "You" 
                      : (participant?.user?.username || msg.user?.username || "Guest");
                    const initials = username.slice(0, 2).toUpperCase() || "??";
                    const isMsgHost = participant?.role === "host";

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="flex gap-3"
                      >
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-cyan-500 text-white">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {username}
                            </span>
                            {isMsgHost && (
                              <Crown className="w-3 h-3 text-amber-400" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{renderTextWithEmoji(msg.content)}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Emoji bar */}
            <AnimatePresence>
              {showEmojis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="px-4 py-2 border-t border-white/5 flex gap-1 shrink-0"
                >
                  {REACTION_NAMES.map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setNewMessage((prev) => prev + EMOJI_UNICODE[name]);
                        setShowEmojis(false);
                      }}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Emoji name={name} size={22} />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-4 border-t border-white/5 shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  maxLength={MAX_MESSAGE_LENGTH}
                  className="flex-1"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={<Button variant="ghost" size="icon" onClick={() => setShowEmojis(!showEmojis)} aria-label="Insert emoji" />}
                  >
                    <Smile className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>Insert emoji</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={<Button size="icon" onClick={sendMessage} className="bg-purple-600 hover:bg-purple-500" aria-label="Send message" />}
                  >
                    <Send className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>Send message</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="participants"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 overflow-hidden h-full"
          >
            <ScrollArea className="h-full px-4 py-4 overflow-y-auto">
              <div className="space-y-1">
                <AnimatePresence initial={false}>
                  {participants.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="relative">
                        <Avatar className="w-9 h-9">
                          <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-cyan-500 text-white">
                            {p.user?.username?.slice(0, 2).toUpperCase() || "??"}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                            p.is_online ? "bg-emerald-400" : "bg-zinc-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {p.user_id === currentUser.id ? "You" : p.user?.username}
                          </span>
                          {p.role === "host" && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">{p.role}</span>
                      </div>
                      {isHost && p.user_id !== currentUser.id && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleKickParticipant(p)}
                                aria-label={`Remove ${p.user?.username || "participant"} from the room`}
                              />
                            }
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>Remove from room</TooltipContent>
                        </Tooltip>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const stableContextValue = useMemo(() => ({
    roomCode,
    roomType,
    isHost,
    currentUser,
    sendActivityEvent,
    registerEventListener,
    soundEnabled,
  }), [roomCode, roomType, isHost, currentUser, sendActivityEvent, registerEventListener, soundEnabled]);

  const dynamicContextValue = useMemo(() => ({
    participants,
  }), [participants]);

  const ActiveGame = activeActivity?.type
    ? (ACTIVITY_REGISTRY[activeActivity.type] ?? null)
    : null;

  return (
    <div className="min-h-screen pt-16 flex flex-col md:flex-row">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Room Header */}
        <div className="glass border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">{roomName}</h1>
                <Badge className={`text-xs ${realtimeStatusClass}`}>
                  <Wifi className="w-3 h-3 mr-1" />
                  {realtimeStatusLabel}
                </Badge>
                {isLocked && (
                  <Badge className="text-xs bg-amber-500/10 text-amber-300">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span>Code: <span className="font-mono text-purple-400 select-all font-semibold uppercase">{roomCode}</span></span>
                <span>·</span>
                <span>
                  {participants.filter((p) => p.is_online).length}
                  {maxParticipantsLimit ? ` / ${maxParticipantsLimit}` : ""} online
                </span>
                {activeActivity && (
                  <>
                    <span>·</span>
                    <span className="text-purple-400 capitalize">{activeActivity.type.replace(/-/g, " ")}</span>
                  </>
                )}
              </div>
              {(realtimeError || notification) && (
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-sm transition-all ${
                    realtimeError
                      ? "border-red-500/20 bg-red-500/10 text-red-200"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                  }`}
                >
                  {realtimeError || notification}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={copyRoomLink} aria-label="Copy room link" />}>
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </TooltipTrigger>
                <TooltipContent>{copied ? "Link copied!" : "Copy room link"}</TooltipContent>
              </Tooltip>
              {isHost && (
                <>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={toggleLock} aria-label="Toggle room lock state" />}>
                      {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
                    </TooltipTrigger>
                    <TooltipContent>{isLocked ? "Unlock room (allow new joins)" : "Lock room (block new joins)"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsCloseRoomDialogOpen(true)}
                          aria-label="Close room for everyone"
                          className="text-red-400 hover:text-red-300"
                        />
                      }
                    >
                      <DoorClosed className="w-4 h-4" />
                    </TooltipTrigger>
                    <TooltipContent>Close room for everyone</TooltipContent>
                  </Tooltip>
                  {(roomType === "party" || roomType === "classroom") && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsPickerOpen(true)}
                            aria-label="Switch game activity"
                            className="text-purple-400"
                          />
                        }
                      >
                        <Shuffle className="w-4 h-4" />
                      </TooltipTrigger>
                      <TooltipContent>Switch game activity</TooltipContent>
                    </Tooltip>
                  )}
                  {activeActivity && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              sendActivityEvent({ kind: "activity_reset" });
                              handleActivityEvent({ kind: "activity_reset" });
                              if (roomType === "party" || roomType === "classroom") {
                                changeActivity(null);
                              }
                            }}
                            aria-label="Reset current activity"
                            className="text-red-400"
                          />
                        }
                      >
                        <RotateCcw className="w-4 h-4" />
                      </TooltipTrigger>
                      <TooltipContent>End current activity</TooltipContent>
                    </Tooltip>
                  )}
                </>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (typeof window !== "undefined" && window.innerWidth < 768) {
                          setIsMobileSidebarOpen(true);
                          if (!showParticipants) setHasUnreadMessages(false);
                        } else {
                          setShowParticipants(!showParticipants);
                          if (showParticipants) setHasUnreadMessages(false);
                        }
                      }}
                      aria-label="Toggle chat and participants sidebar"
                    />
                  }
                >
                  <Users className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent>Chat & participants</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleSound}
                      aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
                      className="text-muted-foreground hover:text-white"
                    />
                  }
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-purple-400" /> : <VolumeX className="w-4 h-4" />}
                </TooltipTrigger>
                <TooltipContent>{soundEnabled ? "Mute sounds" : "Unmute sounds"}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <RoomActivityContext.Provider value={stableContextValue}>
            <RoomParticipantsContext.Provider value={dynamicContextValue}>
            <AnimatePresence mode="wait">
              {/* ── Activity Picker (party / classroom hosts) ── */}
              {isPickerOpen && isHost && (
                <ActivityPickerDialog
                  key="picker"
                  activeActivityType={activeActivity?.type}
                  onClose={() => setIsPickerOpen(false)}
                  onSelect={(type) => {
                    changeActivity(type);
                    setIsPickerOpen(false);
                  }}
                />
              )}

              {/* ── No Activity Selected ── */}
              {!activeActivity && (
                <IdleScreen key="idle" isHost={isHost} onChooseActivity={() => setIsPickerOpen(true)} />
              )}

              {/* ── Active Game from Plugin Registry ── */}
              {activeActivity && activeActivity.type !== "party" && activeActivity.type !== "classroom" && ActiveGame && (
                <ErrorBoundary key={activeActivity.type} fallback={
                  <div className="glass-card p-8 rounded-2xl text-center border border-red-500/20 max-w-md mx-auto mt-8">
                    <p className="text-xl font-bold text-red-400 mb-2">Something went wrong</p>
                    <p className="text-sm text-muted-foreground">The activity crashed or failed to load. Try picking a different activity.</p>
                  </div>
                }>
                  <ActiveGame />
                </ErrorBoundary>
              )}

              {/* ── PARTY / CLASSROOM with no sub-activity ── */}
              {(activeActivity?.type === "party" || activeActivity?.type === "classroom") && (
                <AggregateIdleScreen key="aggregate-idle" activityType={activeActivity.type} isHost={isHost} />
              )}
            </AnimatePresence>
            </RoomParticipantsContext.Provider>
          </RoomActivityContext.Provider>
        </div>
      </div>

      {/* Desktop Sidebar - Chat & Participants */}
      <div className="hidden md:flex md:w-80 md:border-l md:border-white/5 md:flex-col md:bg-background/50 md:backdrop-blur-sm">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Slide-over Drawer */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="right" className="p-0 w-80 bg-background border-l border-white/5 flex flex-col h-full">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Close Room confirmation */}
      <Dialog open={isCloseRoomDialogOpen} onOpenChange={setIsCloseRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this room?</DialogTitle>
            <DialogDescription>
              {`Everyone still here will be disconnected and sent back to Explore, and the chat history for this room will be permanently deleted. The room code ${roomCode} will stop working. This can't be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseRoomDialogOpen(false)} disabled={isClosingRoom}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseRoom}
              disabled={isClosingRoom}
            >
              {isClosingRoom ? "Closing..." : "Close room for everyone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
