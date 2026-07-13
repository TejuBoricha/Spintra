"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  History,
  RotateCcw,
  Volume2,
  VolumeX,
  TrendingUp,
  Sparkles,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { playDiceRoll, playTick } from "@/lib/audio";
import { getGameByType } from "@/lib/games";
import { fireConfetti } from "@/components/celebration";

// WebGL D6 die — loaded client-side only (Three.js requires browser APIs)
const D6Canvas = dynamic(() => import("./d6-canvas"), {
  ssr: false,
  loading: () => (
    <div style={{ width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3 }}>
      <svg viewBox="0 0 100 100" width={56} height={56} fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="10" y="10" width="80" height="80" rx="12" />
        <circle cx="50" cy="50" r="7" fill="currentColor" />
      </svg>
    </div>
  ),
});

const GameIcon = getGameByType("dice")!.icon;

// ── Dice Configs ──
const diceTypes = [
  { sides: 4, label: "D4", color: "from-amber-500 to-orange-600", glow: "shadow-amber-500/20" },
  { sides: 6, label: "D6", color: "from-primary to-(--violet-600)", glow: "shadow-glow-primary-sm" },
  { sides: 8, label: "D8", color: "from-cyan-500 to-blue-600", glow: "shadow-cyan-500/20" },
  { sides: 10, label: "D10", color: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/20" },
  { sides: 12, label: "D12", color: "from-rose-500 to-pink-600", glow: "shadow-rose-500/20" },
  { sides: 20, label: "D20", color: "from-red-500 to-rose-600", glow: "shadow-red-500/20" },
  { sides: 100, label: "D100", color: "from-sky-400 to-blue-500", glow: "shadow-sky-500/20" },
];

// ── SVG shapes for polyhedrals ──
const PolyhedralSvg = ({ sides, className }: { sides: number; className?: string }) => {
  switch (sides) {
    case 4:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="50,5 95,85 5,85" />
          <line points="50,5 50,55" />
          <line points="5,85 50,55" />
          <line points="95,85 50,55" />
        </svg>
      );
    case 8:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="50,5 95,50 50,95 5,50" />
          <line points="5,50 95,50" />
          <line points="50,5 50,95" />
          <line points="50,50 5,50" />
          <line points="50,50 95,50" />
        </svg>
      );
    case 10:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="50,5 90,30 90,70 50,95 10,70 10,30" />
          <line points="50,5 50,95" />
          <line points="10,30 90,70" />
          <line points="10,70 90,30" />
        </svg>
      );
    case 12:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="50,5 90,20 95,65 50,95 5,65 10,20" />
          <polygon points="50,25 75,35 70,65 50,75 30,65 25,35" />
          <line points="50,5 50,25" />
          <line points="90,20 75,35" />
          <line points="95,65 70,65" />
          <line points="50,95 50,75" />
          <line points="5,65 30,65" />
          <line points="10,20 25,35" />
        </svg>
      );
    case 20:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.2">
          <polygon points="50,5 95,30 95,75 50,95 5,75 5,30" />
          <polygon points="50,25 80,45 65,80 35,80 20,45" />
          <line points="50,5 50,25" />
          <line points="95,30 80,45" />
          <line points="95,75 65,80" />
          <line points="50,95 50,80" />
          <line points="5,75 35,80" />
          <line points="5,30 20,45" />
          <line points="50,25 20,45" />
          <line points="50,25 80,45" />
          <line points="65,80 50,80" />
          <line points="35,80 50,80" />
        </svg>
      );
    case 100:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="50" cy="50" r="45" />
          <circle cx="50" cy="50" r="30" strokeDasharray="5,5" />
          <line points="5,50 95,50" />
          <line points="50,5 50,95" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="15" y="15" width="70" height="70" rx="10" />
        </svg>
      );
  }
};


