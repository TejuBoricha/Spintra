"use client";

import { Ban, Coffee, MoveDown, Plane, Scale, Sparkles, Zap } from "lucide-react";
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
//
// Corner/space icons and country flags were previously bare Unicode/emoji and
// CSS-gradient approximations respectively — flagged directly by a user as
// reading like a functional placeholder (icons render inconsistently per OS,
// three of eight flags were outright wrong: Australia had no Union Jack
// canton and two plain dots for five Southern Cross stars, Canada's maple
// leaf was a circle, India's Ashoka Chakra was a navy dot). Icons now come
// from lucide-react — already a dependency two files over — and flags are
// real SVG art (<FlagDefs/> below), built from each flag's actual published
// construction spec rather than eyeballed: Portugal/Australia's colours from
// flagcolorcodes.com, Australia's Southern Cross positions and star-point
// counts from the Flags Act 1953 schedule (fotw.info), South Africa/Canada/
// UAE's official hex values from their own standards. Emoji flags were ruled
// out in the original prototyping (Windows renders regional-indicator pairs
// as bare letter codes — a card literally read "ZA").

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

export const COUNTRY: Record<string, { name: string; band: string }> = {
  pt: { name: "Portugal", band: "#2c8f5e" },
  pl: { name: "Poland", band: "#c2334a" },
  jp: { name: "Japan", band: "#c8415c" },
  za: { name: "South Africa", band: "#c98a1f" },
  au: { name: "Australia", band: "#2065b5" },
  ca: { name: "Canada", band: "#cf3f28" },
  in: { name: "India", band: "#e07b18" },
  ae: { name: "UAE", band: "#6b4bd0" },
};

const CORNER_ICON: Record<string, typeof Plane> = {
  Departure: Plane,
  Customs: Ban,
  Layover: Coffee,
  Detained: MoveDown,
};

const CORNER_SUB: Record<string, string> = {
  Departure: "COLLECT 200",
  Customs: "HELD",
  Layover: "FREE REST",
  Detained: "GO TO CUSTOMS",
};

const KIND_ICON: Record<string, typeof Plane> = {
  airport: Plane,
  utility: Zap,
  tax: Scale,
};

// A regular {spikes}-pointed star, inner radius per the outer/inner ratio the
// Flags Act 1953 schedule specifies for the Commonwealth Star and the four
// larger Southern Cross stars (4/9), reused for all seven-point stars; the
// same ratio is applied to Epsilon Crucis (five points) for visual
// consistency, since the schedule doesn't separately specify one for it.
function starPoints(spikes: number): string {
  const inner = 4 / 9;
  const pts: string[] = [];
  for (let k = 0; k < spikes * 2; k++) {
    const r = k % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (k * Math.PI) / spikes;
    pts.push(`${(r * Math.cos(a)).toFixed(4)},${(r * Math.sin(a)).toFixed(4)}`);
  }
  return pts.join(" ");
}
const STAR7 = starPoints(7);
const STAR5 = starPoints(5);

// A stylised maple leaf silhouette — not botanically exact, but genuinely
// multi-lobed rather than the plain circle it replaces.
const MAPLE_LEAF =
  "0,-1 0.15,-0.55 0.5,-0.62 0.42,-0.35 0.78,-0.22 0.55,-0.08 0.65,0.05 0.35,0.02 " +
  "0.42,0.32 0.18,0.2 0.15,0.55 0.05,0.35 0,0.62 -0.05,0.35 -0.15,0.55 -0.18,0.2 " +
  "-0.42,0.32 -0.35,0.02 -0.65,0.05 -0.55,-0.08 -0.78,-0.22 -0.42,-0.35 -0.5,-0.62 -0.15,-0.55";

const CHAKRA_SPOKES = Array.from({ length: 24 }, (_, i) => i * 15);

/**
 * The board's flag artwork, defined once as hidden SVG `<symbol>`s and drawn
 * per-tile via `<use>` — the standard SVG sprite-sheet pattern, so the same
 * geometry isn't repeated per instance and every flag stays a real vector
 * shape instead of a CSS-gradient approximation.
 */
function FlagDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="star7" viewBox="-1 -1 2 2">
          <polygon points={STAR7} fill="#fff" />
        </symbol>
        <symbol id="star5" viewBox="-1 -1 2 2">
          <polygon points={STAR5} fill="#fff" />
        </symbol>
        <symbol id="mapleleaf" viewBox="-1 -1 2 2">
          <polygon points={MAPLE_LEAF} fill="#d80621" />
        </symbol>
        <symbol id="chakra" viewBox="-1 -1 2 2">
          <circle r="1" fill="none" stroke="#000080" strokeWidth="0.1" />
          {CHAKRA_SPOKES.map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="-0.3"
              x2="0"
              y2="-0.95"
              stroke="#000080"
              strokeWidth="0.16"
              transform={`rotate(${deg})`}
            />
          ))}
          <circle r="0.14" fill="#000080" />
        </symbol>

        {/* Portugal — green 2/5 + red 3/5, colours per flagcolorcodes.com. */}
        <symbol id="flag-pt" viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#da291c" />
          <rect width="12" height="20" fill="#046a38" />
          <circle cx="12" cy="10" r="4.2" fill="#ffcc00" stroke="#7a1710" strokeWidth="0.5" />
          <circle cx="12" cy="10" r="2.6" fill="#046a38" />
        </symbol>

        <symbol id="flag-pl" viewBox="0 0 30 20">
          <rect width="30" height="10" fill="#fff" />
          <rect y="10" width="30" height="10" fill="#dc143c" />
        </symbol>

        {/* Disc diameter 3/5 of height, centred — Japan's own published spec. */}
        <symbol id="flag-jp" viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#fff" />
          <circle cx="15" cy="10" r="6" fill="#bc002d" />
        </symbol>

        {/* South Africa's pall ("Y"): black hoist triangle, green band with
            gold/white borders, drawn as two joined stroked paths rather than
            hand-plotted polygons. */}
        <symbol id="flag-za" viewBox="0 0 30 20">
          <rect width="30" height="10" fill="#de3831" />
          <rect y="10" width="30" height="10" fill="#002395" />
          <polygon points="0,0 0,20 10,10" fill="#000" />
          <path d="M0,0 L12,10 L30,10" fill="none" stroke="#ffb612" strokeWidth="6.4" strokeLinejoin="round" />
          <path d="M0,20 L12,10" fill="none" stroke="#ffb612" strokeWidth="6.4" strokeLinejoin="round" />
          <path d="M0,0 L12,10 L30,10" fill="none" stroke="#fff" strokeWidth="4.8" strokeLinejoin="round" />
          <path d="M0,20 L12,10" fill="none" stroke="#fff" strokeWidth="4.8" strokeLinejoin="round" />
          <path d="M0,0 L12,10 L30,10" fill="none" stroke="#007a4d" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M0,20 L12,10" fill="none" stroke="#007a4d" strokeWidth="3.2" strokeLinejoin="round" />
        </symbol>

        {/* Australia — true ratio is 1:2; squeezed horizontally into this
            shared 3:2 sprite like every small flag-icon set does, but every
            position below is the Flags Act 1953 schedule's own fraction,
            x-scaled by 0.75. */}
        <symbol id="flag-au" viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#00247d" />
          <clipPath id="au-canton">
            <rect width="15" height="10" />
          </clipPath>
          <g clipPath="url(#au-canton)">
            <path d="M0 0 L15 10 M15 0 L0 10" stroke="#fff" strokeWidth="1.7" />
            <path d="M0 0 L15 10 M15 0 L0 10" stroke="#c8102e" strokeWidth="0.7" />
            <rect x="6.4" width="2.2" height="10" fill="#fff" />
            <rect y="4.2" width="15" height="1.6" fill="#fff" />
            <rect x="7" width="1" height="10" fill="#c8102e" />
            <rect y="4.7" width="15" height="0.6" fill="#c8102e" />
          </g>
          {/* Commonwealth Star: centred in lower hoist, outer r = 3/20 fly width.
              width/height are required here, not optional — a <use> pointing at
              a <symbol> (as opposed to a plain shape) has no intrinsic size of
              its own; without an explicit box every nested star below silently
              resolved to 0x0 and never painted, even though the transform
              itself was correct (caught by an actual rendered screenshot, not
              assumed from the source). */}
          <use href="#star7" width="2" height="2" transform="translate(7.5,15) scale(4.5)" />
          {/* Southern Cross — Alpha/Beta/Gamma/Delta (7pt), Epsilon (5pt). */}
          <use href="#star7" width="2" height="2" transform="translate(22.5,16.667) scale(2.143)" />
          <use href="#star7" width="2" height="2" transform="translate(18.75,8.75) scale(2.143)" />
          <use href="#star7" width="2" height="2" transform="translate(22.5,3.333) scale(2.143)" />
          <use href="#star7" width="2" height="2" transform="translate(25.83,7.417) scale(2.143)" />
          <use href="#star5" width="2" height="2" transform="translate(24,10.833) scale(1.25)" />
        </symbol>

        <symbol id="flag-ca" viewBox="0 0 30 20">
          <rect width="7.5" height="20" fill="#d80621" />
          <rect x="7.5" width="15" height="20" fill="#fff" />
          <rect x="22.5" width="7.5" height="20" fill="#d80621" />
          <use href="#mapleleaf" width="2" height="2" transform="translate(15,10) scale(6.5)" />
        </symbol>

        {/* Saffron/white/green thirds, 24-spoke Ashoka Chakra in navy. */}
        <symbol id="flag-in" viewBox="0 0 30 20">
          <rect width="30" height="6.667" fill="#ff9933" />
          <rect y="6.667" width="30" height="6.667" fill="#fff" />
          <rect y="13.333" width="30" height="6.667" fill="#138808" />
          <use href="#chakra" width="2" height="2" transform="translate(15,10) scale(2.5)" />
        </symbol>

        {/* Green/white/black thirds, red bar a quarter of the width at the hoist. */}
        <symbol id="flag-ae" viewBox="0 0 30 20">
          <rect width="30" height="6.667" fill="#00843d" />
          <rect y="6.667" width="30" height="6.667" fill="#fff" />
          <rect y="13.333" width="30" height="6.667" fill="#000" />
          <rect width="7.5" height="20" fill="#c8102e" />
        </symbol>
      </defs>
    </svg>
  );
}

