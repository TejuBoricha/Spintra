"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Clock,
  Crown,
  Dices,
  Loader2,
  LogOut,
  Play,
  UserPlus,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectionBanner } from "@/components/ui/connection-banner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRoomActivity } from "../context/room-activity-context";
import { CityBoard } from "./city-board";
import { CityHoldings } from "./city-holdings";
import { CityTrade } from "./city-trade";
import { CityAuction } from "./city-auction";
import type { CityAuction as CityAuctionState, CityBoardSpace, CityRollResult, CitySeat } from "./use-city-match";
import { useCityMatch } from "./use-city-match";

// The lobby and the live match. See docs/SPINTRA_CITY_SPEC.md §7 for the slice
// plan that governs what is and isn't wired up yet.
//
// Rendered directly by room-client.tsx's RoomGameArea rather than through
// ACTIVITY_REGISTRY — Spintra City is server-authoritative and doesn't use the
// activity event bus at all (SPEC.md §5.3).

const MAX_SEATS = 8;
const MIN_PLAYERS = 2;

// Isolated from CityMatchShell (which previously ticked this same "now" at
// its own root, re-rendering the whole board/holdings/trade/auction subtree
// every 5s for a value only this badge needs) — same self-contained-tick
// idiom as TurnCountdown below. Only ticks at all while this specific seat
// is actually disconnected, and React.memo means an unrelated parent
// re-render never re-executes this component's body.
const SeatBadge = memo(function SeatBadge({
  seat: s,
  isCurrent,
}: {
  seat: CitySeat;
  isCurrent: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!s.disconnected_at) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [s.disconnected_at]);

  // BUG-007 round A/C/H: disconnected_at and consecutive_autopilot_turns
  // are both server-authoritative already (they gate autopilot and
  // forced retire) — this is display only, never a gate itself. A
  // terminal seat (retired/bankrupt) never shows either indicator —
  // both are cleared server-side the instant a seat exits, but a
  // client that fetched stale data before that clear would otherwise
  // show "Away"/"auto×N" forever on a seat that isn't coming back.
  const terminal = s.status === "bankrupt" || s.status === "retired";
  const disconnectedMs = s.disconnected_at ? now - new Date(s.disconnected_at).getTime() : 0;
  // FR-25: flagged the instant a disconnect is detected (no
  // gameplay effect yet) — only past the same 60s grace period
  // city_run_autopilot_from_current itself uses does "Away" mean
  // the server is now actually playing this seat's turns.
  const reconnecting = !terminal && !!s.disconnected_at && disconnectedMs < 60_000;
  const away = !terminal && !!s.disconnected_at && disconnectedMs >= 60_000;
  return (
    <Badge variant={isCurrent ? "default" : "secondary"} className={`gap-1 ${terminal ? "opacity-50" : ""}`}>
      <span className={terminal ? "line-through" : undefined}>{s.username}</span>
      {terminal ? (
        // A bare $0 read as "just poor," indistinguishable from an
        // active seat that's simply broke — an explicit label plus
        // the strikethrough/dimming above is what actually says
        // "this seat is out," at a glance, in the same badge row.
        <span className="text-[10px] uppercase tracking-wide">
          {s.status === "bankrupt" ? "bankrupt" : "retired"}
        </span>
      ) : (
        <span className="font-mono opacity-80">{s.cash.toLocaleString()}</span>
      )}
      {reconnecting && (
        <span
          className="flex items-center text-muted-foreground"
          title="Connection dropped — still their seat and their turn clock, for now"
        >
          <WifiOff className="w-3 h-3" aria-hidden="true" />
        </span>
      )}
      {away && (
        <span
          className="flex items-center text-amber-300"
          title="Disconnected — the server plays this seat's turns automatically until they return"
        >
          <WifiOff className="w-3 h-3" aria-hidden="true" />
        </span>
      )}
      {!terminal && s.consecutive_autopilot_turns > 0 && (
        <span
          className="font-mono text-[10px] text-amber-300"
          title={`${s.consecutive_autopilot_turns} turn(s) auto-played in a row — retired automatically at 2`}
        >
          auto×{s.consecutive_autopilot_turns}
        </span>
      )}
    </Badge>
  );
});

