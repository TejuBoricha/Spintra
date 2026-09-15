"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COUNTRY } from "./city-board";
import type {
  CityAsset,
  CityBoardSpace,
  CitySeat,
  CityTradeOffer,
} from "./use-city-match";

// Trading. The panel's job is not to collect a form — it is to answer the one
// question players get wrong in this genre: *what does this deal do to the
// board?* Hence the set-completion warning, which is the only thing here that
// isn't obvious from the offer itself.
//
// Every rule (ownership, developed sets, affordability, staleness) is enforced
// server-side in migration 0067. Nothing below is a permission check; it is
// only there to spare the player a round trip and to explain a refusal.

function tradeable(board: CityBoardSpace[], assets: CityAsset[], spaceIdx: number): boolean {
  const s = board[spaceIdx];
  if (!s) return false;
  // A city cannot move while anything in its country carries buildings —
  // pulling one out of a developed set would leave it broken and over-built.
  return !assets.some((a) => {
    const other = board[a.space_idx];
    return a.buildings > 0 && (a.space_idx === spaceIdx || (!!s.country && other?.country === s.country));
  });
}

/** Which countries this swap would hand somebody a complete set of. */
function completesFor(
  board: CityBoardSpace[],
  assets: CityAsset[],
  seat: number,
  gaining: number[],
  losing: number[]
): string[] {
  const byCountry = new Map<string, number[]>();
  board.forEach((s) => {
    if (!s.country) return;
    byCountry.set(s.country, [...(byCountry.get(s.country) ?? []), s.idx]);
  });
  const ownerAfter = (idx: number) => {
    if (gaining.includes(idx)) return seat;
    if (losing.includes(idx)) return -1;
    return assets.find((a) => a.space_idx === idx)?.owner_seat ?? -1;
  };
  const out: string[] = [];
  byCountry.forEach((idxs, country) => {
    const before = idxs.every((i) => assets.find((a) => a.space_idx === i)?.owner_seat === seat);
    const after = idxs.every((i) => ownerAfter(i) === seat);
    // the display name, not the key — "Poland", never "PL"
    if (after && !before) out.push(COUNTRY[country]?.name ?? country);
  });
  return out;
}

