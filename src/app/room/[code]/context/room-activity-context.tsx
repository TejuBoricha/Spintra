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
  // The room's current host per the live rooms.host_id column (not a
  // snapshot) — lets an activity distinguish "this event's self-reported
  // sender is the CURRENT host" from "...was the host at some point,"
  // which matters across a host migration. See tournament-activity.tsx.
  hostUserId: string | null;
  currentUser: User;
  // Resolves false if the server refused the event (see use-room-subscription.ts).
  sendActivityEvent: (event: ActivityEvent) => Promise<boolean>;
  registerEventListener: (fn: (event: ActivityEvent) => void) => () => void;
  soundEnabled: boolean;
  // Resolves once this client's queued game events have reached the server
  // (send_room_event records each one as it arrives, migration 0106), true
  // if the last was accepted. Required before calling awardScore for
  // RPS/Bingo, whose server-side verification (ADR-008) reads that recorded
  // log. Callers should skip awarding on `false`.
  flushActivityState: () => Promise<boolean>;
  // Calls the server-verified award_score RPC (ADR-008/009) and applies its
  // returned totals to local state immediately — never fire-and-forget, see
  // the comment on this function's definition in room-client.tsx for why.
  // No-ops in demo/local-only mode. questionNum (Trivia only) disambiguates
  // a legitimately re-drawn question from its earlier occurrence.
  awardScore: (activityType: "trivia" | "rps" | "bingo", questionId?: string, choiceIndex?: number, questionNum?: number) => Promise<void>;
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
