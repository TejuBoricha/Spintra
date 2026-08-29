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

export interface CityMatch {
  id: string;
  room_code: string;
  status: CityMatchStatus;
  mode: "classic" | "timed";
  time_limit_minutes: number | null;
  current_seat: number | null;
  phase: string | null;
  created_by: string;
  started_at: string | null;
}

export interface CitySeat {
  id: string;
  match_id: string;
  user_id: string;
  seat: number;
  username: string;
  is_ready: boolean;
  status: "seated" | "active" | "bankrupt" | "retired";
}

// The RNG columns (rng_seed, rng_counter) are intentionally absent from both
// the interface above and this select list. They're also revoked at the
// column-grant level in migration 0063 — asking for them would fail rather
// than silently leak. Listing columns explicitly (not `*`) keeps the client
// honest about that boundary.
const MATCH_COLUMNS =
  "id, room_code, status, mode, time_limit_minutes, current_seat, phase, created_by, started_at";

interface UseCityMatchResult {
  match: CityMatch | null;
  seats: CitySeat[];
  isLoading: boolean;
  error: string | null;
  isDemoMode: boolean;
  mySeat: CitySeat | null;
  createMatch: (mode: "classic" | "timed", timeLimitMinutes?: number) => Promise<void>;
  joinSeat: (username: string) => Promise<void>;
  leaveSeat: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  startMatch: () => Promise<void>;
}

export function useCityMatch(roomCode: string, currentUserId: string): UseCityMatchResult {
  const [match, setMatch] = useState<CityMatch | null>(null);
  const [seats, setSeats] = useState<CitySeat[]>([]);
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

    const { data: seatRows } = await supabase
      .from("city_match_players")
      .select("id, match_id, user_id, seat, username, is_ready, status")
      .eq("match_id", nextMatch.id)
      .order("seat", { ascending: true });

    setSeats((seatRows ?? []) as unknown as CitySeat[]);
    setIsLoading(false);
  }, [supabase, roomCode]);

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

  return {
    match,
    seats,
    isLoading,
    error,
    isDemoMode,
    mySeat: seats.find((s) => s.user_id === currentUserId) ?? null,
    createMatch,
    joinSeat,
    leaveSeat,
    setReady,
    startMatch,
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
  return "That didn't work. Please try again.";
}
