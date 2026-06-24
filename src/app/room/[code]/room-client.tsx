"use client";

import { useState, useCallback } from "react";
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
import type { User, ChatMessage, RoomParticipant } from "@/lib/types";

function generateId() { return Math.random().toString(36).slice(2, 10); }

const defaultUser: User = {
  id: generateId(),
  username: `Guest_${Math.random().toString(36).slice(2, 6)}`,
  xp: 0,
  rank: "rookie",
  created_at: new Date().toISOString(),
};

const emojis = ["👍", "❤️", "😂", "🎉", "🔥", "💯", "👀", "🙌"];

export default function RoomClient({ code: roomCode }: { code: string }) {
  const [currentUser] = useState<User>(defaultUser);
  const [participants] = useState<RoomParticipant[]>([
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
{ id: "1", room_id: "1", user_id: currentUser.id, role: "host", is_online: true, joined_at: new Date().toISOString(), user: { ...currentUser, username: "You" } },
    { id: "2", room_id: "1", user_id: "u2", role: "participant", is_online: true, joined_at: new Date().toISOString(), user: { id: "u2", username: "Alex", avatar_url: "", xp: 500, rank: "explorer", created_at: "" } },
    { id: "3", room_id: "1", user_id: "u3", role: "participant", is_online: true, joined_at: new Date().toISOString(), user: { id: "u3", username: "Sam", avatar_url: "", xp: 1200, rank: "challenger", created_at: "" } },
    { id: "4", room_id: "1", user_id: "u4", role: "spectator", is_online: false, joined_at: new Date().toISOString(), user: { id: "u4", username: "Jordan", avatar_url: "", xp: 300, rank: "rookie", created_at: "" } },
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "m1", room_id: "1", user_id: "u2", content: "Hey everyone! Ready to play?", created_at: new Date().toISOString(), user: { id: "u2", username: "Alex", avatar_url: "", xp: 500, rank: "explorer", created_at: "" } },
    { id: "m2", room_id: "1", user_id: "u3", content: "Let's go! 🎉", created_at: new Date().toISOString(), user: { id: "u3", username: "Sam", avatar_url: "", xp: 1200, rank: "challenger", created_at: "" } },
  ]);

  const [newMessage, setNewMessage] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const isHost = true; // Current user is host for demo

  const sendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    const msg: ChatMessage = {
      id: generateId(),
      room_id: "1",
      user_id: currentUser.id,
      content: newMessage,
      created_at: new Date().toISOString(),
      user: currentUser,
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
  }, [newMessage, currentUser]);

  const copyRoomLink = async () => {
    await navigator.clipboard.writeText(`spintra.com/room?code=${roomCode}`);
    setCopied(true);
    toast.success("Room link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleLock = () => {
    setIsLocked((prev) => !prev);
    toast.success(isLocked ? "Room unlocked" : "Room locked");
  };

  return (
    <div className="min-h-screen pt-16 flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Room Header */}
        <div className="glass border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">Team Room</h1>
                <Badge variant="secondary" className="text-xs">
                  <Wifi className="w-3 h-3 mr-1 text-emerald-400" />
                  Live
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>Room #{roomCode}</span>
                <span>·</span>
                <span>{participants.filter((p) => p.is_online).length} online</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={copyRoomLink}>
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
              {isHost && (
                <Button variant="ghost" size="icon" onClick={toggleLock}>
                  {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowParticipants(!showParticipants)}>
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
            <h2 className="text-2xl font-bold mb-2">Waiting for Host</h2>
            <p className="text-muted-foreground mb-6">
              The host will start the activity soon. Chat with other participants while you wait!
            </p>
            {isHost && (
              <Button className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0">
                <Sparkles className="w-4 h-4 mr-2" />
                Start Activity
              </Button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Sidebar - Chat & Participants */}
      <div className="w-80 border-l border-white/5 flex flex-col bg-background/50 backdrop-blur-sm">
        {/* Tabs */}
        <div className="flex border-b border-white/5">
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
              className="flex-1 flex flex-col"
            >
              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-cyan-500 text-white">
                          {msg.user?.username?.slice(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {msg.user_id === currentUser.id ? "You" : msg.user?.username}
                          </span>
                          {participants.find((p) => p.user_id === msg.user_id)?.role === "host" && (
                            <Crown className="w-3 h-3 text-amber-400" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Emoji bar */}
              <AnimatePresence>
                {showEmojis && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="px-4 py-2 border-t border-white/5 flex gap-1"
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
              <div className="p-4 border-t border-white/5">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowEmojis(!showEmojis)}>
                    <Smile className="w-4 h-4" />
                  </Button>
                  <Button size="icon" onClick={sendMessage} className="bg-purple-600 hover:bg-purple-500">
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
              className="flex-1"
            >
              <ScrollArea className="h-full px-4 py-4">
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
                        <Button variant="ghost" size="icon" className="h-7 w-7">
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
    </div>
  );
}
