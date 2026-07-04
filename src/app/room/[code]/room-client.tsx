"use client";

import { useState, useEffect, useCallback, useMemo, Component, ReactNode } from "react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { User, ChatMessage } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOrCreateRoomUser, getLocalRoomCreatorId } from "@/lib/room-user";
import { isDuplicateMessage } from "@/lib/utils";
import { IdleScreen } from "./activities/idle-screen";
import { AggregateIdleScreen } from "./activities/aggregate-idle-screen";
import { ActivityPickerDialog } from "./activities/activity-picker-dialog";
import { ACTIVITY_REGISTRY } from "./activities/activity-registry";
import { RoomActivityContext, RoomParticipantsContext } from "./context/room-activity-context";
import { useRouter } from "next/navigation";
import { Emoji, type EmojiName } from "@/components/emoji";

// Custom Hooks
import { useRoomSubscription } from "./hooks/use-room-subscription";
import { useRoomChat } from "./hooks/use-room-chat";

// Components
import { RoomHeader } from "./components/room-header";
import { RoomSidebar } from "./components/room-sidebar";
import { CloseRoomDialog } from "./components/close-room-dialog";

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

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function RoomClient({ code: roomCode }: { code: string }) {
  const [currentUser, setCurrentUser] = useState<User>(getOrCreateRoomUser);
  const [authReady, setAuthReady] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState<"full" | "locked" | "not_found" | null>(null);
  const router = useRouter();

  // Client anonymous auth setup (runs only on mount)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => {
        setAuthReady(true);
        setCheckingAccess(false);
      });
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
      } finally {
        setAuthReady(true);
      }
    };

    signIn();
  }, []);

  // Pre-entry validation logic (runs only when auth is ready)
  useEffect(() => {
    if (!authReady) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setCheckingAccess(false));
      return;
    }

    let isMounted = true;

    const verifyAccess = async () => {
      try {
        // 1. Fetch room details
        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("is_locked, max_participants, host_id")
          .eq("code", roomCode)
          .maybeSingle();

        if (roomError || !room) {
          if (isMounted) {
            setAccessError("not_found");
            setCheckingAccess(false);
          }
          return;
        }

        // 2. Check if current user is host
        const isRoomHost = room.host_id === currentUser.id;
        if (isRoomHost) {
          if (isMounted) setCheckingAccess(false);
          return;
        }

        // 3. Check if user is already a participant (reconnection / page refresh)
        const { data: existingPart } = await supabase
          .from("room_participants")
          .select("id")
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (existingPart) {
          if (isMounted) setCheckingAccess(false);
          return;
        }

        // 4. Validate Lock status for new joiners
        if (room.is_locked) {
          if (isMounted) {
            setAccessError("locked");
            setCheckingAccess(false);
          }
          return;
        }

        // 5. Validate Room Capacity for new joiners
        const { data: parts, error: countError } = await supabase
          .from("room_participants")
          .select("id")
          .eq("room_id", roomCode);

        if (countError) {
          console.error("Failed to fetch participant list:", countError);
        } else if (parts && parts.length >= room.max_participants) {
          if (isMounted) {
            setAccessError("full");
            setCheckingAccess(false);
          }
          return;
        }

        if (isMounted) {
          setCheckingAccess(false);
        }
      } catch (err) {
        console.error("Pre-entry validation error:", err);
        if (isMounted) setCheckingAccess(false);
      }
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [authReady, roomCode, currentUser.id]);

  if (!authReady || checkingAccess) {
    return (
      <div className="min-h-screen bg-[#07050e] flex flex-col items-center justify-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm font-semibold tracking-wider animate-pulse uppercase">
          Verifying Access...
        </p>
      </div>
    );
  }

  if (accessError) {
    const errorDetails = {
      not_found: {
        title: "Room Not Found",
        desc: "The room you are trying to join does not exist or has been closed by the host.",
        emoji: "question_mark" as EmojiName,
      },
      locked: {
        title: "Room is Locked",
        desc: "The host has locked this room. No new participants can join at this time.",
        emoji: "shushing_face" as EmojiName,
      },
      full: {
        title: "Room is Full",
        desc: "This room has reached its maximum participant limit. Try joining later.",
        emoji: "person_gesturing_no" as EmojiName,
      },
    }[accessError];

    return (
      <div className="min-h-screen bg-[#07050e] flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 rounded-3xl border border-white/10 text-center shadow-2xl space-y-6">
          <div className="flex justify-center">
            <Emoji name={errorDetails.emoji} size={64} pop />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">{errorDetails.title}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{errorDetails.desc}</p>
          </div>
          <button
            onClick={() => router.push("/explore")}
            className="w-full h-11 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white rounded-full font-bold shadow-lg shadow-purple-500/10 transition-all"
          >
            Back to Explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <RoomUIInner
      roomCode={roomCode}
      currentUser={currentUser}
      authReady={authReady}
    />
  );
}