export function CityMatchShell() {
  const { roomCode, isHost, currentUser } = useRoomActivity();
  const [selected, setSelected] = useState<number | null>(null);
  const [isRetireConfirmOpen, setIsRetireConfirmOpen] = useState(false);
  // FR-42: chosen here, at match creation, not in RoomSettingsPanel — and
  // never touched again once city_create_match has written it.
  const [pacePreset, setPacePreset] = useState<25 | 40 | 60>(40);
  const {
    match,
    seats,
    board,
    assets,
    isLoading,
    error,
    isDemoMode,
    mySeat,
    isMyTurn,
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
    retireSelf,
    offers,
    proposeTrade,
    acceptTrade,
    declineTrade,
    withdrawTrade,
    leaveDetention,
    auction,
    placeBid,
    passAuction,
    settleAuction,
    claimTimeout,
    results,
    realtimeStatus,
    refetch,
  } = useCityMatch(roomCode, currentUser.id);

  // The escape hatch for a turn stuck on a player who is still in the room
  // but silent (a departed player is handled server-side the moment they
  // leave — see city_retire_seat). Any client — including the stalled
  // player's own, if their tab is merely idle — offers to claim a timeout
  // once its local clock says pace_seconds has genuinely elapsed. This is
  // only ever a convenience trigger: city_claim_timeout re-derives the
  // deadline from the match row itself, so an early or duplicate attempt is
  // simply refused. Same shape as city-auction.tsx's own auto-settle.
  //
  // Must be called unconditionally (Rules of Hooks) even though it only does
  // anything once the match is live — every early return below happens after
  // this, so the guards live inside the effect instead of around the call.
  const claimedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!match || match.status !== "active" || match.phase === "auction") return;

    const activeSeat = seats.find((s) => s.seat === match.current_seat);
    const activeInDebt = (activeSeat?.pending_debt ?? 0) > 0;

    let deadline: number;
    if (match.turn_clock_paused_at) {
      // An auction pause resolves independently (city-auction.tsx's own
      // settle effect) — nothing to claim here. A trade pause has its own
      // 45s escape hatch (BUG-007 round F/H): city_claim_timeout re-derives
      // eligibility itself, so an attempt before 45s is simply refused —
      // this is what makes that escape hatch reachable at all, since
      // nothing else in the client ever calls claimTimeout while paused.
      if (!match.trade_pause_started_at) return;
      deadline = new Date(match.trade_pause_started_at).getTime() + 45_000;
    } else if (activeInDebt && match.debt_started_at) {
      // FR-33/FR-42: forced liquidation runs on its own fixed 90s window,
      // not the ordinary pace-based one.
      deadline = new Date(match.debt_started_at).getTime() + 90_000;
    } else if (match.turn_started_at) {
      deadline = new Date(match.turn_started_at).getTime() + match.pace_seconds * 1000;
    } else {
      return;
    }

    // Keyed on the deadline itself, not just the turn number — a debt or
    // trade pause can arise mid-turn, after an earlier deadline in this same
    // turn_number already fired (e.g. an auto-roll that immediately creates
    // debt), and that later, different deadline must still be armed.
    const turnKey = `${match.id}:${match.turn_number}:${deadline}`;
    if (claimedTurnRef.current === turnKey) return;

    const remaining = deadline - Date.now();

    if (remaining > 0) {
      const t = setTimeout(() => void claimTimeout(), remaining + 250);
      return () => clearTimeout(t);
    }

    claimedTurnRef.current = turnKey;
    void claimTimeout();
  }, [match, seats, claimTimeout]);

  // An auction settling was previously silent — no toast, no confirmation,
  // just the panel vanishing and a cash number changing that a player might
  // not even be watching for. `auction` is always exactly "the one running
  // auction or none" (use-city-match.ts's own model), so it going from
  // populated to null on any client is unambiguously a real settle, not a
  // network blip — safe to announce to everyone watching, every time.
  const prevAuctionRef = useRef<CityAuctionState | null>(null);
  useEffect(() => {
    if (auction) {
      prevAuctionRef.current = auction;
      return;
    }
    const last = prevAuctionRef.current;
    if (!last) return;
    prevAuctionRef.current = null;

    const space = board[last.space_idx];
    const name = space?.name ?? "That property";
    if (last.high_seat != null) {
      const winner = seats.find((s) => s.seat === last.high_seat);
      toast.success(
        `${winner?.username ?? "Someone"} won ${name} for ${last.high_bid.toLocaleString()}.`
      );
    } else {
      toast(`Nobody bid on ${name} — it stays with the bank.`);
    }
  }, [auction, seats, board]);

  if (isDemoMode) {
    return (
      <Shell>
        <p className="text-lg font-semibold">Spintra City needs a database</p>
        <p className="text-sm text-muted-foreground max-w-md">
          This room is running in local demo mode, which can&apos;t referee a match. Configure
          Supabase to play Spintra City.
        </p>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground" role="status">
          Loading the match…
        </p>
      </Shell>
    );
  }

  // No live match. If one just finished, the recap stands in its place until
  // somebody opens the next — a result that disappears the moment it is
  // produced may as well not exist.
  if (!match && results.length > 0) {
    const winner = results.find((r) => r.place === 1);
    return (
      <motion.div
        key="city-recap"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto text-center"
      >
        <IconBadge />
        <h2 className="text-xl font-bold mt-3">
          {winner ? `${winner.username} wins` : "Match over"}
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Final standings by net worth — cash, cities and everything built on them.
        </p>

        <ol className="grid gap-1.5 text-left mb-6">
          {results.map((r) => (
            <li
              key={r.seat}
              className={
                "flex items-center gap-3 rounded-xl border p-3 " +
                (r.place === 1
                  ? "border-(--brand-primary)/50 bg-(--brand-primary)/10"
                  : "border-(--border-hairline) bg-(--surface-panel)")
              }
            >
              <span className="font-mono text-sm w-6 text-(--text-secondary)">{r.place}</span>
              <span className="font-medium flex-1 truncate">
                {r.username}
                {r.status === "bankrupt" && (
                  <span className="text-muted-foreground text-sm"> · bankrupt</span>
                )}
              </span>
              <span className="font-mono text-sm">
                {(r.final_net_worth ?? 0).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>

        {error && <ErrorNote message={error} />}
        {isHost ? (
          <Button onClick={() => void createMatch("classic")}>Play again</Button>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Waiting for the host to start another match…
          </p>
        )}
      </motion.div>
    );
  }

  // No match yet — the host opens one.
  if (!match) {
    return (
      <Shell>
        <IconBadge />
        <p className="text-lg font-semibold">Spintra City</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Buy, build, and trade your way to the top. {MIN_PLAYERS}–{MAX_SEATS} players.
        </p>
        {error && <ErrorNote message={error} />}
        {isHost ? (
          <>
            <div className="flex items-center gap-1.5 mt-3" role="radiogroup" aria-label="Turn pace">
              {([25, 40, 60] as const).map((secs) => (
                <Button
                  key={secs}
                  type="button"
                  size="sm"
                  variant={pacePreset === secs ? "default" : "outline"}
                  role="radio"
                  aria-checked={pacePreset === secs}
                  onClick={() => setPacePreset(secs)}
                >
                  {secs === 25 ? "Fast" : secs === 40 ? "Normal" : "Slow"} · {secs}s
                </Button>
              ))}
            </div>
            <Button
              onClick={() => void createMatch("classic", undefined, pacePreset)}
              className="mt-2"
            >
              Open a match
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-2" role="status">
            Waiting for the host to open a match…
          </p>
        )}
      </Shell>
    );
  }

  // The full match: roll, land, buy or auction, pay rent and tax, draw cards,
  // get out of Customs, build, mortgage, trade, go bankrupt, and finish — by
  // last player standing or on the timed-mode limit — into a recap that awards
  // through the room's existing scoreboard.
  if (match.status !== "lobby") {
    const active = seats.find((s) => s.seat === match.current_seat);
    const inDebt = (mySeat?.pending_debt ?? 0) > 0;
    const detained = !!mySeat?.in_detention;
    const mustDecide = isMyTurn && match.phase === "required_decision";
    const canRoll = isMyTurn && match.phase === "awaiting_roll" && !inDebt && !detained;
    const canEnd =
      isMyTurn &&
      match.phase !== "awaiting_roll" &&
      !mustDecide &&
      !inDebt &&
      !match.turn_clock_paused_at;
    const onSale = mySeat ? board[mySeat.position] : undefined;
    // A never-seated room member (a genuine spectator, FR-36) falls under
    // this too — before this fix their status line fell through to
    // "Waiting for X" instead of the same clear framing an eliminated
    // player already got.
    const iAmOut = !mySeat || mySeat.status === "bankrupt" || mySeat.status === "retired";
    // lastRoll is this tab's own optimistic state (instant, no round-trip) --
    // set only for whoever actually clicked Roll. Every other viewer, and
    // this same player after a refresh, falls back to the server-persisted
    // copy, which is only trusted while it still describes the CURRENT turn
    // (BUG-035: nobody but the roller's original tab ever saw this before).
    const freshServerRoll =
      match.last_roll_turn === match.turn_number ? match.last_roll_result : null;
    const effectiveRoll = lastRoll ?? freshServerRoll;

    return (
      <div className="max-w-5xl mx-auto">
        {/* BUG-042: City's own realtime channel had no visible failure state
            at all — cash badges and the board could silently stop updating
            with nothing telling the player why. */}
        {realtimeStatus !== "connected" && (
          <ConnectionBanner
            state={realtimeStatus}
            onRetry={() => void refetch()}
            className="mb-3 rounded-xl"
          />
        )}
        {/* FR-31: every seat went away with nobody left to hand the turn
            to, so the match paused durably rather than being destroyed or
            silently stuck. Clears itself — server-side, the instant anyone
            reconnects — no action is available here to take. */}
        {match.status === "paused" && (
          <div
            className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center gap-2"
            role="status"
          >
            <Clock className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-200">
              Match paused — everyone left. It picks back up the moment someone returns.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {seats.map((s) => (
              <SeatBadge key={s.id} seat={s} isCurrent={s.seat === match.current_seat} />
            ))}
          </div>
          {/* BUG-006: turn_started_at/pace_seconds have driven a real
              consequence (city_claim_timeout) since BUG-003's fix, but
              nothing ever showed a player the clock was running at all —
              same gating as the auto-claim effect above. Round H: while the
              active seat owes a debt, this is the fixed 90s liquidation
              window (FR-33/FR-42), not the ordinary pace-based clock. */}
          {match.status === "active" && match.phase !== "auction" && !match.turn_clock_paused_at && (
            (active?.pending_debt ?? 0) > 0 && match.debt_started_at ? (
              <TurnCountdown deadline={new Date(match.debt_started_at).getTime() + 90_000} />
            ) : (
              match.turn_started_at && (
                <TurnCountdown
                  deadline={new Date(match.turn_started_at).getTime() + match.pace_seconds * 1000}
                />
              )
            )
          )}
          {/* FR-29: a deliberate "I'm leaving" action, distinct from a
              disconnect — routes through the same retire/liquidation
              sequence a kick already uses. Confirmed first: unlike Leave
              seat in the lobby, this forfeits a live position. Hidden
              while paused — city_retire_self requires status='active',
              same as every other command RPC. */}
          {!iAmOut && match.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setIsRetireConfirmOpen(true)}
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Retire
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-3">
            <ErrorNote message={error} />
          </div>
        )}

        <CityBoard
          board={board}
          seats={seats}
          assets={assets}
          currentSeat={match.current_seat}
          selectedIdx={selected}
          onSelect={setSelected}
        />

        <div
          className={
            "flex flex-wrap items-center justify-center gap-2 mt-4" +
            (auction ? " hidden" : "")
          }
        >
          {isMyTurn && detained && match.phase === "awaiting_roll" ? (
            // Detention replaces the roll entirely: three ways out, and the
            // third failed attempt pays the fee whether you like it or not.
            <>
              <Button onClick={() => void leaveDetention("roll")}>
                <Dices className="w-4 h-4" aria-hidden="true" />
                Roll for doubles
                {mySeat && mySeat.detention_turns < 2
                  ? ` (${2 - mySeat.detention_turns} left)`
                  : " (last try)"}
              </Button>
              {(mySeat?.transit_visas ?? 0) > 0 && (
                <Button variant="outline" onClick={() => void leaveDetention("visa")}>
                  Use Transit Visa
                </Button>
              )}
              <Button
                variant="outline"
                disabled={(mySeat?.cash ?? 0) < 90}
                onClick={() => void leaveDetention("pay")}
              >
                Pay 90
              </Button>
            </>
          ) : mustDecide && onSale && !inDebt ? (
            // A pending purchase blocks the turn, so it replaces the normal
            // controls rather than sitting alongside them — there is exactly
            // one thing to do here and it should be unmissable.
            <>
              <Button
                onClick={() => void buyProperty()}
                disabled={!!(mySeat && onSale.price && mySeat.cash < onSale.price)}
              >
                Buy {onSale.name} · {onSale.price}
              </Button>
              <Button variant="outline" onClick={() => void declinePurchase()}>
                Pass
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => void rollDice()} disabled={!canRoll}>
                <Dices className="w-4 h-4" aria-hidden="true" />
                Roll dice
              </Button>
              <Button variant="outline" onClick={() => void endTurn()} disabled={!canEnd}>
                End turn
              </Button>
            </>
          )}
        </div>

        {auction && (
          <CityAuction
            auction={auction}
            board={board}
            seats={seats}
            mySeat={mySeat}
            onBid={(n) => void placeBid(n)}
            onPass={() => void passAuction()}
            onSettle={() => void settleAuction()}
          />
        )}

        <CityHoldings
          board={board}
          assets={assets}
          mySeat={mySeat}
          isMyTurn={isMyTurn}
          onBuild={(i) => void build(i)}
          onSell={(i) => void sellBuilding(i)}
          onMortgage={(i) => void mortgage(i)}
          onUnmortgage={(i) => void unmortgage(i)}
          onGiveUp={() => void declareBankruptcy()}
        />

        <CityTrade
          board={board}
          assets={assets}
          seats={seats}
          mySeat={mySeat}
          offers={offers}
          onPropose={(a) => void proposeTrade(a)}
          onAccept={(id) => void acceptTrade(id)}
          onDecline={(id) => void declineTrade(id)}
          onWithdraw={(id) => void withdrawTrade(id)}
        />

        {/* aria-live so a screen reader hears the roll, not just sighted players. */}
        <p
          className="text-sm text-muted-foreground text-center mt-3"
          role="status"
          aria-live="polite"
        >
          {iAmOut
            ? exitText(mySeat)
            : detained && isMyTurn
              ? `You're held at Customs. Roll doubles, spend a Transit Visa, or pay 90 to leave.`
              : effectiveRoll
              ? narrate(effectiveRoll, board, seats)
              : mustDecide && onSale && !inDebt
                ? `${onSale.name} is unclaimed. Buy it for ${onSale.price}, or pass.`
                : isMyTurn && inDebt
                  ? "You're short on cash — sell, mortgage, or trade to raise funds, or declare bankruptcy."
                  : isMyTurn && match.phase === "awaiting_roll"
                    ? "Your turn — roll the dice."
                    : isMyTurn
                      ? "You've rolled — build, trade, or end your turn when you're ready."
                      : `Waiting for ${active?.username ?? "the next player"}.`}
        </p>

        <Dialog open={isRetireConfirmOpen} onOpenChange={setIsRetireConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Retire from this match?</DialogTitle>
              <DialogDescription>
                Your properties return to the bank and your seat is out for the rest of this
                match. You&apos;ll keep watching as a spectator, but this can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRetireConfirmOpen(false)}>
                Keep playing
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setIsRetireConfirmOpen(false);
                  void retireSelf();
                }}
              >
                Yes, retire
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const readyCount = seats.filter((s) => s.is_ready).length;
  const canStart = seats.length >= MIN_PLAYERS && readyCount === seats.length;

  return (
    <motion.div
      key="city-lobby"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="max-w-2xl mx-auto"
    >
      {realtimeStatus !== "connected" && (
        <ConnectionBanner
          state={realtimeStatus}
          onRetry={() => void refetch()}
          className="mb-4 rounded-xl"
        />
      )}
      <div className="text-center mb-6">
        <IconBadge />
        <h2 className="text-xl font-bold mt-3">Spintra City</h2>
        <p className="text-sm text-muted-foreground">
          {seats.length} of {MAX_SEATS} seated · {readyCount} ready
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      {/* 2-column only from lg: (1024px), not sm: (640px) -- at 768px the
          site's own md: breakpoint simultaneously reveals the 320px desktop
          sidebar rail, so the content column is much narrower than the
          viewport width the sm: breakpoint assumed, and usernames were
          truncating to a handful of characters in what looked like more
          available space than there actually was. Single-column stacking
          reads fine at every width up to that point. */}
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6">
        {Array.from({ length: MAX_SEATS }, (_, i) => {
          const occupant = seats.find((s) => s.seat === i);
          const isMe = occupant?.user_id === currentUser.id;
          return (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-xl border p-3 bg-(--surface-panel) ${
                occupant ? "border-white/10" : "border-dashed border-white/10 opacity-60"
              }`}
            >
              <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
                {i + 1}
              </span>
              {occupant ? (
                <>
                  <span className="font-medium truncate flex-1">
                    {occupant.username}
                    {isMe && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                  {occupant.is_ready ? (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <Check className="w-3 h-3" aria-hidden="true" />
                      Ready
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">Not ready</span>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Empty seat</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2 justify-center">
        {!mySeat && seats.length < MAX_SEATS && (
          <Button onClick={() => void joinSeat(currentUser.username)}>
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Take a seat
          </Button>
        )}

        {mySeat && (
          <>
            <Button
              variant={mySeat.is_ready ? "outline" : "default"}
              onClick={() => void setReady(!mySeat.is_ready)}
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              {mySeat.is_ready ? "Not ready" : "I'm ready"}
            </Button>
            <Button variant="outline" onClick={() => void leaveSeat()}>
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Leave seat
            </Button>
          </>
        )}

        {isHost && (
          <Button onClick={() => void startMatch()} disabled={!canStart}>
            <Play className="w-4 h-4" aria-hidden="true" />
            Start match
          </Button>
        )}
      </div>

      {/* aria-live so the gating reason is announced, not just visually implied. */}
      <p className="text-xs text-muted-foreground text-center mt-4" role="status" aria-live="polite">
        {seats.length < MIN_PLAYERS
          ? `Spintra City needs at least ${MIN_PLAYERS} players.`
          : readyCount < seats.length
            ? "Waiting for everyone to be ready."
            : isHost
              ? "Everyone's ready — start when you are."
              : "Everyone's ready. Waiting for the host to start."}
      </p>

      {!isHost && (
        <p className="text-xs text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
          <Crown className="w-3 h-3" aria-hidden="true" />
          Only the host can start the match.
        </p>
      )}
    </motion.div>
  );
}

/**
 * BUG-007 round H: a voluntary retire, a kick, and a forced autopilot retire
 * were all indistinguishable to a watching player — one generic sentence for
 * every way a seat could leave.
 */
function exitText(seat: CitySeat | null): string {
  if (!seat) return "You're spectating this match.";
  if (seat.status === "bankrupt") return "You went bankrupt — watching from here.";
  if (seat.exit_reason === "autopilot_forced") {
    return "You were retired after missing too many turns in a row — watching from here.";
  }
  if (seat.exit_reason === "departed") return "You were removed from this match — watching from here.";
  return "You retired from this match — watching from here.";
}

/**
 * Turns a roll result into one sentence. Money moving is the part players most
 * need told to them — a number quietly changing in a badge is easy to miss, and
 * it is the difference between "I lost" and "I don't know what happened".
 */
function narrate(roll: CityRollResult, board: CityBoardSpace[], seats: CitySeat[]): string {
  const where = board[roll.to]?.name ?? "the next space";
  const who = (seat?: number | null) =>
    seats.find((s) => s.seat === seat)?.username ?? "another player";

  const head = roll.detained
    ? `Rolled ${roll.dice[0]} and ${roll.dice[1]} — three doubles, off to Customs.`
    : `Rolled ${roll.dice[0]} and ${roll.dice[1]}, moved to ${where}.` +
      (roll.salary ? ` Collected ${roll.salary} for passing Departure.` : "");

  const l = roll.landing;
  switch (l?.action) {
    case "paid_rent":
      return `${head} Paid ${l.amount} rent to ${who(l.to_seat)}.`;
    case "paid_tax":
      return `${head} Paid ${l.amount} in tax.`;
    case "may_buy":
      return `${head} It's unclaimed — buy it for ${l.price}, or pass.`;
    case "must_raise_funds":
      return `${head} Rent is ${l.owed} and you're ${l.short_by} short — sell or mortgage to cover it.`;
    case "bankrupt":
      return `${head} Couldn't cover ${l.owed} — bankrupt.`;
    case "mortgaged_no_rent":
      return `${head} It's mortgaged, so no rent is due.`;
    case "own_space":
      return `${head} You own it.`;
    case "card": {
      // The card's own effect may itself be a landing (an advance that then
      // charges rent), so the sentence has to nest.
      const r = l.result;
      const inner = r?.landing?.action ?? r?.action;
      // Only add what the printed card cannot say for itself. "Collect 70
      // Spins" followed by "Collected 70." is noise; rent charged on arrival
      // after an advance is not.
      const tail =
        inner === "paid_rent"
          ? ` Paid ${r?.landing?.amount ?? r?.amount} rent on arrival.`
          : inner === "paid_tax" && r?.kind !== "pay" && r?.kind !== "per_building"
            ? ` Paid ${r?.landing?.amount ?? r?.amount} on arrival.`
            : inner === "may_buy"
              ? " It's unclaimed — buy it, or pass."
              : inner === "must_raise_funds"
                ? ` You're ${r?.landing?.short_by ?? r?.short_by} short — sell or mortgage.`
                : "";
      return `${head} ${l.text ?? "Drew a card."}${tail}`;
    }
    default:
      return head;
  }
}

/**
 * BUG-006: the turn clock had a real consequence (city_claim_timeout) with
 * no visible countdown anywhere. Ticks client-side against a server-derived
 * deadline — purely a display; the deadline itself is never trusted for
 * anything authoritative, city_claim_timeout re-derives it server-side.
 */
function TurnCountdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.round((deadline - now) / 1000));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <Badge variant="outline" className="gap-1 font-mono" role="timer" aria-live="off">
      <Clock className="w-3 h-3" aria-hidden="true" />
      {mm}:{ss}
    </Badge>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      key="city-shell"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col items-center justify-center text-center gap-3 py-16 px-4"
    >
      {children}
    </motion.div>
  );
}

function IconBadge() {
  return (
    <div className="inline-flex w-14 h-14 rounded-2xl bg-linear-to-br from-amber-500 to-yellow-500 items-center justify-center">
      <Building2 className="w-7 h-7 text-white" aria-hidden="true" />
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
      role="alert"
    >
      {message}
    </p>
  );
}
