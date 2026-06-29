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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ── Types ──────────────────────────────────────────────────
interface WheelEntry {
  id: string;
  label: string;
  color: string;
  weight: number;
}

// ── Constants ──────────────────────────────────────────────
const DEFAULT_ENTRIES: WheelEntry[] = [
  { id: "1", label: "Prize 1", color: "#8b5cf6", weight: 1 },
  { id: "2", label: "Prize 2", color: "#06b6d4", weight: 1 },
  { id: "3", label: "Prize 3", color: "#f59e0b", weight: 1 },
  { id: "4", label: "Free Spin", color: "#10b981", weight: 1 },
  { id: "5", label: "Try Again", color: "#ef4444", weight: 1 },
];

const PALETTE = [
  "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
  "#3b82f6", "#a855f7", "#22c55e", "#e11d48", "#eab308",
  "#0ea5e9", "#d946ef", "#34d399", "#fb923c", "#a3e635",
];

const TEMPLATES: { label: string; icon: string; entries: WheelEntry[] }[] = [
  {
    label: "Giveaway Prizes",
    icon: "🎁",
    entries: [
      { id: "g1", label: "Grand Prize", color: "#f59e0b", weight: 1 },
      { id: "g2", label: "Gift Card $50", color: "#8b5cf6", weight: 2 },
      { id: "g3", label: "T-Shirt", color: "#06b6d4", weight: 3 },
      { id: "g4", label: "Sticker Pack", color: "#10b981", weight: 4 },
      { id: "g5", label: "Try Again", color: "#ef4444", weight: 5 },
      { id: "g6", label: "Free Spin", color: "#ec4899", weight: 2 },
    ],
  },
  {
    label: "Dinner Picks",
    icon: "🍕",
    entries: [
      { id: "d1", label: "Pizza", color: "#ef4444", weight: 2 },
      { id: "d2", label: "Sushi", color: "#06b6d4", weight: 2 },
      { id: "d3", label: "Burgers", color: "#f59e0b", weight: 2 },
      { id: "d4", label: "Tacos", color: "#10b981", weight: 2 },
      { id: "d5", label: "Indian", color: "#f97316", weight: 1 },
      { id: "d6", label: "Salad 😢", color: "#84cc16", weight: 1 },
    ],
  },
  {
    label: "Movie Night",
    icon: "🎬",
    entries: [
      { id: "m1", label: "Action", color: "#ef4444", weight: 1 },
      { id: "m2", label: "Comedy", color: "#f59e0b", weight: 1 },
      { id: "m3", label: "Horror", color: "#6366f1", weight: 1 },
      { id: "m4", label: "Sci-Fi", color: "#06b6d4", weight: 1 },
      { id: "m5", label: "Rom-Com", color: "#ec4899", weight: 1 },
      { id: "m6", label: "Documentary", color: "#10b981", weight: 1 },
    ],
  },
  {
    label: "Chores",
    icon: "🧹",
    entries: [
      { id: "c1", label: "Dishes", color: "#06b6d4", weight: 1 },
      { id: "c2", label: "Vacuum", color: "#8b5cf6", weight: 1 },
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

const CONFETTI_PARTICLES = Array.from({ length: 120 }, () => {
  const angle = Math.random() * Math.PI * 2;
  const speed = 3 + Math.random() * 8;
  const colors = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];
  return {
    dx: (Math.random() - 0.5) * 180,
    dy: (Math.random() - 0.5) * 120,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
    life: 1,
  };
});

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {CONFETTI_PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            left: `calc(50% + ${p.dx}px)`,
            top: `calc(50% + ${p.dy}px - 50px)`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            opacity: p.life,
          }}
        />
      ))}
      {/* Animate the confetti */}
      <style jsx>{`
       @keyframes fall {
         0% { transform: translateY(0) rotate(0deg); opacity: 1; }
         100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
       }
       div > div {
         animation: fall 2.5s ease-in forwards;
       }
     `}</style>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────