export default function DicePage() {
  const [selectedDice, setSelectedDice] = useState(6);
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [history, setHistory] = useState<{ dice: number; count: number; results: number[] }[]>([]);

  // Analytics
  const stats = useMemo(() => {
    const allRolls = history.flatMap((h) => h.results);
    const totalCount = allRolls.length;
    const sum = allRolls.reduce((a, b) => a + b, 0);
    const avg = totalCount ? (sum / totalCount).toFixed(1) : "0.0";

    const dist: Record<number, number> = {};
    allRolls.forEach((r) => {
      dist[r] = (dist[r] || 0) + 1;
    });

    return { totalCount, sum, avg, dist };
  }, [history]);

  const clearHistory = () => {
    setHistory([]);
    setResults([]);
    toast.success("Roll history cleared!");
  };

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setResults([]);
    playDiceRoll(soundEnabled);

    setTimeout(() => {
      const newResults = Array.from(
        { length: count },
        () => Math.floor(Math.random() * selectedDice) + 1
      );
      setResults(newResults);
      setHistory((prev) => [{ dice: selectedDice, count, results: newResults }, ...prev].slice(0, 20));
      setRolling(false);
      playTick(soundEnabled);

      // Check critical roll
      const isMaxTotal = newResults.every((r) => r === selectedDice);
      if (isMaxTotal) {
        fireConfetti();
        toast.success("Critical Roll! Maximum value achieved!", {
          icon: <Sparkles className="w-5 h-5 text-yellow-400" />,
        });
      }
    }, 1000);
  };

  const total = results.reduce((a, b) => a + b, 0);
  const currentDice = diceTypes.find((d) => d.sides === selectedDice) || diceTypes[1];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-24 pb-16 px-4">
      {/* Immersive background glow effects */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[50%] rounded-full dark:bg-(--violet-800)/10 bg-primary/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[50%] rounded-full dark:bg-cyan-900/10 bg-cyan-500/5 blur-[150px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border-border/40 text-xs text-muted-foreground mb-4">
            <GameIcon className="w-3.5 h-3.5 text-(--brand-primary-strong)" />
            <span>Interactive Rolling Arena</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-3 tracking-tight text-foreground">
            DICE <span className="gradient-text">ROLLER</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Choose polyhedral shapes, adjust counts, and roll inside the neon-lit velvet tray.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="space-y-6">
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 border-border space-y-6">
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                  Select Dice Shape
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {diceTypes.map((d) => (
                    <button
                      key={d.sides}
                      onClick={() => {
                        setSelectedDice(d.sides);
                        setResults([]);
                      }}
                      className={`py-3 px-1.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-2 ${
                        selectedDice === d.sides
                          ? "bg-primary/10 border-primary/50 text-(--brand-primary-strong) shadow-glow-primary-sm"
                          : "border-border bg-card/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <PolyhedralSvg sides={d.sides} className="w-5 h-5 opacity-80" />
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Dice Amount
                  </h3>
                  <span className="text-sm font-bold text-(--brand-primary-strong)">{count}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCount(Math.max(1, count - 1))}
                    disabled={rolling}
                    aria-label="Decrease dice count"
                    className="h-11 w-11 border-border bg-card/30 rounded-lg"
                  >
                    -
                  </Button>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    disabled={rolling}
                    className="flex-1 accent-primary h-1 bg-muted rounded-lg cursor-pointer"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCount(Math.min(10, count + 1))}
                    disabled={rolling}
                    aria-label="Increase dice count"
                    className="h-11 w-11 border-border bg-card/30 rounded-lg"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {/* Live Analytics Dashboard */}
            {stats.totalCount > 0 && (
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 border-border space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-(--brand-primary-strong)" />
                  Rolling Statistics
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-card/40 border border-border">
                    <div className="text-xs text-muted-foreground font-medium">Total Rolls</div>
                    <div className="text-lg font-extrabold mt-1 text-foreground">{stats.totalCount}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-card/40 border border-border">
                    <div className="text-xs text-muted-foreground font-medium">Sum</div>
                    <div className="text-lg font-extrabold mt-1 text-foreground">{stats.sum}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-card/40 border border-border">
                    <div className="text-xs text-muted-foreground font-medium">Average</div>
                    <div className="text-lg font-extrabold mt-1 text-(--brand-primary-strong)">{stats.avg}</div>
                  </div>
                </div>

                {/* Distribution bars */}
                <div className="space-y-2 mt-4">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Rolls Distribution
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {Array.from({ length: selectedDice }, (_, i) => i + 1).map((val) => {
                      const frequency = stats.dist[val] || 0;
                      const pct = stats.totalCount ? (frequency / stats.totalCount) * 100 : 0;
                      return (
                        <div key={val} className="flex items-center gap-3 text-xs">
                          <span className="font-semibold w-4 text-right text-muted-foreground">{val}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: pct / 100 }}
                              style={{ transformOrigin: "left" }}
                              className={`h-full w-full bg-gradient-to-r ${currentDice.color}`}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-muted-foreground text-[10px]">
                            {frequency} ({Math.round(pct)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rolling Tray / Arena */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 border-border flex flex-col justify-between min-h-[460px] relative overflow-hidden">
              {/* Velvet background */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 via-zinc-50/50 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 opacity-[0.95] z-0" />
              {/* LED border strip glowing border */}
              <div className={`absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r ${currentDice.color} opacity-30 dark:opacity-40 shadow-[0_1px_12px_rgba(168,85,247,0.3)]`} />
              <div className={`absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r ${currentDice.color} opacity-30 dark:opacity-40 shadow-[0_-1px_12px_rgba(168,85,247,0.3)]`} />

              <div className="relative z-10 w-full flex items-center justify-between border-b border-border pb-4">
                <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                  Tray
                </span>
                {results.length > 0 && !rolling && (
                  <span role="status" aria-live="polite" className="bg-primary/10 text-(--brand-primary-strong) border border-primary/20 text-xs px-3 py-1 font-bold rounded-full">
                    Total: {total}
                  </span>
                )}
              </div>

              {/* Central Dice Container */}
              <div className="relative z-10 my-auto py-8 flex flex-wrap items-center justify-center gap-6">
                {rolling ? (
                  Array.from({ length: count }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        x: [0, (i % 2 === 0 ? 25 : -25), 0],
                        y: [0, (i % 3 === 0 ? 20 : -20), 0],
                        scale: [1, 1.1, 1],
                      }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    >
                      {selectedDice === 6 ? (
                        <D6Canvas value={1} rolling={true} />
                      ) : (
                        <div className="relative w-16 h-16 flex items-center justify-center text-(--brand-primary-strong)">
                          <PolyhedralSvg sides={selectedDice} className="absolute inset-0 w-full h-full animate-pulse" />
                          <Sparkles className="w-5 h-5 animate-spin" />
                        </div>
                      )}
                    </motion.div>
                  ))
                ) : results.length > 0 ? (
                  results.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, rotate: (i % 2 === 0 ? 45 : -45), y: -100 }}
                      animate={{ scale: 1, rotate: 0, y: 0 }}
                      transition={{ type: "spring", stiffness: 180, damping: 13, delay: i * 0.05 }}
                      className="relative cursor-default"
                    >
                      {selectedDice === 6 ? (
                        <div className="flex flex-col items-center gap-1">
                          <D6Canvas value={r} rolling={false} />
                          <span className="text-2xl font-black tabular-nums text-foreground drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                            {r}
                          </span>
                        </div>
                      ) : (
                        <div className={`relative w-20 h-20 flex items-center justify-center bg-gradient-to-br ${currentDice.color} bg-clip-text text-transparent`}>
                          <PolyhedralSvg
                            sides={selectedDice}
                            className={`absolute inset-0 w-full h-full text-foreground/10 fill-foreground/[0.02] border-border drop-shadow-[0_0_15px_rgba(168,85,247,0.25)]`}
                          />
                          <span className="text-3xl font-black text-foreground relative z-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                            {r}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <PolyhedralSvg sides={selectedDice} className="w-full h-full text-foreground/5" />
                    </div>
                    <span className="text-sm font-semibold opacity-30">Drop dice in the tray to roll</span>
                  </div>
                )}
              </div>

              {/* Footer Controls */}
              <div className="relative z-10 flex items-center justify-center gap-4 mt-6">
                <Button
                  size="lg"
                  onClick={roll}
                  disabled={rolling}
                  className="px-10 py-6 text-sm font-black tracking-wider uppercase bg-gradient-to-r bg-(image:--gradient-brand) text-primary-foreground border-2 border-(--border-strong) hover:brightness-95 shadow-lg shadow-glow-primary-sm flex items-center gap-2 rounded-xl"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Roll {count}d{selectedDice}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
                  className="h-12 w-12 border-border bg-card/30 hover:bg-muted rounded-xl"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Elegant History Feed */}
            {history.length > 0 && (
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 border-border">
                <div className="flex items-center justify-between w-full mb-4">
                  <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-(--brand-primary-strong)" />
                    History Feed
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    disabled={rolling}
                    className="text-xs text-muted-foreground hover:text-red-400 h-8 gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {history.slice(0, 10).map((h, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-card/40 border border-border flex items-center justify-between text-xs"
                    >
                      <span className="text-muted-foreground font-bold">
                        {h.count}d{h.dice}
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-w-[60%]">
                        {h.results.map((r, j) => (
                          <span
                            key={j}
                            className="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center font-mono font-bold text-foreground text-[10px]"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                      <span className="font-extrabold text-(--brand-primary-strong)">
                        = {h.results.reduce((a, b) => a + b, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