function RoomUIInner({
  roomCode,
  currentUser,
  authReady,
}: {
  roomCode: string;
  currentUser: User;
  authReady: boolean;
}) {
  const [hasMounted, setHasMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sidebar, picker, dialog and navigation states
  const [showParticipants, setShowParticipants] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCloseRoomDialogOpen, setIsCloseRoomDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [localCreatorId] = useState<string | null>(() => {
    return getLocalRoomCreatorId(roomCode);
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Post mount sync to prevent hydration mismatch
  useEffect(() => {
    queueMicrotask(() => setHasMounted(true));
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("spintra-room-sound");
      if (saved !== null) {
        queueMicrotask(() => setSoundEnabled(saved === "true"));
      }
    }
  }, []);

  // Sound toggler
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

  // 1. Subscription hook: Holds participants, settings and syncs database changes
  const subscription = useRoomSubscription({
    roomCode,
    currentUser,
    localCreatorId,
    authReady,
    addIncomingMessage: useCallback(
      (incoming: ChatMessage) => {
        setMessages((prev) => {
          if (isDuplicateMessage(prev, incoming)) {
            return prev;
          }
          return [...prev, incoming];
        });
        if (incoming.user_id !== currentUser.id) {
          // If sidebar is showing participants OR mobile drawer is closed, trigger unread badge
          if (showParticipants || !isMobileSidebarOpen) {
            setHasUnreadMessages(true);
          }
        }
      },
      [currentUser.id, showParticipants, isMobileSidebarOpen, setMessages, setHasUnreadMessages]
    ),
  });

  const {
    participants,
    roomType,
    roomName,
    isLocked,
    activeActivity,
    maxParticipantsLimit,
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
    realtimeError,
    notification,
  } = subscription;

  // 2. Chat hook: Handles message listing, input, pagination and emojis
  const chat = useRoomChat({
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
  });

  const {
    hasMoreMessages,
    loadingOlderMessages,
    newMessage,
    setNewMessage,
    showEmojis,
    setShowEmojis,
    sendMessage,
    loadOlderMessages,
    chatScrollContainerRef,
    messagesEndRef,
  } = chat;

  // Copy Room Link Handler
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

  // Stable context values provided to sub-activities
  const stableContextValue = useMemo(
    () => ({
      roomCode,
      roomType,
      isHost,
      currentUser,
      sendActivityEvent,
      registerEventListener,
      soundEnabled,
    }),
    [
      roomCode,
      roomType,
      isHost,
      currentUser,
      sendActivityEvent,
      registerEventListener,
      soundEnabled,
    ]
  );

  const dynamicContextValue = useMemo(
    () => ({
      participants,
    }),
    [participants]
  );

  if (!hasMounted) {
    return null;
  }

  const ActiveGame = activeActivity?.type
    ? ACTIVITY_REGISTRY[activeActivity.type] ?? null
    : null;

  const sidebarContent = (
    <RoomSidebar
      showParticipants={showParticipants}
      setShowParticipants={setShowParticipants}
      hasUnreadMessages={hasUnreadMessages}
      setHasUnreadMessages={setHasUnreadMessages}
      participants={participants}
      messages={messages}
      currentUser={currentUser}
      hasMoreMessages={hasMoreMessages}
      loadingOlderMessages={loadingOlderMessages}
      loadOlderMessages={loadOlderMessages}
      newMessage={newMessage}
      setNewMessage={setNewMessage}
      sendMessage={sendMessage}
      showEmojis={showEmojis}
      setShowEmojis={setShowEmojis}
      isHost={isHost}
      handleKickParticipant={handleKickParticipant}
      chatScrollContainerRef={chatScrollContainerRef}
      messagesEndRef={messagesEndRef}
    />
  );

  return (
    <div className="min-h-screen pt-16 flex flex-col md:flex-row w-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <RoomHeader
          roomName={roomName}
          realtimeStatusClass={realtimeStatusClass}
          realtimeStatusLabel={realtimeStatusLabel}
          isLocked={isLocked}
          roomCode={roomCode}
          onlineCount={participants.filter((p) => p.is_online).length}
          maxParticipantsLimit={maxParticipantsLimit}
          activeActivityType={activeActivity?.type}
          realtimeError={realtimeError}
          notification={notification}
          copied={copied}
          copyRoomLink={copyRoomLink}
          isHost={isHost}
          toggleLock={toggleLock}
          onOpenCloseRoomDialog={() => setIsCloseRoomDialogOpen(true)}
          roomType={roomType}
          onOpenPicker={() => setIsPickerOpen(true)}
          onResetActivity={() => {
            sendActivityEvent({ kind: "activity_reset" });
            handleActivityEvent({ kind: "activity_reset" });
            if (roomType === "party" || roomType === "classroom") {
              changeActivity(null);
            }
          }}
          onToggleSidebar={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setIsMobileSidebarOpen(true);
              if (!showParticipants) setHasUnreadMessages(false);
            } else {
              setShowParticipants(!showParticipants);
              if (showParticipants) setHasUnreadMessages(false);
            }
          }}
          soundEnabled={soundEnabled}
          toggleSound={toggleSound}
        />

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
                  <IdleScreen
                    key="idle"
                    isHost={isHost}
                    onChooseActivity={() => setIsPickerOpen(true)}
                  />
                )}

                {/* ── Active Game from Plugin Registry ── */}
                {activeActivity &&
                  activeActivity.type !== "party" &&
                  activeActivity.type !== "classroom" &&
                  ActiveGame && (
                    <ErrorBoundary
                      key={activeActivity.type}
                      fallback={
                        <div className="glass-card p-8 rounded-2xl text-center border border-red-500/20 max-w-md mx-auto mt-8">
                          <p className="text-xl font-bold text-red-400 mb-2">Something went wrong</p>
                          <p className="text-sm text-muted-foreground">
                            The activity crashed or failed to load. Try picking a different activity.
                          </p>
                        </div>
                      }
                    >
                      <ActiveGame />
                    </ErrorBoundary>
                  )}

                {/* ── PARTY / CLASSROOM with no sub-activity ── */}
                {(activeActivity?.type === "party" || activeActivity?.type === "classroom") && (
                  <AggregateIdleScreen
                    key="aggregate-idle"
                    activityType={activeActivity.type}
                    isHost={isHost}
                  />
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
        <SheetContent
          side="right"
          className="p-0 w-80 bg-background border-l border-white/5 flex flex-col h-full"
        >
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Close Room confirmation */}
      <CloseRoomDialog
        isOpen={isCloseRoomDialogOpen}
        onOpenChange={setIsCloseRoomDialogOpen}
        onClose={() => setIsCloseRoomDialogOpen(false)}
        onConfirm={handleCloseRoom}
        isConfirming={isClosingRoom}
        roomCode={roomCode}
      />
    </div>
  );
}
