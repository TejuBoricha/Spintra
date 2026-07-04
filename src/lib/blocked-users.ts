const BLOCKED_USERS_KEY = "spintra-blocked-users";

function readBlockedUsers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BLOCKED_USERS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeBlockedUsers(ids: string[]) {
  window.localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(ids));
}

export function getBlockedUsers(): string[] {
  return readBlockedUsers();
}

export function isUserBlocked(userId: string): boolean {
  return readBlockedUsers().includes(userId);
}

export function toggleBlockedUser(userId: string): string[] {
  const current = readBlockedUsers();
  const next = current.includes(userId)
    ? current.filter((id) => id !== userId)
    : [...current, userId];
  writeBlockedUsers(next);
  return next;
}
