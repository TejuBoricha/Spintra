"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo, Component, ReactNode } from "react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { User, ChatMessage, RoomType } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOrCreateRoomUser, getLocalRoomCreatorId } from "@/lib/room-user";
import { isUserBannedFromRoom } from "@/lib/room-bans";
import { isDuplicateMessage, capMessageHistory } from "@/lib/utils";
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

// Memoized so unrelated state changes elsewhere in RoomUIInner (most
// notably every chat-input keystroke updating `newMessage` in
// useRoomChat) don't cascade into re-rendering — and remounting the active
// game's AnimatePresence transition — every time someone types.
const RoomGameArea = memo(function RoomGameArea({
  activeActivity,
  isHost,
  roomType,
  changeActivity,
  isPickerOpen,
  setIsPickerOpen,
  stableContextValue,
  dynamicContextValue,
}: {
  activeActivity: { type: string; state: unknown } | null;
  isHost: boolean;
  roomType: RoomType;
  changeActivity: (type: string | null) => void;
  isPickerOpen: boolean;
  setIsPickerOpen: (open: boolean) => void;
  stableContextValue: Parameters<typeof RoomActivityContext.Provider>[0]["value"];
  dynamicContextValue: Parameters<typeof RoomParticipantsContext.Provider>[0]["value"];
}) {
  const ActiveGame = activeActivity?.type ? ACTIVITY_REGISTRY[activeActivity.type] ?? null : null;

  const handleSelect = useCallback(
    (type: string | null) => {
      changeActivity(type);
      setIsPickerOpen(false);
    },
    [changeActivity, setIsPickerOpen]
  );
  const handleChooseActivity = useCallback(() => setIsPickerOpen(true), [setIsPickerOpen]);

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      <RoomActivityContext.Provider value={stableContextValue}>
        <RoomParticipantsContext.Provider value={dynamicContextValue}>
          <ActivityPickerDialog
            open={isPickerOpen && isHost}
            onOpenChange={setIsPickerOpen}
            activeActivityType={activeActivity?.type}
            roomType={roomType}
            onSelect={handleSelect}
          />
          <AnimatePresence mode="wait">
            {/* ── No Activity Selected ── */}
            {!activeActivity && (
              <IdleScreen key="idle" isHost={isHost} onChooseActivity={handleChooseActivity} />
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
  );
});

export default function RoomClient({ code: roomCode }: { code: string }) {
  const [currentUser, setCurrentUser] = useState<User>(getOrCreateRoomUser);
  const [authReady, setAuthReady] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState<"full" | "locked" | "not_found" | "banned" | "error" | null>(null);
  const router = useRouter();

  // Cached from verifyAccess below so useRoomSubscription doesn't have to
  // re-fetch the same `rooms` row and re-check the same "am I already a
  // participant" question a second (and third) time immediately after —
  // this was the largest concrete latency finding in the Session 41 audit
  // (9 serial round trips on every room join). `undefined` means "verifyAccess
  // didn't check this" (the host early-exit path skips both checks), which
  // tells useRoomSubscription it still needs to check for itself. State, not
  // a ref, since it's read during render (refs may only be read in effects/
  // event handlers).
  const [prefetchedRoom, setPrefetchedRoom] = useState<{
    name: string;
    type: string;
    is_locked: boolean;
    max_participants: number;
    host_id: string;
  } | null>(null);
  const [prefetchedExistingParticipant, setPrefetchedExistingParticipant] = useState<
    { id: string; role: string } | null | undefined
  >(undefined);

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
      queueMicrotask(() => {
        if (isUserBannedFromRoom(roomCode, currentUser.id)) {
          setAccessError("banned");
        }
        setCheckingAccess(false);
      });
      return;
    }

    let isMounted = true;

    const verifyAccess = async () => {
      try {
        // 1. Fetch room details (all columns useRoomSubscription's
        // loadRoomDetails also needs, so it can reuse this instead of
        // re-fetching the same row a second time right after).
        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("name, type, is_locked, max_participants, host_id")
          .eq("code", roomCode)
          .maybeSingle();

        if (roomError) {
          // A real fetch failure (network error, Supabase outage, RLS/
          // permission error) is not the same claim as "this room doesn't
          // exist" — .maybeSingle() only returns roomError for an actual
          // query failure, never for zero matching rows (that's `!room`
          // below). Conflating the two told users a room was gone/never
          // existed when the real problem was that we simply couldn't check.
          console.error("Failed to fetch room:", roomError);
          if (isMounted) {
            setAccessError("error");
            setCheckingAccess(false);
          }
          return;
        }

        if (!room) {
          if (isMounted) {
            setAccessError("not_found");
            setCheckingAccess(false);
          }
          return;
        }

        setPrefetchedRoom(room);

        // 2. Check if current user is host
        const isRoomHost = room.host_id === currentUser.id;
        if (isRoomHost) {
          if (isMounted) setCheckingAccess(false);
          return;
        }

        // 3. Check if the user has been banned from this room
        const { data: ban } = await supabase
          .from("room_bans")
          .select("id")
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (ban) {
          if (isMounted) {
            setAccessError("banned");
            setCheckingAccess(false);
          }
          return;
        }

        // 4. Check if user is already a participant (reconnection / page refresh)
        const { data: existingPart } = await supabase
          .from("room_participants")
          .select("id, role")
          .eq("room_id", roomCode)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        setPrefetchedExistingParticipant(existingPart ?? null);

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

        // 5. Validate Room Capacity for new joiners — only count currently
        // online participants. A disconnected participant's row is kept
        // (marked is_online=false) rather than deleted, so counting every
        // row regardless of status would let a room's effective capacity
        // shrink permanently every time someone joins and leaves.
        const { data: parts, error: countError } = await supabase
          .from("room_participants")
          .select("id")
          .eq("room_id", roomCode)
          .eq("is_online", true);

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
        // An unexpected exception here (e.g. a network-level fetch failure
        // that supabase-js doesn't wrap into a clean `{ error }` result) used
        // to just log and clear the loading state with no accessError set —
        // falling through to render the room UI with incomplete/null
        // prefetched data instead of telling the user anything went wrong.
        console.error("Pre-entry validation error:", err);
        if (isMounted) {
          setAccessError("error");
          setCheckingAccess(false);
        }
      }
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [authReady, roomCode, currentUser.id]);

  if (!authReady || checkingAccess) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
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
      banned: {
        title: "You've Been Removed",
        desc: "The host removed you from this room and you can't rejoin it.",
        emoji: "broom" as EmojiName,
      },
      error: {
        title: "Couldn't Connect",
        desc: "We couldn't check this room right now — this doesn't mean it's gone. Check your connection and try again.",
        emoji: "disappointed_face" as EmojiName,
      },
    }[accessError];

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 rounded-3xl border border-white/10 text-center shadow-2xl space-y-6">
          <div className="flex justify-center">
            <Emoji name={errorDetails.emoji} size={64} pop />
          </div>
          <div className="space-y-2">
            <h1 tabIndex={-1} ref={(el) => el?.focus()} className="text-2xl font-black text-white">{errorDetails.title}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{errorDetails.desc}</p>
          </div>
          {accessError === "error" ? (
            <button
              onClick={() => window.location.reload()}
              className="w-full h-11 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white rounded-full font-bold shadow-lg shadow-purple-500/10 transition-all"
            >
              Try Again
            </button>
          ) : (
            <button
              onClick={() => router.push("/explore")}
              className="w-full h-11 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white rounded-full font-bold shadow-lg shadow-purple-500/10 transition-all"
            >
              Back to Explore
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <RoomUIInner
      roomCode={roomCode}
      currentUser={currentUser}
      authReady={authReady}
      prefetchedRoom={prefetchedRoom}
      prefetchedExistingParticipant={prefetchedExistingParticipant}
    />
  );
}

