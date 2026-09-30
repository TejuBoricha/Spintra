"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COUNTRY } from "./city-board";
import type { CityAsset, CityBoardSpace, CitySeat } from "./use-city-match";

// What a tile is, for anyone who taps it (audit C-12: there was no way to see a
// property's price, rent or owner in-game). It is also what makes a small
// board acceptable: on a phone the tile names are scaled down with the board,
// and this is where the readable version lives.
//
// Rent comes from the server row (`city_board_spaces.rent`), never a constant
// here. For a city, rent[0] is the undeveloped rent and rent[n] the rent with n
// buildings (migration 0065). Airports, utilities and tax tiles work
// differently, so only their price or tax is shown.
export function CityTileDetail({
  space,
  asset,
  seats,
  onClose,
}: {
  space: CityBoardSpace;
  asset: CityAsset | undefined;
  seats: CitySeat[];
  onClose: () => void;
}) {
  const country = space.country ? COUNTRY[space.country] : null;
  const owner = asset ? seats.find((s) => s.seat === asset.owner_seat) : undefined;
  const isCity = space.kind === "property";
  const rents = isCity && space.rent && space.rent.length > 0 ? space.rent : null;

  return (
    <section
      aria-label={`${space.name} details`}
      className="mt-3 rounded-xl border border-(--border-hairline) bg-(--surface-panel) p-3 text-sm"
      data-testid="city-tile-detail"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold leading-tight">{space.name}</h3>
          <p className="m-0 text-xs text-muted-foreground">
            {country ? country.name : space.kind === "corner" ? "Corner" : kindLabel(space.kind)}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label="Close tile details"
          onClick={onClose}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0">
        {space.price != null && (
          <>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="m-0 font-mono tabular-nums">{space.price} Spins</dd>
          </>
        )}
        {space.tax_amount != null && (
          <>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="m-0 font-mono tabular-nums">{space.tax_amount} Spins</dd>
          </>
        )}
        {isCity && space.build_cost != null && (
          <>
            <dt className="text-muted-foreground">Build cost</dt>
            <dd className="m-0 font-mono tabular-nums">{space.build_cost} Spins each</dd>
          </>
        )}
        {rents && (
          <>
            <dt className="text-muted-foreground">Rent</dt>
            <dd className="m-0 font-mono tabular-nums">
              {rents[0]}
              {rents.length > 1 && (
                <span className="text-muted-foreground">
                  {" "}
                  · with 1 to {rents.length - 1} buildings: {rents.slice(1).join(" / ")}
                </span>
              )}
            </dd>
          </>
        )}
        {space.price != null && (
          <>
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="m-0">
              {owner ? (
                <>
                  {owner.username}
                  {asset?.is_mortgaged && " (mortgaged)"}
                  {asset && asset.buildings > 0 && ` · ${asset.buildings} built`}
                </>
              ) : (
                "Nobody yet"
              )}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

function kindLabel(kind: CityBoardSpace["kind"]): string {
  switch (kind) {
    case "airport":
      return "Airport";
    case "utility":
      return "Utility";
    case "tax":
      return "Tax";
    case "card":
      return "Card";
    default:
      return "";
  }
}
