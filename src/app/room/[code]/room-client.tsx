"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Send, Crown, MessageCircle, Lock, Unlock,
  Sparkles, Copy, Check, Smile, MoreHorizontal, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { User, ChatMessage, RoomParticipant } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOrCreateRoomUser, getLocalRoomCreatorId } from "@/lib/room-user";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const emojis = ["👍", "❤️", "😂", "🎉", "🔥", "💯", "👀", "🙌"];

function isDuplicateMessage(messages: ChatMessage[], candidate: ChatMessage) {
  return messages.some(
    (message) =>
      message.user_id === candidate.user_id &&
      message.created_at === candidate.created_at &&
      message.content === candidate.content
  );
}

export default function RoomClient({ code: roomCode }: { code: string }) {
  const [currentUser] = useState<User>(getOrCreateRoomUser);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [localCreatorId] = useState<string | null>(() => {
    return getLocalRoomCreatorId(roomCode);
  });

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

  const isHost =
    participants.some((p) => p.user_id === currentUser.id && p.role === "host" && p.is_online) ||
    localCreatorId === currentUser.id;

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const realtimeStatusLabel = realtimeError
    ? "Offline"
    : isRealtimeReady
    ? "Live"
    : "Connecting...";
  const realtimeStatusClass = realtimeError
    ? "bg-red-500/10 text-red-300"
    : isRealtimeReady
    ? "bg-emerald-500/10 text-emerald-300"
    : "bg-amber-500/10 text-amber-300";

  const sendMessage = useCallback(async () => {
    if (isLocked && !isHost) {
      toast.error("The room is locked by the host.");
      return;
    }

    if (!newMessage.trim()) return;

    const msg: ChatMessage = {
      id: generateId(),
      room_id: roomCode,
      user_id: currentUser.id,
      content: newMessage,
      created_at: new Date().toISOString(),
      user: currentUser,
    };

    setMessages((prev) => [...prev, msg]);
    setNewMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      toast.error("Chat is unavailable because Supabase is not configured.");
      return;
    }

    try {
      await supabase.from("chat_messages").insert({
        room_id: roomCode,
        user_id: currentUser.id,
        content: newMessage,
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
      }
      toast.success(nextValue ? "Room locked" : "Room unlocked");
      return nextValue;
    });
  };


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
        setParticipants((prev) => {
          const next = prev.filter((participant) => participant.id !== removed.id);
          electHostIfNeeded(supabase, next);
          return next;
        });
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeReady(true);
          setRealtimeError(null);
          setNotification(null);
        } else {
          setIsRealtimeReady(false);
          setRealtimeError("Realtime subscription failed.");
          setNotification("Realtime connection lost. Trying to reconnect...");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, electHostIfNeeded]);

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
  }, [roomCode, currentUser, electHostIfNeeded]);

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
          onClick={() => setShowParticipants(false)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${!showParticipants ? "text-white border-b-2 border-purple-500" : "text-muted-foreground"}`}
        >
          <MessageCircle className="w-4 h-4 inline mr-2" />
          Chat
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
                        <p className="text-sm text-muted-foreground">{msg.content}</p>
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
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setNewMessage((prev) => prev + emoji);
                        setShowEmojis(false);
                      }}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-lg transition-colors"
                    >
                      {emoji}
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
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => setShowEmojis(!showEmojis)} aria-label="Insert emoji">
                  <Smile className="w-4 h-4" />
                </Button>
                <Button size="icon" onClick={sendMessage} className="bg-purple-600 hover:bg-purple-500" aria-label="Send message">
                  <Send className="w-4 h-4" />
                </Button>
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
                      {p.is_online && (
                         <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
                      )}
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Manage participant ${p.user?.username}`}>
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
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
                <h1 className="text-xl font-bold">Team Room</h1>
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
                <span>{participants.filter((p) => p.is_online).length} online</span>
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
              <Button variant="ghost" size="icon" onClick={copyRoomLink} aria-label="Copy room link">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
              {isHost && (
                <Button variant="ghost" size="icon" onClick={toggleLock} aria-label="Toggle room lock state">
                  {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setIsMobileSidebarOpen(true);
                  } else {
                    setShowParticipants(!showParticipants);
                  }
                }}
                aria-label="Toggle chat and participants sidebar"
              >
                <Users className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 p-6 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center glass-card p-12 max-w-md w-full"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            {isHost ? (
              <>
                <h2 className="text-2xl font-bold mb-2">You are the host</h2>
                <p className="text-muted-foreground mb-6">
                  You can start the activity or wait for guests to join. Use the controls on the right to manage the room.
                </p>
                <Button className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Activity
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">Waiting for Host</h2>
                <p className="text-muted-foreground mb-6">
                  The host will start the activity soon. Chat with other participants while you wait!
                </p>
              </>
            )}
          </motion.div>
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
    </div>
  );
}
