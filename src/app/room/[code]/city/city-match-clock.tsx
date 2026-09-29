"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { serverNow } from "@/lib/server-clock";

// Timed mode's countdown (FR-06, FR-07, FR-50). The limit is wall-clock from
// started_at; a resume after the whole match was paused shifts started_at
// forward (0098), so started_at + the limit is always the real end.
//
// When it runs out the round in progress still completes, then the match ends
// ranked on net worth. So past zero this says that, instead of sitting on 0:00
// with no explanation while the game plainly carries on.

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function CityMatchClock({
  startedAt,
  limitMinutes,
}: {
  startedAt: string;
  limitMinutes: number;
}) {
  const end = new Date(startedAt).getTime() + limitMinutes * 60_000;
  // Server time (src/lib/server-clock.ts), not this computer's clock.
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = end - now;
  const over = left <= 0;

  return (
    <div
      className={
        "mb-3 flex items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-sm " +
        (over
          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
          : "border-(--border-hairline) bg-(--surface-panel) text-muted-foreground")
      }
      role="timer"
      data-testid="city-match-clock"
    >
      <Timer className="h-4 w-4 shrink-0" aria-hidden="true" />
      {over ? (
        <span>Time&apos;s up. This round finishes, then the richest player wins.</span>
      ) : (
        <span>
          Timed match: <span className="font-mono tabular-nums">{format(left)}</span> left
        </span>
      )}
    </div>
  );
}
