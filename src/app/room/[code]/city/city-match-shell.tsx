"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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
import type { CityBoardSpace, CityRollResult, CitySeat } from "./use-city-match";
import { useCityMatch } from "./use-city-match";

// The lobby and the live match. See docs/SPINTRA_CITY_SPEC.md §7 for the slice
// plan that governs what is and isn't wired up yet.
//
// Rendered directly by room-client.tsx's RoomGameArea rather than through
// ACTIVITY_REGISTRY — Spintra City is server-authoritative and doesn't use the
// activity event bus at all (SPEC.md §5.3).

const MAX_SEATS = 8;
const MIN_PLAYERS = 2;

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
    if (
      !match ||
      match.status !== "active" ||
      match.phase === "auction" ||
      match.turn_clock_paused_at ||
      !match.turn_started_at
    ) {
      return;
    }

    const turnKey = `${match.id}:${match.turn_number}`;
    if (claimedTurnRef.current === turnKey) return;

    const deadline = new Date(match.turn_started_at).getTime() + match.pace_seconds * 1000;
    const remaining = deadline - Date.now();

    if (remaining > 0) {
      const t = setTimeout(() => void claimTimeout(), remaining + 250);
      return () => clearTimeout(t);
    }

    claimedTurnRef.current = turnKey;
    void claimTimeout();
  }, [match, claimTimeout]);

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
    const canEnd = isMyTurn && match.phase !== "awaiting_roll" && !mustDecide && !inDebt;
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
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {seats.map((s) => (
              <Badge
                key={s.id}
                variant={s.seat === match.current_seat ? "default" : "secondary"}
                className="gap-1"
              >
                {s.username}
                <span className="font-mono opacity-80">{s.cash.toLocaleString()}</span>
              </Badge>
            ))}
          </div>
          {/* BUG-006: turn_started_at/pace_seconds have driven a real
              consequence (city_claim_timeout) since BUG-003's fix, but
              nothing ever showed a player the clock was running at all —
              same gating as the auto-claim effect above. */}
          {match.status === "active" &&
            match.phase !== "auction" &&
            !match.turn_clock_paused_at &&
            match.turn_started_at && (
              <TurnCountdown
                deadline={new Date(match.turn_started_at).getTime() + match.pace_seconds * 1000}
              />
            )}
          {/* FR-29: a deliberate "I'm leaving" action, distinct from a
              disconnect — routes through the same retire/liquidation
              sequence a kick already uses. Confirmed first: unlike Leave
              seat in the lobby, this forfeits a live position. */}
          {!iAmOut && (
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
            ? mySeat
              ? "You're out of this match — watching from here."
              : "You're spectating this match."
            : detained && isMyTurn
              ? `You're held at Customs. Roll doubles, spend a Transit Visa, or pay 90 to leave.`
              : effectiveRoll
              ? narrate(effectiveRoll, board, seats)
              : mustDecide && onSale
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

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
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
