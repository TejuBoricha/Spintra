"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Spintra City's data layer.
//
// Deliberately NOT built on the room's activity event bus (sendActivityEvent /
// registerEventListener / room_activity_state). That pattern is client-driven
// and replay-capped — right for Coin Flip, wrong for a match with money and
// trades. Here Postgres is the referee: every mutation is a SECURITY DEFINER
// RPC that validates and applies state in one locked transaction, and realtime
// only tells us "something changed, refetch". See docs/SPINTRA_CITY_DESIGN.md
// §2.2 and docs/SPINTRA_CITY_SPEC.md §5.3.

export type CityMatchStatus = "lobby" | "active" | "paused" | "finished" | "abandoned";

export type CityPhase =
  | "awaiting_roll"
  | "movement"
  | "space_resolution"
  | "required_decision"
  | "optional_actions"
  | "auction";

export interface CityMatch {
  id: string;
  room_code: string;
  status: CityMatchStatus;
  mode: "classic" | "timed";
  time_limit_minutes: number | null;
  current_seat: number | null;
  phase: CityPhase | null;
  created_by: string;
  started_at: string | null;
  turn_started_at: string | null;
  pace_seconds: number;
  last_roll: number[] | null;
  doubles_count: number;
}

export interface CitySeat {
  id: string;
  match_id: string;
  user_id: string;
  seat: number;
  username: string;
  is_ready: boolean;
  status: "seated" | "active" | "bankrupt" | "retired";
  position: number;
  cash: number;
}

/** Reference data from `city_board_spaces` — the same 40 rows for every match. */
export interface CityBoardSpace {
  idx: number;
  name: string;
  kind: "corner" | "property" | "airport" | "utility" | "tax" | "card";
  country: string | null;
  price: number | null;
  build_cost: number | null;
  rent: number[] | null;
  tax_amount: number | null;
  deck: "boarding_pass" | "city_fund" | null;
}

export interface CityAsset {
  space_idx: number;
  owner_seat: number;
  buildings: number;
  is_mortgaged: boolean;
}

/** What `city_roll_dice` hands back, so the UI can narrate the move. */
export interface CityRollResult {
  dice: number[];
  from: number;
  to: number;
  passed_departure: boolean;
  salary: number;
  doubles: boolean;
  detained: boolean;
}

// The RNG columns (rng_seed, rng_counter) are intentionally absent from both
// the interface above and this select list. They're also revoked at the
// column-grant level in migration 0063 — asking for them would fail rather
// than silently leak. Listing columns explicitly (not `*`) keeps the client
// honest about that boundary.
const MATCH_COLUMNS =
  "id, room_code, status, mode, time_limit_minutes, current_seat, phase, created_by, " +
  "started_at, turn_started_at, pace_seconds, last_roll, doubles_count";

const SEAT_COLUMNS =
  "id, match_id, user_id, seat, username, is_ready, status, position, cash";

interface UseCityMatchResult {
  match: CityMatch | null;
  seats: CitySeat[];
  board: CityBoardSpace[];
  assets: CityAsset[];
  isLoading: boolean;
  error: string | null;
  isDemoMode: boolean;
  mySeat: CitySeat | null;
  isMyTurn: boolean;
  lastRoll: CityRollResult | null;
  createMatch: (mode: "classic" | "timed", timeLimitMinutes?: number) => Promise<void>;
  joinSeat: (username: string) => Promise<void>;
  leaveSeat: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  startMatch: () => Promise<void>;
  rollDice: () => Promise<void>;
  endTurn: () => Promise<void>;
}

