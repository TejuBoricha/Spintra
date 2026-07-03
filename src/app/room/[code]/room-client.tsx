"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Send, Crown, MessageCircle, Lock, Unlock,
  Copy, Check, Smile, UserX, Wifi,
  Shuffle, RotateCcw, DoorClosed,
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
import { IdleScreen } from "./activities/idle-screen";
import { AggregateIdleScreen } from "./activities/aggregate-idle-screen";
import { ActivityPickerDialog } from "./activities/activity-picker-dialog";
import { CoinFlipActivity } from "./activities/coin-flip-activity";
import { DiceActivity } from "./activities/dice-activity";
import { LuckyWheelActivity } from "./activities/lucky-wheel-activity";
import { GuessNumberActivity } from "./activities/guess-number-activity";
import { TruthOrDareActivity } from "./activities/truth-or-dare-activity";
import { WouldYouRatherActivity } from "./activities/would-you-rather-activity";
import { NeverHaveIEverActivity } from "./activities/never-have-i-ever-activity";
import { RpsActivity } from "./activities/rps-activity";
import { TeamMakerActivity } from "./activities/team-maker-activity";
import { NameDrawActivity } from "./activities/name-draw-activity";
import { TournamentActivity } from "./activities/tournament-activity";
import { TriviaActivity } from "./activities/trivia-activity";
import { BingoActivity } from "./activities/bingo-activity";
import { WordScrambleActivity } from "./activities/word-scramble-activity";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const REACTION_NAMES = [
  "thumbs_up", "red_heart", "face_with_tears_of_joy", "party_popper",
  "fire", "hundred_points", "eyes", "raising_hands",
] as const;

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

  const [triviaQuestion, setTriviaQuestion] = useState<{ text: string; options: string[]; correctIndex: number; num: number } | null>(null);
  const [triviaAnswers, setTriviaAnswers] = useState<Record<string, { username: string; choiceIndex: number; correct: boolean }>>({});

  const [bingoCalled, setBingoCalled] = useState<number[]>([]);
  const [bingoWinner, setBingoWinner] = useState<string | null>(null);

  const [scrambleWord, setScrambleWord] = useState<{ scrambled: string; answer: string } | null>(null);
  const [scrambleWinner, setScrambleWinner] = useState<string | null>(null);

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
        case "trivia_question":
          setTriviaQuestion({ text: event.text, options: event.options, correctIndex: event.correctIndex, num: event.num });
          setTriviaAnswers({});
          break;
        case "trivia_answer":
          setTriviaAnswers((prev) => ({ ...prev, [event.userId]: { username: event.username, choiceIndex: event.choiceIndex, correct: event.correct } }));
          break;
        case "bingo_call":
          setBingoCalled((prev) => [...prev, event.number]);
          break;
        case "bingo_win":
          setBingoWinner(event.username);
          break;
        case "bingo_reset":
          setBingoCalled([]);
          setBingoWinner(null);
          break;
        case "scramble_word":
          setScrambleWord({ scrambled: event.scrambled, answer: event.answer });
          setScrambleWinner(null);
          break;
        case "scramble_correct":
          setScrambleWinner(event.username);
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
          setTriviaQuestion(null);
          setTriviaAnswers({});
          setBingoCalled([]);
          setBingoWinner(null);
          setScrambleWord(null);
          setScrambleWinner(null);
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

            {/* ── COIN FLIP ── */}
            {activeActivity?.type === "coin-flip" && (
              <CoinFlipActivity
                key="coin-flip"
                isHost={isHost}
                coinResult={coinResult}
                coinFlipping={coinFlipping}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── DICE ROLLER ── */}
            {activeActivity?.type === "dice" && (
              <DiceActivity
                key="dice"
                isHost={isHost}
                diceResults={diceResults}
                diceRolling={diceRolling}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── LUCKY WHEEL ── */}
            {activeActivity?.type === "lucky-wheel" && (
              <LuckyWheelActivity
                key="lucky-wheel"
                isHost={isHost}
                wheelEntries={wheelEntries}
                newWheelEntryText={newWheelEntryText}
                setNewWheelEntryText={setNewWheelEntryText}
                wheelWinner={wheelWinner}
                wheelSpinning={wheelSpinning}
                wheelSpinAngle={wheelSpinAngle}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
                addWheelEntry={addWheelEntry}
                removeWheelEntry={removeWheelEntry}
              />
            )}

            {/* ── GUESS THE NUMBER ── */}
            {activeActivity?.type === "guess-number" && (
              <GuessNumberActivity
                key="guess-number"
                isHost={isHost}
                guessSecretNumber={guessSecretNumber}
                setGuessSecretNumber={setGuessSecretNumber}
                guessHistory={guessHistory}
                currentUser={currentUser}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── TRUTH OR DARE ── */}
            {activeActivity?.type === "truth-or-dare" && (
              <TruthOrDareActivity
                key="tod"
                isHost={isHost}
                todPrompt={todPrompt}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── WOULD YOU RATHER ── */}
            {activeActivity?.type === "would-you-rather" && (
              <WouldYouRatherActivity
                key="wyr"
                isHost={isHost}
                wyrPrompt={wyrPrompt}
                wyrVotes={wyrVotes}
                currentUser={currentUser}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── NEVER HAVE I EVER ── */}
            {activeActivity?.type === "never-have-i-ever" && (
              <NeverHaveIEverActivity
                key="nhie"
                isHost={isHost}
                nhiePrompt={nhiePrompt}
                nhieConfessions={nhieConfessions}
                currentUser={currentUser}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── ROCK PAPER SCISSORS ── */}
            {activeActivity?.type === "rps" && (
              <RpsActivity
                key="rps"
                isHost={isHost}
                rpsChoices={rpsChoices}
                currentUser={currentUser}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── TEAM MAKER ── */}
            {activeActivity?.type === "team-maker" && (
              <TeamMakerActivity
                key="team-maker"
                isHost={isHost}
                participants={participants}
                tmTeams={tmTeams}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── NAME DRAW ── */}
            {activeActivity?.type === "name-draw" && (
              <NameDrawActivity
                key="name-draw"
                isHost={isHost}
                participants={participants}
                ndWinner={ndWinner}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── TOURNAMENT ── */}
            {activeActivity?.type === "tournament" && (
              <TournamentActivity
                key="tournament"
                isHost={isHost}
                participants={participants}
                tmTeams={tmTeams}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── TRIVIA ── */}
            {activeActivity?.type === "trivia" && (
              <TriviaActivity
                key="trivia"
                isHost={isHost}
                currentUser={currentUser}
                triviaQuestion={triviaQuestion}
                triviaAnswers={triviaAnswers}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── BINGO ── */}
            {activeActivity?.type === "bingo" && (
              <BingoActivity
                key="bingo"
                isHost={isHost}
                currentUser={currentUser}
                bingoCalled={bingoCalled}
                bingoWinner={bingoWinner}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── WORD SCRAMBLE ── */}
            {activeActivity?.type === "word-scramble" && (
              <WordScrambleActivity
                key="word-scramble"
                isHost={isHost}
                currentUser={currentUser}
                scrambleWord={scrambleWord}
                scrambleWinner={scrambleWinner}
                sendActivityEvent={sendActivityEvent}
                onActivityEventRef={onActivityEventRef}
              />
            )}

            {/* ── PARTY / CLASSROOM with no sub-activity ── */}
            {(activeActivity?.type === "party" || activeActivity?.type === "classroom") && (
              <AggregateIdleScreen key="aggregate-idle" activityType={activeActivity.type} isHost={isHost} />
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
