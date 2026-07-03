"use client";

import { createContext, useContext } from "react";
import type { User, RoomParticipant, ActivityEvent, RoomType } from "@/lib/types";

// STABLE — memoized, never changes after mount
export interface RoomActivityContextType {
  roomCode: string;
  roomType: RoomType;
  isHost: boolean;
  currentUser: User;
  sendActivityEvent: (event: ActivityEvent) => void;
  registerEventListener: (fn: (event: ActivityEvent) => void) => () => void;
  soundEnabled: boolean;
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
