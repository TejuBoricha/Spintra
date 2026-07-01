import type { User } from "@/lib/types";

const USER_STORAGE_KEY = "spintra-room-user";
const CREATOR_STORAGE_PREFIX = "spintra-room-creator-";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const defaultUser: Omit<User, "created_at"> = {
  id: generateId(),
  username: `Guest_${Math.random().toString(36).slice(2, 6)}`,
  xp: 0,
  rank: "rookie",
  avatar_url: "",
};

export function getOrCreateRoomUser(): User {
  if (typeof window === "undefined") {
    return { ...defaultUser, created_at: new Date().toISOString() };
  }

  const saved = window.localStorage.getItem(USER_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as User;
    } catch {
      // ignore invalid stored user
    }
  }

  const user = { ...defaultUser, created_at: new Date().toISOString() };
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
}

function normalizeRoomCode(roomCode?: string) {
  if (!roomCode || typeof roomCode !== "string") return "";
  return roomCode.trim().toUpperCase();
}

export function setLocalRoomCreator(roomCode: string | undefined, userId: string) {
  if (typeof window === "undefined") return;
  const normalizedCode = normalizeRoomCode(roomCode);
  if (!normalizedCode) return;
  window.localStorage.setItem(`${CREATOR_STORAGE_PREFIX}${normalizedCode}`, userId);
}

export function getLocalRoomCreatorId(roomCode?: string): string | null {
  if (typeof window === "undefined") return null;
  const normalizedCode = normalizeRoomCode(roomCode);
  if (!normalizedCode) return null;
  return window.localStorage.getItem(`${CREATOR_STORAGE_PREFIX}${normalizedCode}`);
}
