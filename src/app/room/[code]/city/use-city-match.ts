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
  /** >0 while this seat owes money it could not cover in cash (DESIGN.md §3.1D). */
  pending_debt: number;
  pending_creditor_seat: number | null;
  in_detention: boolean;
  detention_turns: number;
  transit_visas: number;
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

export interface CityTradeOffer {
  id: string;
  from_seat: number;
  to_seat: number;
  give_spaces: number[];
  get_spaces: number[];
  give_cash: number;
  get_cash: number;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
  expires_at: string;
}

/**
 * What landing on the space actually did. Resolved inside the same transaction
 * as the roll — if this were a second RPC the client had to make, a client
 * could simply never call it and never pay rent.
 */
export interface CityLanding {
  action:
    | "none"
    | "own_space"
    | "no_rent"
    | "mortgaged_no_rent"
    | "may_buy"
    | "paid_rent"
    | "paid_tax"
    | "bankrupt"
    | "must_raise_funds"
    | "detained"
    | "card";
  price?: number;
  space?: number;
  amount?: number;
  owed?: number;
  short_by?: number;
  to_seat?: number | null;
  to?: number;
  deck?: string;
  /** printed card text, when action is "card" */
  text?: string;
  /** what the card then did — its own landing may nest inside */
  result?: CityLanding & { kind?: string; landing?: CityLanding };
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
  landing: CityLanding;
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
  "id, match_id, user_id, seat, username, is_ready, status, position, cash, " +
  "pending_debt, pending_creditor_seat, in_detention, detention_turns, transit_visas";

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
  buyProperty: () => Promise<void>;
  declinePurchase: () => Promise<void>;
  build: (spaceIdx: number) => Promise<void>;
  sellBuilding: (spaceIdx: number) => Promise<void>;
  mortgage: (spaceIdx: number) => Promise<void>;
  unmortgage: (spaceIdx: number) => Promise<void>;
  declareBankruptcy: () => Promise<void>;
  offers: CityTradeOffer[];
  proposeTrade: (args: {
    toSeat: number;
    giveSpaces: number[];
    getSpaces: number[];
    giveCash: number;
    getCash: number;
  }) => Promise<void>;
  acceptTrade: (offerId: string) => Promise<void>;
  declineTrade: (offerId: string) => Promise<void>;
  withdrawTrade: (offerId: string) => Promise<void>;
  leaveDetention: (method: "pay" | "visa" | "roll") => Promise<void>;
}

