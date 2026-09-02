"use client";

import type { CityAsset, CityBoardSpace, CitySeat } from "./use-city-match";

// The board. Ported from the reviewed design prototype, keeping the layout
// decisions that were measured rather than guessed:
//
//  - No tile text is rotated. The side columns are wider than they are tall,
//    so rotating their names gave the text the SHORTER axis to run along while
//    also demanding a head tilt — worse on both counts.
//  - Tokens live in a reserved lane inside each tile rather than being
//    absolutely positioned over it, so a pawn can never cover a city name.
//  - Player identity is a bold initial first and colour second, because a 19px
//    disc carrying a 9px emoji is unreadable at board scale.
//
// Prices and rents come from the server (`city_board_spaces`), never from a
// constant in this bundle — see migration 0064 §1.

// Seat colours are the site's own accent ramp (globals.css), not a palette
// invented for this mode — lime, coral, violet, cyan, magenta and electric are
// already what Spintra uses for player/mascot duty. The light value is the disc
// face and the dark value is the ownership stripe, so a stripe stays legible
// against a cream tile while the disc stays legible under dark ink.
const SEAT_COLOURS: { light: string; dark: string }[] = [
  { light: "#eefb6e", dark: "#a8bb18" }, // lime
  { light: "#f54452", dark: "#c33138" }, // coral
  { light: "#b080ec", dark: "#6d3ee0" }, // violet
  { light: "#5ce1e6", dark: "#3ddaee" }, // cyan
  { light: "#ff5fb8", dark: "#f728a0" }, // magenta
  { light: "#5ef0ff", dark: "#2585c9" }, // electric
  { light: "#f6f1ef", dark: "#8b8d97" }, // fog
  { light: "#ffd9a3", dark: "#d97d1f" }, // amber, last so it is rarely reached
];

// Country set colours and procedurally drawn flags. Emoji flags are
// regional-indicator pairs that Windows renders as bare letter pairs (a real
// defect hit in prototyping — a card displayed "ZA"), so every flag here is
// CSS gradient geometry instead.
export const COUNTRY: Record<string, { name: string; band: string; flag: string }> = {
  pt: { name: "Portugal", band: "#2c8f5e", flag: "linear-gradient(90deg,#046a38 0 40%,#da291c 40%)" },
  pl: { name: "Poland", band: "#c2334a", flag: "linear-gradient(180deg,#fff 0 50%,#dc143c 50%)" },
  jp: { name: "Japan", band: "#c8415c", flag: "radial-gradient(circle at 50% 50%,#bc002d 0 30%,#fff 31%)" },
  za: {
    name: "South Africa",
    band: "#c98a1f",
    flag: "linear-gradient(180deg,#de3831 0 33%,#fff 33% 38%,#007a4d 38% 62%,#fff 62% 67%,#001489 67%)",
  },
  au: {
    name: "Australia",
    band: "#2065b5",
    flag: "radial-gradient(circle at 72% 66%,#fff 0 9%,transparent 10%),radial-gradient(circle at 32% 30%,#fff 0 7%,transparent 8%),#00247d",
  },
  ca: {
    name: "Canada",
    band: "#cf3f28",
    flag: "linear-gradient(90deg,#d80621 0 28%,#fff 28% 72%,#d80621 72%),radial-gradient(circle at 50% 50%,#d80621 0 22%,transparent 23%)",
  },
  in: {
    name: "India",
    band: "#e07b18",
    flag: "linear-gradient(180deg,#ff9933 0 33%,#fff 33% 66%,#138808 66%),radial-gradient(circle at 50% 50%,#000080 0 10%,transparent 11%)",
  },
  ae: {
    name: "UAE",
    band: "#6b4bd0",
    flag: "linear-gradient(90deg,#ff0000 0 26%,transparent 26%),linear-gradient(180deg,#00732f 0 33%,#fff 33% 66%,#000 66%)",
  },
};