function RoomUIInner({
  roomCode,
  currentUser,
  authReady,
  prefetchedRoom,
  prefetchedExistingParticipant,
}: {
  roomCode: string;
  currentUser: User;
  authReady: boolean;
  prefetchedRoom: {
    name: string;
    type: string;
    is_locked: boolean;
    max_participants: number;
    host_id: string;
  } | null;
  prefetchedExistingParticipant: { id: string; role: string } | null | undefined;
}) {
  const [hasMounted, setHasMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [localUser, setLocalUser] = useState<User>(currentUser);

  const handleUpdateUsername = useCallback(async (newName: string) => {
    setLocalUser((prev) => {
      const next = { ...prev, username: newName };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("spintra-room-user", JSON.stringify(next));
      }
      return next;
    });

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      try {
        await supabase
          .from("room_participants")
          .update({ username: newName })
          .eq("room_id", roomCode)
          .eq("user_id", localUser.id);
      } catch (err) {
        console.error("Failed to sync updated username to database:", err);
      }
    }
  }, [roomCode, localUser.id]);

  // Sidebar, picker, dialog and navigation states
  const [showParticipants, setShowParticipants] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Mirrored in refs so addIncomingMessage (below) can read the latest sidebar
  // state without depending on it directly — depending on it directly used to
  // give the callback a new identity on every sidebar toggle, which tore down
  // and rebuilt the entire realtime channel (missing events during the gap).
  const showParticipantsRef = useRef(showParticipants);
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  useEffect(() => {
    showParticipantsRef.current = showParticipants;
  }, [showParticipants]);
  useEffect(() => {
    isMobileSidebarOpenRef.current = isMobileSidebarOpen;
  }, [isMobileSidebarOpen]);
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
    currentUser: localUser,
    localCreatorId,
    authReady,
    prefetchedRoom,
    prefetchedExistingParticipant,
    addIncomingMessage: useCallback(
      (incoming: ChatMessage) => {
        setMessages((prev) => {
          if (isDuplicateMessage(prev, incoming)) {
            return prev;
          }
          return capMessageHistory([...prev, incoming]);
        });
        if (incoming.user_id !== localUser.id) {
          // On desktop the sidebar is always visible; only mark unread if the
          // user has switched to the participants panel (chat hidden). On mobile
          // mark unread when the sidebar drawer is closed.
          const isDesktop = window.innerWidth >= 768;
          if (isDesktop ? !showParticipantsRef.current : !isMobileSidebarOpenRef.current) {
            setHasUnreadMessages(true);
          }
        }
      },
      [localUser.id, setMessages, setHasUnreadMessages]
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
    isLocalOnlyMode,
    realtimeError,
    notification,
    roomAnnouncement,
  } = subscription;

  // 2. Chat hook: Handles message listing, input, pagination and emojis
  const chat = useRoomChat({
    roomCode,
    currentUser: localUser,
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
    reportMessage,
    loadOlderMessages,
    chatScrollContainerRef,
    messagesEndRef,
  } = chat;

  // Copy Room Link Handler
  const copyRoomLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`);
      setCopied(true);
      if (isLocalOnlyMode) {
        toast.warning("Link copied — but this room only works on this device, so it won't work for anyone else.");
      } else {
        toast.success("Room link copied!");
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy room link:", error);
      toast.error("Unable to copy link. Please copy it manually.");
    }
  }, [roomCode, isLocalOnlyMode]);

  // Stable identities for RoomHeader's callback props — RoomHeader is
  // React.memo'd specifically so that unrelated state changes elsewhere in
  // this component (e.g. every chat-input keystroke updating `newMessage`
  // in useRoomChat) don't cascade into re-rendering the header; that only
  // works if the props it receives don't get new identities on every render.
  const handleOpenCloseRoomDialog = useCallback(() => setIsCloseRoomDialogOpen(true), []);
  const handleOpenPicker = useCallback(() => setIsPickerOpen(true), []);
  const handleResetActivity = useCallback(() => {
    sendActivityEvent({ kind: "activity_reset" });
    handleActivityEvent({ kind: "activity_reset" });
    if (roomType === "party" || roomType === "classroom") {
      changeActivity(null);
    }
  }, [sendActivityEvent, handleActivityEvent, roomType, changeActivity]);
  const handleToggleSidebar = useCallback(() => {
    // Reads the ref mirror, not the closed-over `showParticipants` state,
    // since this callback is intentionally kept referentially stable
    // ([] deps) for RoomHeader's memo to be effective.
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileSidebarOpen(true);
      if (!showParticipantsRef.current) setHasUnreadMessages(false);
    } else {
      if (showParticipantsRef.current) setHasUnreadMessages(false);
      setShowParticipants(!showParticipantsRef.current);
    }
  }, []);

  // Stable context values provided to sub-activities
  const stableContextValue = useMemo(
    () => ({
      roomCode,
      roomType,
      isHost,
      currentUser: localUser,
      sendActivityEvent,
      registerEventListener,
      soundEnabled,
    }),
    [
      roomCode,
      roomType,
      isHost,
      localUser,
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

  const onlineCount = useMemo(
    () => participants.filter((p) => p.is_online).length,
    [participants]
  );

  if (!hasMounted) {
    return null;
  }

  const sidebarContent = (
    <RoomSidebar
      showParticipants={showParticipants}
      setShowParticipants={setShowParticipants}
      hasUnreadMessages={hasUnreadMessages}
      setHasUnreadMessages={setHasUnreadMessages}
      participants={participants}
      messages={messages}
      currentUser={localUser}
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
      reportMessage={reportMessage}
      chatScrollContainerRef={chatScrollContainerRef}
      messagesEndRef={messagesEndRef}
      onUpdateUsername={handleUpdateUsername}
    />
  );

  return (
    <div className="min-h-screen pt-16 flex flex-col md:flex-row w-full">
      {/* Screen-reader-only announcements for participant join/leave and
          game changes — found missing entirely in the Session 41 audit.
          Visually hidden (sr-only): these are transient events that would
          be noisy as a persistent visible banner, but matter to screen
          reader users with no other way to notice them. */}
      <div className="sr-only" role="status" aria-live="polite">
        {roomAnnouncement}
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <RoomHeader
          roomName={roomName}
          realtimeStatusClass={realtimeStatusClass}
          realtimeStatusLabel={realtimeStatusLabel}
          isLocalOnlyMode={isLocalOnlyMode}
          isLocked={isLocked}
          roomCode={roomCode}
          onlineCount={onlineCount}
          maxParticipantsLimit={maxParticipantsLimit}
          activeActivityType={activeActivity?.type}
          realtimeError={realtimeError}
          notification={notification}
          copied={copied}
          copyRoomLink={copyRoomLink}
          isHost={isHost}
          toggleLock={toggleLock}
          onOpenCloseRoomDialog={handleOpenCloseRoomDialog}
          roomType={roomType}
          onOpenPicker={handleOpenPicker}
          onResetActivity={handleResetActivity}
          onToggleSidebar={handleToggleSidebar}
          soundEnabled={soundEnabled}
          toggleSound={toggleSound}
        />

        {/* Game Area */}
        <RoomGameArea
          activeActivity={activeActivity}
          isHost={isHost}
          roomType={roomType}
          changeActivity={changeActivity}
          isPickerOpen={isPickerOpen}
          setIsPickerOpen={setIsPickerOpen}
          stableContextValue={stableContextValue}
          dynamicContextValue={dynamicContextValue}
        />
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