export function CityTrade({
  board,
  assets,
  seats,
  mySeat,
  offers,
  onPropose,
  onAccept,
  onDecline,
  onWithdraw,
}: {
  board: CityBoardSpace[];
  assets: CityAsset[];
  seats: CitySeat[];
  mySeat: CitySeat | null;
  offers: CityTradeOffer[];
  onPropose: (a: {
    toSeat: number;
    giveSpaces: number[];
    getSpaces: number[];
    giveCash: number;
    getCash: number;
  }) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onWithdraw: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [partner, setPartner] = useState<number | null>(null);
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [giveCash, setGiveCash] = useState(0);
  const [getCash, setGetCash] = useState(0);

  if (!mySeat) return null;

  const opponents = seats.filter((s) => s.seat !== mySeat.seat && s.status === "active");
  // FR-43: a queued offer is inactionable (accept/decline both refused
  // server-side) until the recipient's own turn ends — hidden here rather
  // than shown-and-disabled, matching DESIGN.md's "queued and surfaced
  // when their turn ends" (not "queued and visible the whole time").
  const incoming = offers.filter((o) => o.to_seat === mySeat.seat && !o.queued);
  const outgoing = offers.filter((o) => o.from_seat === mySeat.seat);
  const nameOf = (seat: number) => seats.find((s) => s.seat === seat)?.username ?? `Seat ${seat + 1}`;
  const spaceName = (i: number) => board[i]?.name ?? `#${i}`;

  const reset = () => {
    setGive([]); setGet([]); setGiveCash(0); setGetCash(0); setPartner(null); setOpen(false);
  };
  const toggle = (list: number[], set: (v: number[]) => void, idx: number) =>
    set(list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx]);

  const theirGain = partner === null ? [] : completesFor(board, assets, partner, give, get);
  const myGain = completesFor(board, assets, mySeat.seat, get, give);
  const empty = !give.length && !get.length && !giveCash && !getCash;

  const holdings = (seat: number) =>
    assets
      .filter((a) => a.owner_seat === seat)
      .map((a) => a.space_idx)
      .sort((a, b) => a - b);

  return (
    <div className="mt-3">
      {(incoming.length > 0 || outgoing.length > 0) && (
        <ul className="grid gap-1.5 mb-3">
          {incoming.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-(--brand-primary)/40 bg-(--brand-primary)/10 px-3 py-2"
            >
              <p className="text-sm">
                <b>{nameOf(o.from_seat)}</b> offers you{" "}
                {describeSide(o.give_spaces, o.give_cash, spaceName)} for{" "}
                {describeSide(o.get_spaces, o.get_cash, spaceName)}.
              </p>
              <div className="flex gap-2 mt-1.5">
                <Button size="sm" onClick={() => onAccept(o.id)}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDecline(o.id)}>
                  Decline
                </Button>
              </div>
            </li>
          ))}
          {outgoing.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-2 rounded-lg border border-(--border-hairline) px-3 py-2"
            >
              <p className="text-sm text-muted-foreground flex-1">
                {o.queued ? (
                  <>
                    Queued for <b>{nameOf(o.to_seat)}</b> — it&apos;s their turn, so this waits
                    until it ends.
                  </>
                ) : (
                  <>
                    Waiting on <b>{nameOf(o.to_seat)}</b>
                  </>
                )}{" "}
                — {describeSide(o.give_spaces, o.give_cash, spaceName)} for{" "}
                {describeSide(o.get_spaces, o.get_cash, spaceName)}.
              </p>
              <Button size="sm" variant="outline" onClick={() => onWithdraw(o.id)}>
                Withdraw
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={!opponents.length || mySeat.status !== "active"}
        >
          <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
          Propose a trade
        </Button>
      ) : (
        <div
          data-testid="trade-panel"
          className="rounded-xl border border-(--border-hairline) bg-(--surface-panel) p-3"
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {opponents.map((o) => (
              <Button
                key={o.seat}
                size="sm"
                data-testid="trade-partner"
                variant={partner === o.seat ? "default" : "outline"}
                onClick={() => {
                  setPartner(o.seat);
                  setGet([]);
                }}
              >
                {o.username}
              </Button>
            ))}
          </div>

          {partner !== null && (
            <>
              {/* The reason this panel exists. */}
              {theirGain.length > 0 && (
                <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  This completes <b>{nameOf(partner)}&apos;s {theirGain.join(" and ")}</b>. They can
                  build there straight away, and their rent doubles even undeveloped.
                </p>
              )}
              {myGain.length > 0 && (
                <p className="mb-3 rounded-lg border border-(--brand-primary)/40 bg-(--brand-primary)/10 px-3 py-2 text-sm">
                  This completes <b>your {myGain.join(" and ")}</b>.
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <Side
                  title="You give"
                  spaces={holdings(mySeat.seat)}
                  picked={give}
                  board={board}
                  assets={assets}
                  onToggle={(i) => toggle(give, setGive, i)}
                  cash={giveCash}
                  max={mySeat.cash}
                  onCash={setGiveCash}
                />
                <Side
                  title={`${nameOf(partner)} gives`}
                  spaces={holdings(partner)}
                  picked={get}
                  board={board}
                  assets={assets}
                  onToggle={(i) => toggle(get, setGet, i)}
                  cash={getCash}
                  max={seats.find((s) => s.seat === partner)?.cash ?? 0}
                  onCash={setGetCash}
                />
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end mt-3">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button
              disabled={partner === null || empty}
              onClick={() => {
                if (partner === null) return;
                onPropose({
                  toSeat: partner,
                  giveSpaces: give,
                  getSpaces: get,
                  giveCash,
                  getCash,
                });
                reset();
              }}
            >
              Send offer
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Offers lapse at the end of your next turn, or after 3 minutes. Terms are re-checked when
            they accept — if anything has moved, the trade fails rather than going through on terms
            that no longer hold.
          </p>
        </div>
      )}
    </div>
  );
}

function Side({
  title,
  spaces,
  picked,
  board,
  assets,
  onToggle,
  cash,
  max,
  onCash,
}: {
  title: string;
  spaces: number[];
  picked: number[];
  board: CityBoardSpace[];
  assets: CityAsset[];
  onToggle: (idx: number) => void;
  cash: number;
  max: number;
  onCash: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-(--border-hairline) p-2.5">
      <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-(--brand-primary) mb-2">
        {title}
      </p>
      {spaces.length === 0 && <p className="text-sm text-muted-foreground">No cities.</p>}
      <ul className="grid gap-1">
        {spaces.map((i) => {
          const can = tradeable(board, assets, i);
          const on = picked.includes(i);
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!can}
                onClick={() => onToggle(i)}
                title={can ? undefined : "Sell the buildings in this country first"}
                className={
                  "w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[13px] " +
                  (on
                    ? "border-(--brand-primary) bg-(--brand-primary)/15"
                    : "border-(--border-hairline)") +
                  (can ? " cursor-pointer" : " opacity-45 cursor-not-allowed")
                }
              >
                {board[i]?.name ?? `#${i}`}
                <span className="ml-auto font-mono text-[11px] text-(--text-secondary)">
                  {can ? board[i]?.price ?? "" : "built"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <label className="flex items-center gap-2 mt-2 pt-2 border-t border-(--border-hairline)">
        <span className="text-xs text-muted-foreground">Cash</span>
        <Input
          type="number"
          min={0}
          max={max}
          step={10}
          value={cash}
          onChange={(e) => onCash(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
          className="ml-auto w-24 h-8 font-mono text-[13px]"
        />
      </label>
    </div>
  );
}

function describeSide(spaces: number[], cash: number, name: (i: number) => string): string {
  const parts = spaces.map(name);
  if (cash > 0) parts.push(`${cash.toLocaleString()} Spins`);
  return parts.length ? parts.join(" + ") : "nothing";
}
