"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Play,
  RotateCcw,
  Share2,
  Upload,
  Trash2,
  Save,
  Crown,
  Shuffle,
  Copy,
  ArrowRight,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { playSuccess, playTick } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { shuffleArray } from "@/lib/utils";
import { getGameByType } from "@/lib/games";
import { Emoji } from "@/components/emoji";

const GameIcon = getGameByType("name-draw")!.icon;

const SAMPLE_SETS: Record<string, string[]> = {
  fruits: ["Apple", "Banana", "Cherry", "Date", "Elderberry", "Fig", "Grape", "Honeydew"],
  colors: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Cyan"],
  animals: ["Lion", "Tiger", "Bear", "Wolf", "Eagle", "Shark", "Fox", "Deer"],
  countries: ["Japan", "Brazil", "Canada", "France", "Australia", "India", "Mexico", "Kenya"],
};

const STORAGE_KEY = "spintra-name-draw-saved";

export default function NameDrawPage() {
  const [textInput, setTextInput] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.join("\n");
        }
      }
    } catch {
      // ignore
    }
    return "";
  });
  const [eliminationMode, setEliminationMode] = useState(true);
  const [drawnNames, setDrawnNames] = useState<string[]>([]);
  const [currentWinner, setCurrentWinner] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shufflingName, setShufflingName] = useState<string>("");
  const [drawCount, setDrawCount] = useState(1);
  const [multiWinners, setMultiWinners] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const shuffleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const names = useMemo(
    () =>
      textInput
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    [textInput]
  );

  const availableNames = useMemo(
    () => (eliminationMode ? names.filter((n) => !drawnNames.includes(n)) : names),
    [eliminationMode, names, drawnNames]
  );

  const clearShuffleInterval = useCallback(() => {
    if (shuffleIntervalRef.current) {
      clearInterval(shuffleIntervalRef.current);
      shuffleIntervalRef.current = null;
    }
  }, []);

  const doDraw = useCallback(
    (count: number) => {
      if (availableNames.length === 0) {
        toast.error("No names to draw from!");
        return;
      }

      if (count > availableNames.length) {
        toast.warning(`Only ${availableNames.length} names available`);
        count = availableNames.length;
      }

      setIsDrawing(true);
      setCurrentWinner(null);
      setMultiWinners([]);

      // Pick winner(s) upfront
      const picked = shuffleArray(availableNames).slice(0, count);

      // Shuffle animation: cycle through names rapidly
      let cycles = 0;
      const maxCycles = 15;
      clearShuffleInterval();
      shuffleIntervalRef.current = setInterval(() => {
        cycles++;
        if (cycles >= maxCycles) {
          clearShuffleInterval();
          shuffleIntervalRef.current = null;

          // Reveal
          setTimeout(() => {
            setShufflingName("");
            if (count === 1) {
              setCurrentWinner(picked[0]);
            }
            setMultiWinners(picked);
            setDrawnNames((prev) => [...prev, ...picked]);
            setIsDrawing(false);
            playSuccess(soundEnabled);

            if (eliminationMode && picked.length === availableNames.length) {
              toast("All names have been drawn!", {
                description: "Reset to draw again.",
                icon: <Emoji name="party_popper" size={18} />,
              });
            }
          }, 100);
          return;
        }
        setShufflingName(availableNames[Math.floor(Math.random() * availableNames.length)]);
        playTick(soundEnabled);
      }, 80);
    },
    [availableNames, eliminationMode, clearShuffleInterval, soundEnabled]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => clearShuffleInterval();
  }, [clearShuffleInterval]);

  const reset = useCallback(() => {
    clearShuffleInterval();
    setDrawnNames([]);
    setCurrentWinner(null);
    setMultiWinners([]);
    setShufflingName("");
    setIsDrawing(false);
    toast.success("Draw reset!");
  }, [clearShuffleInterval]);

  const clearAll = useCallback(() => {
    setTextInput("");
    setDrawnNames([]);
    setCurrentWinner(null);
    setMultiWinners([]);
    setShufflingName("");
    setIsDrawing(false);
    toast.success("All cleared!");
  }, []);

  const addSampleSet = useCallback((key: string) => {
    const samples = SAMPLE_SETS[key];
    if (!samples) return;
    setTextInput((prev) => {
      const existing = prev
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      const merged = [...new Set([...existing, ...samples])];
      return merged.join("\n");
    });
    setDrawnNames([]);
    setCurrentWinner(null);
    setMultiWinners([]);
    toast.success(`Added ${samples.length} names!`);
  }, []);

  const handleCsvImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        // Parse CSV: split by newlines, also handle comma-separated on each line
        const parsed = text
          .split(/[\n\r]+/)
          .flatMap((line) => line.split(","))
          .map((n) => n.trim().replace(/^["']|["']$/g, ""))
          .filter((n) => n.length > 0);
        setTextInput((prev) => {
          const existing = prev
            .split("\n")
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
          const merged = [...new Set([...existing, ...parsed])];
          return merged.join("\n");
        });
        setDrawnNames([]);
        setCurrentWinner(null);
        setMultiWinners([]);
        toast.success(`Imported ${parsed.length} names!`);
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const saveNames = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
      toast.success("Names saved!");
    } catch {
      toast.error("Failed to save names");
    }
  }, [names]);

  const shareResults = useCallback(async () => {
    if (drawnNames.length === 0) {
      toast.error("No results to share yet!");
      return;
    }
    const text = [
      "🎯 Spintra Name Draw Results",
      "",
      `🏆 Winners (in order):`,
      ...drawnNames.map((n, i) => `  ${i + 1}. ${n}`),
      "",
      `Draw mode: ${eliminationMode ? "Elimination" : "Repeatable"}`,
      `Total entries: ${names.length}`,
      "",
      "Powered by Spintra — spintra.com",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Results copied to clipboard!");
    } catch {
      // Fallback
      toast.error("Failed to copy");
    }
  }, [drawnNames, names.length, eliminationMode]);

  const drawnButShuffled = [...drawnNames].reverse();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Aurora background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm mb-4">
            <GameIcon className="w-4 h-4 text-amber-400" />
            <span className="text-muted-foreground">Random Picker</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            Name <span className="gradient-text">Draw</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Pick a random winner with style. Perfect for giveaways, raffles, and
            fair decisions.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Panel: Input */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            {/* Input Card */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Entries
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {names.length} names
                </Badge>
              </div>

              <Textarea
                placeholder="Paste names, one per line...&#10;Alice&#10;Bob&#10;Charlie"
                className="min-h-[160px] resize-y font-mono text-sm"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />

              {/* Quick Actions Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCsvImport}
                  className="glass border-white/10 hover:border-white/20"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Import CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveNames}
                  disabled={names.length === 0}
                  className="glass border-white/10 hover:border-white/20"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={names.length === 0 && drawnNames.length === 0}
                  className="glass border-white/10 hover:border-white/20 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              </div>

              {/* Sample Sets */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Quick add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(SAMPLE_SETS).map(([key, entries]) => (
                    <button
                      key={key}
                      onClick={() => addSampleSet(key)}
                      className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-500/30 transition-colors capitalize"
                    >
                      + {key} ({entries.length})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings Card */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Settings
              </h2>

              {/* Elimination Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Elimination Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Remove drawn names from the pool
                  </p>
                </div>
                <Switch
                  checked={eliminationMode}
                  onCheckedChange={setEliminationMode}
                />
              </div>

              {/* Draw count */}
              <div>
                <p className="text-sm font-medium mb-1.5">Draw Count</p>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(availableNames.length, 1)}
                  value={drawCount}
                  onChange={(e) =>
                    setDrawCount(
                      Math.max(1, Math.min(parseInt(e.target.value) || 1, availableNames.length))
                    )
                  }
                  className="w-20"
                />
              </div>
            </div>

            {/* Create Room CTA */}
            <Link href="/create?type=name-draw">
              <div className="glass-card p-4 flex items-center justify-between group cursor-pointer hover:border-amber-500/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Play with Friends</p>
                    <p className="text-xs text-muted-foreground">
                      Create a multiplayer room
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </motion.div>

          {/* Right Panel: Draw Area */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-3 space-y-6"
          >
            {/* Winner Spotlight */}
            <div className="glass-card p-8 min-h-[280px] flex flex-col items-center justify-center relative overflow-hidden">
              {/* Background glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />

              <AnimatePresence mode="wait">
                {isDrawing && shufflingName ? (
                  <motion.div
                    key="shuffling"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ rotate: [0, -3, 3, -2, 0] }}
                      transition={{ duration: 0.3, repeat: Infinity }}
                      className="text-5xl sm:text-6xl md:text-7xl font-bold text-amber-400 mb-4"
                    >
                      {shufflingName}
                    </motion.div>
                    <motion.p
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="text-muted-foreground text-sm"
                    >
                      Picking a winner...
                    </motion.p>
                  </motion.div>
                ) : currentWinner ? (
                  <motion.div
                    key="winner"
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 20,
                    }}
                    className="text-center"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mb-4"
                    >
                      <Crown className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                      <p className="text-sm text-amber-400/80 font-medium uppercase tracking-wider">
                        Winner!
                      </p>
                    </motion.div>
                    <motion.div
                      initial={{ scale: 2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                      className="text-5xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent mb-3 break-all"
                    >
                      {currentWinner}
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-muted-foreground text-sm"
                    >
                      {drawnNames.length} of {names.length} drawn
                    </motion.p>
                  </motion.div>
                ) : multiWinners.length > 1 ? (
                  <motion.div
                    key="multi"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center w-full"
                  >
                    <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                    <p className="text-sm text-amber-400/80 font-medium uppercase tracking-wider mb-4">
                      Winners
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                      {multiWinners.map((name, i) => (
                        <motion.div
                          key={name}
                          initial={{ scale: 0, rotate: -5 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            delay: i * 0.1,
                            type: "spring",
                            stiffness: 200,
                          }}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30"
                        >
                          <div className="text-xs text-amber-400/60 mb-1">
                            #{i + 1}
                          </div>
                          <div className="text-xl font-bold text-amber-300">
                            {name}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{
                        y: [0, -8, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="mb-6"
                    >
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center mx-auto">
                        <Shuffle className="w-10 h-10 text-amber-400/50" />
                      </div>
                    </motion.div>
                    <p className="text-lg font-semibold text-muted-foreground mb-1">
                      Ready to Draw
                    </p>
                    <p className="text-sm text-muted-foreground/60">
                      {names.length > 0
                        ? `${names.length} names loaded — hit Draw!`
                        : "Add some names to get started"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Draw Buttons */}
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                onClick={() => doDraw(1)}
                disabled={
                  isDrawing ||
                  availableNames.length === 0
                }
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white border-0 shadow-lg shadow-amber-500/25"
              >
                <Play className="w-4 h-4 mr-2" />
                Draw One
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => doDraw(drawCount)}
                disabled={
                  isDrawing ||
                  availableNames.length === 0
                }
                className="flex-1 glass border-white/10 hover:border-amber-500/30"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Draw {Math.min(drawCount, availableNames.length)}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={reset}
                disabled={drawnNames.length === 0 && !currentWinner}
                className="glass border-white/10 hover:border-white/20"
                aria-label="Reset draw history"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={shareResults}
                disabled={drawnNames.length === 0}
                className="glass border-white/10 hover:border-white/20"
                aria-label="Share results"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Sound On" : "Sound Off"}
                aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
                className="glass border-white/10 hover:border-white/20"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Available Names */}
            {availableNames.length > 0 && names.length > 0 && (
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Available ({availableNames.length})
                  </h3>
                  {eliminationMode && drawnNames.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {availableNames.length} remaining
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableNames.map((name) => (
                    <span
                      key={name}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-foreground/70"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Drawn History */}
            {drawnNames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Drawn ({drawnNames.length})
                  </h3>
                  <button
                    onClick={shareResults}
                    className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy results
                  </button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {drawnButShuffled.map((name, i) => (
                    <motion.div
                      key={`${name}-${drawnNames.length - i}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5"
                    >
                      <span className="text-xs font-mono text-amber-400/60 w-6 text-right">
                        #{drawnNames.length - i}
                      </span>
                      <span className="text-sm font-medium flex-1">{name}</span>
                      {i === 0 && (
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