export function useCityMatch(roomCode: string, currentUserId: string): UseCityMatchResult {
  const [match, setMatch] = useState<CityMatch | null>(null);
  const [seats, setSeats] = useState<CitySeat[]>([]);
  const [board, setBoard] = useState<CityBoardSpace[]>([]);
  const [assets, setAssets] = useState<CityAsset[]>([]);
  const [lastRoll, setLastRoll] = useState<CityRollResult | null>(null);
  const [offers, setOffers] = useState<CityTradeOffer[]>([]);
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

    const [{ data: seatRows }, { data: assetRows }, { data: offerRows }] = await Promise.all([
      supabase
        .from("city_match_players")
        .select(SEAT_COLUMNS)
        .eq("match_id", nextMatch.id)
        .order("seat", { ascending: true }),
      supabase
        .from("city_assets")
        .select("space_idx, owner_seat, buildings, is_mortgaged")
        .eq("match_id", nextMatch.id),
      supabase
        .from("city_trade_offers")
        .select("id, from_seat, to_seat, give_spaces, get_spaces, give_cash, get_cash, status, expires_at")
        .eq("match_id", nextMatch.id)
        .eq("status", "pending"),
    ]);

    setSeats((seatRows ?? []) as unknown as CitySeat[]);
    setAssets((assetRows ?? []) as unknown as CityAsset[]);
    setOffers((offerRows ?? []) as unknown as CityTradeOffer[]);
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
        { event: "*", schema: "public", table: "city_trade_offers" },
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

  const buyProperty = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    await runCommand(() => supabase!.rpc("city_buy_property", { p_match_id: id }));
  }, [runCommand, supabase]);

  const declinePurchase = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    await runCommand(() => supabase!.rpc("city_decline_purchase", { p_match_id: id }));
  }, [runCommand, supabase]);

  // Every property command takes the same shape: one space index, validated
  // entirely server-side. The client never decides whether a move is legal —
  // it only decides what to ask for.
  const spaceCommand = useCallback(
    (fn: "city_build" | "city_sell_building" | "city_mortgage" | "city_unmortgage") =>
      async (spaceIdx: number) => {
        const id = matchIdRef.current;
        if (!id) return;
        await runCommand(() => supabase!.rpc(fn, { p_match_id: id, p_space_idx: spaceIdx }));
      },
    [runCommand, supabase]
  );

  const build = spaceCommand("city_build");
  const sellBuilding = spaceCommand("city_sell_building");
  const mortgage = spaceCommand("city_mortgage");
  const unmortgage = spaceCommand("city_unmortgage");

  const declareBankruptcy = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    await runCommand(() => supabase!.rpc("city_declare_bankruptcy", { p_match_id: id }));
  }, [runCommand, supabase]);

  const proposeTrade = useCallback(
    async (args: {
      toSeat: number;
      giveSpaces: number[];
      getSpaces: number[];
      giveCash: number;
      getCash: number;
    }) => {
      const id = matchIdRef.current;
      if (!id) return;
      await runCommand(() =>
        supabase!.rpc("city_propose_trade", {
          p_match_id: id,
          p_to_seat: args.toSeat,
          p_give_spaces: args.giveSpaces,
          p_get_spaces: args.getSpaces,
          p_give_cash: args.giveCash,
          p_get_cash: args.getCash,
        })
      );
    },
    [runCommand, supabase]
  );

  const acceptTrade = useCallback(
    async (offerId: string) => {
      await runCommand(() => supabase!.rpc("city_accept_trade", { p_offer_id: offerId }));
    },
    [runCommand, supabase]
  );

  const resolveTrade = useCallback(
    (action: "declined" | "withdrawn") => async (offerId: string) => {
      await runCommand(() =>
        supabase!.rpc("city_resolve_trade", { p_offer_id: offerId, p_action: action })
      );
    },
    [runCommand, supabase]
  );
  const declineTrade = resolveTrade("declined");
  const withdrawTrade = resolveTrade("withdrawn");

  const leaveDetention = useCallback(
    async (method: "pay" | "visa" | "roll") => {
      const id = matchIdRef.current;
      if (!id) return;
      await runCommand(() =>
        supabase!.rpc("city_leave_detention", { p_match_id: id, p_method: method })
      );
    },
    [runCommand, supabase]
  );

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
    buyProperty,
    declinePurchase,
    build,
    sellBuilding,
    mortgage,
    unmortgage,
    declareBankruptcy,
    offers,
    proposeTrade,
    acceptTrade,
    declineTrade,
    withdrawTrade,
    leaveDetention,
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
  if (message.includes("CITY_DECISION_PENDING")) return "Decide on this space before ending your turn.";
  if (message.includes("CITY_INSUFFICIENT_FUNDS")) return "You can't afford that.";
  if (message.includes("CITY_ALREADY_OWNED")) return "Someone already owns that.";
  if (message.includes("CITY_NOTHING_TO_BUY")) return "There's nothing to buy here.";
  if (message.includes("CITY_SEAT_OUT")) return "You're out of this match.";
  if (message.includes("CITY_SETTLE_DEBT_FIRST")) return "Settle what you owe first.";
  if (message.includes("CITY_SET_INCOMPLETE")) return "You need the whole country before building.";
  if (message.includes("CITY_EVEN_BUILD")) return "Build and sell evenly across a country.";
  if (message.includes("CITY_SELL_BUILDINGS_FIRST")) return "Sell its buildings before mortgaging.";
  if (message.includes("CITY_FULLY_BUILT")) return "That's fully built already.";
  if (message.includes("CITY_NOTHING_BUILT")) return "There's nothing built there.";
  if (message.includes("CITY_ALREADY_MORTGAGED")) return "That's already mortgaged.";
  if (message.includes("CITY_NOT_MORTGAGED")) return "That isn't mortgaged.";
  if (message.includes("CITY_NOT_YOURS")) return "You don't own that.";
  if (message.includes("CITY_CAN_PAY")) return "You can still cover this — sell or mortgage instead.";
  if (message.includes("CITY_OFFER_STALE"))
    return "The terms changed since this was offered, so it wasn't applied.";
  if (message.includes("CITY_OFFER_EXPIRED")) return "That offer has expired.";
  if (message.includes("CITY_OFFER_CLOSED")) return "That offer is no longer open.";
  if (message.includes("CITY_NOT_YOUR_OFFER")) return "That isn't your offer to answer.";
  if (message.includes("CITY_DEVELOPED_CANNOT_TRADE"))
    return "Sell the buildings in that country before trading it.";
  if (message.includes("CITY_THEY_CANT_AFFORD")) return "They don't have that much cash.";
  if (message.includes("CITY_NOT_THEIRS")) return "They don't own that.";
  if (message.includes("CITY_IN_DETENTION")) return "You're in Customs — get out first.";
  if (message.includes("CITY_NOT_DETAINED")) return "You're not in Customs.";
  if (message.includes("CITY_NO_VISA")) return "You don't have a Transit Visa.";
  return "That didn't work. Please try again.";
}
