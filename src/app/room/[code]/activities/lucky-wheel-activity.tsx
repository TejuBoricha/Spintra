"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { toast } from "sonner";
import { playSwipe, playSuccess } from "@/lib/audio";

// ── Helpers copied from standalone tool for UI alignment ──
function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#111" : "#fff";
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

const PALETTE = [
  "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

export function LuckyWheelActivity() {
  const { isHost, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();

  const [wheelEntries, setWheelEntries] = useState<string[]>(["Option 1", "Option 2", "Option 3"]);
  const [newWheelEntryText, setNewWheelEntryText] = useState("");
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationAngleRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const spinStartTimeRef = useRef<number>(0);
  const targetRotationRef = useRef<number>(0);

  // Read by the event listener below via refs rather than as effect
  // dependencies — see the registration effect's comment for why.
  const wheelEntriesRef = useRef(wheelEntries);
  useEffect(() => {
    wheelEntriesRef.current = wheelEntries;
  }, [wheelEntries]);

  // ── Draw Wheel function matching Standalone Tool UI ──
  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 20;

    ctx.clearRect(0, 0, w, h);

    if (wheelEntries.length === 0) return;

    // Draw slices
    let startAngle = rotation - Math.PI / 2;
    const sliceAngle = (2 * Math.PI) / wheelEntries.length;

    wheelEntries.forEach((entry, i) => {
      const endAngle = startAngle + sliceAngle;
      const baseColor = PALETTE[i % PALETTE.length];

      const grad = ctx.createLinearGradient(
        cx,
        cy,
        cx + Math.cos(startAngle + sliceAngle / 2) * radius,
        cy + Math.sin(startAngle + sliceAngle / 2) * radius
      );
      grad.addColorStop(0, adjustBrightness(baseColor, -40));
      grad.addColorStop(0.5, baseColor);
      grad.addColorStop(1, adjustBrightness(baseColor, 12));

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label drawing
      const midAngle = startAngle + sliceAngle / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      const cleanAngle = ((midAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const shouldFlip = cleanAngle > Math.PI / 2 && cleanAngle < (3 * Math.PI) / 2;

      ctx.fillStyle = getContrastText(baseColor);
      const maxWidthAtMid = radius * 0.6 * Math.sin(sliceAngle / 2) * 2;
      const fontSize = Math.max(10, Math.min(14, maxWidthAtMid * 0.85));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = "middle";

      const label = entry.length > 12 ? entry.slice(0, 10) + "…" : entry;

      if (shouldFlip) {
        ctx.rotate(Math.PI);
        ctx.textAlign = "left";
        ctx.fillText(label, -radius * 0.82, 0);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(label, radius * 0.82, 0);
      }
      ctx.restore();

      startAngle = endAngle;
    });

    // Outer Rim Border
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#12121a";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 6;
    ctx.stroke();

    // LED Chase Bulbs
    const totalLights = 16;
    const chaseSpeed = wheelSpinning ? rotation * 6 : Date.now() / 250;
    const activeLightIndex = Math.floor(chaseSpeed % totalLights);

    for (let i = 0; i < totalLights; i++) {
      const angle = (i / totalLights) * Math.PI * 2;
      const lx = cx + Math.cos(angle) * (radius + 4);
      const ly = cy + Math.sin(angle) * (radius + 4);

      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      const diff = (i - activeLightIndex + totalLights) % totalLights;

      ctx.save();
      if (diff === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = 8;
      } else if (diff === 1 || diff === 2) {
        ctx.fillStyle = "#06b6d4";
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = "#2a2a3c";
      }
      ctx.fill();
      ctx.restore();
    }

    // Metallic center cap
    const centerRadius = radius * 0.16;
    const chromeGrad = ctx.createLinearGradient(
      cx - centerRadius,
      cy - centerRadius,
      cx + centerRadius,
      cy + centerRadius
    );
    chromeGrad.addColorStop(0, "#ffffff");
    chromeGrad.addColorStop(0.2, "#d1d5db");
    chromeGrad.addColorStop(0.45, "#4b5563");
    chromeGrad.addColorStop(0.7, "#f3f4f6");
    chromeGrad.addColorStop(1, "#1f2937");

    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
    ctx.fillStyle = chromeGrad;
    ctx.fill();

    const innerRadius = centerRadius - 3;
    const innerGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, innerRadius);
    innerGrad.addColorStop(0, "#374151");
    innerGrad.addColorStop(0.8, "#111827");
    innerGrad.addColorStop(1, "#030712");

    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = innerGrad;
    ctx.fill();
  }, [wheelEntries, wheelSpinning]);

  const drawWheelRef = useRef(drawWheel);
  useEffect(() => {
    drawWheelRef.current = drawWheel;
  }, [drawWheel]);

  // Initial draw & resize listeners
  useEffect(() => {
    drawWheel(rotationAngleRef.current);
  }, [drawWheel]);

  // ── Network event subscription ──
  //
  // Deliberately stable deps ([registerEventListener, soundEnabled] only —
  // matching every other activity in this codebase). wheelEntries/drawWheel
  // are read via refs instead of being dependencies: registerEventListener
  // replays this activity's full persisted event log to any newly
  // registering listener (see use-room-subscription.ts), and a
  // "wheel_spinning" event is never cleared from that log once fired. If
  // wheelEntries/drawWheel were dependencies here, every wheelSpinning
  // true/false transition would change drawWheel's identity, re-run this
  // effect, re-register a new listener, replay the same still-present
  // "wheel_spinning" event, and restart the spin — forever. (Found live:
  // the wheel would spin indefinitely, never landing.)
  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "wheel_entries":
          setWheelEntries(event.entries);
          break;
        case "wheel_spinning": {
          if (event.winner) {
            setWheelWinner(null);
            setWheelSpinning(true);
            playSwipe(soundEnabled);

            const entries = wheelEntriesRef.current;
            const winnerIndex = entries.indexOf(event.winner);
            const sliceAngle = (2 * Math.PI) / entries.length;

            // Deterministic calculation to stop exactly on the winning segment at 12 o'clock position
            const offsetAngle = 1.5 * Math.PI - (winnerIndex + 0.5) * sliceAngle;
            targetRotationRef.current = 6 * Math.PI + offsetAngle;
            spinStartTimeRef.current = Date.now();

            const animateSpin = () => {
              const elapsed = Date.now() - spinStartTimeRef.current;
              const duration = 3000; // 3 seconds spin duration
              const t = Math.min(1, elapsed / duration);

              // Cubic ease out curve
              const easeOutCubic = 1 - Math.pow(1 - t, 3);
              const angle = easeOutCubic * targetRotationRef.current;
              rotationAngleRef.current = angle;

              drawWheelRef.current(angle);

              if (t < 1) {
                animationFrameIdRef.current = requestAnimationFrame(animateSpin);
              } else {
                setWheelWinner(event.winner ?? null);
                setWheelSpinning(false);
                playSuccess(soundEnabled);
              }
            };

            if (animationFrameIdRef.current) {
              cancelAnimationFrame(animationFrameIdRef.current);
            }
            animationFrameIdRef.current = requestAnimationFrame(animateSpin);
          }
          break;
        }
        case "activity_reset":
          setWheelWinner(null);
          setWheelSpinning(false);
          rotationAngleRef.current = 0;
          drawWheelRef.current(0);
          break;
      }
    });
  }, [registerEventListener, soundEnabled]);

  // Cleanup anim loop
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  const syncWheelEntries = (entries: string[]) => {
    setWheelEntries(entries);
    sendActivityEvent({ kind: "wheel_entries", entries });
  };

  const addWheelEntry = () => {
    const label = newWheelEntryText.trim();
    if (!label) return;
    syncWheelEntries([...wheelEntries, label].slice(0, 12));
    setNewWheelEntryText("");
  };

  const removeWheelEntry = (index: number) => {
    if (wheelEntries.length <= 2) {
      toast.error("The wheel needs at least 2 options.");
      return;
    }
    syncWheelEntries(wheelEntries.filter((_, i) => i !== index));
  };

  const updateWheelEntry = (index: number, newValue: string) => {
    const val = newValue.trim();
    if (!val) return;
    const next = [...wheelEntries];
    next[index] = val;
    syncWheelEntries(next);
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-xl mx-auto pt-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Emoji name="ferris_wheel" size={28} /> Lucky Wheel
      </h2>

      {/* Render High-Fidelity Canvas Wheel matching standalone UI */}
      <div className="relative w-80 h-80 sm:w-96 sm:h-96">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ maxWidth: 384, maxHeight: 384 }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 text-2xl drop-shadow-md select-none pointer-events-none">
          ▼
        </div>
      </div>

      {wheelWinner && (
        <div className="text-center p-4 glass-card rounded-xl">
          <p className="text-sm text-muted-foreground mb-1">Winner!</p>
          <p className="text-2xl font-bold text-purple-400 flex items-center justify-center gap-2">
            {wheelWinner} <Emoji name="party_popper" size={28} pop />
          </p>
        </div>
      )}

      {/* 11 of 14 activities already show non-hosts an explicit "waiting
          for host" cue; without it, a guest just sees an inert wheel with
          no hint that only the host can spin. */}
      {!isHost && !wheelSpinning && !wheelWinner && (
        <EmptyState icon={<Emoji name="ferris_wheel" size={48} />} description="Waiting for host to spin the wheel…" />
      )}

      {isHost && (
        <div className="w-full space-y-3">
          {!wheelSpinning && !wheelWinner && (
            <p className="text-xs text-muted-foreground">Press Spin the Wheel to pick a winner</p>
          )}
          <div className="flex flex-wrap gap-2">
            {wheelEntries.map((e, i) => {
              const isEditing = editingIndex === i;

              if (isEditing) {
                return (
                  <Input
                    key={i}
                    value={editingText}
                    onChange={(evt) => setEditingText(evt.target.value)}
                    onBlur={() => {
                      const trimmed = editingText.trim();
                      if (trimmed && trimmed !== e) {
                        updateWheelEntry(i, trimmed);
                      }
                      setEditingIndex(null);
                    }}
                    onKeyDown={(evt) => {
                      if (evt.key === "Enter") {
                        const trimmed = editingText.trim();
                        if (trimmed && trimmed !== e) {
                          updateWheelEntry(i, trimmed);
                        }
                        setEditingIndex(null);
                      } else if (evt.key === "Escape") {
                        setEditingIndex(null);
                      }
                    }}
                    autoFocus
                    maxLength={40}
                    disabled={wheelSpinning}
                    className="h-6 py-0 px-2 text-xs w-28 bg-purple-500/10 border-purple-500/40 text-purple-200 rounded-lg shrink-0"
                  />
                );
              }

              return (
                <Badge
                  key={i}
                  className="bg-purple-500/20 text-purple-300 pr-1 gap-1 cursor-pointer select-none"
                  onClick={() => {
                    if (!wheelSpinning) {
                      setEditingIndex(i);
                      setEditingText(e);
                    }
                  }}
                >
                  <span title="Click to edit">{e}</span>
                  <button
                    type="button"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      removeWheelEntry(i);
                    }}
                    disabled={wheelSpinning}
                    aria-label={`Remove ${e}`}
                    className="rounded-full hover:bg-white/10 disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={newWheelEntryText}
              onChange={(e) => setNewWheelEntryText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWheelEntry()}
              placeholder="Add an option..."
              aria-label="Add a wheel option"
              maxLength={40}
              disabled={wheelSpinning || wheelEntries.length >= 12}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={addWheelEntry}
              disabled={wheelSpinning || !newWheelEntryText.trim() || wheelEntries.length >= 12}
            >
              Add
            </Button>
          </div>
          <Button
            disabled={wheelSpinning}
            onClick={() => {
              const winner = wheelEntries[Math.floor(Math.random() * wheelEntries.length)];
              sendActivityEvent({ kind: "wheel_spinning", winner });
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0"
          >
            {wheelSpinning ? "Spinning…" : "Spin the Wheel!"}
          </Button>
        </div>
      )}
    </div>
  );
}
