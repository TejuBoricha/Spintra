"use client";

import { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CityAuction, CityBoardSpace, CitySeat } from "./use-city-match";

// The auction. Two things it must show that a bid box alone would not:
//
//  1. Everyone's available cash. Whether a raise can actually be answered is
//     the entire question, and it is unknowable from the bid history.
//  2. That the clock resets on every bid. Otherwise a rolling deadline looks
//     like the auction is broken.
//
// The countdown is presentational. The deadline is a server timestamp, and
// settling re-derives whether it has passed (migration 0069) — so a client with
// a fast clock, or a modified one, cannot end an auction early.

const STEPS = [10, 50, 100];

export function CityAuction({
  auction,
  board,
  seats,
  mySeat,
  onBid,
  onPass,
  onSettle,
}: {
  auction: CityAuction;
  board: CityBoardSpace[];
  seats: CitySeat[];
  mySeat: CitySeat | null;
  onBid: (amount: number) => void;
  onPass: () => void;
  onSettle: () => void;
}) {
  const space = board[auction.space_idx];
  const deadline = Math.min(
    new Date(auction.ends_at).getTime(),
    new Date(auction.hard_ends_at).getTime()
  );
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  // Same tick also drives the away-bidder check below without reading the
  // impure Date.now() during render.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      const n = Date.now();
      setNow(n);
      setLeft(Math.max(0, deadline - n));
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [deadline]);

  // Whoever notices the clock run out asks the server to settle. Every client
  // will try; the ones that lose the race get a harmless refusal.
  useEffect(() => {
    if (left > 0) return;
    const t = setTimeout(onSettle, 200);
    return () => clearTimeout(t);
  }, [left, onSettle]);

  const seconds = Math.ceil(left / 1000);
  const minBid = auction.high_seat === null ? 10 : auction.high_bid + 10;
  const iAmHigh = mySeat != null && auction.high_seat === mySeat.seat;
  const iPassed = mySeat != null && auction.passed_seats.includes(mySeat.seat);
  const canBid = (n: number) => mySeat != null && n <= mySeat.cash && !iAmHigh;

  return (
    <div className="mt-4 rounded-xl border border-(--brand-primary)/40 bg-(--surface-panel) p-3">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Gavel className="w-5 h-5 text-(--brand-primary)" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{space?.name ?? "This space"} — up for auction</p>
          <p className="text-xs text-muted-foreground">
            Nobody bought it, so everyone bids. List price {space?.price ?? "—"}.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-(--text-secondary) tracking-wider">HIGH BID</p>
          <p className="font-mono text-2xl text-(--brand-primary) tabular-nums leading-tight">
            {auction.high_seat === null ? "—" : auction.high_bid.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {auction.high_seat === null
              ? "no bids yet"
              : `by ${seats.find((s) => s.seat === auction.high_seat)?.username ?? "someone"}`}
          </p>
        </div>
      </div>

      <p
        className="font-mono text-xs text-(--text-secondary) mb-2"
        role="status"
        aria-live="off"
      >
        {seconds > 0 ? `closing in ${seconds}s` : "closing…"} — every bid resets it to 10s
      </p>

      <ul className="mb-3">
        {seats
          .filter((s) => s.status === "active")
          .map((s) => {
            const passed = auction.passed_seats.includes(s.seat);
            const high = auction.high_seat === s.seat;
            // BUG-007 round G: city_pass_auction excludes an away seat from the
            // "has everyone eligible passed" count without writing it into
            // passed_seats (it isn't a real pass — reconnecting still lets them
            // bid) — so this is read the same way, off disconnected_at, rather
            // than off the array.
            const away =
              !high &&
              !!s.disconnected_at &&
              now - new Date(s.disconnected_at).getTime() >= 60_000;
            return (
              <li
                key={s.seat}
                className="flex items-center gap-2 py-1 text-[13px] border-b border-white/5 last:border-0"
              >
                <span>{s.username}</span>
                <span className="ml-auto font-mono text-xs text-(--text-secondary)">
                  {high
                    ? `high bid ${auction.high_bid.toLocaleString()}`
                    : passed
                      ? "passed"
                      : away
                        ? "away — skipped"
                        : `${s.cash.toLocaleString()} available`}
                </span>
              </li>
            );
          })}
      </ul>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((step, i) => {
          const amount = i === 0 ? minBid : minBid + step - 10;
          return (
            <Button
              key={step}
              variant={i === 0 ? "default" : "outline"}
              disabled={!canBid(amount) || seconds <= 0}
              title={
                mySeat && amount > mySeat.cash
                  ? `You only have ${mySeat.cash.toLocaleString()} — no bidding on credit`
                  : undefined
              }
              onClick={() => onBid(amount)}
            >
              Bid {amount.toLocaleString()}
            </Button>
          );
        })}
        <Button variant="outline" disabled={iAmHigh || seconds <= 0} onClick={onPass}>
          {iPassed ? "Bid again" : "Pass"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Passing isn&apos;t binding — you can come back in while the clock runs. The auction ends
        when everyone else has passed, or after 2 minutes.
      </p>
    </div>
  );
}
