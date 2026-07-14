import type { Tournament } from "@/lib/tournament-engine";

export type RoomType = "team-maker" | "lucky-wheel" | "name-draw" | "tournament" | "coin-flip" | "dice" | "guess-number" | "rps" | "truth-or-dare" | "would-you-rather" | "never-have-i-ever" | "trivia" | "bingo" | "word-scramble" | "party" | "classroom";

export type TournamentType = "single-elimination" | "double-elimination" | "round-robin" | "swiss";

export type UserRole = "host" | "participant";

// Room activity events carry different fields per game kind (coin flip, dice
// roll, guess submit, ...) — structured as a discriminated union for strict type safety.
type CoinFlippingEvent    = { kind: "coin_flipping"; result?: "Heads" | "Tails" };
type CoinFlipEvent        = { kind: "coin_flip"; result: "Heads" | "Tails" };
type DiceRollingEvent     = { kind: "dice_rolling"; results?: number[] };
type DiceRollEvent        = { kind: "dice_roll"; results: number[] };
type TodPromptEvent       = { kind: "tod_prompt"; promptType: "truth" | "dare"; text: string };
type WyrPromptEvent       = { kind: "wyr_prompt"; a: string; b: string };
type WyrVoteEvent         = { kind: "wyr_vote"; userId: string; username: string; option: "A" | "B" };
type NhiePromptEvent      = { kind: "nhie_prompt"; text: string };
type NhieConfessEvent     = { kind: "nhie_confess"; userId: string; username: string; choice: "have" | "never" };
type RpsChoiceEvent       = { kind: "rps_choice"; userId: string; username: string; choice: string };
type RpsResetEvent        = { kind: "rps_reset" };
type TmTeamsEvent         = { kind: "team_maker_teams"; teams: { name: string; members: string[] }[] };
// `tm_teams` was renamed to `team_maker_teams` (Session 45 audit: the old
// abbreviation was inconsistent with every other activity's full-word kind
// prefix). Never written after that rename, but a room's room_activity_state
// can have one already persisted (migration 0023/0035 replay) — kept here,
// read-only, purely so old rows still replay instead of silently dropping
// that event on reconnect.
type TmTeamsLegacyEvent   = { kind: "tm_teams"; teams: { name: string; members: string[] }[] };
// Broadcast so a host who migrates before Generate Bracket is clicked
// doesn't silently see the format selection reset to the default — see
// docs/HOST_MIGRATION_AUDIT.md finding M4. Low-stakes (no bracket exists
// yet), unlike TournamentUpdateEvent — no sender verification needed.
type TournamentFormatSelectedEvent = { kind: "tournament_format_selected"; format: TournamentType };
type TournamentUpdateEvent = {
  kind: "tournament_update";
  tournament: Tournament;
  outcome?: "champion" | "grand-final-set" | "advanced";
  // Self-reported author, checked against the receiving client's own live
  // rooms.host_id (never the sender's own claim about itself) before a
  // LIVE (non-replayed) event is trusted — see tournament-activity.tsx.
  // Not a security boundary on its own (a client could lie about this
  // field); the actual enforcement is the DB trigger on room_activity_state
  // (migration 0060) checking the real auth.uid() at persist time. This
  // field exists to dampen the live-broadcast race during a host
  // transition, not to stop a determined forger.
  senderId: string;
};
type NdWinnerEvent        = { kind: "name_draw_winner"; winner: string };
// Same rename/replay-compat treatment as TmTeamsLegacyEvent above.
type NdWinnerLegacyEvent  = { kind: "nd_winner"; winner: string };
type TriviaQuestionEvent  = { kind: "trivia_question"; questionId?: string; text: string; options: string[]; correctIndex?: number; num: number; category: string; difficulty: "easy" | "medium" | "hard" };
type TriviaAnswerEvent    = { kind: "trivia_answer"; userId: string; username: string; choiceIndex: number; correctIndex?: number; correct: boolean };
type ActivityResetEvent   = { kind: "activity_reset" };
// lucky-wheel
type WheelEntriesEvent  = { kind: "wheel_entries"; entries: string[] };
type WheelSpinningEvent = { kind: "wheel_spinning"; winner?: string };

// guess-number
type GuessSubmitEvent   = { kind: "guess_submit"; username: string; guess: number; hint: string };
// `secret` is only ever populated in demo mode (no real backend to check
// against, so the client-side fallback needs it); in real Supabase mode the
// secret lives server-side only (see check_guess_number RPC, migration
// 0028) and is never broadcast.
type GuessResetEvent    = { kind: "guess_reset"; secret?: number };

// bingo
type BingoCallEvent     = { kind: "bingo_call"; number: number };
type BingoWinEvent      = { kind: "bingo_win"; username: string; userId: string };
// userId is optional so a pre-migration event still sitting in a persisted
// room_activity_state snapshot (from before ADR-008's Scoreboard shipped)
// replays without crashing — the reducer simply skips awarding for it.
type BingoVerifiedEvent = { kind: "bingo_verified"; username: string; userId?: string };
type BingoResetEvent    = { kind: "bingo_reset" };

// word-scramble
type ScrambleWordEvent  = { kind: "scramble_word"; scrambled: string; hash: string; answer?: string };
type ScrambleCorrectEvent = { kind: "scramble_correct"; username: string; answer?: string };

export type ActivityEvent =
  | CoinFlippingEvent | CoinFlipEvent
  | DiceRollingEvent  | DiceRollEvent
  | TodPromptEvent
  | WyrPromptEvent    | WyrVoteEvent
  | NhiePromptEvent   | NhieConfessEvent
  | RpsChoiceEvent    | RpsResetEvent
  | TmTeamsEvent      | TmTeamsLegacyEvent
  | NdWinnerEvent     | NdWinnerLegacyEvent
  | TournamentUpdateEvent | TournamentFormatSelectedEvent
  | TriviaQuestionEvent | TriviaAnswerEvent
  | WheelEntriesEvent | WheelSpinningEvent
  | GuessSubmitEvent | GuessResetEvent
  | BingoCallEvent | BingoWinEvent | BingoVerifiedEvent | BingoResetEvent
  | ScrambleWordEvent | ScrambleCorrectEvent
  | ActivityResetEvent;

export type UserRank = "rookie" | "explorer" | "challenger" | "master" | "legend";

export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  xp: number;
  rank: UserRank;
  created_at: string;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  role: UserRole;
  is_online: boolean;
  joined_at: string;
  user?: User;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

