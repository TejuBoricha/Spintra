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
  /** Set while a context outside the active player's control owns the clock —
   *  an auction, mainly. A client offering to claim a timeout must treat this
   *  the same as "not running": there is nothing stalled to resolve. */
  turn_clock_paused_at: string | null;
  pace_seconds: number;
  last_roll: number[] | null;
  /** The full roll/landing outcome, same shape as CityRollResult below —
   *  lets every client narrate the most recent roll, not just the one
   *  browser tab that made it. Compare `last_roll_turn` to `turn_number`
   *  before trusting it: once the turn advances, it's describing the past. */
  last_roll_result: CityRollResult | null;
  last_roll_turn: number | null;
  doubles_count: number;
  turn_number: number;
  /** Set only while status is 'paused' (FR-31) — every seat was away with
   *  nobody left to hand the turn to. Cleared automatically the moment
   *  anyone reconnects, which also resumes the match server-side. */
  paused_at: string | null;
  /** Fixed 90s window for a stalled forced-liquidation decision (FR-33/
   *  FR-42) — independent of pace_seconds. Only meaningful while the active
   *  seat has pending_debt > 0. */
  debt_started_at: string | null;
  /** Set while the active seat's own outgoing trade proposal has paused
   *  their turn clock (FR-33). Past 45s of no response, city_claim_timeout's
   *  own escape hatch may force-withdraw it and resume the clock. */
  trade_pause_started_at: string | null;
  /** Running total (ms) of trade-pause time already spent this turn — capped
   *  at 90000 (FR-33), after which no further proposal pauses the clock. */
  trade_pause_ms_used: number;
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
  /** Set the moment this seat's underlying room presence drops (BUG-007 round
   *  A); cleared on reconnect. Past the 60s grace period, the server treats
   *  this seat as away for autopilot/auction purposes — mirrored here for
   *  display only, never trusted for any actual gating client-side. */
  disconnected_at: string | null;
  /** How many turns in a row this seat has been autopiloted (FR-28). Forced
   *  retire happens server-side at 2; shown here as an early warning. */
  consecutive_autopilot_turns: number;
  /** Why a non-active seat left play — null while still active. */
  exit_reason: "voluntary" | "departed" | "autopilot_forced" | null;
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

/** One row of a finished match's standings, from the `city_match_results` view. */
export interface CityResult {
  match_id: string;
  seat: number;
  username: string;
  status: string;
  final_net_worth: number | null;
  place: number;
  finished_at: string;
  mode: string;
}

export interface CityAuction {
  id: string;
  space_idx: number;
  high_bid: number;
  high_seat: number | null;
  passed_seats: number[];
  ends_at: string;
  hard_ends_at: string;
}

/**
 * One row of the persistent activity feed (migration 0093) — rolled, bought,
 * rent_paid, tax_paid, built, sold_building, mortgaged, unmortgaged,
 * auction_started, auction_won, auction_unsold, trade_accepted, bankrupt,
 * retired. `payload` carries space indexes and seats, never names — every
 * client already holds the static board and seat list and resolves those
 * locally, so a feed row never needs to be kept in sync with anything.
 * Deliberately not exhaustive (v1): turn-change, trade proposed/declined/
 * withdrawn, and detention exits are not logged — see TASKS.md.
 */
