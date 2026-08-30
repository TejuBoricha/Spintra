"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Check, Crown, Dices, Loader2, LogOut, Play, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoomActivity } from "../context/room-activity-context";
import { CityBoard } from "./city-board";
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
  } = useCityMatch(roomCode, currentUser.id);

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
          <Button onClick={() => void createMatch("classic")} className="mt-2">
            Open a match
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground mt-2" role="status">
            Waiting for the host to open a match…
          </p>
        )}
      </Shell>
    );
  }

  // Slice 3: the board, the roll, and what the space you land on demands —
  // buy-or-pass, rent, tax, and bankruptcy. Still to come: building and
  // mortgaging (Slice 4), trading (Slice 5), and auctions, card decks and
  // detention (Slice 6), so a declined property currently stays unowned and a
  // card space is a no-op.
  if (match.status !== "lobby") {
    const active = seats.find((s) => s.seat === match.current_seat);
    const mustDecide = isMyTurn && match.phase === "required_decision";
    const canRoll = isMyTurn && match.phase === "awaiting_roll";
    const canEnd = isMyTurn && !canRoll && !mustDecide;
    const onSale = mySeat ? board[mySeat.position] : undefined;
    const iAmOut = mySeat?.status === "bankrupt" || mySeat?.status === "retired";

    return (
      <div className="max-w-5xl mx-auto">
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

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {mustDecide && onSale ? (
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

        {/* aria-live so a screen reader hears the roll, not just sighted players. */}
        <p
          className="text-sm text-muted-foreground text-center mt-3"
          role="status"
          aria-live="polite"
        >
          {iAmOut
            ? "You're out of this match — watching from here."
            : lastRoll
              ? narrate(lastRoll, board, seats)
              : mustDecide && onSale
                ? `${onSale.name} is unclaimed. Buy it for ${onSale.price}, or pass.`
                : isMyTurn
                  ? "Your turn — roll the dice."
                  : `Waiting for ${active?.username ?? "the next player"}.`}
        </p>
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
    case "bankrupt":
      return `${head} Couldn't cover ${l.owed} — bankrupt.`;
    case "mortgaged_no_rent":
      return `${head} It's mortgaged, so no rent is due.`;
    case "own_space":
      return `${head} You own it.`;
    case "card_pending":
      return `${head} Card decks arrive in a later update.`;
    default:
      return head;
  }
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
