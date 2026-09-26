import type { Breadcrumb, Event } from "@sentry/nextjs";

// Room codes are the key to a room, so they're removed from everything sent
// to Sentry (browser, server and edge). A code is 6 to 8 characters from
// create-client.tsx's alphabet (A-Z without I and O, digits 2-9), which is
// also what keeps these patterns off ordinary words and file paths
// (".../app/room/page.js" is left alone).
const CODE = "[A-HJ-NP-Z2-9]{6,8}";
const PATTERNS: [RegExp, string][] = [
  // /room/AB12CD in page paths and URLs
  [new RegExp(`/room/${CODE}\\b`, "g"), "/room/[code]"],
  // database filters and query strings: code=eq.AB12CD, room_id=AB12CD
  [new RegExp(`\\b(code|room_id|room_code|p_room_code|p_room_id)=(eq\\.)?${CODE}\\b`, "g"), "$1=$2[code]"],
  // realtime channel names: room:AB12CD, city:AB12CD, room_scores_AB12CD, moderation_dashboard_AB12CD
  [new RegExp(`\\b(room|city):${CODE}\\b`, "g"), "$1:[code]"],
  [new RegExp(`\\b(room_scores|moderation_dashboard)_${CODE}\\b`, "g"), "$1_[code]"],
  // log messages: "... for room AB12CD", "Room AB12CD". Only the word may
  // differ in case: codes are always uppercase, and a case-insensitive
  // match would also swallow ordinary words ("room details").
  [new RegExp(`\\b[Rr]oom ${CODE}\\b`, "g"), "room [code]"],
];

function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

// Walks the whole object (spans, request, exception values, tags, extra,
// breadcrumbs) rather than a hand-picked list of fields, which would miss
// whichever field a future SDK version puts a URL in.
function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 12 || value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value) as T;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubDeep(value[i], depth + 1);
    return value;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) record[key] = scrubDeep(record[key], depth + 1);
  }
  return value;
}

export function scrubRoomCodes<T extends Event>(event: T): T {
  return scrubDeep(event);
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return scrubDeep(breadcrumb);
}