export interface CityMatchEvent {
  id: number;
  created_at: string;
  kind: string;
  actor_seat: number | null;
  payload: Record<string, unknown>;
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
  /** FR-43: true while the recipient is the active seat — inactionable
   *  (accept/decline both refused server-side) until their turn ends, so
   *  it can neither consume nor freeze their own turn clock. */
  queued: boolean;
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
  "started_at, turn_started_at, turn_clock_paused_at, pace_seconds, last_roll, " +
  "last_roll_result, last_roll_turn, doubles_count, turn_number, paused_at, " +
  "debt_started_at, trade_pause_started_at, trade_pause_ms_used";

const SEAT_COLUMNS =
  "id, match_id, user_id, seat, username, is_ready, status, position, cash, " +
  "pending_debt, pending_creditor_seat, in_detention, detention_turns, transit_visas, " +
  "disconnected_at, consecutive_autopilot_turns, exit_reason";

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
  createMatch: (
    mode: "classic" | "timed",
    timeLimitMinutes?: number,
    paceSeconds?: 25 | 40 | 60
  ) => Promise<void>;
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
  retireSelf: () => Promise<void>;
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
  auction: CityAuction | null;
  results: CityResult[];
  /** The persistent activity feed, oldest first, for the live match only —
   *  cleared and reloaded whenever `match.id` changes. */
  events: CityMatchEvent[];
  placeBid: (amount: number) => Promise<void>;
  passAuction: () => Promise<void>;
  settleAuction: () => Promise<void>;
  claimTimeout: () => Promise<void>;
  /** City's own postgres_changes channel status — separate from the room's
   *  base chat/participants channel (use-room-subscription.ts), which can
   *  stay connected while this one drops. "connected" in demo mode too:
   *  there's no channel to lose. */
  realtimeStatus: "connected" | "reconnecting" | "offline";
  refetch: () => Promise<void>;
}

