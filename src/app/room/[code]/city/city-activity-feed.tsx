"use client";

import {
  ArrowLeftRight,
  Banknote,
  Building2,
  Dices,
  Gavel,
  HandCoins,
  Landmark,
  LogOut,
  Skull,
} from "lucide-react";
import type { CityBoardSpace, CityMatchEvent, CitySeat } from "./use-city-match";

// The persistent history behind the "who has acquired what" gap — user
// feedback 2026-09-03, naming richup.io's running action log by name. The
// purchase toast (city-match-shell.tsx) is still what a player's own tab
// sees the instant it happens; this is what survives a refresh and reaches
// someone who joins mid-match, from migration 0093's append-only event log.
//
// Newest first, no auto-scroll machinery: reverse-chronological means the
// thing you'd want to see is always at the top of a fixed-height panel,
// without needing to track and restore a scroll position on every append.

const ICONS: Record<string, typeof Dices> = {
  rolled: Dices,
  bought: Landmark,
  auction_started: Gavel,
  auction_won: Gavel,
  auction_unsold: Gavel,
  rent_paid: HandCoins,
  tax_paid: HandCoins,
  built: Building2,
  sold_building: Building2,
  mortgaged: Banknote,
  unmortgaged: Banknote,
  trade_accepted: ArrowLeftRight,
  bankrupt: Skull,
  retired: LogOut,
};

function describe(
  e: CityMatchEvent,
  seats: CitySeat[],
  board: CityBoardSpace[]
): string {
  const who = (seat: unknown) =>
    seats.find((s) => s.seat === seat)?.username ?? "Someone";
  const actor = who(e.actor_seat);
  const space = (idx: unknown) =>
    typeof idx === "number" ? (board[idx]?.name ?? "a property") : "a property";
  const money = (n: unknown) => Number(n ?? 0).toLocaleString();
  const p = e.payload;

  switch (e.kind) {
    case "rolled": {
      const dice = Array.isArray(p.dice) ? (p.dice as number[]) : [];
      return `${actor} rolled ${dice.join("-")}${p.doubles ? " — doubles!" : ""}`;
    }
    case "bought":
      return `${actor} bought ${space(p.space)} for ${money(p.price)}`;
    case "auction_started":
      return `${actor} sent ${space(p.space)} to auction`;
    case "auction_won":
      return `${actor} won ${space(p.space)} at auction for ${money(p.price)}`;
    case "auction_unsold":
      return `${space(p.space)} went unsold at auction`;
    case "rent_paid":
      return `${actor} paid ${money(p.amount)} rent to ${who(p.to_seat)}`;
    case "tax_paid":
      return `${actor} paid ${money(p.amount)} in tax`;
    case "built":
      return `${actor} built on ${space(p.space)}`;
    case "sold_building":
      return `${actor} sold a building on ${space(p.space)} for ${money(p.returned)}`;
    case "mortgaged":
      return `${actor} mortgaged ${space(p.space)} for ${money(p.raised)}`;
    case "unmortgaged":
      return `${actor} paid off the mortgage on ${space(p.space)}`;
    case "trade_accepted":
      return `${actor} completed a trade with ${who(p.with_seat)}`;
    case "bankrupt":
      return `${actor} went bankrupt`;
    case "retired":
      return `${actor} left the match`;
    default:
      return `${actor} — ${e.kind}`;
  }
}

export function CityActivityFeed({
  events,
  seats,
  board,
}: {
  events: CityMatchEvent[];
  seats: CitySeat[];
  board: CityBoardSpace[];
}) {
  if (events.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-(--border-hairline) bg-(--surface-panel) p-3">
        <p className="font-mono text-xs tracking-[0.16em] uppercase text-(--text-secondary) mb-2">
          Activity
        </p>
        <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
      </div>
    );
  }

  const newestFirst = events.slice().reverse();

  return (
    <div className="mt-4 rounded-xl border border-(--border-hairline) bg-(--surface-panel) p-3">
      <p className="font-mono text-xs tracking-[0.16em] uppercase text-(--text-secondary) mb-2">
        Activity
      </p>
      <ul className="grid gap-1 max-h-64 overflow-y-auto pr-1">
        {newestFirst.map((e) => {
          const Icon = ICONS[e.kind] ?? Dices;
          const severe = e.kind === "bankrupt" || e.kind === "retired";
          return (
            <li
              key={e.id}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-(--surface-raised)"
            >
              <Icon
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${severe ? "text-red-400" : "text-(--brand-primary)"}`}
                aria-hidden="true"
              />
              <span className="flex-1 leading-snug">{describe(e, seats, board)}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {new Date(e.created_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
