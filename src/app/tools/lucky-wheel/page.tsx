"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Disc3,
  Play,
  Plus,
  Minus,
  ArrowRight,
  Volume2,
  VolumeX,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Emoji, type EmojiName } from "@/components/emoji";
import { fireConfetti, CelebrationBanner } from "@/components/celebration";
import { playTick } from "@/lib/audio";
import { getGameByType } from "@/lib/games";

const GameIcon = getGameByType("lucky-wheel")!.icon;

// ── Types ──────────────────────────────────────────────────
interface WheelEntry {
  id: string;
  label: string;
  color: string;
  weight: number;
}

// ── Constants ──────────────────────────────────────────────
const DEFAULT_ENTRIES: WheelEntry[] = [
  { id: "1", label: "Prize 1", color: "#6d3ee0", weight: 1 },
  { id: "2", label: "Prize 2", color: "#3ddaee", weight: 1 },
  { id: "3", label: "Prize 3", color: "#f59e0b", weight: 1 },
  { id: "4", label: "Free Spin", color: "#10b981", weight: 1 },
  { id: "5", label: "Try Again", color: "#ef4444", weight: 1 },
];

const PALETTE = [
  "#6d3ee0", "#3ddaee", "#f59e0b", "#10b981", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
  "#3b82f6", "#a855f7", "#22c55e", "#e11d48", "#eab308",
  "#0ea5e9", "#d946ef", "#34d399", "#fb923c", "#a3e635",
];

