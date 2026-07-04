import { useState, useCallback } from "react";
import { toast } from "sonner";
import { MessageCircle, Users as UsersIcon, Crown, Smile, Send, UserX, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Emoji, renderTextWithEmoji, EMOJI_UNICODE } from "@/components/emoji";
import type { User, ChatMessage, RoomParticipant } from "@/lib/types";

const REACTION_NAMES = [
  "thumbs_up",
  "red_heart",
  "face_with_tears_of_joy",
  "party_popper",
  "fire",
  "hundred_points",
  "eyes",
  "raising_hands",
] as const;

const MAX_MESSAGE_LENGTH = 500;

interface RoomSidebarProps {
  showParticipants: boolean;
  setShowParticipants: (show: boolean) => void;
  hasUnreadMessages: boolean;
  setHasUnreadMessages: (has: boolean) => void;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  currentUser: User;
  hasMoreMessages: boolean;
  loadingOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;
  newMessage: string;
  setNewMessage: (msg: string) => void;
  sendMessage: () => Promise<void>;
  showEmojis: boolean;
  setShowEmojis: (show: boolean) => void;
  isHost: boolean;
  handleKickParticipant: (p: RoomParticipant) => Promise<void>;
  chatScrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onUpdateUsername: (newName: string) => Promise<void>;
}

export function RoomSidebar({
  showParticipants,
  setShowParticipants,
  hasUnreadMessages,
  setHasUnreadMessages,
  participants,
  messages,
  currentUser,
  hasMoreMessages,
  loadingOlderMessages,
  loadOlderMessages,
  newMessage,
  setNewMessage,
  sendMessage,
  showEmojis,
  setShowEmojis,
  isHost,
  handleKickParticipant,
  chatScrollContainerRef,
  messagesEndRef,
  onUpdateUsername,
}: RoomSidebarProps) {
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleSaveUsername = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === currentUser.username) {
      setIsEditingUsername(false);
      return;
    }
    try {
      await onUpdateUsername(trimmed);
      toast.success("Username updated!");
    } catch (err) {
      console.error("Failed to update username:", err);
      toast.error("Failed to update username");
    } finally {
      setIsEditingUsername(false);
    }
  }, [editValue, currentUser.username, onUpdateUsername]);
  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 backdrop-blur-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/5 shrink-0">
        <button
          onClick={() => {
            setShowParticipants(false);
            setHasUnreadMessages(false);
          }}
          className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
            !showParticipants
              ? "text-white border-b-2 border-purple-500"
              : "text-muted-foreground"
          }`}
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
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            showParticipants
              ? "text-white border-b-2 border-purple-500"
              : "text-muted-foreground"
          }`}
        >
          <UsersIcon className="w-4 h-4 inline mr-2" />
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
            <div ref={chatScrollContainerRef} className="contents">
              <ScrollArea className="flex-1 px-4 py-4 overflow-y-auto">
                <div className="space-y-4">
                  {hasMoreMessages && (
                    <div className="flex justify-center pb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadOlderMessages}
                        disabled={loadingOlderMessages}
                        className="text-xs h-7"
                      >
                        {loadingOlderMessages ? "Loading…" : "Load older messages"}
                      </Button>
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                      const participant = participants.find((p) => p.user_id === msg.user_id);
                      const username =
                        msg.user_id === currentUser.id
                          ? "You"
                          : participant?.user?.username || msg.user?.username || "Guest";
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
                              <span className="text-sm font-medium">{username}</span>
                              {isMsgHost && <Crown className="w-3 h-3 text-amber-400" />}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {renderTextWithEmoji(msg.content)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

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
                        setNewMessage(newMessage + EMOJI_UNICODE[name]);
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
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowEmojis(!showEmojis)}
                        aria-label="Insert emoji"
                      />
                    }
                  >
                    <Smile className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>Insert emoji</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon"
                        onClick={sendMessage}
                        className="bg-purple-600 hover:bg-purple-500"
                        aria-label="Send message"
                      />
                    }
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-all ${
                        p.is_online ? "" : "opacity-55"
                      }`}
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
                      {p.user_id === currentUser.id ? (
                        isEditingUsername ? (
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                              maxLength={15}
                              className="text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-medium text-white focus:outline-none focus:border-purple-500/50 w-24"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveUsername();
                                if (e.key === "Escape") setIsEditingUsername(false);
                              }}
                              autoFocus
                            />
                            <button onClick={handleSaveUsername} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsEditingUsername(false)} className="text-red-400 hover:text-red-300">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate flex items-center gap-1.5 text-white">
                                You
                                <span className="text-xs text-muted-foreground/80 font-normal">
                                  ({p.user?.username})
                                </span>
                                <button
                                  onClick={() => {
                                    setEditValue(p.user?.username || "");
                                    setIsEditingUsername(true);
                                  }}
                                  className="text-muted-foreground hover:text-white transition-colors p-0.5"
                                  aria-label="Edit username"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </span>
                              {p.role === "host" && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                            </div>
                            <span className="text-xs text-muted-foreground capitalize">
                              {p.role} {!p.is_online && " • Offline"}
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {p.user?.username}
                            </span>
                            {p.role === "host" && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">
                            {p.role} {!p.is_online && " • Offline"}
                          </span>
                        </div>
                      )}
                      {isHost && p.user_id !== currentUser.id && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleKickParticipant(p)}
                                aria-label={`Remove ${
                                  p.user?.username || "participant"
                                } from the room`}
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
}
