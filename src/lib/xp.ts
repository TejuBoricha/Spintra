import type { UserRank } from "./types";

// Mirrors tier_for_xp() in supabase/migrations/0050_room_scores_and_xp_awards.sql
// (ADR-009) — the two must be kept in sync by hand; there is no way to share
// this logic between SQL and TypeScript. The server is authoritative (the
// award RPC writes room_participants.rank using its own copy of these
// thresholds); this client-side copy is only used to detect a level-up
// locally (comparing the pre-award tier against the RPC's returned rank).
const RANK_THRESHOLDS: [number, UserRank][] = [
  [1500, "legend"],
  [700, "master"],
  [300, "challenger"],
  [100, "explorer"],
  [0, "rookie"],
];

export function tierOf(xp: number): UserRank {
  for (const [threshold, rank] of RANK_THRESHOLDS) {
    if (xp >= threshold) return rank;
  }
  return "rookie";
}

export const RANK_LABELS: Record<UserRank, string> = {
  rookie: "Rookie",
  explorer: "Explorer",
  challenger: "Challenger",
  master: "Master",
  legend: "Legend",
};