// A code-review pass found the events feed's initial full-page load and its
// realtime top-up (fetchNewEvents, below) could race each other for the same
// match — whichever resolved second would blindly replace/append over the
// other, silently dropping a row or duplicating one, and neither derived
// its next cursor from the other's result. Merging by id instead of
// replacing or blind-appending closes both: two overlapping fetches for the
// same rows just overwrite the same Map keys (no duplicates), and a slower
// stale response can never erase a row a faster one already added (the
// merged array is always a superset). The cursor is derived from the merged
// result's own max id rather than from whichever response happened to
// arrive, so it can't be rolled backward by a late responder either.
function mergeEvents(prev: CityMatchEvent[], incoming: CityMatchEvent[]): CityMatchEvent[] {
  if (incoming.length === 0) return prev;
  const byId = new Map(prev.map((e) => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

// Resets dependent state when a derived key changes, adjusted during render
// (React's documented pattern for this — see the two call sites below) rather
// than a synchronous setState at the top of an effect, which the react-hooks/
// set-state-in-effect lint rule forbids. Deliberately backed by useState, not
// useRef: reading/writing a ref during render is exactly what the react-hooks/
// refs rule (see the comment above `refetch`'s coalescing refs) forbids.
function useResetOnChange<K>(key: K, onChange: () => void): void {
  const [prevKey, setPrevKey] = useState<K>(key);
  if (prevKey !== key) {
    setPrevKey(key);
    onChange();
  }
}

// Shared by `refetch` (full bundle) and `makeNarrowRefetch` (single-table)
// below — see the BUG-037 comment on `refetch` for why coalescing exists.
const REFETCH_COALESCE_MS = 80;

// A coalesced, single-table refetcher — the same debounce shape as `refetch`
// above, but scoped to one table instead of the full 5-query bundle. Kept as
// a plain factory (not a hook) so it can be constructed inside the
// subscription effect below, where reading matchIdRef.current is safe (an
// effect runs after render, not during it — see the react-hooks/refs
// comment above `refetch`).
//
// Two failure modes a code-review pass caught in the first version of this
// function, both fixed the same way `fetchNewEvents` above already handles
// its own overlapping-fetch problem (the `isFetchingEventsRef`/
// `queuedEventsFetchRef` do/while loop):
//   1. A trigger() call that arrived while a fetch was already in flight
//      used to be silently absorbed into that fetch's own promise with no
//      further fetch scheduled — a second auction bid landing mid-request
//      could go unobserved until an unrelated later ping happened to fire.
//      `queued` now records that a newer ping arrived and immediately
//      re-runs the query once the in-flight one finishes, so the latest
//      state is never left unread.
//   2. cancel() used to only clear the pending setTimeout — a query already
//      in flight when the owning effect tore down (a room/match switch)
//      would still resolve later and call apply() with data read for a
//      match that's no longer current. `cancelled` is now checked before
//      every apply() call, including one for a request that was already
//      in flight at cancel() time.
function makeNarrowRefetch<T>(
  table: string,
  apply: (rows: T[] | null) => void,
  query: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): { trigger: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isFetching = false;
  let queued = false;
  let cancelled = false;

  const runOnce = () => {
    isFetching = true;
    void Promise.resolve(query())
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          console.error(`Failed to refresh ${table}:`, fetchError);
          return;
        }
        apply(data);
      })
      .finally(() => {
        isFetching = false;
        if (queued && !cancelled) {
          queued = false;
          runOnce();
        }
      });
  };

  return {
    trigger: () => {
      if (cancelled) return;
      if (isFetching) {
        queued = true;
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        runOnce();
      }, REFETCH_COALESCE_MS);
    },
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export function useCityMatch(roomCode: string, currentUserId: string): UseCityMatchResult {
  const [match, setMatch] = useState<CityMatch | null>(null);
  const [seats, setSeats] = useState<CitySeat[]>([]);
  const [board, setBoard] = useState<CityBoardSpace[]>([]);
  const [assets, setAssets] = useState<CityAsset[]>([]);
  const [lastRoll, setLastRoll] = useState<CityRollResult | null>(null);
  const [offers, setOffers] = useState<CityTradeOffer[]>([]);
  const [auction, setAuction] = useState<CityAuction | null>(null);
  const [results, setResults] = useState<CityResult[]>([]);
  const [events, setEvents] = useState<CityMatchEvent[]>([]);
  // Highest event id already in `events`, for the incremental fetch below —
  // a ref because it drives no rendering itself and must survive across the
  // per-ping fetch without becoming a dependency that rebuilds the channel.
  const lastEventIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<"connected" | "reconnecting" | "offline">("connected");
  const realtimeOfflineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // lastRoll is only ever cleared by the roller's own endTurn() click — a
  // turn that ends any other way (timeout, forced bankruptcy, autopilot)
  // left it set, so this same player's *next* turn could show stale "you
  // rolled X, moved to Y" narration instead of "your turn — roll the dice."
  // Clearing on every turn-number change closes the gap regardless of how
  // the previous turn ended.
  useResetOnChange(match?.turn_number, () => setLastRoll(null));

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

  const doRefetch = useCallback(async () => {
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
      // No live match. There may still be a finished one to report — the recap
      // has to survive the match leaving the live set, or it would vanish the
      // instant it was produced.
      const { data: last } = await supabase
        .from("city_match_results")
        .select("match_id, seat, username, status, final_net_worth, place, finished_at, mode")
        .eq("room_code", roomCode)
        .order("finished_at", { ascending: false })
        .order("place", { ascending: true })
        .limit(16);
      const rows = (last ?? []) as unknown as CityResult[];
      const newest = rows[0]?.match_id;
      setResults(newest ? rows.filter((r) => r.match_id === newest) : []);
      setIsLoading(false);
      return;
    }

    setResults([]);

    const nextMatch = matchRow as unknown as CityMatch;
    setMatch(nextMatch);

    // city_trade_offers/city_auctions are deliberately NOT part of this
    // bundle — see the dedicated match-id-keyed load effect and the narrow
    // refetchers below for why. A code-review pass found that reading them
    // here too, alongside the narrow per-table refetch this file also
    // added, created two independently-timed pipelines both writing
    // auction/offers state: whichever happened to resolve last won, even if
    // it read stale data started before the other's fresher read. Splitting
    // ownership so exactly one pipeline ever writes each table removes the
    // race by construction instead of trying to out-sequence it.
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

  // BUG-037: every mutating command already calls refetch() itself once it
  // succeeds, and each row it touched also pings back over realtime — a
  // single build, for instance, changes both city_assets (no subscription,
  // so no ping) and city_match_players (cash), but a multi-seat effect like
  // collect_from_each changes several match_players rows in one
  // transaction, each firing its own realtime event to every connected
  // client. Un-coalesced, that is N nearly-simultaneous refetch() calls per
  // client for what is functionally one update. This collapses any calls
  // that land within one short window into a single underlying fetch, and
  // every caller's await resolves once that one fetch actually completes —
  // not a leading-edge throttle that would drop a solo action's own update.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchPromiseRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(() => {
    if (refetchPromiseRef.current) return refetchPromiseRef.current;
    const p = new Promise<void>((resolve) => {
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        void doRefetch().finally(() => {
          refetchPromiseRef.current = null;
          resolve();
        });
      }, REFETCH_COALESCE_MS);
    });
    refetchPromiseRef.current = p;
    return p;
  }, [doRefetch]);

  useEffect(
    () => () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    },
    []
  );


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

  // The activity feed's initial load — keyed on match.id (not roomCode), so a
  // client that joins mid-match sees its full history, and a fresh match in
  // the same room starts a fresh feed instead of appending onto the last
  // one's tail. Full page (last 200), not incremental — this is the one place
  // that legitimately re-reads from scratch; the realtime ping below only
  // ever fetches forward from here.
  //
  // The reset itself happens during render (same useResetOnChange pattern as
  // lastRoll above) rather than as a synchronous setState at the top of the
  // effect below, which the React Compiler lint rules forbid
  // (react-hooks/set-state-in-effect).
  useResetOnChange(match?.id ?? null, () => setEvents([]));

  useEffect(() => {
    lastEventIdRef.current = 0;
    if (!supabase || !match?.id) return;
    const loadingFor = match.id;
    let cancelled = false;
    void (async () => {
      const { data, error: eventsError } = await supabase
        .from("city_match_events")
        .select("id, created_at, kind, actor_seat, payload")
        .eq("match_id", loadingFor)
        .order("id", { ascending: false })
        .limit(200);
      // `cancelled` alone is sufficient: this effect is keyed on match?.id,
      // so a match change tears this instance down before a new one runs. A
      // second matchIdRef check was here too at one point; confirmed
      // redundant and removed.
      if (cancelled) return;
      if (eventsError) {
        console.error("Failed to load the city activity feed:", eventsError);
        return;
      }
      const rows = ((data ?? []) as unknown as CityMatchEvent[]).slice().reverse();
      setEvents((prev) => {
        const merged = mergeEvents(prev, rows);
        lastEventIdRef.current = merged.length ? merged[merged.length - 1].id : 0;
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, match?.id]);

  // The one-time load of city_trade_offers/city_auctions for a newly-current
  // match — doRefetch above deliberately excludes both (see its own
  // comment); this is the other half of that split. Keyed on match?.id
  // (not the subscription effect below, which intentionally excludes match
  // from its own deps) so this fires again whenever a fresh match starts in
  // the same room without a page reload, not just on first mount.
  useEffect(() => {
    if (!supabase || !match?.id) return;
    const loadingFor = match.id;
    let cancelled = false;
    void (async () => {
      const [{ data: offerRows }, { data: auctionRow }] = await Promise.all([
        supabase
          .from("city_trade_offers")
          .select(
            "id, from_seat, to_seat, give_spaces, get_spaces, give_cash, get_cash, status, expires_at, queued"
          )
          .eq("match_id", loadingFor)
          .eq("status", "pending"),
        supabase
          .from("city_auctions")
          .select("id, space_idx, high_bid, high_seat, passed_seats, ends_at, hard_ends_at")
          .eq("match_id", loadingFor)
          .eq("status", "running")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setOffers((offerRows ?? []) as unknown as CityTradeOffer[]);
      setAuction((auctionRow ?? null) as unknown as CityAuction | null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, match?.id]);

  // The activity feed's realtime top-up — fetches only rows past what's
  // already loaded (id > lastEventIdRef), unlike every other table here,
  // which refetches its whole current-state snapshot. Events are append-only
  // history, not current state, so "what changed" really does mean "what's
  // new since last time" here, not "re-read everything." mergeEvents (byid,
  // above) makes a duplicate fetch a no-op instead of a duplicate row; the
  // matchIdRef check discards a response for a match that's no longer live.
  //
  // This has been through several prior passes, each fixing a real bug the
  // last one introduced: unbounded -> capped ascending (self-healing via
  // repeated pings, but a single capped fetch could leave a gap behind the
  // initial-load effect's own most-recent-200 window) -> capped descending
  // (fixed that race, but for a plain backlog with no race at all, jumping
  // the cursor straight to "now" meant the skipped middle was gone for good)
  // -> a 20-page ascending loop (closed the gap properly, but a mid-loop
  // query error discarded every already-fetched page instead of keeping
  // partial progress, and concurrent pings each re-paged the same range from
  // scratch with no coordination). FETCH_LIMIT set generously above any real
  // match's per-ping backlog keeps the same self-healing property a single
  // capped ascending fetch already had — the cursor only advances to what
  // was actually merged, so a still-larger backlog is picked up whole by the
  // next ping rather than silently skipped — without a loop's multi-await
  // window or its all-or-nothing error handling. isFetchingRef/queuedRef
  // below replace the loop's per-page matchIdRef re-check for the one thing
  // a single query doesn't fix on its own: two pings landing close together
  // (e.g. a roll that also triggers a rent charge in the same transaction)
  // both reading the same stale cursor. Rather than dropping the second one
  // outright — which could lose whatever it was signalling if that row
  // wasn't yet visible to the first query — it's coalesced into exactly one
  // more run right after the first finishes.
  const FETCH_LIMIT = 2000;
  const isFetchingEventsRef = useRef(false);
  const queuedEventsFetchRef = useRef(false);
  const fetchNewEvents = useCallback(async () => {
    if (!supabase || !matchIdRef.current) return;
    if (isFetchingEventsRef.current) {
      queuedEventsFetchRef.current = true;
      return;
    }
    isFetchingEventsRef.current = true;
    try {
      do {
        queuedEventsFetchRef.current = false;
        const fetchingFor: string | null = matchIdRef.current;
        if (!fetchingFor) break;
        const { data, error: eventsError } = await supabase
          .from("city_match_events")
          .select("id, created_at, kind, actor_seat, payload")
          .eq("match_id", fetchingFor)
          .gt("id", lastEventIdRef.current)
          .order("id", { ascending: true })
          .limit(FETCH_LIMIT);
        if (matchIdRef.current !== fetchingFor) break;
        if (eventsError) {
          console.error("Failed to load new city activity events:", eventsError);
          break;
        }
        const rows = (data ?? []) as unknown as CityMatchEvent[];
        if (rows.length === 0) continue;
        if (rows.length === FETCH_LIMIT) {
          // Not silent: the next ping (a future INSERT, or SUBSCRIBED on
          // reconnect) resumes right where this cursor lands, same
          // self-healing property the ascending order already relies on.
          console.warn(
            `City activity feed hit its ${FETCH_LIMIT}-row fetch cap — more events may remain.`
          );
        }
        setEvents((prev) => {
          const merged = mergeEvents(prev, rows);
          lastEventIdRef.current = merged.length ? merged[merged.length - 1].id : 0;
          return merged;
        });
      } while (queuedEventsFetchRef.current);
    } finally {
      isFetchingEventsRef.current = false;
    }
  }, [supabase]);

  // Realtime as a notifier only: a change ping triggers a refetch of
  // RLS-gated rows rather than trusting a broadcast payload to carry state.
  // This is what keeps authoritative data behind row-level security instead of
  // on a channel any room member could read (SPEC.md §5.1).
  //
  // city_auctions and city_match_players carry no server-side filter here —
  // Realtime bakes a `filter:` value in at subscribe time, but matchIdRef can
  // change mid-session (a post-match flow opens a fresh match in the same
  // room without remounting this hook), so a baked-in match_id would go stale
  // exactly when a new match starts. The guard below is client-side and reads
  // matchIdRef live on every event instead, which is what city_match_players
  // already did; city_auctions and city_trade_offers previously had no guard
  // at all, so a trade or auction in ANY match, in ANY room, forced this
  // client to run a full refetch — proven behaviourally in the 2026-08-30 QA
  // audit (BUG-038): activity in a wholly separate room and match caused an
  // idle client's five-query refetch to fire.
  useEffect(() => {
    if (!supabase) return;

    const narrowIfCurrentMatch =
      (narrow: () => void) =>
      (payload: { new: object; old: object }) => {
        const changedMatchId =
          (payload.new as { match_id?: string })?.match_id ??
          (payload.old as { match_id?: string })?.match_id;
        if (!matchIdRef.current || changedMatchId === matchIdRef.current) {
          narrow();
        }
      };

    // Constructed here (effect phase, not render) so matchIdRef.current is
    // safe to read inside the query closures below.
    const auctionRefetcher = makeNarrowRefetch<CityAuction>(
      "city_auctions",
      (rows) => {
        setError(null);
        setAuction((rows?.[0] as CityAuction | undefined) ?? null);
      },
      () => {
        const id = matchIdRef.current;
        if (!id) return Promise.resolve({ data: null, error: null });
        return supabase
          .from("city_auctions")
          .select("id, space_idx, high_bid, high_seat, passed_seats, ends_at, hard_ends_at")
          .eq("match_id", id)
          .eq("status", "running")
          .limit(1) as unknown as PromiseLike<{
          data: CityAuction[] | null;
          error: { message: string } | null;
        }>;
      }
    );

    const offersRefetcher = makeNarrowRefetch<CityTradeOffer>(
      "city_trade_offers",
      (rows) => {
        setError(null);
        setOffers(rows ?? []);
      },
      () => {
        const id = matchIdRef.current;
        if (!id) return Promise.resolve({ data: null, error: null });
        return supabase
          .from("city_trade_offers")
          .select(
            "id, from_seat, to_seat, give_spaces, get_spaces, give_cash, get_cash, status, expires_at, queued"
          )
          .eq("match_id", id)
          .eq("status", "pending") as unknown as PromiseLike<{
          data: CityTradeOffer[] | null;
          error: { message: string } | null;
        }>;
      }
    );

    // city_matches/city_match_players changes go through refetch()'s own
    // bundle (match/seats/assets) AND both narrow auction/offers
    // refetchers — never just refetch() alone. Auction/offer state has
    // exactly one owner now (this pair of refetchers, everywhere), which is
    // what actually closes a race a code-review pass found: two
    // independently-timed pipelines both able to write `auction`/`offers`
    // meant whichever happened to resolve last won, even reading data
    // started before the other's fresher read. The specific transactions
    // that need this (settle-auction clearing the auction via a
    // city_matches phase change, accept-trade via a city_match_players cash
    // change, decline-purchase starting one) don't self-identify in the
    // realtime payload, so every ping on these two tables re-triggers both
    // narrow refetchers rather than trying to detect which ones need it —
    // cheap, since each is a small single-table query the shared
    // in-flight/coalesce logic above already collapses bursts of.
    const refetchIfCurrentMatch = (payload: {
      new: object;
      old: object;
    }) => {
      const changedMatchId =
        (payload.new as { match_id?: string })?.match_id ??
        (payload.old as { match_id?: string })?.match_id;
      if (!matchIdRef.current || changedMatchId === matchIdRef.current) {
        void refetch();
        auctionRefetcher.trigger();
        offersRefetcher.trigger();
      }
    };

    const channel = supabase
      .channel(`city:${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "city_matches", filter: `room_code=eq.${roomCode}` },
        () => {
          void refetch();
          auctionRefetcher.trigger();
          offersRefetcher.trigger();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "city_auctions" },
        narrowIfCurrentMatch(() => void auctionRefetcher.trigger())
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "city_trade_offers" },
        narrowIfCurrentMatch(() => void offersRefetcher.trigger())
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "city_match_players" },
        refetchIfCurrentMatch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "city_match_events" },
        (payload: { new: object }) => {
          const changedMatchId = (payload.new as { match_id?: string })?.match_id;
          if (!matchIdRef.current || changedMatchId === matchIdRef.current) {
            void fetchNewEvents();
          }
        }
      )
      // BUG-042: this channel had no status callback at all, so a dropped
      // subscription here was invisible — the UI kept showing whatever data
      // it last had with no signal anything was wrong. Mirrors
      // use-room-subscription.ts's own SUBSCRIBED/else handling and its
      // 20s escalation from "still retrying" to a harder "offline" state.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (realtimeOfflineTimerRef.current) {
            clearTimeout(realtimeOfflineTimerRef.current);
            realtimeOfflineTimerRef.current = null;
          }
          // A code-review pass caught a gap the events feed didn't share
          // with the rest of this file: every other table gets a fresh read
          // on every reconnect via refetch() below, but fetchNewEvents only
          // ever ran on a live INSERT ping — if the channel dropped right as
          // a match's last event fired (its own closing bankrupt/finish
          // row), nothing would ever trigger the catch-up that would have
          // picked it up. Firing it here closes that gap the same way
          // refetch() already does for current state.
          void fetchNewEvents();
          setRealtimeStatus("connected");
        } else {
          setRealtimeStatus("reconnecting");
          if (!realtimeOfflineTimerRef.current) {
            realtimeOfflineTimerRef.current = setTimeout(() => {
              realtimeOfflineTimerRef.current = null;
              setRealtimeStatus("offline");
            }, 20_000);
          }
        }
      });

    return () => {
      if (realtimeOfflineTimerRef.current) {
        clearTimeout(realtimeOfflineTimerRef.current);
        realtimeOfflineTimerRef.current = null;
      }
      auctionRefetcher.cancel();
      offersRefetcher.cancel();
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomCode, refetch, fetchNewEvents]);

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
    async (mode: "classic" | "timed", timeLimitMinutes?: number, paceSeconds?: 25 | 40 | 60) => {
      await runCommand(() =>
        // p_time_limit_minutes/p_pace_seconds are omitted rather than passed
        // as null so the function's own defaults apply.
        supabase!.rpc("city_create_match", {
          p_room_code: roomCode,
          p_mode: mode,
          ...(timeLimitMinutes !== undefined ? { p_time_limit_minutes: timeLimitMinutes } : {}),
          ...(paceSeconds !== undefined ? { p_pace_seconds: paceSeconds } : {}),
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

  // FR-29: a deliberate "I'm leaving" action, distinct from a disconnect.
  // Routes server-side through the same retire/liquidation sequence kick and
  // ban already use (city_retire_seat via city_retire_self, migration 0083).
  const retireSelf = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    await runCommand(() => supabase!.rpc("city_retire_self", { p_match_id: id }));
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

  const placeBid = useCallback(
    async (amount: number) => {
      const id = matchIdRef.current;
      if (!id) return;
      await runCommand(() => supabase!.rpc("city_place_bid", { p_match_id: id, p_amount: amount }));
    },
    [runCommand, supabase]
  );

  const passAuction = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    await runCommand(() => supabase!.rpc("city_pass_auction", { p_match_id: id }));
  }, [runCommand, supabase]);

  // Shared by settleAuction and claimTimeout below: both are fired
  // optimistically by every client watching the same deadline (the server
  // re-derives whether it's actually passed, so an early or duplicate call is
  // simply refused), so losing that race — another client's call landed
  // first, or it genuinely isn't over yet — is the ordinary case, not a
  // failure. console.error was previously unconditional in each, so Next's
  // dev overlay popped a full-screen "Console Error" (reading as an opaque
  // "{}" — Error objects don't have enumerable own properties, so the
  // overlay's JSON.stringify renders one that way regardless of what the
  // real error says) for completely normal gameplay, on nearly every race
  // either of these is designed to lose. Logged (and surfaced) only for an
  // actually-unexpected outcome.
  const runRaceableCommand = useCallback(
    async (rpcName: "city_settle_auction" | "city_claim_timeout", expectedRaceCodes: RegExp, logLabel: string) => {
      const id = matchIdRef.current;
      if (!supabase || !id) return;
      const { error: e } = await supabase.rpc(rpcName, { p_match_id: id });
      if (e) {
        if (!expectedRaceCodes.test(e.message)) {
          console.error(`${logLabel} failed:`, e);
          setError(friendlyCommandError(e.message));
        }
        return;
      }
      await refetch();
    },
    [supabase, refetch]
  );

  // Called by whichever client notices the deadline pass.
  const settleAuction = useCallback(
    () =>
      runRaceableCommand(
        "city_settle_auction",
        /CITY_AUCTION_STILL_RUNNING|CITY_NO_AUCTION/,
        "City settle-auction"
      ),
    [runRaceableCommand]
  );

  // Same shape as settleAuction: any client — including the stalled player's
  // own, if their tab is merely idle — may attempt this once its local clock
  // says the turn has run past pace_seconds.
  const claimTimeout = useCallback(
    () =>
      runRaceableCommand(
        "city_claim_timeout",
        /CITY_TURN_CLOCK_STILL_RUNNING|CITY_TURN_CLOCK_PAUSED/,
        "City claim-timeout"
      ),
    [runRaceableCommand]
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
    realtimeStatus: isDemoMode ? "connected" : realtimeStatus,
    refetch,
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
    retireSelf,
    offers,
    proposeTrade,
    acceptTrade,
    declineTrade,
    withdrawTrade,
    leaveDetention,
    auction,
    results,
    events,
    placeBid,
    passAuction,
    settleAuction,
    claimTimeout,
  };
}

// Data, not control flow: each RPC error code maps to one copy string. Order
// doesn't matter — every CITY_* code below is a distinct, non-overlapping
// substring of any other (none is a prefix/suffix of another), so at most
// one entry can ever match a given message.
const COMMAND_ERROR_COPY: Record<string, string> = {
  CITY_NOT_HOST: "Only the host can do that.",
  CITY_MATCH_FULL: "All 8 seats are taken.",
  CITY_NOT_ENOUGH_PLAYERS: "You need at least 2 players to start.",
  CITY_PLAYERS_NOT_READY: "Everyone needs to be ready first.",
  CITY_MATCH_ALREADY_STARTED: "The match has already started.",
  CITY_MATCH_ALREADY_EXISTS: "A match is already open in this room.",
  CITY_NOT_ROOM_MEMBER: "Join the room before taking a seat.",
  CITY_RATE_LIMIT: "Slow down a moment, then try again.",
  CITY_NOT_YOUR_TURN: "It's not your turn yet.",
  CITY_WRONG_PHASE: "You've already rolled this turn.",
  CITY_MUST_ROLL_FIRST: "Roll the dice before ending your turn.",
  CITY_MATCH_NOT_ACTIVE: "This match isn't running.",
  CITY_NOT_SEATED: "You're spectating this match.",
  CITY_DECISION_PENDING: "Decide on this space before ending your turn.",
  CITY_TURN_CLOCK_PAUSED: "A trade is in progress — wait for it to resolve.",
  CITY_INSUFFICIENT_FUNDS: "You can't afford that.",
  CITY_ALREADY_OWNED: "Someone already owns that.",
  CITY_NOTHING_TO_BUY: "There's nothing to buy here.",
  CITY_SEAT_OUT: "You're out of this match.",
  CITY_SETTLE_DEBT_FIRST: "Settle what you owe first.",
  CITY_SET_INCOMPLETE: "You need the whole country before building.",
  CITY_EVEN_BUILD: "Build and sell evenly across a country.",
  CITY_SELL_BUILDINGS_FIRST: "Sell its buildings before mortgaging.",
  CITY_FULLY_BUILT: "That's fully built already.",
  CITY_NOTHING_BUILT: "There's nothing built there.",
  CITY_ALREADY_MORTGAGED: "That's already mortgaged.",
  CITY_NOT_MORTGAGED: "That isn't mortgaged.",
  CITY_NOT_YOURS: "You don't own that.",
  CITY_CAN_PAY: "You can still cover this — sell or mortgage instead.",
  CITY_OFFER_STALE: "The terms changed since this was offered, so it wasn't applied.",
  CITY_OFFER_EXPIRED: "That offer has expired.",
  CITY_OFFER_CLOSED: "That offer is no longer open.",
  CITY_NOT_YOUR_OFFER: "That isn't your offer to answer.",
  CITY_DEVELOPED_CANNOT_TRADE: "Sell the buildings in that country before trading it.",
  CITY_THEY_CANT_AFFORD: "They don't have that much cash.",
  CITY_NOT_THEIRS: "They don't own that.",
  CITY_IN_DETENTION: "You're in Customs — get out first.",
  CITY_NOT_DETAINED: "You're not in Customs.",
  CITY_NO_VISA: "You don't have a Transit Visa.",
  CITY_AUCTION_RUNNING: "Finish the auction first.",
  CITY_BID_TOO_LOW: "Bid higher than the standing bid.",
  CITY_BID_NOT_A_STEP: "Bids go up in tens.",
  CITY_AUCTION_CLOSED: "That auction has closed.",
  CITY_NO_AUCTION: "There's no auction running.",
  CITY_OFFER_QUEUED: "That offer is queued until your turn ends.",
};

function friendlyCommandError(message: string): string {
  const code = Object.keys(COMMAND_ERROR_COPY).find((c) => message.includes(c));
  return code ? COMMAND_ERROR_COPY[code] : "That didn't work. Please try again.";
}