const CORNER_ICON: Record<string, string> = {
  Departure: "✈",
  Customs: "⛔",
  Layover: "☕",
  Detained: "⇩",
};

const CORNER_SUB: Record<string, string> = {
  Departure: "COLLECT 200",
  Customs: "HELD",
  Layover: "FREE REST",
  Detained: "GO TO CUSTOMS",
};

type Edge = "bottom" | "left" | "top" | "right";

/** Grid placement for an 11x11 board, walking clockwise from the start corner. */
function place(i: number): { col: number; row: number; edge: Edge } {
  if (i === 0) return { col: 11, row: 11, edge: "bottom" };
  if (i < 10) return { col: 11 - i, row: 11, edge: "bottom" };
  if (i === 10) return { col: 1, row: 11, edge: "left" };
  if (i < 20) return { col: 1, row: 11 - (i - 10), edge: "left" };
  if (i === 20) return { col: 1, row: 1, edge: "top" };
  if (i < 30) return { col: 1 + (i - 20), row: 1, edge: "top" };
  if (i === 30) return { col: 11, row: 1, edge: "right" };
  return { col: 11, row: 1 + (i - 30), edge: "right" };
}

/** A single letter only identifies a player if it's unique; otherwise use the seat. */
function initials(seats: CitySeat[]): Map<number, string> {
  const firsts = seats.map((s) => s.username.trim()[0]?.toUpperCase() ?? "?");
  return new Map(
    seats.map((s, i) => [
      s.seat,
      firsts.filter((f) => f === firsts[i]).length > 1 ? String(s.seat + 1) : firsts[i],
    ])
  );
}

export function CityBoard({
  board,
  seats,
  assets,
  currentSeat,
  selectedIdx,
  onSelect,
}: {
  board: CityBoardSpace[];
  seats: CitySeat[];
  assets: CityAsset[];
  currentSeat: number | null;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}) {
  const marks = initials(seats);
  const assetBy = new Map(assets.map((a) => [a.space_idx, a]));

  return (
    <div className="rounded-2xl border border-(--border-hairline) bg-linear-to-br from-(--city-frame-a) to-(--city-frame-b) p-3 overflow-x-auto overscroll-x-contain">
      {/* One fixed width everywhere. The board is square, so width sets height:
          left to fill the room's content column it grew past the viewport and
          pushed the top row off screen, and capping it lower than 700px clipped
          the longest city name ("Melbourne"). 700px is the width at which every
          name still sets on one line, and it leaves room for the room header and
          the action bar on a laptop. Narrower viewports scroll the wrapper above
          rather than the page. */}
      <div
        className="grid aspect-square gap-[2px] rounded-lg overflow-hidden bg-(--city-gap) p-[2px] w-175 mx-auto"
        style={{
          gridTemplateColumns: "1.42fr repeat(9,1fr) 1.42fr",
          gridTemplateRows: "1.42fr repeat(9,1fr) 1.42fr",
        }}
      >
        {board.map((space) => {
          const { col, row, edge } = place(space.idx);
          const asset = assetBy.get(space.idx);
          const here = seats.filter((s) => s.position === space.idx);
          const country = space.country ? COUNTRY[space.country] : null;
          const isCorner = space.kind === "corner";

          return (
            <button
              key={space.idx}
              type="button"
              onClick={() => onSelect(space.idx)}
              aria-pressed={selectedIdx === space.idx}
              aria-label={
                isCorner
                  ? `${space.name}. ${CORNER_SUB[space.name] ?? ""}`
                  : `${space.name}${country ? `, ${country.name}` : ""}` +
                    `${space.price ? `, ${space.price} Spins` : ""}` +
                    `${asset ? `, owned by ${seats.find((s) => s.seat === asset.owner_seat)?.username ?? "another player"}` : ", unowned"}`
              }
              style={{ gridColumn: col, gridRow: row }}
              className={
                "relative flex overflow-hidden border-0 p-0 text-left cursor-pointer " +
                "focus-visible:outline-3 focus-visible:outline-(--brand-primary) focus-visible:-outline-offset-3 focus-visible:z-10 " +
                (isCorner
                  ? "bg-linear-to-br from-(--city-corner-a) to-(--city-corner-b) text-(--city-on-dark) items-center justify-center"
                  : "bg-linear-to-br from-(--city-tile-a) to-(--city-tile-b) text-(--city-tile-ink) hover:from-(--city-tile-hi-a) hover:to-(--city-tile-hi-b)") +
                (selectedIdx === space.idx ? " ring-2 ring-inset ring-(--brand-primary) z-[3]" : "")
              }
            >
              {isCorner ? (
                <span className="flex flex-col items-center gap-1 p-1">
                  <span className="text-[21px] leading-none text-(--brand-primary)" aria-hidden="true">
                    {CORNER_ICON[space.name] ?? "◆"}
                  </span>
                  <span className="text-[11.5px] font-bold text-center leading-tight">
                    {space.name}
                  </span>
                  <span className="font-mono text-[10px] text-(--city-on-dark-soft) tracking-wide">
                    {CORNER_SUB[space.name]}
                  </span>
                  <TokenLane seats={here} marks={marks} currentSeat={currentSeat} />
                </span>
              ) : (
                <TileFace
                  space={space}
                  edge={edge}
                  country={country}
                  asset={asset}
                  seats={seats}
                  here={here}
                  marks={marks}
                  currentSeat={currentSeat}
                />
              )}
            </button>
          );
        })}

        <div
          className="flex flex-col items-center justify-center gap-3 p-4 bg-linear-to-br from-(--city-felt-a) to-(--city-felt-b)"
          style={{ gridColumn: "2 / 11", gridRow: "2 / 11" }}
        >
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-(--brand-primary) m-0">Spintra City</p>
          <p className="font-mono text-[10px] tracking-[0.36em] text-(--city-on-dark-soft) m-0">
            WORLD TOUR
          </p>
        </div>
      </div>
    </div>
  );
}