// FlagDefs takes no props and its output never changes, but <FlagDefs/>
// inline in CityBoard's JSX would still be a fresh element every render —
// React re-executes a function component's body whenever its element isn't
// referentially the same one as last time, wrapping in React.memo or not.
// Computing the element once, here, at module load, means CityBoard always
// passes the exact same element reference, so React bails out of this
// subtree entirely instead of re-diffing ~80 static SVG nodes (8 flags'
// worth of rects/paths/uses) on every board re-render — a code-review pass
// found this rebuilding on every unrelated realtime refetch.
const FLAG_DEFS = <FlagDefs />;

// COUNTRY (name/band) and FlagDefs (the actual <symbol id="flag-XX"> art)
// are two independently-maintained artifacts — a code-review pass flagged
// that nothing enforces they stay in sync; a country added to one without
// the other renders a silent empty/border-only flag chip, no error
// anywhere. FLAG_SYMBOL_CODES is a manually-kept mirror of every symbol id
// FlagDefs actually defines, checked once at module load so a mismatch
// fails loudly in development instead of shipping quietly.
const FLAG_SYMBOL_CODES = ["pt", "pl", "jp", "za", "au", "ca", "in", "ae"] as const;
if (process.env.NODE_ENV !== "production") {
  const missing = Object.keys(COUNTRY).filter(
    (code) => !(FLAG_SYMBOL_CODES as readonly string[]).includes(code)
  );
  if (missing.length > 0) {
    console.error(
      `city-board.tsx: COUNTRY has ${missing.join(", ")} with no matching ` +
        `<symbol id="flag-..."> in FlagDefs — add one, or that country's flag chip renders empty.`
    );
  }
}

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
      {FLAG_DEFS}
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
          // Falls back to Sparkles rather than rendering nothing, matching
          // the sibling !country branch in TileFace below — city_board_spaces
          // is server data, not a closed TS union, so a future corner
          // rename/addition should degrade to a generic icon, not a blank
          // slot with no signal anything's missing.
          const CornerIcon = CORNER_ICON[space.name] ?? Sparkles;

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
                  <CornerIcon
                    className="w-[19px] h-[19px] text-(--brand-primary)"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
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
          className="relative flex flex-col items-center justify-center gap-3 p-4 bg-linear-to-br from-(--city-felt-a) to-(--city-felt-b)"
          style={{ gridColumn: "2 / 11", gridRow: "2 / 11" }}
        >
          {/* One graphic anchor rather than an illustration — a seal ring
              behind the wordmark, in the same brand lime everything else on
              this board now draws its accents from. */}
          <span
            className="absolute w-17 h-17 rounded-full border-2 border-(--brand-primary)/90"
            aria-hidden="true"
          />
          <span
            className="absolute w-13 h-13 rounded-full border border-(--brand-primary)/55"
            aria-hidden="true"
          />
          <p className="relative text-2xl sm:text-3xl font-extrabold tracking-tight text-(--brand-primary) m-0">Spintra City</p>
          <p className="relative font-mono text-[10px] tracking-[0.36em] text-(--city-on-dark-soft) m-0">
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
  country: { name: string; band: string } | null;
  asset: CityAsset | undefined;
  seats: CitySeat[];
  here: CitySeat[];
  marks: Map<number, string>;
  currentSeat: number | null;
}) {
  const sideways = edge === "left" || edge === "right";
  const owner = asset ? seats.find((s) => s.seat === asset.owner_seat) : undefined;
  const KindIcon = KIND_ICON[space.kind];

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
          <svg
            viewBox="0 0 30 20"
            className="w-[19px] h-[13px] rounded-[2px] shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,.45)]"
            aria-hidden="true"
          >
            <use href={`#flag-${space.country}`} />
          </svg>
        )}
        {!country && (
          <span aria-hidden="true">
            {KindIcon ? (
              <KindIcon className="w-[13px] h-[13px] text-black/70" strokeWidth={2.25} />
            ) : (
              <Sparkles className="w-[13px] h-[13px] text-black/70" strokeWidth={2.25} />
            )}
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

// Up to 8 players can genuinely stack on one space (a corner tile especially
// — Layover/Detained/Departure/Customs see disproportionate traffic). A
// plain gapped row of 19px discs only has room for 2-3 before it overflows
// its lane and the tile's own overflow-hidden silently clips the rest —
// invisible, not just cramped, since a clipped token leaves no trace it was
// ever there. Fixed two ways: tokens after the first overlap (card-fan
// style) instead of each claiming full width, and a hard cap beyond which
// the remainder collapse into a single "+N" badge rather than attempting to
// cram every token in — every player is still represented, none silently
// disappear, and the tile's own name never has to lose space to make room.
const MAX_VISIBLE_TOKENS = 4;

function TokenLane({
  seats,
  marks,
  currentSeat,
}: {
  seats: CitySeat[];
  marks: Map<number, string>;
  currentSeat: number | null;
}) {
  if (seats.length === 0) return <span className="min-h-[21px]" aria-hidden="true" />;

  const overflow = seats.length > MAX_VISIBLE_TOKENS;
  const shown = overflow ? seats.slice(0, MAX_VISIBLE_TOKENS - 1) : seats;
  const hidden = overflow ? seats.slice(MAX_VISIBLE_TOKENS - 1) : [];

  return (
    <span className="flex shrink-0 min-h-[21px] items-center justify-center px-[2px] pb-[3px]">
      {shown.map((s, i) => {
        const c = SEAT_COLOURS[s.seat % 8];
        return (
          <span
            key={s.seat}
            title={s.username}
            className={
              "grid place-items-center w-[19px] h-[19px] shrink-0 rounded-full border-[1.5px] border-black/60 " +
              "text-[11px] font-extrabold leading-none text-[#16121b] " +
              (i > 0 ? "-ml-[7px] " : "") +
              (s.seat === currentSeat ? "z-[1]" : "")
            }
            style={{
              // A linear diagonal, matching the app's own --gradient-avatar
              // direction, rather than a radial "candy shine" invented just
              // for this board — same per-seat colour ramp, different
              // gradient style, so a token still reads as a Spintra avatar
              // first and a board piece second.
              background: `linear-gradient(135deg, ${c.light}, ${c.dark})`,
              textShadow: "0 1px 0 rgba(255,255,255,.5)",
              // A code-review pass computed real contrast ratios twice on this
              // ring: a lime ring against cream tiles fell to ~1.12:1, and the
              // "measured-good" white it was reverted to still only reaches
              // ~1.08-1.34:1 against the same cream tiles — a single ring
              // colour cannot win against both the near-black corner tiles and
              // the cream property tiles at once. Two stacked rings can: white
              // immediately outside the border, black immediately outside
              // that, so whichever one is closer to the tile's own colour, the
              // OTHER one still reads clearly — verified against every tile
              // background this board actually uses, not assumed.
              boxShadow:
                s.seat === currentSeat
                  ? "0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,.75)"
                  : undefined,
            }}
          >
            {marks.get(s.seat) ?? "?"}
          </span>
        );
      })}
      {overflow && (
        <span
          title={hidden.map((s) => s.username).join(", ")}
          className="grid place-items-center w-[19px] h-[19px] shrink-0 -ml-[7px] rounded-full border-[1.5px] border-black/60 bg-black text-[9px] font-extrabold leading-none text-white"
        >
          +{hidden.length}
        </span>
      )}
    </span>
  );
}