export default function LuckyWheelPage() {
  const [entries, setEntries] = useState<WheelEntry[]>(DEFAULT_ENTRIES);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newEntryLabel, setNewEntryLabel] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const animationRef = useRef<number>(0);
  const friction = 0.985;

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("spintra-lucky-wheel");
      if (saved) setEntries(JSON.parse(saved));
    } catch {
      // ignore invalid saved data
    }
  }, []);

  // ── Save to localStorage ──
  const saveWheel = useCallback(() => {
    localStorage.setItem("spintra-lucky-wheel", JSON.stringify(entries));
  }, [entries]);

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
      const radius = Math.min(cx, cy) - 8;

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

        // Segment fill
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = entry.color;
        ctx.fill();

        // Segment border
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        const midAngle = startAngle + sliceAngle / 2;
        const labelRadius = radius * 0.65;
        const lx = cx + Math.cos(midAngle) * labelRadius;
        const ly = cy + Math.sin(midAngle) * labelRadius;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.fillStyle = getContrastText(entry.color);
        ctx.font = `${Math.max(10, Math.min(13, radius / entries.length / 3))}px sans-serif`;
        ctx.textAlign = "center";
        const label = entry.label.length > 14 ? entry.label.slice(0, 12) + "…" : entry.label;
        ctx.fillText(label, 0, 0);
        ctx.restore();

        startAngle = endAngle;
      });

      // Center circle
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.25);
      gradient.addColorStop(0, "#1e1e30");
      gradient.addColorStop(1, "#12121a");
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Shadow ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(139,92,246,0.15)";
      ctx.lineWidth = 12;
      ctx.stroke();

      // Pointer at top
      const pointerSize = 14;
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius - 2);
      ctx.lineTo(cx - pointerSize, cy - radius - 22);
      ctx.lineTo(cx + pointerSize, cy - radius - 22);
      ctx.closePath();
      ctx.fillStyle = "#f0f0f5";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Small pointer circle
      ctx.beginPath();
      ctx.arc(cx, cy - radius - 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#f0f0f5";
      ctx.fill();
    },
    [entries, totalWeight]
  );

  // ── Spin logic ──
  const spin = useCallback(() => {
    if (spinning || entries.length === 0) return;
    setSpinning(true);
    setWinner(null);
    setShowConfetti(false);

    // Initial velocity: 15-25 rad per frame (fast spin)
    velocityRef.current = 0.3 + Math.random() * 0.3;

    const animate = () => {
      velocityRef.current *= friction;
      angleRef.current += velocityRef.current;

      drawWheel(angleRef.current);

      if (velocityRef.current > 0.0005) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Determine winner
        const normalizedAngle =
          ((angleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const pointerAngle = (2 * Math.PI - normalizedAngle + Math.PI / 2) % (Math.PI * 2);

        let cumulative = 0;
        for (const entry of entries) {
          cumulative += (entry.weight / totalWeight) * Math.PI * 2;
          if (pointerAngle <= cumulative) {
            setWinner(entry.label);
            break;
          }
        }

        setSpinning(false);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [spinning, entries, totalWeight, drawWheel]);

  // ── Initial draw and resize ──
  useEffect(() => {
    drawWheel(angleRef.current);

    const handleResize = () => drawWheel(angleRef.current);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [drawWheel]);

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

  const applyTemplate = useCallback((tpl: (typeof TEMPLATES)[0]) => {
    setEntries(tpl.entries.map((e) => ({ ...e, id: uid() })));
    setWinner(null);
    setShowConfetti(false);
  }, []);

  const resetToDefault = useCallback(() => {
    setEntries(DEFAULT_ENTRIES.map((e) => ({ ...e, id: uid() })));
    setWinner(null);
    setShowConfetti(false);
  }, []);

  return (
    <div className="relative min-h-screen" ref={containerRef}>
      <Confetti active={showConfetti} />

      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-muted-foreground mb-6">
            <Disc3 className="w-4 h-4" />
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
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 px-6 py-3 rounded-xl glass-card text-center"
                >
                  <span className="text-xs text-muted-foreground block mb-1">🎉 Winner!</span>
                  <span className="text-2xl font-bold gradient-text">{winner}</span>
                </motion.div>
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
                className="h-14 px-10 text-lg font-bold bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0 rounded-full shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 mr-2" />
                {spinning ? "Spinning..." : "Spin!"}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Sound On" : "Sound Off"}
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
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Entries ({entries.length})
                </h3>
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
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.03] group/entry hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Color picker */}
                      <div className="relative">
                        <input
                          type="color"
                          value={entry.color}
                          onChange={(e) => updateEntryColor(entry.id, e.target.value)}
                          className="absolute inset-0 w-5 h-5 opacity-0 cursor-pointer z-10"
                        />
                        <div
                          className="w-5 h-5 rounded-full ring-1 ring-white/10 shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                      </div>

                      {/* Label */}
                      <span className="flex-1 text-sm truncate">{entry.label}</span>

                      {/* Weight slider */}
                      <div className="hidden group-hover/entry:flex items-center gap-1.5 w-20">
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
                        className="p-1 rounded opacity-0 group-hover/entry:opacity-100 hover:bg-red-500/10 text-red-400 transition-all"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Add entry */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New entry..."
                  value={newEntryLabel}
                  onChange={(e) => setNewEntryLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addEntry();
                  }}
                  className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-input bg-transparent outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                />
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={addEntry}
                  disabled={!newEntryLabel.trim()}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Templates */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Templates
              </h3>
              <div className="grid gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all text-left group"
                  >
                    <span className="text-lg">{tpl.icon}</span>
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
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Sound Effects</Label>
                <p className="text-xs text-muted-foreground">
                  Play tick sounds while spinning
                </p>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>
          </motion.div>
        </div>

        {/* ── Create Room CTA ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Multiplayer
          </div>
          <h3 className="text-xl font-bold">Spin together with friends?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create a room and let everyone watch the wheel spin live.
            Perfect for giveaways, game nights, and decision-making.
          </p>
          <Link href="/create?type=lucky-wheel">
            <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0">
              <Disc3 className="w-4 h-4" />
              Create Room
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
