import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ChatMessage, RoomParticipant } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isDuplicateMessage(messages: ChatMessage[], candidate: ChatMessage): boolean {
  return messages.some(
    (message) =>
      message.id === candidate.id ||
      (message.user_id === candidate.user_id &&
        new Date(message.created_at).getTime() === new Date(candidate.created_at).getTime() &&
        message.content === candidate.content)
  );
}

// A long-running room session (hours, hundreds of messages) grew this array
// — and its Framer-Motion-wrapped DOM row per message — without limit.
// Capped generously: comfortably covers any single active party session,
// this is a safety net against unbounded growth, not a tight window.
export const MAX_RETAINED_MESSAGES = 500;

export function capMessageHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.length > MAX_RETAINED_MESSAGES
    ? messages.slice(messages.length - MAX_RETAINED_MESSAGES)
    : messages;
}


/**
 * Display names for a set of participants, disambiguated when two
 * participants share the same (editable, non-unique) username — a bare
 * username list makes them indistinguishable in a team roster or draw
 * result. Duplicates get a short user-id suffix; unique names are
 * returned untouched, so nothing changes in the common case.
 */
export function disambiguatedUsernames(participants: RoomParticipant[]): string[] {
  const counts = new Map<string, number>();
  for (const p of participants) {
    const name = p.user?.username || "Guest";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return participants.map((p) => {
    const name = p.user?.username || "Guest";
    return (counts.get(name) ?? 0) > 1 ? `${name} (${p.user_id.slice(0, 4)})` : name;
  });
}

/** Unbiased Fisher-Yates shuffle. Does not mutate the input array. */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateUUID(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function safeStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function safeStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private browsing */ }
}

// Shared between the standalone /tools/word-scramble page and the room
// activity — both used to hardcode their own copy of this list, which had
// already drifted apart (the room activity's fallback list was missing
// MARBLE/JUNGLE/WHISKER/LANTERN/PENGUIN/VOLCANO/MEADOW). One shared list
// closes that gap; both call sites use this as their demo-mode fallback
// (word-scramble also has a database-backed path via `activity_prompts`).
export const WORD_SCRAMBLE_WORDS = [
  "PUZZLE", "GALAXY", "WIZARD", "CASTLE", "DRAGON", "PLANET", "GUITAR", "FOREST",
  "ISLAND", "ROCKET", "TROPHY", "CANDLE", "BREEZE", "MARBLE", "JUNGLE", "WHISKER",
  "LANTERN", "PENGUIN", "VOLCANO", "MEADOW",
] as const;

/** Scrambles a word's letters, guaranteed to differ from the original. */
export function scramble(word: string): string {
  let letters = word.split("");
  let attempt = letters.join("");
  while (attempt === word) {
    letters = shuffleArray(letters);
    attempt = letters.join("");
  }
  return attempt;
}

// Shared between the standalone /tools/bingo page and the room activity —
// both used to hardcode identical copies of this logic.
const BINGO_COLUMN_RANGES: Record<string, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};
export const BINGO_COLUMNS = Object.keys(BINGO_COLUMN_RANGES);

/** A 5x5 bingo card: 5 numbers per column, drawn from that column's standard range. */
export function generateBingoCard(): number[][] {
  return BINGO_COLUMNS.map((col) => {
    const [min, max] = BINGO_COLUMN_RANGES[col];
    const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return shuffleArray(pool).slice(0, 5);
  });
}

/** Every winning line (rows, columns, both diagonals) on a standard 5x5 bingo card, as [col, row] coordinate pairs. */
export const BINGO_LINES: [number, number][][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => [c, r] as [number, number])),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => [c, r] as [number, number])),
  [0, 1, 2, 3, 4].map((i) => [i, i] as [number, number]),
  [0, 1, 2, 3, 4].map((i) => [i, 4 - i] as [number, number]),
];

