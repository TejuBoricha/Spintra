"use client";

import { Button } from "@/components/ui/button";
import type { CityAsset, CityBoardSpace, CitySeat } from "./use-city-match";

// What you own, and what you can do with it. Doubles as the raise-funds window:
// when a debt is outstanding the same list is what you sell from, so a player
// never has to learn a second screen at the worst moment of their match.
//
// Every button here is a request, not a decision — legality (complete country,
// even build, strip before mortgaging, affordability) is settled server-side in
// migration 0066. The disabled states below only spare the player a round trip.

export function CityHoldings({
  board,
  assets,
  mySeat,
  isMyTurn,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
  onGiveUp,
}: {
  board: CityBoardSpace[];
  assets: CityAsset[];
  mySeat: CitySeat | null;
  isMyTurn: boolean;
  onBuild: (idx: number) => void;
  onSell: (idx: number) => void;
  onMortgage: (idx: number) => void;
  onUnmortgage: (idx: number) => void;
  onGiveUp: () => void;
}) {
  if (!mySeat) return null;
  const mine = assets
    .filter((a) => a.owner_seat === mySeat.seat)
    .sort((a, b) => a.space_idx - b.space_idx);

  const inDebt = mySeat.pending_debt > 0;
  const shortBy = Math.max(0, mySeat.pending_debt - mySeat.cash);

  // What everything would raise if sold and mortgaged — mirrors
  // city_max_liquidation so the player can see whether they are actually able
  // to survive before they start dismantling their board position.
  const canRaise = mine.reduce((t, a) => {
    const s = board[a.space_idx];
    if (!s) return t;
    return (
      t +
      a.buildings * Math.floor((s.build_cost ?? 0) / 2) +
      (a.is_mortgaged ? 0 : Math.floor((s.price ?? 0) / 2))
    );
  }, 0);

  if (!mine.length && !inDebt) return null;

  return (
    <div className="mt-4 rounded-xl border border-(--border-hairline) bg-(--surface-panel) p-3">
      {inDebt && (
        <div
          className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-300">
            You owe {mySeat.pending_debt.toLocaleString()} and are {shortBy.toLocaleString()} short.
          </p>
          <p className="text-xs text-red-200/80 mt-0.5">
            Sell buildings and mortgage cities below — the debt settles itself the moment you can
            cover it. Selling everything would raise {canRaise.toLocaleString()}.
          </p>
          {mySeat.cash + canRaise < mySeat.pending_debt && (
            <Button variant="outline" className="mt-2" onClick={onGiveUp}>
              Declare bankruptcy
            </Button>
          )}
        </div>
      )}

      <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-(--text-secondary) mb-2">
        Your holdings
      </p>

      {!mine.length ? (
        <p className="text-sm text-muted-foreground">You don&apos;t own anything yet.</p>
      ) : (
        <ul className="grid gap-1.5">
          {mine.map((a) => {
            const s = board[a.space_idx];
            if (!s) return null;
            const buildCost = s.build_cost ?? 0;
            const canDevelop = s.kind === "property";
            return (
              <li
                key={a.space_idx}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-(--border-hairline) px-2.5 py-1.5"
              >
                <span className="text-sm font-medium">{s.name}</span>
                {a.is_mortgaged && (
                  <span className="text-[11px] font-mono text-amber-300">mortgaged</span>
                )}
                {a.buildings > 0 && (
                  <span className="text-[11px] font-mono text-(--text-secondary)">
                    {a.buildings === 5 ? "landmark" : `${a.buildings} built`}
                  </span>
                )}

                <span className="ml-auto flex flex-wrap gap-1.5">
                  {canDevelop && !a.is_mortgaged && a.buildings < 5 && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isMyTurn || inDebt || mySeat.cash < buildCost}
                      title={
                        !isMyTurn
                          ? "Wait for your turn"
                          : inDebt
                            ? "Settle your debt first"
                            : mySeat.cash < buildCost
                              ? "Not enough cash"
                              : undefined
                      }
                      onClick={() => onBuild(a.space_idx)}
                    >
                      Build · {buildCost}
                    </Button>
                  )}
                  {canDevelop && a.buildings > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      // Selling is one of the raise-funds actions the server
                      // allows off-turn while in debt (migration 0077) — the
                      // button has to follow, or the debt banner above is
                      // telling the player to do something this button won't
                      // let them do.
                      disabled={!isMyTurn && !inDebt}
                      title={!isMyTurn && !inDebt ? "Wait for your turn" : undefined}
                      onClick={() => onSell(a.space_idx)}
                    >
                      Sell · +{Math.floor(buildCost / 2)}
                    </Button>
                  )}
                  {!a.is_mortgaged && a.buildings === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      // Same off-turn-while-in-debt allowance as Sell, above.
                      disabled={!isMyTurn && !inDebt}
                      title={!isMyTurn && !inDebt ? "Wait for your turn" : undefined}
                      onClick={() => onMortgage(a.space_idx)}
                    >
                      Mortgage · +{Math.floor((s.price ?? 0) / 2)}
                    </Button>
                  )}
                  {a.is_mortgaged && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isMyTurn || inDebt}
                      title={
                        !isMyTurn
                          ? "Wait for your turn"
                          : inDebt
                            ? "Settle your debt first"
                            : undefined
                      }
                      onClick={() => onUnmortgage(a.space_idx)}
                    >
                      Lift · {Math.ceil(Math.floor((s.price ?? 0) / 2) * 1.1)}
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
