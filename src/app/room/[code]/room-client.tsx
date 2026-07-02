"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Send, Crown, MessageCircle, Lock, Unlock,
  Sparkles, Copy, Check, Smile, UserX, Wifi, X,
  Target, Shuffle, RotateCcw, DoorClosed,
  Coins, ArrowUp, ArrowDown, Swords, ShieldAlert,
  MessageCircleQuestion, Split, HeartHandshake, Eye
} from "lucide-react";
import { GAMES } from "@/lib/games";
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
import Image from "next/image";
import type { User, ChatMessage, RoomParticipant, RoomType } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOrCreateRoomUser, getLocalRoomCreatorId } from "@/lib/room-user";
import type { RealtimeChannel } from "@supabase/supabase-js";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const REACTION_NAMES = [
  "thumbs_up", "red_heart", "face_with_tears_of_joy", "party_popper",
  "fire", "hundred_points", "eyes", "raising_hands",
] as const;
const RPS_EMOJI = { Rock: "raised_fist", Paper: "raised_hand", Scissors: "victory_hand" } as const;

// Activity events carry different fields per game kind (coin flip, dice roll,
// guess submit, ...) — narrowed with `kind` checks where consumed rather than
// a full discriminated union, since the payload just crosses the wire as-is.
type ActivityEvent = Record<string, unknown> & { kind: string };

function isDuplicateMessage(messages: ChatMessage[], candidate: ChatMessage) {
  // `id` catches exact re-deliveries of the same DB row (e.g. resync after reconnect).
  // The composite fallback is still needed because the optimistic local echo is
  // assigned a client-generated id that never reaches the database (see sendMessage).
  return messages.some(
    (message) =>
      message.id === candidate.id ||
      (message.user_id === candidate.user_id &&
        message.created_at === candidate.created_at &&
        message.content === candidate.content)
  );
}

const MAX_MESSAGE_LENGTH = 500;

