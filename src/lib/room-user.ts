import type { User } from "@/lib/types";
import { safeStorageGet, safeStorageSet, safeStorageRemove } from "@/lib/utils";

const STORAGE_PREFIX = "spintra-";
const USER_STORAGE_KEY = "spintra-room-user";
const CREATOR_STORAGE_PREFIX = "spintra-room-creator-";

function generateId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
}

const defaultUser: Omit<User, "created_at"> = {
  id: generateId(),
  username: `Guest_${generateId().slice(0, 5)}`,
  xp: 0,
  rank: "rookie",
  avatar_url: "",
};

export function getOrCreateRoomUser(): User {
  if (typeof window === "undefined") {
    return { ...defaultUser, created_at: new Date().toISOString() };
  }

  const saved = safeStorageGet(USER_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as User;
    } catch {
      // ignore invalid stored user
    }
  }

  const user = { ...defaultUser, created_at: new Date().toISOString() };
  safeStorageSet(USER_STORAGE_KEY, JSON.stringify(user));
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
  safeStorageSet(`${CREATOR_STORAGE_PREFIX}${normalizedCode}`, userId);
}

export function getLocalRoomCreatorId(roomCode?: string): string | null {
  if (typeof window === "undefined") return null;
  const normalizedCode = normalizeRoomCode(roomCode);
  if (!normalizedCode) return null;
  return safeStorageGet(`${CREATOR_STORAGE_PREFIX}${normalizedCode}`);
}

// Device-only rename: no account exists to update server-side, so this just
// rewrites the same localStorage record getOrCreateRoomUser reads.
export function updateRoomUsername(newUsername: string): User {
  const current = getOrCreateRoomUser();
  const updated = { ...current, username: newUsername };
  safeStorageSet(USER_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// Wipes every localStorage key this app has ever written (identity, sound/theme
// prefs, room history, per-room creator flags, cookie consent) rather than an
// explicit list, so it can't silently miss a key added later.
export function clearAllLocalUserData(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
  } catch {
    // private browsing / storage unavailable
  }
  keys.forEach(safeStorageRemove);
}
