"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { AX, AY, REST, TRACK_D, TRACK_WIDE_D, curve, toPath } from "./footer-table-geometry";
import "./footer-table.css";

/*
 * The footer's "endless game table" (the look and the loop are in footer-table.css). This file is the markup, which
 * is the same on the server and in the browser (no randomness, no dates), so the scene runs from the first paint,
 * before any script; and one effect that does two things:
 *   - pauses the scene while it is off screen (data-live), so the page does no animation work above the footer;
 *   - with a mouse (hover and a precise pointer) and motion welcome: the cursor easter egg. Pieces near the cursor
 *     move away, two of them are curious and come towards it, the track bends around it, and the layers shift a
 *     little. Touch and reduced motion get none of it. The scene never takes pointer events itself.
 */

const TRACK_POINTS = curve(AX, AY);

const vars = (o: Record<string, string | number>) => o as CSSProperties;

/** Names an id of this instance's gradients and patterns: two scenes on one page must not share them. */
type Ids = (name: string) => string;

/** One piece on the track: two lanes (one per axis) carry it, a wrapper the cursor can push, a wrapper for the hop. */
function Piece({
  phase,
  size,
  ratio,
  pull,
  index,
  children,
}: {
  phase: number;
  size: number;
  ratio?: number;
  pull: "flee" | "follow";
  index: number;
  children: ReactNode;
}) {
  const at = REST[String(phase)];
  return (
    <div className="ft-lx" style={vars({ "--ph": phase, "--sx": at.x, "--sy": at.y })}>
      <div className="ft-ly">
        <div className="ft-pc" data-pull={pull} style={vars({ "--w": `${size}%`, ...(ratio ? { "--ar": ratio } : {}) })}>
          <div className="ft-in ft-hop" style={vars({ "--i": index })}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const STAR = "M50 6 C 55 36 66 46 94 50 C 66 54 55 64 50 94 C 45 64 34 54 6 50 C 34 46 45 36 50 6 Z";

function Die({ k }: { k: Ids }) {
  return (
    <div className="ft-in ft-bn-up">
      <div className="ft-in ft-die-fx">
        <svg viewBox="0 0 100 100" className="ft-spr" focusable="false">
          <circle className="ft-halo" cx="50" cy="50" r="64" fill={`url(#${k("halo-lime")})`} />
          <rect className="ft-sh" x="16" y="17" width="80" height="80" rx="20" />
          <rect className="ft-rim" x="10" y="10" width="80" height="80" rx="20" />
          <rect className="ft-s ft-lime" x="10" y="10" width="80" height="80" rx="20" />
          <path className="ft-shine" d="M24 31 Q 26 23 36 21" />
          <g className="ft-fa">
            <circle className="ft-pip" cx="31" cy="31" r="7.5" />
            <circle className="ft-pip" cx="69" cy="31" r="7.5" />
            <circle className="ft-pip" cx="50" cy="50" r="7.5" />
            <circle className="ft-pip" cx="31" cy="69" r="7.5" />
            <circle className="ft-pip" cx="69" cy="69" r="7.5" />
          </g>
          <g className="ft-fb">
            <circle className="ft-pip" cx="32" cy="28" r="7.5" />
            <circle className="ft-pip" cx="68" cy="28" r="7.5" />
            <circle className="ft-pip" cx="32" cy="50" r="7.5" />
            <circle className="ft-pip" cx="68" cy="50" r="7.5" />
            <circle className="ft-pip" cx="32" cy="72" r="7.5" />
            <circle className="ft-pip" cx="68" cy="72" r="7.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** The logo as a game token: the orange disc and the lime ring; it shows the S, then turns over to a star. */
function SChip({ k }: { k: Ids }) {
  return (
    <div className="ft-in ft-bn-down">
      <div className="ft-in ft-chip-fx">
        <svg viewBox="0 0 100 100" className="ft-spr" focusable="false">
          <circle className="ft-halo" cx="50" cy="50" r="64" fill={`url(#${k("halo-orange")})`} />
          <circle className="ft-sh" cx="55" cy="56" r="42" />
          <circle className="ft-rim" cx="50" cy="50" r="42" />
          <circle className="ft-s ft-lime" cx="50" cy="50" r="42" />
          <circle className="ft-s ft-orange" cx="50" cy="50" r="31" />
          <g className="ft-fa">
            <path className="ft-s" d="M61 36 C 58 26 40 27 39 38 C 38 50 62 49 61 62 C 60 74 41 74 38 64" fill="none" strokeWidth="8" />
          </g>
          <g className="ft-fb">
            <path
              className="ft-s ft-paper"
              strokeWidth="4.5"
              d="M50 30 C 52 43 57 48 70 50 C 57 52 52 57 50 70 C 48 57 43 52 30 50 C 43 48 48 43 50 30 Z"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** A card that turns over twice a loop: a star on its face, a violet lattice on its back. */
function Card({ k }: { k: Ids }) {
  return (
    <div className="ft-in ft-card-fx">
      <svg viewBox="0 0 70 100" className="ft-spr" focusable="false">
        <rect className="ft-sh" x="9" y="10" width="58" height="88" rx="10" />
        <rect className="ft-rim" x="6" y="6" width="58" height="88" rx="10" />
        <rect className="ft-s ft-paper" x="6" y="6" width="58" height="88" rx="10" />
        <g className="ft-cf">
          <path
            className="ft-s ft-lime"
            strokeWidth="4"
            d="M35 28 C 37 42 42 47 52 50 C 42 53 37 58 35 72 C 33 58 28 53 18 50 C 28 47 33 42 35 28 Z"
          />
          <circle className="ft-violet" cx="17" cy="19" r="4" />
          <circle className="ft-violet" cx="53" cy="81" r="4" />
        </g>
        <g className="ft-cb">
          <rect x="10" y="10" width="50" height="80" rx="7" fill={`url(#${k("lattice")})`} />
          <rect x="10" y="10" width="50" height="80" rx="7" fill="none" stroke="var(--ft-ink)" strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
}

function Pawn({ k }: { k: Ids }) {
  const body = "M33 86 C 36 66 43 54 50 49 C 57 54 64 66 67 86 Z";
  return (
    <div className="ft-in ft-pawn-fx">
      <svg viewBox="0 0 100 100" className="ft-spr" focusable="false">
        <circle className="ft-halo" cx="50" cy="52" r="60" fill={`url(#${k("halo-violet")})`} />
        <ellipse className="ft-sh" cx="55" cy="92" rx="27" ry="9" />
        <g className="ft-rim">
          <circle cx="50" cy="27" r="17" />
          <path d={body} />
          <ellipse cx="50" cy="88" rx="27" ry="9" />
        </g>
        <ellipse className="ft-s ft-cyan" cx="50" cy="88" rx="27" ry="9" />
        <path className="ft-s ft-cyan" d={body} />
        <ellipse className="ft-s ft-cyan" cx="50" cy="47" rx="18" ry="6.5" />
        <circle className="ft-s ft-cyan" cx="50" cy="27" r="17" />
        <path className="ft-shine" d="M40 21 Q 42 15 49 13" />
      </svg>
    </div>
  );
}

function VioletChip({ k }: { k: Ids }) {
  return (
    <div className="ft-in ft-vchip-fx">
      <svg viewBox="0 0 100 100" className="ft-spr" focusable="false">
        <circle className="ft-halo" cx="50" cy="50" r="64" fill={`url(#${k("halo-violet")})`} />
        <circle className="ft-sh" cx="55" cy="56" r="42" />
        <circle className="ft-rim" cx="50" cy="50" r="42" />
        <circle className="ft-s ft-violet" cx="50" cy="50" r="42" />
        <circle className="ft-dash" cx="50" cy="50" r="28" />
        <path
          className="ft-s ft-lime"
          strokeWidth="4"
          d="M50 34 C 52 44 56 48 66 50 C 56 52 52 56 50 66 C 48 56 44 52 34 50 C 44 48 48 44 50 34 Z"
        />
      </svg>
    </div>
  );
}

function SparkPiece({ k }: { k: Ids }) {
  return (
    <div className="ft-in ft-star-fx">
      <svg viewBox="0 0 100 100" className="ft-spr" focusable="false">
        <circle className="ft-halo" cx="50" cy="50" r="62" fill={`url(#${k("halo-lime")})`} />
        <path className="ft-rim" d={STAR} />
        <path className="ft-s ft-lime" d={STAR} />
      </svg>
    </div>
  );
}

/** Small star twinkles around the table, each with its own place, size and moment in the loop. */
const SPARKLES = [
  { left: 7, top: 26, w: 2.6, d: 0, rs: 0.9, ro: 1 },
  { left: 93, top: 70, w: 2.2, d: 1.6, rs: 0.6, ro: 0.7 },
  { left: 39, top: 11, w: 2, d: 3.1, rs: 1, ro: 0.95 },
  { left: 63, top: 90, w: 2.4, d: 2.2, rs: 0.75, ro: 0.8 },
  { left: 19, top: 85, w: 1.8, d: 4.1, rs: 0.55, ro: 0.6 },
  { left: 82, top: 16, w: 2.3, d: 0.9, rs: 0.95, ro: 1 },
];

const DUST = [
  { left: 12, top: 70, d: 0 },
  { left: 27, top: 88, d: 3 },
  { left: 44, top: 82, d: 6 },
  { left: 58, top: 92, d: 1.5 },
  { left: 73, top: 78, d: 8 },
  { left: 88, top: 86, d: 4.5 },
];

const SPARKLE_PATH = "M50 0 C 54 38 62 46 100 50 C 62 54 54 62 50 100 C 46 62 38 54 0 50 C 38 46 46 38 50 0 Z";

export function FooterTable({ className = "" }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const k: Ids = (name) => `ft${uid}-${name}`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Off screen, nothing runs.
    const watcher = new IntersectionObserver(
      (entries) => {
        // several can be queued when the footer scrolls in and out quickly: the last one is the current state
        root.dataset.live = entries[entries.length - 1].isIntersecting ? "true" : "false";
      },
      { rootMargin: "80px" },
    );
    watcher.observe(root);

    // The cursor easter egg: only with a mouse (hover and a precise pointer), and only when motion is welcome.
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stop = () => {};
    const sync = () => {
      stop();
      stop = mouse.matches && !reduced.matches ? followCursor(root) : () => {};
    };
    sync();
    mouse.addEventListener("change", sync);
    reduced.addEventListener("change", sync);

    return () => {
      watcher.disconnect();
      mouse.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return (
    <div ref={rootRef} className={`ft-scene ${className}`.trim()} aria-hidden="true" data-live="true" data-testid="footer-table">
      <svg className="ft-defs" width="0" height="0" focusable="false">
        <defs>
          <radialGradient id={k("halo-lime")}>
            <stop offset="0" stopColor="#e2f72a" stopOpacity=".5" />
            <stop offset="1" stopColor="#e2f72a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={k("halo-orange")}>
            <stop offset="0" stopColor="#ff6a00" stopOpacity=".5" />
            <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={k("halo-violet")}>
            <stop offset="0" stopColor="#9d63e8" stopOpacity=".55" />
            <stop offset="1" stopColor="#9d63e8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={k("felt-g")} cx="50%" cy="50%" r="50%">
            <stop offset="0" style={{ stopColor: "var(--ft-felt)" }} />
            <stop offset="1" style={{ stopColor: "var(--ft-felt)", stopOpacity: 0 }} />
          </radialGradient>
          <pattern id={k("lattice")} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill="var(--ft-violet)" />
            <path d="M0 0H14" stroke="var(--ft-lime)" strokeOpacity=".7" strokeWidth="3" />
          </pattern>
        </defs>
      </svg>

      {/* far layer: the felt, the table's rim, a second track, dust */}
      <div className="ft-layer" data-depth="0.35">
        {DUST.map((p) => (
          <span key={p.d} className="ft-dust" style={vars({ left: `${p.left}%`, top: `${p.top}%`, "--d": p.d })} />
        ))}
        <svg className="ft-svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <ellipse className="ft-felt" cx="50" cy="50" rx="46" ry="46" fill={`url(#${k("felt-g")})`} />
          <ellipse className="ft-rimline" cx="50" cy="50" rx="47.5" ry="45" />
          <path className="ft-track2" d={TRACK_WIDE_D} />
        </svg>
      </div>

      {/* the track, the hub where it crosses, and an orbit inside each loop */}
      <div className="ft-layer" data-depth="0.8">
        <svg className="ft-svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <path className="ft-track" data-track="" d={TRACK_D} />
        </svg>
        <div className="ft-hub">
          <svg className="ft-hub-ring" viewBox="0 0 100 100" focusable="false">
            <circle cx="50" cy="50" r="48" />
          </svg>
          <svg className="ft-hub-rays" viewBox="0 0 100 100" focusable="false">
            <line x1="50" y1="4" x2="50" y2="18" />
            <line x1="50" y1="82" x2="50" y2="96" />
            <line x1="4" y1="50" x2="18" y2="50" />
            <line x1="82" y1="50" x2="96" y2="50" />
            <line x1="17" y1="17" x2="27" y2="27" />
            <line x1="73" y1="73" x2="83" y2="83" />
            <line x1="83" y1="17" x2="73" y2="27" />
            <line x1="17" y1="83" x2="27" y2="73" />
          </svg>
        </div>
        <div className="ft-orb" style={{ left: "29%", top: "50%" }}>
          <svg className="ft-svg" viewBox="0 0 100 100" focusable="false">
            <circle className="ft-orbit-line" cx="50" cy="50" r="48" />
          </svg>
          <div className="ft-orb-spin">
            <div className="ft-sat">
              <svg viewBox="0 0 100 100" className="ft-spr" focusable="false">
                <circle className="ft-halo" cx="50" cy="50" r="62" fill={`url(#${k("halo-lime")})`} />
                <path className="ft-s ft-lime" d={STAR} />
              </svg>
            </div>
          </div>
        </div>
        <div className="ft-orb" style={{ left: "71%", top: "50%" }}>
          <svg className="ft-svg" viewBox="0 0 100 100" focusable="false">
            <circle className="ft-orbit-line" cx="50" cy="50" r="48" />
          </svg>
          <div className="ft-orb-spin ft-rev">
            <div className="ft-sat">
              <svg viewBox="0 0 100 100" className="ft-spr" focusable="false">
                <circle className="ft-halo" cx="50" cy="50" r="62" fill={`url(#${k("halo-violet")})`} />
                <circle className="ft-s ft-violet" cx="50" cy="50" r="38" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* the pieces: the die and the S chip start half a lap apart, so they meet at the crossing every 5 s */}
      <div className="ft-layer" data-depth="1.2">
        <Piece phase={0} size={10.4} pull="flee" index={0}>
          <Die k={k} />
        </Piece>
        <Piece phase={0.5} size={10.4} pull="flee" index={1}>
          <SChip k={k} />
        </Piece>
        <Piece phase={0.125} size={7.4} ratio={0.7} pull="flee" index={2}>
          <Card k={k} />
        </Piece>
        <Piece phase={0.375} size={8} pull="follow" index={3}>
          <Pawn k={k} />
        </Piece>
        <Piece phase={0.25} size={6.6} pull="follow" index={4}>
          <VioletChip k={k} />
        </Piece>
        <Piece phase={0.4375} size={5.8} pull="flee" index={5}>
          <SparkPiece k={k} />
        </Piece>
      </div>

      {/* near layer: sparkles */}
      <div className="ft-layer" data-depth="1.8">
        {SPARKLES.map((p) => (
          <span key={p.d} className="ft-sp" style={vars({ left: `${p.left}%`, top: `${p.top}%`, "--w": `${p.w}%`, "--d": p.d, "--rs": p.rs, "--ro": p.ro })}>
            <svg viewBox="0 0 100 100" focusable="false">
              <path d={SPARKLE_PATH} />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The cursor easter egg. One animation frame loop that runs only while the cursor is near the scene or something is
 * still settling, and ends by itself. Returns the function that stops it and puts everything back.
 */
function followCursor(root: HTMLElement): () => void {
  const pieces = Array.from(root.querySelectorAll<HTMLElement>("[data-pull]")).map((el) => ({
    el,
    sprite: el.querySelector("svg") as SVGElement,
    mode: el.dataset.pull,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  }));
  const track = root.querySelector<SVGPathElement>("[data-track]");
  let cursor: { x: number; y: number } | null = null;
  const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]")).map((el) => ({ el, depth: Number(el.dataset.depth) }));
  let amount = 0; // how far the track has given way (0 to 1)
  let trackBent = false;
  let ticks = 0;
  let px = 0;
  let py = 0;
  let frame = 0;

  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  /** Is this point within reach of the scene (a margin around it)? */
  const nearScene = (x: number, y: number, r: DOMRect) => x > r.left - 60 && x < r.right + 60 && y > r.top - 50 && y < r.bottom + 50;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    // A mouse moves over the whole page: do nothing while the scene is off screen and at rest.
    if (root.dataset.live === "false" && !cursor && !frame) return;
    const r = root.getBoundingClientRect();
    const near = nearScene(e.clientX, e.clientY, r);
    if (!near && !cursor) return; // the cursor is elsewhere and the scene has nothing to settle
    cursor = near ? { x: e.clientX, y: e.clientY } : null;
    wake();
  };
  const onLeave = () => {
    cursor = null;
    wake();
  };

  function tick() {
    frame = 0;
    // Read everything first, write everything after. Reading a position between style writes makes the browser
    // recalculate style and layout again for every read: with the cursor over the scene that measured 60 layouts and
    // 370 style recalculations a second; this order costs one of each per frame at most.
    const r = root.getBoundingClientRect();
    const rects = pieces.map((p) => p.sprite.getBoundingClientRect());
    // The page can scroll under a stationary mouse, so the cursor is checked against the scene every frame.
    if (cursor && !nearScene(cursor.x, cursor.y, r)) cursor = null;

    const W = r.width;
    const H = r.height;
    const cx = cursor ? cursor.x - r.left : -9999;
    const cy = cursor ? cursor.y - r.top : -9999;
    const goal = cursor ? 1 : 0;
    amount += (goal - amount) * 0.14;
    if (Math.abs(goal - amount) < 0.004) amount = goal;

    // the layers drift a little against the cursor, each by its own depth
    const nx = cursor ? (cx / W - 0.5) * 2 : 0;
    const ny = cursor ? (cy / H - 0.5) * 2 : 0;
    px += (nx * 7 - px) * 0.08;
    py += (ny * 5 - py) * 0.08;

    let moving = false;
    pieces.forEach((p, i) => {
      const b = rects[i];
      // Where the piece is on its track: the box includes the offset this loop applied last frame, and a force that
      // depended on that offset would feed back on itself and jitter at the edge of its reach.
      const qx = b.left + b.width / 2 - r.left - p.x;
      const qy = b.top + b.height / 2 - r.top - p.y;
      let tx = 0;
      let ty = 0;
      if (cursor) {
        const dx = qx - cx;
        const dy = qy - cy;
        const d = Math.hypot(dx, dy) || 1;
        if (p.mode === "flee") {
          if (d < 82) {
            const k = 1 - d / 82;
            tx = (dx / d) * k * k * 34;
            ty = (dy / d) * k * k * 34;
          }
        } else if (d < 150) {
          // the pull fades to nothing right at the cursor, where its direction is undefined
          const k = (1 - d / 150) * Math.min(1, d / 24);
          tx = (-dx / d) * k * 22;
          ty = (-dy / d) * k * 22;
        }
      }
      // a spring towards where the cursor wants it, so pieces glide and settle instead of jumping
      p.vx = (p.vx + (tx - p.x) * 0.1) * 0.8;
      p.vy = (p.vy + (ty - p.y) * 0.1) * 0.8;
      p.x += p.vx;
      p.y += p.vy;
      if (Math.abs(p.x) > 0.05 || Math.abs(p.y) > 0.05 || Math.abs(p.vx) > 0.02 || Math.abs(p.vy) > 0.02) moving = true;
    });

    // write phase. The layers and the pieces get their own translate: moving them through a custom property on the
    // root made the browser restyle the whole scene (about 150 elements) on every frame.
    for (const layer of layers) layer.el.style.translate = `${(px * layer.depth).toFixed(2)}px ${(py * layer.depth).toFixed(2)}px`;
    for (const p of pieces) p.el.style.translate = `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`;

    // the track gives way around the cursor (and is put back once, when the cursor has gone); a bend changes the
    // geometry of the path, so it is redrawn every other frame, which is smooth enough for a slight bend
    ticks++;
    if (track && (amount > 0 || trackBent) && (ticks % 2 === 0 || amount === 0)) {
      if (amount > 0) {
        const bent = TRACK_POINTS.map(([x, y]) => {
          let X = (x / 100) * W;
          let Y = (y / 100) * H;
          const dx = X - cx;
          const dy = Y - cy;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 74) {
            const k = 1 - d / 74;
            const push = k * k * 11 * amount;
            X += (dx / d) * push;
            Y += (dy / d) * push;
          }
          return [(X / W) * 100, (Y / H) * 100] as [number, number];
        });
        track.setAttribute("d", toPath(bent));
        trackBent = true;
      } else {
        track.setAttribute("d", TRACK_D);
        trackBent = false;
      }
    }

    if (moving || cursor || amount > 0 || Math.abs(px) > 0.05 || Math.abs(py) > 0.05) frame = requestAnimationFrame(tick);
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);

  return () => {
    window.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("blur", onLeave);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const p of pieces) p.el.style.translate = "";
    for (const layer of layers) layer.el.style.translate = "";
    track?.setAttribute("d", TRACK_D);
  };
}