export default function RoomClient({ code: roomCode }: { code: string }) {
  const router = useRouter();
  const [currentUser] = useState<User>(getOrCreateRoomUser);
  const [maxParticipantsLimit, setMaxParticipantsLimit] = useState<number | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [localCreatorId] = useState<string | null>(() => {
    return getLocalRoomCreatorId(roomCode);
  });

  const [roomType, setRoomType] = useState<RoomType>(() => {
    if (typeof window === "undefined") return "party";
    return (window.localStorage.getItem(`spintra-room-type-${roomCode}`) as RoomType) || "party";
  });
  const [roomName, setRoomName] = useState<string>(() => {
    if (typeof window === "undefined") return "Game Room";
    return window.localStorage.getItem(`spintra-room-name-${roomCode}`) || "Game Room";
  });
  const [activeActivity, setActiveActivity] = useState<{
    type: string;
    state: unknown;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const initialType = window.localStorage.getItem(`spintra-room-type-${roomCode}`) || "party";
    if (initialType !== "party" && initialType !== "classroom") {
      return { type: initialType, state: null };
    }
    return null;
  });
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Sub-game states for real-time synchronization
  const [coinResult, setCoinResult] = useState<"Heads" | "Tails" | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);

  const [diceResults, setDiceResults] = useState<number[]>([]);
  const [diceRolling, setDiceRolling] = useState(false);

  const [wheelEntries, setWheelEntries] = useState<string[]>(["Option 1", "Option 2", "Option 3"]);
  const [newWheelEntryText, setNewWheelEntryText] = useState("");
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelSpinAngle, setWheelSpinAngle] = useState(1440);

  const [guessHistory, setGuessHistory] = useState<{ username: string; guess: number; hint: string }[]>([]);
  const [guessSecretNumber, setGuessSecretNumber] = useState(50);

  const [todPrompt, setTodPrompt] = useState<{ type: string; text: string } | null>(null);

  const [wyrPrompt, setWyrPrompt] = useState<{ a: string; b: string } | null>(null);
  const [wyrVotes, setWyrVotes] = useState<Record<string, { username: string; option: "A" | "B" }>>({});

  const [nhiePrompt, setNhiePrompt] = useState<string | null>(null);
  const [nhieConfessions, setNhieConfessions] = useState<Record<string, { username: string; choice: "have" | "never" }>>({});

  const [rpsChoices, setRpsChoices] = useState<Record<string, { username: string; choice: string }>>({});

  const [tmTeams, setTmTeams] = useState<{ name: string; members: string[] }[]>([]);

  const [ndWinner, setNdWinner] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [newMessage, setNewMessage] = useState("");
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const savedLock = window.localStorage.getItem(`spintra-room-lock-${roomCode}`);
    return savedLock === "true";
  });
  const [showEmojis, setShowEmojis] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isRealtimeReady, setIsRealtimeReady] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    const supabase = getSupabaseBrowserClient();
    return supabase ? null : false;
  });
  const [realtimeError, setRealtimeError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const supabase = getSupabaseBrowserClient();
    return supabase ? null : "Supabase is not configured.";
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [isCloseRoomDialogOpen, setIsCloseRoomDialogOpen] = useState(false);
  const [isClosingRoom, setIsClosingRoom] = useState(false);

  const isHost =
    participants.some((p) => p.user_id === currentUser.id && p.role === "host" && p.is_online) ||
    localCreatorId === currentUser.id;

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const onActivityEventRef = useRef<((event: ActivityEvent) => void) | null>(null);
  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const closingRoomRef = useRef(false);
  const activeActivityRef = useRef(activeActivity);
  const isHostRef = useRef(isHost);
  const showParticipantsRef = useRef(showParticipants);
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

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

  const syncWheelEntries = useCallback(
    (entries: string[]) => {
      setWheelEntries(entries);
      sendActivityEvent({ kind: "wheel_entries", entries });
    },
    [sendActivityEvent]
  );

  const addWheelEntry = useCallback(() => {
    const label = newWheelEntryText.trim();
    if (!label) return;
    syncWheelEntries([...wheelEntries, label].slice(0, 12));
    setNewWheelEntryText("");
  }, [newWheelEntryText, wheelEntries, syncWheelEntries]);

  const removeWheelEntry = useCallback(
    (index: number) => {
      if (wheelEntries.length <= 2) {
        toast.error("The wheel needs at least 2 options.");
        return;
      }
      syncWheelEntries(wheelEntries.filter((_, i) => i !== index));
    },
    [wheelEntries, syncWheelEntries]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Wire up the activity event dispatcher for incoming real-time events.
  // Payload shape varies per activity kind (~20 cases below); typing this as
  // a full discriminated union is a larger refactor than this pass covers, so
  // the dynamic field access is scoped to this one handler.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onActivityEventRef.current = (event: any) => {
      const { kind } = event;
      switch (kind) {
        case "coin_flip":
          setCoinResult(event.result);
          setCoinFlipping(false);
          break;
        case "coin_flipping":
          setCoinFlipping(true);
          break;
        case "dice_roll":
          setDiceResults(event.results);
          setDiceRolling(false);
          break;
        case "dice_rolling":
          setDiceRolling(true);
          break;
        case "wheel_spin":
          setWheelWinner(event.winner);
          setWheelSpinning(false);
          break;
        case "wheel_spinning":
          setWheelSpinAngle(1440 + Math.random() * 360);
          setWheelSpinning(true);
          break;
        case "wheel_entries":
          setWheelEntries(event.entries);
          break;
        case "guess_submit":
          setGuessHistory((prev) => [...prev, { username: event.username, guess: event.guess, hint: event.hint }]);
          break;
        case "guess_reset":
          setGuessHistory([]);
          setGuessSecretNumber(event.secret);
          break;
        case "tod_prompt":
          setTodPrompt({ type: event.promptType, text: event.text });
          break;
        case "wyr_prompt":
          setWyrPrompt({ a: event.a, b: event.b });
          setWyrVotes({});
          break;
        case "wyr_vote":
          setWyrVotes((prev) => ({ ...prev, [event.userId]: { username: event.username, option: event.option } }));
          break;
        case "nhie_prompt":
          setNhiePrompt(event.text);
          setNhieConfessions({});
          break;
        case "nhie_confess":
          setNhieConfessions((prev) => ({ ...prev, [event.userId]: { username: event.username, choice: event.choice } }));
          break;
        case "rps_choice":
          setRpsChoices((prev) => ({ ...prev, [event.userId]: { username: event.username, choice: event.choice } }));
          break;
        case "rps_reset":
          setRpsChoices({});
          break;
        case "tm_teams":
          setTmTeams(event.teams);
          break;
        case "nd_winner":
          setNdWinner(event.winner);
          break;
        case "activity_reset":
          setCoinResult(null);
          setDiceResults([]);
          setWheelWinner(null);
          setGuessHistory([]);
          setTodPrompt(null);
          setWyrPrompt(null);
          setWyrVotes({});
          setNhiePrompt(null);
          setNhieConfessions({});
          setRpsChoices({});
          setTmTeams([]);
          setNdWinner(null);
          break;
      }
    };
  }, []);

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
          if (payload && onActivityEventRef.current) {
            onActivityEventRef.current(payload);
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
  }, [roomCode, currentUser, localCreatorId, router, markMessageUnreadIfHidden]);

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
      id: generateId(),
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

      const { error } = await supabase
        .from("room_participants")
        .update({ role: "host" })
        .eq("room_id", roomCode)
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("Failed to elect host:", error);
      } else {
        setParticipants((prev) =>
          prev.map((participant) =>
            participant.user_id === currentUser.id
              ? { ...participant, role: "host" }
              : participant
          )
        );
        toast.success("You are now the host.");
        setNotification("The previous host left, and you have been promoted to host.");
      }
    },
    [currentUser.id, roomCode]
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`room:${roomCode}`)
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
        const removed = payload.old as RoomParticipant;
        if (removed.user_id === currentUser.id) {
          toast.error("You were removed from the room by the host.");
          router.push("/explore");
          return;
        }
        setParticipants((prev) => {
          const next = prev.filter((participant) => participant.id !== removed.id);
          electHostIfNeeded(supabase, next);
          return next;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${roomCode}` }, (payload) => {
        const updated = payload.new as { name?: string; type?: RoomType; is_locked?: boolean; max_participants?: number };
        if (updated.name) setRoomName(updated.name);
        if (updated.type) setRoomType(updated.type);
        if (typeof updated.is_locked === "boolean") setIsLocked(updated.is_locked);
        if (typeof updated.max_participants === "number") setMaxParticipantsLimit(updated.max_participants);
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
        if (payload && onActivityEventRef.current) {
          onActivityEventRef.current(payload);
        }
      });

    supabaseChannelRef.current = channel;

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        setIsRealtimeReady(true);
        setRealtimeError(null);
        setNotification(null);
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
  }, [roomCode, electHostIfNeeded, currentUser.id, router, markMessageUnreadIfHidden]);

  useEffect(() => {
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

    const determineRole = async (supabase: ReturnType<typeof getSupabaseBrowserClient> | null) => {
      if (!supabase) return "participant" as const;

      const { data, error } = await supabase
        .from("room_participants")
        .select("user_id")
        .eq("room_id", roomCode)
        .eq("role", "host")
        .eq("is_online", true)
        .limit(1);

      if (error) {
        console.error("Failed to determine room host:", error);
        return "participant" as const;
      }

      if (data && data.length > 0) {
        return data[0].user_id === currentUser.id ? ("host" as const) : ("participant" as const);
      }

      return "host" as const;
    };

    const markSelfOffline = () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      supabase.from("room_participants").update({ is_online: false }).eq("room_id", roomCode).eq("user_id", currentUser.id);
    };

    const trackSelf = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;

        const { data: existingRow } = await supabase
          .from("room_participants")
          .select("id")
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        // Only new joiners are subject to the lock/capacity check — participants
        // already tracked (e.g. reconnecting) should always be able to rejoin.
        if (!existingRow) {
          const { data: roomRow } = await supabase
            .from("rooms")
            .select("is_locked, max_participants, host_id")
            .eq("code", roomCode)
            .maybeSingle();

          if (roomRow) {
            const isRoomHost = roomRow.host_id === currentUser.id || localCreatorId === currentUser.id;

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
        }

        const role = await determineRole(supabase);
        const joined_at = new Date().toISOString();
        const { data, error } = await supabase
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

        if (error) {
          console.error("Failed to register participant:", error);
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
          .select("name, type, is_locked, max_participants")
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
  }, [roomCode, currentUser, electHostIfNeeded, localCreatorId, router]);

  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;

        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, room_id, user_id, content, created_at")
          .eq("room_id", roomCode)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Failed to load chat messages:", error);
          if (isMounted) toast.error("Couldn't load chat history. Try refreshing the page.");
          return;
        }

        if (isMounted && data) {
          setMessages(
            data.map((item) => ({
              ...item,
              user: {
                id: item.user_id,
                username: item.user_id === currentUser.id ? "You" : "Guest",
                avatar_url: "",
                xp: 0,
                rank: "rookie",
                created_at: item.created_at,
              },
            }))
          );
        }
      } catch (cause) {
        console.error("Message load failed:", cause);
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [roomCode, currentUser.id]);

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
                {messages.map((msg) => {
                  const participant = participants.find((p) => p.user_id === msg.user_id);
                  const username = msg.user_id === currentUser.id 
                    ? "You" 
                    : (participant?.user?.username || msg.user?.username || "Guest");
                  const initials = username.slice(0, 2).toUpperCase() || "??";
                  const isMsgHost = participant?.role === "host";

                  return (
                    <div key={msg.id} className="flex gap-3">
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
                    </div>
                  );
                })}
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
                {participants.map((p) => (
                  <div
                    key={p.id}
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
                  </div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

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
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>Room #{roomCode}</span>
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
                              if (onActivityEventRef.current) onActivityEventRef.current({ kind: "activity_reset" });
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
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ── Activity Picker (party / classroom hosts) ── */}
            {isPickerOpen && isHost && (
              <motion.div
                key="picker"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setIsPickerOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                      className="glass-card p-6 w-full max-w-lg rounded-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Choose an Activity
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {GAMES.filter((g) => g.type !== "party" && g.type !== "classroom").map((g) => {
                      const Icon = g.icon;
                      return (
                        <button
                          key={g.type}
                          onClick={() => {
                            changeActivity(g.type);
                            setIsPickerOpen(false);
                          }}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm font-medium hover:border-purple-500/50 hover:bg-purple-500/10 ${
                            activeActivity?.type === g.type
                              ? "border-purple-500 bg-purple-500/20 text-purple-300"
                              : "border-white/10 text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                          <span>{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── No Activity Selected ── */}
            {!activeActivity && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-center min-h-[400px]"
              >
                <div className="text-center glass-card p-12 max-w-md w-full">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden"
                  >
                    <Image src="/icons/logo.png" alt="Spintra" width={80} height={80} className="w-full h-full object-cover" />
                  </motion.div>
                  {isHost ? (
                    <>
                      <h2 className="text-2xl font-bold mb-2">You are the Host</h2>
                      <p className="text-muted-foreground mb-6">
                        Pick an activity to play with your room. Participants will see it automatically.
                      </p>
                      <Button
                        onClick={() => setIsPickerOpen(true)}
                        className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0"
                      >
                        <Shuffle className="w-4 h-4 mr-2" />
                        Choose Activity
                      </Button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold mb-2">Waiting for Host</h2>
                      <p className="text-muted-foreground">
                        The host will start an activity soon. Chat with participants while you wait!
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/* ── COIN FLIP ── */}
            {activeActivity?.type === "coin-flip" && (
              <motion.div
                key="coin-flip"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-8 max-w-sm mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Coins className="w-6 h-6 text-amber-400" /> Coin Flip
                </h2>
                <motion.div
                  animate={coinFlipping ? { rotateY: [0, 720], scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className={`w-36 h-36 rounded-full flex items-center justify-center text-5xl font-black shadow-2xl border-4 ${
                    coinResult === "Heads"
                      ? "bg-gradient-to-br from-amber-400 to-yellow-600 border-amber-500 text-white"
                      : coinResult === "Tails"
                      ? "bg-gradient-to-br from-slate-400 to-slate-600 border-slate-500 text-white"
                      : "bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border-white/20 text-white/40"
                  }`}
                >
                  {coinResult === "Heads" ? "H" : coinResult === "Tails" ? "T" : "?"}
                </motion.div>
                {coinResult && (
                  <motion.p
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-3xl font-bold text-amber-400"
                  >
                    {coinResult}!
                  </motion.p>
                )}
                {isHost && (
                  <Button
                    disabled={coinFlipping}
                    onClick={() => {
                      sendActivityEvent({ kind: "coin_flipping" });
                      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "coin_flipping" });
                      setTimeout(() => {
                        const result = Math.random() < 0.5 ? "Heads" : "Tails";
                        sendActivityEvent({ kind: "coin_flip", result });
                        if (onActivityEventRef.current) onActivityEventRef.current({ kind: "coin_flip", result });
                      }, 1300);
                    }}
                    className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white border-0 w-full"
                  >
                    {coinFlipping ? "Flipping…" : "Flip Coin"}
                  </Button>
                )}
                {!isHost && !coinResult && (
                  <p className="text-muted-foreground text-sm">Waiting for host to flip…</p>
                )}
              </motion.div>
            )}

            {/* ── DICE ROLLER ── */}
            {activeActivity?.type === "dice" && (
              <motion.div
                key="dice"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2"><Emoji name="game_die" size={28} /> Dice Roller</h2>
                <div className="flex flex-wrap gap-4 justify-center">
                  {(diceResults.length > 0 ? diceResults : [0]).map((val, i) => (
                    <motion.div
                      key={i}
                      animate={diceRolling ? { rotate: [0, 180, 360], scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-4xl font-black text-white shadow-xl border border-purple-500/50"
                    >
                      {val === 0 ? "?" : ["⚀","⚁","⚂","⚃","⚄","⚅"][val - 1]}
                    </motion.div>
                  ))}
                </div>
                {diceResults.length > 1 && (
                  <p className="text-lg font-semibold text-purple-300">
                    Total: {diceResults.reduce((a, b) => a + b, 0)}
                  </p>
                )}
                {isHost && (
                  <div className="flex gap-3 flex-wrap justify-center">
                    {[1, 2, 4].map((count) => (
                      <Button
                        key={count}
                        disabled={diceRolling}
                        onClick={() => {
                          sendActivityEvent({ kind: "dice_rolling" });
                          if (onActivityEventRef.current) onActivityEventRef.current({ kind: "dice_rolling" });
                          setTimeout(() => {
                            const results = Array.from({ length: count }, () => Math.ceil(Math.random() * 6));
                            sendActivityEvent({ kind: "dice_roll", results });
                            if (onActivityEventRef.current) onActivityEventRef.current({ kind: "dice_roll", results });
                          }, 900);
                        }}
                        variant="outline"
                        className="border-purple-500/50 hover:bg-purple-500/20"
                      >
                        Roll {count}d6
                      </Button>
                    ))}
                  </div>
                )}
                {!isHost && diceResults.length === 0 && (
                  <p className="text-muted-foreground text-sm">Waiting for host to roll…</p>
                )}
              </motion.div>
            )}

            {/* ── LUCKY WHEEL ── */}
            {activeActivity?.type === "lucky-wheel" && (
              <motion.div
                key="lucky-wheel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2"><Emoji name="ferris_wheel" size={28} /> Lucky Wheel</h2>
                <div className="relative w-64 h-64">
                  <motion.div
                    animate={wheelSpinning ? { rotate: [0, wheelSpinAngle] } : {}}
                    transition={{ duration: 3, ease: "easeOut" }}
                    className="w-full h-full rounded-full border-4 border-purple-500/50 overflow-hidden"
                  >
                    {wheelEntries.map((entry, i) => {
                      const angle = (360 / wheelEntries.length) * i;
                      const colors = ["from-purple-500", "from-cyan-500", "from-amber-500", "from-pink-500", "from-emerald-500", "from-indigo-500"];
                      return (
                        <div
                          key={i}
                          className={`absolute inset-0 flex items-center justify-end pr-6 text-xs font-bold text-white bg-gradient-to-r ${colors[i % colors.length]} to-transparent`}
                          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "center", clipPath: `polygon(50% 50%, 100% 0, 100% ${100 / wheelEntries.length * 2}%)` }}
                        >
                          <span className="max-w-[70px] truncate">{entry}</span>
                        </div>
                      );
                    })}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-background border-2 border-purple-500/50 flex items-center justify-center">
                        <Emoji name="ferris_wheel" size={28} animated={!wheelSpinning} />
                      </div>
                    </div>
                  </motion.div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-2xl">▼</div>
                </div>
                {wheelWinner && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center p-4 glass-card rounded-xl"
                  >
                    <p className="text-sm text-muted-foreground mb-1">Winner!</p>
                    <p className="text-2xl font-bold text-purple-400 flex items-center justify-center gap-2">
                      {wheelWinner} <Emoji name="party_popper" size={28} pop />
                    </p>
                  </motion.div>
                )}
                {isHost && (
                  <div className="w-full space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {wheelEntries.map((e, i) => (
                        <Badge
                          key={i}
                          className="bg-purple-500/20 text-purple-300 pr-1 gap-1"
                        >
                          {e}
                          <button
                            type="button"
                            onClick={() => removeWheelEntry(i)}
                            disabled={wheelSpinning}
                            aria-label={`Remove ${e}`}
                            className="rounded-full hover:bg-white/10 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newWheelEntryText}
                        onChange={(e) => setNewWheelEntryText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addWheelEntry()}
                        placeholder="Add an option..."
                        maxLength={40}
                        disabled={wheelSpinning || wheelEntries.length >= 12}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={addWheelEntry}
                        disabled={wheelSpinning || !newWheelEntryText.trim() || wheelEntries.length >= 12}
                      >
                        Add
                      </Button>
                    </div>
                    <Button
                      disabled={wheelSpinning}
                      onClick={() => {
                        sendActivityEvent({ kind: "wheel_spinning" });
                        if (onActivityEventRef.current) onActivityEventRef.current({ kind: "wheel_spinning" });
                        setTimeout(() => {
                          const winner = wheelEntries[Math.floor(Math.random() * wheelEntries.length)];
                          sendActivityEvent({ kind: "wheel_spin", winner });
                          if (onActivityEventRef.current) onActivityEventRef.current({ kind: "wheel_spin", winner });
                        }, 3100);
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0"
                    >
                      {wheelSpinning ? "Spinning…" : "Spin the Wheel!"}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── GUESS THE NUMBER ── */}
            {activeActivity?.type === "guess-number" && (
              <motion.div
                key="guess-number"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-6 max-w-md mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Target className="w-6 h-6 text-cyan-400" /> Guess the Number
                </h2>
                {isHost && (
                  <div className="glass-card p-4 rounded-xl space-y-2">
                    <p className="text-sm text-muted-foreground">Secret number (only you can see):</p>
                    <div className="flex gap-2 items-center">
                      <span className="text-3xl font-black text-cyan-400">{guessSecretNumber}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const secret = Math.floor(Math.random() * 100) + 1;
                          setGuessSecretNumber(secret);
                          sendActivityEvent({ kind: "guess_reset", secret });
                        }}
                        className="ml-auto border-white/20"
                      >
                        New Number
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {guessHistory.map((g, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${g.hint === "correct" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5"}`}>
                      <span className="font-medium">{g.username}</span>
                      <span className="ml-auto font-mono">{g.guess}</span>
                      <span className={g.hint === "too high" ? "text-red-400" : g.hint === "too low" ? "text-amber-400" : "text-emerald-400"}>
                        {g.hint === "too high" ? <ArrowDown className="w-4 h-4" /> : g.hint === "too low" ? <ArrowUp className="w-4 h-4" /> : "✓"}
                      </span>
                    </div>
                  ))}
                  {guessHistory.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No guesses yet…</p>}
                </div>
                {!isHost && (
                  <div className="flex gap-2">
                    <Input
                      id="guess-input"
                      type="number"
                      min={1}
                      max={100}
                      placeholder="1 – 100"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (!val || val < 1 || val > 100) return;
                          const hint = val === guessSecretNumber ? "correct" : val > guessSecretNumber ? "too high" : "too low";
                          sendActivityEvent({ kind: "guess_submit", username: currentUser.username, guess: val, hint });
                          if (onActivityEventRef.current) onActivityEventRef.current({ kind: "guess_submit", username: currentUser.username, guess: val, hint });
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        const input = document.getElementById("guess-input") as HTMLInputElement;
                        const val = parseInt(input?.value);
                        if (!val || val < 1 || val > 100) return;
                        const hint = val === guessSecretNumber ? "correct" : val > guessSecretNumber ? "too high" : "too low";
                        sendActivityEvent({ kind: "guess_submit", username: currentUser.username, guess: val, hint });
                        if (onActivityEventRef.current) onActivityEventRef.current({ kind: "guess_submit", username: currentUser.username, guess: val, hint });
                        if (input) input.value = "";
                      }}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white border-0"
                    >
                      Guess
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── TRUTH OR DARE ── */}
            {activeActivity?.type === "truth-or-dare" && (
              <motion.div
                key="tod"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-8 max-w-md mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6 text-pink-400" /> Truth or Dare
                </h2>
                {isHost && (
                  <div className="flex gap-3 w-full">
                    {[
                      { type: "truth", label: "Draw Truth", color: "from-cyan-600 to-blue-600", prompts: ["What's your biggest fear?","What's the most embarrassing thing you've done?","What's a secret you've never told anyone?","Who was your first crush?","What's the worst lie you've told?"] },
                      { type: "dare", label: "Draw Dare", color: "from-pink-600 to-red-600", prompts: ["Do your best celebrity impression","Speak in an accent for the next 3 minutes","Text your crush right now","Do 10 jumping jacks","Sing a song for 30 seconds"] },
                    ].map((btn) => (
                      <Button
                        key={btn.type}
                        onClick={() => {
                          const text = btn.prompts[Math.floor(Math.random() * btn.prompts.length)];
                          sendActivityEvent({ kind: "tod_prompt", promptType: btn.type, text });
                          if (onActivityEventRef.current) onActivityEventRef.current({ kind: "tod_prompt", promptType: btn.type, text });
                        }}
                        className={`flex-1 bg-gradient-to-r ${btn.color} text-white border-0`}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                )}
                {todPrompt ? (
                  <motion.div
                    key={todPrompt.text}
                    initial={{ opacity: 0, scale: 0.9, rotateX: -20 }}
                    animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                    className={`glass-card p-8 rounded-2xl text-center w-full border-2 ${todPrompt.type === "truth" ? "border-cyan-500/50" : "border-pink-500/50"}`}
                  >
                    <Badge className={`mb-4 gap-1 ${todPrompt.type === "truth" ? "bg-cyan-500/20 text-cyan-300" : "bg-pink-500/20 text-pink-300"}`}>
                      {todPrompt.type === "truth" ? (
                        <>Truth <Emoji name="thinking_face" size={18} /></>
                      ) : (
                        <>Dare <Emoji name="fire" size={18} /></>
                      )}
                    </Badge>
                    <p className="text-xl font-semibold">{todPrompt.text}</p>
                  </motion.div>
                ) : (
                  <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
                    <p className="mb-3 flex justify-center"><Emoji name="performing_arts" size={48} /></p>
                    <p className="text-muted-foreground">{isHost ? "Choose Truth or Dare above" : "Waiting for host to draw a card…"}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── WOULD YOU RATHER ── */}
            {activeActivity?.type === "would-you-rather" && (
              <motion.div
                key="wyr"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <MessageCircleQuestion className="w-6 h-6 text-emerald-400" /> Would You Rather
                </h2>
                {isHost && (
                  <Button
                    onClick={() => {
                      const prompts: { a: string; b: string }[] = [
                        { a: "Be able to fly", b: "Be invisible" },
                        { a: "Always be cold", b: "Always be hot" },
                        { a: "Live without music", b: "Live without movies" },
                        { a: "Have super strength", b: "Have super speed" },
                        { a: "Travel to the past", b: "Travel to the future" },
                      ];
                      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
                      sendActivityEvent({ kind: "wyr_prompt", ...prompt });
                      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "wyr_prompt", ...prompt });
                    }}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
                  >
                    <Shuffle className="w-4 h-4 mr-2" /> New Question
                  </Button>
                )}
                {wyrPrompt ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 w-full">
                      {(["A", "B"] as const).map((opt) => {
                        const text = opt === "A" ? wyrPrompt.a : wyrPrompt.b;
                        const voteCount = Object.values(wyrVotes).filter((v) => v.option === opt).length;
                        const myVote = wyrVotes[currentUser.id]?.option;
                        return (
                          <motion.button
                            key={opt}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              if (myVote) return;
                              sendActivityEvent({ kind: "wyr_vote", userId: currentUser.id, username: currentUser.username, option: opt });
                              if (onActivityEventRef.current) onActivityEventRef.current({ kind: "wyr_vote", userId: currentUser.id, username: currentUser.username, option: opt });
                            }}
                            className={`p-6 rounded-2xl border-2 text-left transition-all ${
                              myVote === opt
                                ? "border-emerald-500 bg-emerald-500/20"
                                : myVote
                                ? "border-white/10 opacity-60"
                                : "border-white/20 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                            }`}
                          >
                            <Badge className="mb-3 bg-white/10 text-white/60">Option {opt}</Badge>
                            <p className="font-semibold">{text}</p>
                            <p className="mt-3 text-2xl font-black text-emerald-400">{voteCount}</p>
                            <p className="text-xs text-muted-foreground">vote{voteCount !== 1 ? "s" : ""}</p>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(wyrVotes).map((v, i) => (
                        <Badge key={i} className={v.option === "A" ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}>
                          {v.username} → {v.option}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
                    <p className="mb-3 flex justify-center"><Emoji name="thinking_face" size={48} /></p>
                    <p className="text-muted-foreground">{isHost ? "Press New Question to start" : "Waiting for host…"}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── NEVER HAVE I EVER ── */}
            {activeActivity?.type === "never-have-i-ever" && (
              <motion.div
                key="nhie"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Eye className="w-6 h-6 text-violet-400" /> Never Have I Ever
                </h2>
                {isHost && (
                  <Button
                    onClick={() => {
                      const stmts = [
                        "Never have I ever lied to get out of trouble",
                        "Never have I ever pulled an all-nighter",
                        "Never have I ever gone skydiving",
                        "Never have I ever eaten something off the floor",
                        "Never have I ever ghosted someone",
                      ];
                      const text = stmts[Math.floor(Math.random() * stmts.length)];
                      sendActivityEvent({ kind: "nhie_prompt", text });
                      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "nhie_prompt", text });
                    }}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0"
                  >
                    <Shuffle className="w-4 h-4 mr-2" /> Next Statement
                  </Button>
                )}
                {nhiePrompt ? (
                  <>
                    <div className="glass-card p-6 rounded-2xl text-center w-full border border-violet-500/30">
                      <p className="text-lg font-semibold">{nhiePrompt}</p>
                    </div>
                    <div className="flex gap-4 w-full">
                      {(["have", "never"] as const).map((choice) => {
                        const count = Object.values(nhieConfessions).filter((c) => c.choice === choice).length;
                        const myChoice = nhieConfessions[currentUser.id]?.choice;
                        return (
                          <motion.button
                            key={choice}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              if (myChoice) return;
                              sendActivityEvent({ kind: "nhie_confess", userId: currentUser.id, username: currentUser.username, choice });
                              if (onActivityEventRef.current) onActivityEventRef.current({ kind: "nhie_confess", userId: currentUser.id, username: currentUser.username, choice });
                            }}
                            className={`flex-1 py-6 rounded-2xl border-2 font-bold text-lg transition-all ${
                              myChoice === choice
                                ? choice === "have" ? "border-rose-500 bg-rose-500/20 text-rose-300" : "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                                : "border-white/20 hover:border-white/40"
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {choice === "have" ? (
                                <><Emoji name="raised_hand" size={20} /> I have</>
                              ) : (
                                <><Emoji name="person_gesturing_no" size={20} /> Never</>
                              )}
                            </div>
                            <div className="text-3xl font-black mt-1">{count}</div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
                    <p className="mb-3 flex justify-center"><Emoji name="see_no_evil_monkey" size={48} /></p>
                    <p className="text-muted-foreground">{isHost ? "Press Next Statement to start" : "Waiting for host…"}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── ROCK PAPER SCISSORS ── */}
            {activeActivity?.type === "rps" && (
              <motion.div
                key="rps"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Swords className="w-6 h-6 text-red-400" /> Rock Paper Scissors
                </h2>
                {!rpsChoices[currentUser.id] ? (
                  <div className="flex gap-4">
                    {(["Rock", "Paper", "Scissors"] as const).map((choice) => (
                      <motion.button
                        key={choice}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          sendActivityEvent({ kind: "rps_choice", userId: currentUser.id, username: currentUser.username, choice });
                          if (onActivityEventRef.current) onActivityEventRef.current({ kind: "rps_choice", userId: currentUser.id, username: currentUser.username, choice });
                        }}
                        className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-white/20 hover:border-red-500/50 hover:bg-red-500/10 transition-all"
                      >
                        <Emoji name={RPS_EMOJI[choice]} size={44} animated={false} />
                        <span className="text-xs text-muted-foreground">{choice}</span>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="glass-card p-4 rounded-xl text-center">
                    <p className="text-sm text-muted-foreground mb-1">Your pick</p>
                    <p className="text-3xl font-bold flex items-center justify-center gap-2">
                      <Emoji name={RPS_EMOJI[rpsChoices[currentUser.id].choice as keyof typeof RPS_EMOJI]} size={32} pop /> {rpsChoices[currentUser.id].choice}
                    </p>
                  </div>
                )}
                <div className="w-full space-y-2">
                  {Object.values(rpsChoices).map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 glass rounded-xl">
                      <span className="font-medium text-sm">{r.username}</span>
                      <span className="ml-auto">
                        {r.username === currentUser.username || isHost ? (
                          <Emoji name={RPS_EMOJI[r.choice as keyof typeof RPS_EMOJI]} size={24} animated={false} />
                        ) : (
                          <Emoji name="shushing_face" size={24} animated={false} />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {isHost && Object.keys(rpsChoices).length >= 2 && (
                  <Button
                    onClick={() => {
                      sendActivityEvent({ kind: "rps_reset" });
                      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "rps_reset" });
                    }}
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> New Round
                  </Button>
                )}
              </motion.div>
            )}

            {/* ── TEAM MAKER ── */}
            {activeActivity?.type === "team-maker" && (
              <motion.div
                key="team-maker"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-6 max-w-lg mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Split className="w-6 h-6 text-cyan-400" /> Team Maker
                </h2>
                {isHost && (
                  <div className="flex gap-3 flex-wrap">
                    {[2, 3, 4].map((n) => (
                      <Button
                        key={n}
                        variant="outline"
                        className="border-cyan-500/30 hover:bg-cyan-500/10"
                        onClick={() => {
                          const names = participants.filter((p) => p.is_online).map((p) => p.user?.username || "Guest");
                          const shuffled = [...names].sort(() => Math.random() - 0.5);
                          const teams = Array.from({ length: n }, (_, i) => ({
                            name: `Team ${i + 1}`,
                            members: shuffled.filter((_, j) => j % n === i),
                          }));
                          sendActivityEvent({ kind: "tm_teams", teams });
                          if (onActivityEventRef.current) onActivityEventRef.current({ kind: "tm_teams", teams });
                        }}
                      >
                        {n} Teams
                      </Button>
                    ))}
                  </div>
                )}
                {tmTeams.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {tmTeams.map((team, i) => {
                      const colors = ["border-purple-500/50 bg-purple-500/10","border-cyan-500/50 bg-cyan-500/10","border-amber-500/50 bg-amber-500/10","border-emerald-500/50 bg-emerald-500/10"];
                      return (
                        <div key={i} className={`p-4 rounded-2xl border-2 ${colors[i % colors.length]}`}>
                          <p className="font-bold mb-2 text-sm">{team.name}</p>
                          {team.members.map((m, j) => (
                            <p key={j} className="text-sm text-muted-foreground">{m}</p>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-card p-8 rounded-2xl text-center border border-white/10">
                    <p className="mb-3 flex justify-center"><Emoji name="busts_in_silhouette" size={48} /></p>
                    <p className="text-muted-foreground">{isHost ? "Choose how many teams to create" : "Waiting for host to create teams…"}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── NAME DRAW ── */}
            {activeActivity?.type === "name-draw" && (
              <motion.div
                key="name-draw"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-8 max-w-md mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <HeartHandshake className="w-6 h-6 text-pink-400" /> Name Draw
                </h2>
                {ndWinner ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center glass-card p-10 rounded-2xl border-2 border-pink-500/50 w-full"
                  >
                    <p className="text-sm text-muted-foreground mb-2">Selected</p>
                    <p className="text-4xl font-black text-pink-400 flex items-center justify-center gap-2">
                      {ndWinner} <Emoji name="party_popper" size={36} pop />
                    </p>
                  </motion.div>
                ) : (
                  <div className="glass-card p-10 rounded-2xl text-center border border-white/10 w-full">
                    <p className="mb-3 flex justify-center"><Emoji name="admission_tickets" size={48} /></p>
                    <p className="text-muted-foreground">{isHost ? "Draw a name from the room" : "Waiting for host to draw…"}</p>
                  </div>
                )}
                {isHost && (
                  <Button
                    onClick={() => {
                      const online = participants.filter((p) => p.is_online);
                      const winner = online[Math.floor(Math.random() * online.length)]?.user?.username || "?";
                      sendActivityEvent({ kind: "nd_winner", winner });
                      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "nd_winner", winner });
                    }}
                    className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white border-0"
                  >
                    <Shuffle className="w-4 h-4 mr-2" /> Draw a Name
                  </Button>
                )}
              </motion.div>
            )}

            {/* ── TOURNAMENT ── */}
            {activeActivity?.type === "tournament" && (
              <motion.div
                key="tournament"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-6 max-w-lg mx-auto pt-8"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Swords className="w-6 h-6 text-amber-400" /> Tournament Bracket
                </h2>
                {tmTeams.length > 0 ? (
                  <div className="space-y-3">
                    {tmTeams.map((round, i) => (
                      <div key={i} className="flex items-center gap-3 glass p-3 rounded-xl">
                        <Badge className="bg-amber-500/20 text-amber-300">Match {i + 1}</Badge>
                        <span className="font-medium">{round.members.join(" vs ")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-card p-8 rounded-2xl text-center border border-white/10">
                    <p className="mb-3 flex justify-center"><Emoji name="trophy" size={48} /></p>
                    <p className="text-muted-foreground">{isHost ? "Generate bracket below" : "Waiting for host to set up bracket…"}</p>
                  </div>
                )}
                {isHost && (
                  <Button
                    onClick={() => {
                      const names = participants.filter((p) => p.is_online).map((p) => p.user?.username || "Guest");
                      const shuffled = [...names].sort(() => Math.random() - 0.5);
                      const matches: { name: string; members: string[] }[] = [];
                      for (let i = 0; i < shuffled.length - 1; i += 2) {
                        matches.push({ name: `Match ${matches.length + 1}`, members: [shuffled[i], shuffled[i + 1] || "BYE"] });
                      }
                      sendActivityEvent({ kind: "tm_teams", teams: matches });
                      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "tm_teams", teams: matches });
                    }}
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
                  >
                    <Shuffle className="w-4 h-4 mr-2" /> Generate Bracket
                  </Button>
                )}
              </motion.div>
            )}

            {/* ── PARTY / CLASSROOM with no sub-activity ── */}
            {(activeActivity?.type === "party" || activeActivity?.type === "classroom") && (
              <motion.div
                key="aggregate-idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center justify-center min-h-[400px]"
              >
                <div className="text-center glass-card p-12 max-w-md w-full">
                  <p className="mb-4 flex justify-center">
                    <Emoji name={activeActivity.type === "party" ? "party_popper" : "books"} size={56} />
                  </p>
                  <h2 className="text-2xl font-bold mb-2 capitalize">{activeActivity.type} Mode</h2>
                  <p className="text-muted-foreground mb-6">
                    {isHost ? (
                      <>Use the <Shuffle className="w-4 h-4 inline align-text-bottom" /> button in the header to pick a game activity for the room.</>
                    ) : (
                      "The host will choose an activity soon!"
                    )}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
