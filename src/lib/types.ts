import type { Tournament } from "@/lib/tournament-engine";

export type RoomType = "team-maker" | "lucky-wheel" | "name-draw" | "tournament" | "coin-flip" | "dice" | "guess-number" | "rps" | "truth-or-dare" | "would-you-rather" | "never-have-i-ever" | "trivia" | "bingo" | "word-scramble" | "party" | "classroom";

export type TournamentType = "single-elimination" | "double-elimination" | "round-robin" | "swiss";

export type UserRole = "host" | "participant";

// Room activity events carry different fields per game kind (coin flip, dice
// roll, guess submit, ...) — structured as a discriminated union for strict type safety.
type CoinFlippingEvent    = { kind: "coin_flipping" };
type CoinFlipEvent        = { kind: "coin_flip"; result: "Heads" | "Tails" };
type DiceRollingEvent     = { kind: "dice_rolling" };
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
type TournamentUpdateEvent = {
  kind: "tournament_update";
  tournament: Tournament;
  outcome?: "champion" | "grand-final-set" | "advanced";
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
type BingoWinEvent      = { kind: "bingo_win"; username: string };
type BingoResetEvent    = { kind: "bingo_reset" };

// word-scramble
type ScrambleWordEvent  = { kind: "scramble_word"; scrambled: string; answer: string };
type ScrambleCorrectEvent = { kind: "scramble_correct"; username: string };

export type ActivityEvent =
  | CoinFlippingEvent | CoinFlipEvent
  | DiceRollingEvent  | DiceRollEvent
  | TodPromptEvent
  | WyrPromptEvent    | WyrVoteEvent
  | NhiePromptEvent   | NhieConfessEvent
  | RpsChoiceEvent    | RpsResetEvent
  | TmTeamsEvent      | TmTeamsLegacyEvent
  | NdWinnerEvent     | NdWinnerLegacyEvent
  | TournamentUpdateEvent
  | TriviaQuestionEvent | TriviaAnswerEvent
  | WheelEntriesEvent | WheelSpinningEvent
  | GuessSubmitEvent | GuessResetEvent
  | BingoCallEvent | BingoWinEvent | BingoResetEvent
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