function TileFace({
  space,
  edge,
  country,
  asset,
  seats,
  here,
  marks,
  currentSeat,
}: {
  space: CityBoardSpace;
  edge: Edge;
  country: { name: string; band: string; flag: string } | null;
  asset: CityAsset | undefined;
  seats: CitySeat[];
  here: CitySeat[];
  marks: Map<number, string>;
  currentSeat: number | null;
}) {
  const sideways = edge === "left" || edge === "right";
  const owner = asset ? seats.find((s) => s.seat === asset.owner_seat) : undefined;

  // The band always faces the board centre; the body always reads upright.
  const tileDir =
    edge === "top" ? "flex-col-reverse" : edge === "left" ? "flex-row-reverse" : sideways ? "flex-row" : "flex-col";

  return (
    <span className={`relative flex flex-1 min-w-0 items-stretch ${tileDir}`}>
      <span
        className={
          "relative flex shrink-0 items-center justify-center gap-[3px] " +
          (sideways ? "w-[22px] flex-col" : "h-[23px]")
        }
        style={{
          background: country
            ? `linear-gradient(178deg, ${country.band}cc, ${country.band})`
            : "linear-gradient(178deg,#cfc6b2,#9c927c)",
        }}
      >
        {country && (
          <span
            className="w-[19px] h-[13px] rounded-[2px] shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,.45)]"
            style={{ background: country.flag }}
            aria-hidden="true"
          />
        )}
        {!country && (
          <span className="text-[11px] font-extrabold text-black/70 leading-none" aria-hidden="true">
            {space.kind === "airport" ? "✈" : space.kind === "utility" ? "⚡" : space.kind === "tax" ? "⚖" : "✦"}
          </span>
        )}
        {asset && asset.buildings > 0 && (
          // Four pips in a row measure 23px, which overflows the 22px vertical
          // band — on side tiles they stack with the band's own axis instead.
          // A thin light outline (not a size change, which would overflow the
          // band) is what makes a 5px pip actually read against the country
          // band's own colour instead of blending into it at board scale.
          <span className={`flex gap-[1px] ${sideways ? "flex-col" : ""}`} aria-hidden="true">
            {asset.buildings >= 5 ? (
              <i
                className={`bg-[#c0392b] rounded-[1px] shadow-[0_0_0_0.5px_rgba(255,255,255,.7)] ${sideways ? "w-[5px] h-[8px]" : "w-[8px] h-[5px]"}`}
              />
            ) : (
              Array.from({ length: asset.buildings }, (_, k) => (
                <i
                  key={k}
                  className="w-[5px] h-[5px] rounded-[1px] bg-[#2f7d4f] shadow-[0_0_0_0.5px_rgba(255,255,255,.7)]"
                />
              ))
            )}
          </span>
        )}
      </span>

      <span className="flex flex-1 min-w-0 min-h-0 flex-col items-stretch">
        {/* One size, because the board is one width at every viewport. A `sm:`
            step here rendered 12px on desktop and clipped "Melbourne" in a 57px
            tile while mobile's 11px fitted — a breakpoint with nothing to
            respond to. */}
        <span className="flex flex-1 items-center justify-center text-center text-[11px] font-bold leading-tight px-0.75 py-0.5 tracking-[-0.2px]">
          {space.name}
        </span>
        {space.price != null && (
          <span className="font-mono text-[11px] font-bold text-center pb-[2px] text-(--city-price-ink) tabular-nums">
            {space.price}
          </span>
        )}
        <TokenLane seats={here} marks={marks} currentSeat={currentSeat} />
      </span>

      {owner && (
        <span
          className={
            "absolute " +
            (edge === "top"
              ? "inset-x-0 top-0 h-1.5"
              : edge === "left"
                ? "inset-y-0 left-0 w-1.5"
                : edge === "right"
                  ? "inset-y-0 right-0 w-1.5"
                  : "inset-x-0 bottom-0 h-1.5")
          }
          style={{
            // Mortgaged reads as a hazard-striped, half-dimmed version of the
            // owner's own colour rather than a solid stripe — a board-scale
            // signal that this property isn't earning rent right now, without
            // needing to compete with the tile's other content for space.
            background: asset?.is_mortgaged
              ? `repeating-linear-gradient(45deg, ${SEAT_COLOURS[owner.seat % 8].dark}, ${SEAT_COLOURS[owner.seat % 8].dark} 3px, rgba(0,0,0,.5) 3px, rgba(0,0,0,.5) 6px)`
              : SEAT_COLOURS[owner.seat % 8].dark,
          }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

function TokenLane({
  seats,
  marks,
  currentSeat,
}: {
  seats: CitySeat[];
  marks: Map<number, string>;
  currentSeat: number | null;
}) {
  return (
    <span className="flex shrink-0 min-h-[21px] items-center justify-center gap-[2px] px-[2px] pb-[3px]">
      {seats.map((s) => {
        const c = SEAT_COLOURS[s.seat % 8];
        return (
          <span
            key={s.seat}
            title={s.username}
            className={
              "grid place-items-center w-[19px] h-[19px] shrink-0 rounded-full border-[1.5px] border-black/60 " +
              "text-[11px] font-extrabold leading-none text-[#16121b] " +
              (s.seat === currentSeat ? "ring-[2.5px] ring-white" : "")
            }
            style={{
              background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.9), ${c.light} 42%, ${c.dark})`,
              textShadow: "0 1px 0 rgba(255,255,255,.5)",
            }}
          >
            {marks.get(s.seat) ?? "?"}
          </span>
        );
      })}
    </span>
  );
}