export function useCityMatch(roomCode: string, currentUserId: string): UseCityMatchResult {
  const [match, setMatch] = useState<CityMatch | null>(null);
  const [seats, setSeats] = useState<CitySeat[]>([]);
  const [board, setBoard] = useState<CityBoardSpace[]>([]);
  const [assets, setAssets] = useState<CityAsset[]>([]);
  const [lastRoll, setLastRoll] = useState<CityRollResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();
  const isDemoMode = !supabase;

  // Mirrored so the realtime subscription effect below doesn't need `match` in
  // its dependency array — otherwise every refetch would tear down and rebuild
  // the channel, the exact bug fixed in use-room-subscription.ts (Session 61).
  // Synced in an effect rather than during render: this repo's React Compiler
  // lint rules forbid touching refs mid-render (same fix as bingo-activity.tsx).
  const matchIdRef = useRef<string | null>(null);
  useEffect(() => {
    matchIdRef.current = match?.id ?? null;
  }, [match?.id]);

  const refetch = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const { data: matchRow, error: matchError } = await supabase
      .from("city_matches")
      .select(MATCH_COLUMNS)
      .eq("room_code", roomCode)
      .in("status", ["lobby", "active", "paused"])
      .maybeSingle();

    if (matchError) {
      // A real fetch failure is not the same claim as "no match exists" —
      // conflating those is a bug this codebase has fixed twice before
      // (room-client.tsx's verifyAccess, room-join-check.ts).
      console.error("Failed to load city match:", matchError);
      setError("Couldn't load the match. Check your connection and try again.");
      setIsLoading(false);
      return;
    }

    setError(null);

    if (!matchRow) {
      setMatch(null);
      setSeats([]);
      setIsLoading(false);
      return;
    }

    const nextMatch = matchRow as unknown as CityMatch;
    setMatch(nextMatch);

    const [{ data: seatRows }, { data: assetRows }] = await Promise.all([
      supabase
        .from("city_match_players")
        .select(SEAT_COLUMNS)
        .eq("match_id", nextMatch.id)
        .order("seat", { ascending: true }),
      supabase
        .from("city_assets")
        .select("space_idx, owner_seat, buildings, is_mortgaged")
        .eq("match_id", nextMatch.id),
    ]);

    setSeats((seatRows ?? []) as unknown as CitySeat[]);
    setAssets((assetRows ?? []) as unknown as CityAsset[]);
    setIsLoading(false);
  }, [supabase, roomCode]);

  // The board is immutable reference data shared by every match, so it is
  // fetched once and never refetched by the realtime notifier below. Prices
  // and rents live server-side deliberately: a client that can redefine the
  // rent table can rewrite the economy (migration 0064 §1).
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const { data, error: boardError } = await supabase
        .from("city_board_spaces")
        .select("idx, name, kind, country, price, build_cost, rent, tax_amount, deck")
        .order("idx", { ascending: true });
      if (cancelled) return;
      if (boardError) {
        console.error("Failed to load the city board:", boardError);
        return;
      }
      setBoard((data ?? []) as unknown as CityBoardSpace[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // queueMicrotask defers the state updates out of the effect body, matching
  // the pattern room-client.tsx uses for its `hasMounted` effect to satisfy
  // the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    queueMicrotask(() => void refetch());
  }, [refetch]);

  // Realtime as a notifier only: a change ping triggers a refetch of
  // RLS-gated rows rather than trusting a broadcast payload to carry state.
  // This is what keeps authoritative data behind row-level security instead of
  // on a channel any room member could read (SPEC.md §5.1).
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`city:${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "city_matches", filter: `room_code=eq.${roomCode}` },
        () => void refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "city_match_players" },
        (payload) => {
          const changedMatchId =
            (payload.new as { match_id?: string })?.match_id ??
            (payload.old as { match_id?: string })?.match_id;
          if (!matchIdRef.current || changedMatchId === matchIdRef.current) {
            void refetch();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomCode, refetch]);

  // Surfaces the RPC's own error text, which is a stable machine-readable
  // code (CITY_NOT_HOST, CITY_MATCH_FULL, ...) rather than a raw Postgres
  // message, so the UI can map it to friendly copy.
  // Takes a PromiseLike rather than a Promise: supabase.rpc() returns a
  // thenable query builder, not a true Promise.
  const runCommand = useCallback(
    async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
      if (!supabase) return;
      const { error: rpcError } = await fn();
      if (rpcError) {
        console.error("City command failed:", rpcError);
        setError(friendlyCommandError(rpcError.message));
        return;
      }
      setError(null);
      await refetch();
    },
    [supabase, refetch]
  );

  const createMatch = useCallback(
    async (mode: "classic" | "timed", timeLimitMinutes?: number) => {
      await runCommand(() =>
        // p_time_limit_minutes is omitted rather than passed as null so the
        // function's own default applies (it derives 60 for timed mode).
        supabase!.rpc("city_create_match", {
          p_room_code: roomCode,
          p_mode: mode,
          ...(timeLimitMinutes !== undefined ? { p_time_limit_minutes: timeLimitMinutes } : {}),
        })
      );
    },
    [runCommand, supabase, roomCode]
  );

  const joinSeat = useCallback(
    async (username: string) => {
      const id = matchIdRef.current;
      if (!id) return;
      await runCommand(() =>
        supabase!.rpc("city_join_seat", { p_match_id: id, p_username: username })
      );
    },
    [runCommand, supabase]
  );

  const leaveSeat = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    await runCommand(() => supabase!.rpc("city_leave_seat", { p_match_id: id }));
  }, [runCommand, supabase]);

  const setReady = useCallback(
    async (ready: boolean) => {
      const id = matchIdRef.current;
      if (!id) return;
      await runCommand(() =>
        supabase!.rpc("city_set_ready", { p_match_id: id, p_ready: ready })
      );
    },
    [runCommand, supabase]
  );

  const startMatch = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    await runCommand(() => supabase!.rpc("city_start_match", { p_match_id: id }));
  }, [runCommand, supabase]);

  // Unlike the lobby commands, the roll returns a payload the UI needs (the
  // dice, where the token moved from and to, whether salary was paid), so it
  // can't go through runCommand — that discards `data`. The payload is a
  // *narration* of a move the server already committed, never the source of
  // truth: the refetch below re-reads the authoritative rows.
  const rollDice = useCallback(async () => {
    const id = matchIdRef.current;
    if (!supabase || !id) return;
    const { data, error: rpcError } = await supabase.rpc("city_roll_dice", { p_match_id: id });
    if (rpcError) {
      console.error("City roll failed:", rpcError);
      setError(friendlyCommandError(rpcError.message));
      return;
    }
    setError(null);
    setLastRoll(data as unknown as CityRollResult);
    await refetch();
  }, [supabase, refetch]);

  const endTurn = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    setLastRoll(null);
    await runCommand(() => supabase!.rpc("city_end_turn", { p_match_id: id }));
  }, [runCommand, supabase]);

  const mySeat = seats.find((s) => s.user_id === currentUserId) ?? null;

  return {
    match,
    seats,
    board,
    assets,
    isLoading,
    error,
    isDemoMode,
    mySeat,
    isMyTurn:
      match?.status === "active" && mySeat != null && match.current_seat === mySeat.seat,
    lastRoll,
    createMatch,
    joinSeat,
    leaveSeat,
    setReady,
    startMatch,
    rollDice,
    endTurn,
  };
}

function friendlyCommandError(message: string): string {
  if (message.includes("CITY_NOT_HOST")) return "Only the host can do that.";
  if (message.includes("CITY_MATCH_FULL")) return "All 8 seats are taken.";
  if (message.includes("CITY_NOT_ENOUGH_PLAYERS")) return "You need at least 2 players to start.";
  if (message.includes("CITY_PLAYERS_NOT_READY")) return "Everyone needs to be ready first.";
  if (message.includes("CITY_MATCH_ALREADY_STARTED")) return "The match has already started.";
  if (message.includes("CITY_MATCH_ALREADY_EXISTS")) return "A match is already open in this room.";
  if (message.includes("CITY_NOT_ROOM_MEMBER")) return "Join the room before taking a seat.";
  if (message.includes("CITY_RATE_LIMIT")) return "Slow down a moment, then try again.";
  if (message.includes("CITY_NOT_YOUR_TURN")) return "It's not your turn yet.";
  if (message.includes("CITY_WRONG_PHASE")) return "You've already rolled this turn.";
  if (message.includes("CITY_MUST_ROLL_FIRST")) return "Roll the dice before ending your turn.";
  if (message.includes("CITY_MATCH_NOT_ACTIVE")) return "This match isn't running.";
  if (message.includes("CITY_NOT_SEATED")) return "You're spectating this match.";
  return "That didn't work. Please try again.";
}
