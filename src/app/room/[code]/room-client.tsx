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
  const [hasMounted, setHasMounted] = useState(false);

  // Sound capability state
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

  // Client anonymous auth setup (runs only on mount)
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
      } finally {
        setAuthReady(true);
      }
    };

    signIn();
  }, []);

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
    <div className="min-h-screen pt-16 flex flex-col md:flex-row">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
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
