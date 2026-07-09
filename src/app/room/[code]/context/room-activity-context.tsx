"use client";

import { createContext, useContext } from "react";
import type { User, RoomParticipant, ActivityEvent, RoomType } from "@/lib/types";

// Memoized in room-client.tsx's `stableContextValue` — stable across the
// high-frequency changes this split exists to isolate activities from
// (participants joining/leaving, chat messages). It is NOT unconditionally
// stable: `currentUser` is the full `User` object, and its reference changes
// whenever the local profile is edited (username/avatar), which recreates
// this whole context value and re-renders every mounted activity once.
// That's a deliberate, accepted trade-off — profile edits are rare, and
// activities that display the current user's name/avatar need the fresh
// value anyway — not a bug, but worth knowing before assuming a consumer
// here truly never re-renders (found via the Session 45 audit).
export interface RoomActivityContextType {
  roomCode: string;
  roomType: RoomType;
  isHost: boolean;
  currentUser: User;
  sendActivityEvent: (event: ActivityEvent) => void;
  registerEventListener: (fn: (event: ActivityEvent) => void) => () => void;
  soundEnabled: boolean;
  // Forces the debounced room_activity_state persist (use-room-subscription.ts)
  // to happen immediately. Required before calling awardScore for RPS/Bingo,
  // whose server-side verification (ADR-008) reads that persisted state
  // directly — without this, a win claimed the instant it happens can race
  // the up-to-2s debounce and be server-rejected as unverifiable.
  flushActivityState: () => Promise<void>;
  // Calls the server-verified award_score RPC (ADR-008/009) and applies its
  // returned totals to local state immediately — never fire-and-forget, see
  // the comment on this function's definition in room-client.tsx for why.
  // No-ops in demo/local-only mode.
  awardScore: (activityType: "trivia" | "rps" | "bingo", questionId?: string, choiceIndex?: number) => Promise<void>;
}

// DYNAMIC — only participants list
export interface RoomParticipantsContextType {
  participants: RoomParticipant[];
}

export const RoomActivityContext = createContext<RoomActivityContextType | null>(null);
export const RoomParticipantsContext = createContext<RoomParticipantsContextType | null>(null);

export function useRoomActivity() {
  const context = useContext(RoomActivityContext);
  if (!context) {
    throw new Error("useRoomActivity must be used within RoomActivityContext.Provider");
  }
  return context;
}

export function useRoomParticipants() {
  const context = useContext(RoomParticipantsContext);
  if (!context) {
    throw new Error("useRoomParticipants must be used within RoomParticipantsContext.Provider");
  }
  return context;
}
