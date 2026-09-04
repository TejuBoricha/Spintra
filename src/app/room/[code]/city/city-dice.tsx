"use client";

// The one thing this board never had: a dice roll you can actually see. Every
// other feedback for a roll was text-only ("Rolled 4 and 2, moved to...") —
// user feedback: "there's no visual involvement in this part as it kills the
// big fun part of this game," pointing at richup.io's dice as the bar to
// clear. richup.io itself blocks automated fetching (403), so this isn't a
// pixel copy of theirs — it's a real 3D CSS dice cube (a well-established,
// widely-reproduced technique: 6 faces placed in 3D space via rotate+
// translateZ, then the whole cube rotated to bring the rolled face forward),
// tumbling into place rather than just appearing.
//
// Face placement (fixed, physical layout of the cube — opposite faces sum to
// 7, the actual constraint a real die has to satisfy):
//   1 front (rotateY 0) / 6 back (rotateY 180)
//   2 right (rotateY 90) / 5 left (rotateY -90)
//   3 top   (rotateX 90) / 4 bottom (rotateX -90)
//
// Rotating the whole cube by the inverse of a face's placement brings that
// face to point at the camera — this exact placement/reveal pairing is the
// standard one reproduced across most CSS dice tutorials, verified here by
// screenshotting all 6 values in a row and checking pip counts 1-6 in order
// (see CHANGELOG_AI.md).
const FACE_REVEAL: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: 0, ry: -90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90, ry: 0 },
  5: { rx: 0, ry: 90 },
  6: { rx: 0, ry: 180 },
};

// Which cells of a 3x3 grid get a pip, per value — the standard die layout.
const PIP_CELLS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Face({
  value,
  rotate,
  half,
}: {
  value: number;
  rotate: string;
  half: number;
}) {
  return (
    <div
      className="absolute inset-0 rounded-[18%] bg-white border border-black/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] grid grid-cols-3 grid-rows-3 p-[14%]"
      style={{ transform: `${rotate} translateZ(${half}px)` }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIP_CELLS[value].includes(i) && (
            <span className="w-full h-full rounded-full bg-[#16121b]" />
          )}
        </span>
      ))}
    </div>
  );
}

/** One die, permanently spun to reveal `value` — replays its roll animation
 *  only when its React `key` changes (see DicePair below), not on every
 *  render, so an unrelated re-render never re-tumbles an already-landed die. */
function Die({ value, size = 48 }: { value: number; size?: number }) {
  const half = size / 2;
  const reveal = FACE_REVEAL[value] ?? FACE_REVEAL[1];
  // Extra whole turns baked into the animated target so the die visibly
  // tumbles a few times before landing — adding 360deg multiples doesn't
  // change which face ends up forward, so the final resting value is exact,
  // never just approximately close.
  const finalRx = reveal.rx + 720;
  const finalRy = reveal.ry + 1080;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size, perspective: 300 }}
    >
      <div
        className="relative w-full h-full [transform-style:preserve-3d] animate-city-dice-roll"
        style={
          {
            "--city-dice-final-rx": `${finalRx}deg`,
            "--city-dice-final-ry": `${finalRy}deg`,
          } as React.CSSProperties
        }
      >
        <Face value={1} rotate="rotateY(0deg)" half={half} />
        <Face value={6} rotate="rotateY(180deg)" half={half} />
        <Face value={2} rotate="rotateY(90deg)" half={half} />
        <Face value={5} rotate="rotateY(-90deg)" half={half} />
        <Face value={3} rotate="rotateX(90deg)" half={half} />
        <Face value={4} rotate="rotateX(-90deg)" half={half} />
      </div>
    </div>
  );
}

/**
 * Two dice, keyed by the caller to the specific roll they're showing — a
 * fresh `key` remounts both `Die`s, which is what restarts the CSS roll
 * animation (deliberately not driven by a JS animation-state machine: a
 * plain remount can't desync from what's actually on screen). Renders
 * nothing until there's a roll to show, same condition the text narration
 * next to it already uses.
 */
export function CityDice({
  dice,
  rollKey,
}: {
  dice: [number, number] | null;
  rollKey: string;
}) {
  if (!dice) return null;
  return (
    <div className="flex items-center justify-center gap-3 mb-2" aria-hidden="true">
      <div key={rollKey} className="flex items-center gap-3">
        <Die value={dice[0]} />
        <Die value={dice[1]} />
      </div>
    </div>
  );
}
