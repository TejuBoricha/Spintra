import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { generateUUID } from "@/lib/utils";
import type { ChatMessage, User } from "@/lib/types";

interface UseRoomChatProps {
  roomCode: string;
  currentUser: User;
  isHost: boolean;
  isLocked: boolean;
  authReady: boolean;
  postLocalMessage: (type: string, payload: unknown) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  hasUnreadMessages: boolean;
  setHasUnreadMessages: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useRoomChat({
  roomCode,
  currentUser,
  isHost,
  isLocked,
  authReady,
  postLocalMessage,
  messages,
  setMessages,
  hasUnreadMessages,
  setHasUnreadMessages,
}: UseRoomChatProps) {
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);


  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSidebarOpenRef = useRef(false);

  const MAX_MESSAGE_LENGTH = 500;

  // Track if sidebar or drawer is active in order to clear unread flag or trigger it
  const markMessageUnreadIfHidden = useCallback((sidebarOpen: boolean) => {
    isSidebarOpenRef.current = sidebarOpen;
    if (!sidebarOpen) {
      setHasUnreadMessages(true);
    }
  }, [setHasUnreadMessages]);

  // Initial messages load
  useEffect(() => {
    if (!authReady) return;
    let isMounted = true;

    const loadMessages = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, room_id, user_id, content, created_at")
          .eq("room_id", roomCode)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("Failed to load initial messages:", error);
          toast.error("Couldn't load chat history.");
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
          setHasMoreMessages(data.length === 100);
        }
      } catch (cause) {
        console.error("Message load failed:", cause);
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [roomCode, currentUser.id, authReady, setMessages]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderMessages || !hasMoreMessages || messages.length === 0) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoadingOlderMessages(true);
    const viewport = chatScrollContainerRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    const prevScrollHeight = viewport?.scrollHeight ?? 0;
    const prevScrollTop = viewport?.scrollTop ?? 0;

    try {
      const oldestCreatedAt = messages[0].created_at;
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, room_id, user_id, content, created_at")
        .eq("room_id", roomCode)
        .lt("created_at", oldestCreatedAt)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to load older messages:", error);
        toast.error("Couldn't load older messages.");
        return;
      }

      if (data) {
        setHasMoreMessages(data.length === 50);
        const formattedOlder = data.map((item) => ({
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
        formattedOlder.reverse();
        setMessages((prev) => [...formattedOlder, ...prev]);

        requestAnimationFrame(() => {
          if (viewport) {
            viewport.scrollTop = prevScrollTop + (viewport.scrollHeight - prevScrollHeight);
          }
        });
      }
    } catch (cause) {
      console.error("Older message load failed:", cause);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [messages, roomCode, currentUser.id, hasMoreMessages, loadingOlderMessages, setMessages]);

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
      postLocalMessage("CHAT", msg);
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
  }, [newMessage, currentUser, roomCode, isHost, isLocked, postLocalMessage, setMessages]);

  return {
    messages,
    setMessages,
    hasMoreMessages,
    loadingOlderMessages,
    newMessage,
    setNewMessage,
    showEmojis,
    setShowEmojis,
    hasUnreadMessages,
    setHasUnreadMessages,
    sendMessage,
    loadOlderMessages,
    chatScrollContainerRef,
    messagesEndRef,
    markMessageUnreadIfHidden,
  };
}
