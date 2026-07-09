function storageKey(roomCode: string): string {
  return `spintra-room-bans-${roomCode}`;
}

function readBannedUserIds(roomCode: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(roomCode));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isUserBannedFromRoom(roomCode: string, userId: string): boolean {
  return readBannedUserIds(roomCode).includes(userId);
}

export function banUserFromRoom(roomCode: string, userId: string): void {
  const current = readBannedUserIds(roomCode);
  if (current.includes(userId)) return;
  window.localStorage.setItem(storageKey(roomCode), JSON.stringify([...current, userId]));
}

// Demo-mode counterpart to room_bans (real Supabase mode) — no username is
// ever stored here, only the id, so the unban panel falls back to "Unknown
// user" for these rows.
export function listBannedUserIdsFromRoom(roomCode: string): string[] {
  return readBannedUserIds(roomCode);
}

export function unbanUserFromRoom(roomCode: string, userId: string): void {
  const current = readBannedUserIds(roomCode);
  const next = current.filter((id) => id !== userId);
  if (next.length === current.length) return;
  window.localStorage.setItem(storageKey(roomCode), JSON.stringify(next));
}