const TEMPLATES: { label: string; icon: EmojiName; entries: WheelEntry[] }[] = [
  {
    label: "Giveaway Prizes",
    icon: "wrapped_gift",
    entries: [
      { id: "g1", label: "Grand Prize", color: "#f59e0b", weight: 1 },
      { id: "g2", label: "Gift Card $50", color: "#6d3ee0", weight: 2 },
      { id: "g3", label: "T-Shirt", color: "#3ddaee", weight: 3 },
      { id: "g4", label: "Sticker Pack", color: "#10b981", weight: 4 },
      { id: "g5", label: "Try Again", color: "#ef4444", weight: 5 },
      { id: "g6", label: "Free Spin", color: "#ec4899", weight: 2 },
    ],
  },
  {
    label: "Dinner Picks",
    icon: "pizza",
    entries: [
      { id: "d1", label: "Pizza", color: "#ef4444", weight: 2 },
      { id: "d2", label: "Sushi", color: "#3ddaee", weight: 2 },
      { id: "d3", label: "Burgers", color: "#f59e0b", weight: 2 },
      { id: "d4", label: "Tacos", color: "#10b981", weight: 2 },
      { id: "d5", label: "Indian", color: "#f97316", weight: 1 },
      { id: "d6", label: "Salad 😢", color: "#84cc16", weight: 1 },
    ],
  },
  {
    label: "Movie Night",
    icon: "clapper_board",
    entries: [
      { id: "m1", label: "Action", color: "#ef4444", weight: 1 },
      { id: "m2", label: "Comedy", color: "#f59e0b", weight: 1 },
      { id: "m3", label: "Horror", color: "#6366f1", weight: 1 },
      { id: "m4", label: "Sci-Fi", color: "#3ddaee", weight: 1 },
      { id: "m5", label: "Rom-Com", color: "#ec4899", weight: 1 },
      { id: "m6", label: "Documentary", color: "#10b981", weight: 1 },
    ],
  },
  {
    label: "Chores",
    icon: "broom",
    entries: [
      { id: "c1", label: "Dishes", color: "#3ddaee", weight: 1 },
      { id: "c2", label: "Vacuum", color: "#6d3ee0", weight: 1 },
      { id: "c3", label: "Trash", color: "#f59e0b", weight: 1 },
      { id: "c4", label: "Laundry", color: "#ec4899", weight: 1 },
      { id: "c5", label: "Lucky! Skip", color: "#10b981", weight: 1 },
      { id: "c6", label: "Bathroom 😱", color: "#ef4444", weight: 1 },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 11);
}

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

// ── Component ──────────────────────────────────────────────
export default function LuckyWheelPage() {
  const [entries, setEntries] = useState<WheelEntry[]>(DEFAULT_ENTRIES);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newEntryLabel, setNewEntryLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [pendingTemplate, setPendingTemplate] = useState<(typeof TEMPLATES)[0] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const lastSegmentIndexRef = useRef<number>(-1);
  const tickerWobbleRef = useRef<number>(0);
  const friction = 0.985;

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);

  // Load from localStorage on client-side mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("spintra-lucky-wheel");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEntries(JSON.parse(saved) as WheelEntry[]);
      }
    } catch {
      // Ignore
    }
    setHasHydrated(true);
  }, []);

  // ── Save to localStorage ──
  const saveWheel = useCallback(() => {
    if (hasHydrated) {
      localStorage.setItem("spintra-lucky-wheel", JSON.stringify(entries));
    }
  }, [entries, hasHydrated]);

  useEffect(() => {
    saveWheel();
  }, [entries, saveWheel]);

  // ── Draw the wheel ──
  const drawWheel = useCallback(
    (rotation: number) => {
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
      const radius = Math.min(cx, cy) - 30;

      ctx.clearRect(0, 0, w, h);

      if (entries.length === 0) {
        ctx.fillStyle = "#8888a0";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Add entries to start", cx, cy);
        return;
      }

      // Draw segments
      let startAngle = rotation - Math.PI / 2;
      entries.forEach((entry) => {
        const sliceAngle = (entry.weight / totalWeight) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;

        // Segment fill gradient (radial linear gradient from center to outer edge)
        const grad = ctx.createLinearGradient(
          cx,
          cy,
          cx + Math.cos(startAngle + sliceAngle / 2) * radius,
          cy + Math.sin(startAngle + sliceAngle / 2) * radius
        );
        grad.addColorStop(0, adjustBrightness(entry.color, -40)); // darker center
        grad.addColorStop(0.5, entry.color);
        grad.addColorStop(1, adjustBrightness(entry.color, 12)); // brighter edge

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Segment border (clean translucent separator)
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

        ctx.fillStyle = getContrastText(entry.color);

        const maxWidthAtMid = radius * 0.6 * Math.sin(sliceAngle / 2) * 2;
        const fontSize = Math.max(10, Math.min(15, maxWidthAtMid * 0.85));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textBaseline = "middle";

        const label = entry.label.length > 14 ? entry.label.slice(0, 12) + "…" : entry.label;

        if (shouldFlip) {
          ctx.rotate(Math.PI);
          ctx.textAlign = "left";
          ctx.shadowColor = "rgba(0,0,0,0.2)";
          ctx.shadowBlur = 2;
          ctx.fillText(label, -radius * 0.82, 0);
        } else {
          ctx.textAlign = "right";
          ctx.shadowColor = "rgba(0,0,0,0.2)";
          ctx.shadowBlur = 2;
          ctx.fillText(label, radius * 0.82, 0);
        }
        ctx.restore();

        startAngle = endAngle;
      });

      // ── Outer Rim Border & LED lights ──
      // Dark rim backing
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#12121a";
      ctx.lineWidth = 14;
      ctx.stroke();

      // Sleek inner border overlay
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 12;
      ctx.stroke();

      // Circumference LED chase bulbs
      const totalLights = 24;
      const chaseSpeed = spinning ? rotation * 8 : Date.now() / 250;
      const activeLightIndex = Math.floor(chaseSpeed % totalLights);

      for (let i = 0; i < totalLights; i++) {
        const angle = (i / totalLights) * Math.PI * 2;
        const lx = cx + Math.cos(angle) * (radius + 6);
        const ly = cy + Math.sin(angle) * (radius + 6);

        ctx.beginPath();
        ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);

        const diff = (i - activeLightIndex + totalLights) % totalLights;

        ctx.save();
        if (diff === 0) {
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "#3ddaee";
          ctx.shadowBlur = 12;
        } else if (diff === 1 || diff === 2) {
          ctx.fillStyle = "#3ddaee";
          ctx.shadowColor = "#3ddaee";
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = "#2a2a3c";
          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        ctx.fill();
        ctx.restore();
      }

      // ── 3D Metallic Center Cap ──
      // 1. Chrome outer bezel
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
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Glossy dark center core
      const innerRadius = centerRadius - 4;
      const innerGrad = ctx.createRadialGradient(
        cx - 2,
        cy - 2,
        0,
        cx,
        cy,
        innerRadius
      );
      innerGrad.addColorStop(0, "#374151");
      innerGrad.addColorStop(0.8, "#111827");
      innerGrad.addColorStop(1, "#030712");

      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = innerGrad;
      ctx.fill();

      // 3. Center glossy highlight overlay
      ctx.beginPath();
      ctx.ellipse(
        cx - innerRadius * 0.35,
        cy - innerRadius * 0.35,
        innerRadius * 0.45,
        innerRadius * 0.25,
        -Math.PI / 4,
        0,
        Math.PI * 2
      );
      const glossGrad = ctx.createLinearGradient(
        cx - innerRadius * 0.6,
        cy - innerRadius * 0.6,
        cx,
        cy
      );
      glossGrad.addColorStop(0, "rgba(255,255,255,0.35)");
      glossGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glossGrad;
      ctx.fill();

      // ── Futuristic Neon Ticker Pointer ──
      const pointerPivotY = cy - radius - 24;
      const pointerLength = 22;
      const pointerHalfWidth = 14;
      const wobble = tickerWobbleRef.current;

      ctx.save();
      ctx.translate(cx, pointerPivotY);
      ctx.rotate(wobble);

      // Shadow for pointer needle
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;

      // Outer needle border
      ctx.beginPath();
      ctx.moveTo(0, pointerLength);
      ctx.lineTo(-pointerHalfWidth, 0);
      ctx.lineTo(pointerHalfWidth, 0);
      ctx.closePath();
      const ptrChrome = ctx.createLinearGradient(-pointerHalfWidth, 0, pointerHalfWidth, 0);
      ptrChrome.addColorStop(0, "#9ca3af");
      ptrChrome.addColorStop(0.5, "#ffffff");
      ptrChrome.addColorStop(1, "#4b5563");
      ctx.fillStyle = ptrChrome;
      ctx.fill();

      ctx.shadowBlur = 0; // reset shadow
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner glowing needle body
      ctx.beginPath();
      ctx.moveTo(0, pointerLength - 3);
      ctx.lineTo(-pointerHalfWidth + 3, 2);
      ctx.lineTo(pointerHalfWidth - 3, 2);
      ctx.closePath();
      ctx.fillStyle = "#1e1e2f";
      ctx.fill();

      // Sleek neon gem at pivot point
      ctx.beginPath();
      ctx.arc(0, 1, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "#3ddaee";
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.restore();
    },
    [entries, totalWeight, spinning]
  );

  // ── Spin logic ──
  const spin = useCallback(() => {
    if (spinning || entries.length === 0) return;
    playTick(soundEnabled);
    setSpinning(true);
    setWinner(null);
    velocityRef.current = 0.3 + Math.random() * 0.3;
    lastSegmentIndexRef.current = -1;
  }, [spinning, entries, soundEnabled]);

  // ── Continuous animation loop for physics & rendering ──
  useEffect(() => {
    let animId = 0;

    const tick = () => {
      // 1. Update spinning physics if active
      if (spinning) {
        velocityRef.current *= friction;
        angleRef.current += velocityRef.current;

        const normalizedAngle =
          ((angleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const pointerAngle = (2 * Math.PI - normalizedAngle) % (Math.PI * 2);

        let cumulative = 0;
        let curIndex = 0;
        for (let i = 0; i < entries.length; i++) {
          cumulative += (entries[i].weight / totalWeight) * Math.PI * 2;
          if (pointerAngle <= cumulative) {
            curIndex = i;
            break;
          }
        }

        if (curIndex !== lastSegmentIndexRef.current) {
          if (lastSegmentIndexRef.current !== -1) {
            playTick(soundEnabled);
            tickerWobbleRef.current = -0.38; // bounce pointer
          }
          lastSegmentIndexRef.current = curIndex;
        }

        if (velocityRef.current <= 0.0005) {
          // Stopped spinning
          setWinner(entries[curIndex].label);
          setSpinning(false);
          velocityRef.current = 0;
          fireConfetti();
        }
      }

      // 2. Damp pointer wobble
      tickerWobbleRef.current *= 0.82;

      // 3. Draw frame
      drawWheel(angleRef.current);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [spinning, entries, totalWeight, drawWheel, soundEnabled]);



  // ── CRUD helpers ──
  const addEntry = useCallback(() => {
    const label = newEntryLabel.trim();
    if (!label) return;
    setEntries((prev) => [
      ...prev,
      {
        id: uid(),
        label,
        color: PALETTE[prev.length % PALETTE.length],
        weight: 1,
      },
    ]);
    setNewEntryLabel("");
  }, [newEntryLabel]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateEntryWeight = useCallback((id: string, weight: number) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, weight } : e)));
  }, []);

  const updateEntryColor = useCallback((id: string, color: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, color } : e)));
  }, []);

  const updateEntryLabel = useCallback((id: string, label: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, label } : e)));
  }, []);

  const applyTemplate = useCallback((tpl: (typeof TEMPLATES)[0]) => {
    setEntries(tpl.entries.map((e) => ({ ...e, id: uid() })));
    setWinner(null);
  }, []);

  const resetToDefault = useCallback(() => {
    setEntries(DEFAULT_ENTRIES.map((e) => ({ ...e, id: uid() })));
    setWinner(null);
  }, []);

  return (
    <div className="relative min-h-screen" ref={containerRef}>
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) text-sm text-muted-foreground mb-6">
            <GameIcon className="w-4 h-4" />
            Wheel Tool
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="gradient-text">Lucky Wheel</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Spin to decide — customize entries, weights, and colors.
          </p>
        </motion.div>

        {/* ── Main layout: Wheel | Sidebar ── */}
        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          {/* Wheel column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="lg:col-span-2 flex flex-col items-center"
          >
            {/* Winner announcement */}
            <AnimatePresence>
              {winner && !spinning && (
                <CelebrationBanner
                  icon={<Emoji name="party_popper" size={40} pop />}
                  title={winner}
                  subtitle="Winner!"
                  className="mb-6 w-full max-w-md"
                />
              )}
            </AnimatePresence>

            {/* Canvas */}
            <div className="relative w-full max-w-[480px] aspect-square">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ maxWidth: 480, maxHeight: 480 }}
              />
            </div>

            {/* Spin button */}
            <div className="mt-8 flex items-center gap-4">
              <Button
                onClick={spin}
                disabled={spinning || entries.length === 0}
                size="lg"
                className="h-14 px-10 text-lg font-bold bg-(image:--gradient-brand) text-primary-foreground border-2 border-(--border-strong) hover:brightness-95 rounded-full shadow-lg shadow-glow-primary-sm hover:shadow-glow-primary-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 mr-2" />
                {spinning ? "Spinning..." : "Spin!"}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Sound On" : "Sound Off"}
                aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
                className="h-10 w-10 rounded-full"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </Button>
            </div>
          </motion.div>

          {/* Sidebar: Entries + Templates */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-6"
          >
            {/* Entries card */}
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Entries ({entries.length})
                </h2>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={resetToDefault}
                    title="Reset to default"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={saveWheel}
                    title="Save to browser"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Entry list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {entries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, height: 0 }}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-(--surface-sunken) border border-(--border-hairline) group/entry hover:bg-muted transition-colors"
                    >
                      {/* Color picker */}
                      <div className="relative">
                        <input
                          type="color"
                          value={entry.color}
                          onChange={(e) => updateEntryColor(entry.id, e.target.value)}
                          aria-label={`Change color for ${entry.label}`}
                          className="absolute inset-0 w-5 h-5 opacity-0 cursor-pointer z-10"
                        />
                        <div
                          className="w-5 h-5 rounded-full ring-1 ring-white/10 shrink-0 group-focus-within/entry:ring-2 group-focus-within/entry:ring-primary"
                          style={{ backgroundColor: entry.color }}
                        />
                      </div>

                      {/* Label */}
                      {editingId === entry.id ? (
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => {
                            const trimmed = editingText.trim();
                            if (trimmed && trimmed !== entry.label) {
                              updateEntryLabel(entry.id, trimmed);
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const trimmed = editingText.trim();
                              if (trimmed && trimmed !== entry.label) {
                                updateEntryLabel(entry.id, trimmed);
                              }
                              setEditingId(null);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          autoFocus
                          maxLength={40}
                          disabled={spinning}
                          className="flex-1 h-6 px-1.5 text-xs bg-primary/10 border border-primary/40 text-(--brand-primary-strong) rounded-lg shrink-0 outline-none"
                        />
                      ) : (
                        <span
                          onClick={() => {
                            if (!spinning) {
                              setEditingId(entry.id);
                              setEditingText(entry.label);
                            }
                          }}
                          title="Click to edit"
                          className="flex-1 text-sm truncate cursor-pointer hover:text-(--brand-primary-strong) transition-colors"
                        >
                          {entry.label}
                        </span>
                      )}

                      {/* Weight slider */}
                      <div className="hidden group-hover/entry:flex group-focus-within/entry:flex items-center gap-1.5 w-20">
                        <Slider
                          value={[entry.weight]}
                          onValueChange={(v) => {
                            const val = Array.isArray(v) ? v[0] : v;
                            if (val !== undefined) updateEntryWeight(entry.id, val);
                          }}
                          min={1}
                          max={10}
                          step={1}
                          className="w-14"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">
                          {entry.weight}
                        </span>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeEntry(entry.id)}
                        aria-label={`Remove ${entry.label}`}
                        className="p-1 rounded opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100 hover:bg-red-500/10 text-red-400 transition-all"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Add entry */}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="New entry..."
                  value={newEntryLabel}
                  onChange={(e) => setNewEntryLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addEntry();
                  }}
                  className="flex-1 text-xs"
                />
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={addEntry}
                  disabled={!newEntryLabel.trim()}
                  aria-label="Add entry"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Templates */}
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Templates
              </h2>
              <div className="grid gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => {
                      if (entries.length > 0) {
                        setPendingTemplate(tpl);
                        return;
                      }
                      applyTemplate(tpl);
                    }}
                    aria-label={`Apply "${tpl.label}" template (replaces current entries)`}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-(--border-hairline) bg-(--surface-sunken) hover:bg-muted hover:border-cyan-500/20 transition-all text-left group"
                  >
                    <Emoji name={tpl.icon} size={22} animated={false} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium group-hover:text-cyan-300 transition-colors">
                        {tpl.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tpl.entries.length} entries
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            {/* Sound toggle */}
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Sound Effects</Label>
                <p className="text-xs text-muted-foreground">
                  Play tick sounds while spinning
                </p>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} aria-label="Sound effects" />
            </div>
          </motion.div>
        </div>

        {/* ── Create Room CTA ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Multiplayer
          </div>
          <h2 className="text-xl font-bold">Spin together with friends?</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create a room and let everyone watch the wheel spin live.
            Perfect for giveaways, game nights, and decision-making.
          </p>
          <Link href="/create?type=lucky-wheel">
            <Button className="gap-2 bg-(image:--gradient-brand) text-primary-foreground border-2 border-(--border-strong) hover:brightness-95">
              <Disc3 className="w-4 h-4" />
              Create Room
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>

      <Dialog open={!!pendingTemplate} onOpenChange={(open) => { if (!open) setPendingTemplate(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace current entries?</DialogTitle>
            <DialogDescription>
              {pendingTemplate
                ? `This replaces your current wheel entries with the "${pendingTemplate.label}" template. Your current entries will be lost.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingTemplate) applyTemplate(pendingTemplate);
                setPendingTemplate(null);
              }}
            >
              Replace entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
