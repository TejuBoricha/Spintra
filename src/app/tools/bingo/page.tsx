"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  VolumeX,
  RotateCcw,
  SlidersHorizontal,
  Printer,
  Sparkles,
  Trophy,
  Grid3X3,
  Check,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { fireConfetti, CelebrationBanner } from "@/components/celebration";
import { getGameByType } from "@/lib/games";
import { playPop, playSuccess } from "@/lib/audio";
import {
  BINGO_THEMES,
  BINGO_PATTERNS,
  generateThemedBingoCard,
  checkBingoPattern,
  type BingoTheme,
  type BingoPatternId,
} from "@/lib/bingo-themes";

const GameIcon = getGameByType("bingo")!.icon;
const COLUMNS = ["B", "I", "N", "G", "O"] as const;

export default function BingoPage() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [autoDaub, setAutoDaub] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showMasterBoard, setShowMasterBoard] = useState(false);

  // Configuration
  const [currentThemeId, setCurrentThemeId] = useState<string>("classic");
  const [currentPatternId, setCurrentPatternId] = useState<BingoPatternId>("line");

  const currentTheme = useMemo<BingoTheme>(() => {
    return BINGO_THEMES.find((t) => t.id === currentThemeId) || BINGO_THEMES[0];
  }, [currentThemeId]);

  const currentPattern = useMemo(() => {
    return BINGO_PATTERNS.find((p) => p.id === currentPatternId) || BINGO_PATTERNS[0];
  }, [currentPatternId]);

  // Card & game state
  const [card, setCard] = useState<string[][] | null>(null);
  const [called, setCalled] = useState<string[]>([]);
  const [manualMarks, setManualMarks] = useState<Set<string>>(new Set());

  // Generate card on theme change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side random card generation
    setCard(generateThemedBingoCard(currentTheme));
    setCalled([]);
    setManualMarks(new Set(["2,2"])); // Center free space is always marked
  }, [currentTheme]);

  // Check if a cell is marked (either via auto-daub from called list, or player manual stamp)
  const isCellMarked = useCallback(
    (col: number, row: number): boolean => {
      if (col === 2 && row === 2) return true; // Center free space
      if (!card) return false;
      const cellValue = card[col][row];

      if (autoDaub) {
        return called.includes(cellValue);
      }
      return manualMarks.has(`${col},${row}`);
    },
    [card, called, autoDaub, manualMarks]
  );

  // Win condition checker derived cleanly
  const hasBingo = useMemo(() => {
    if (!card || called.length === 0) return false;
    return checkBingoPattern(currentPatternId, isCellMarked);
  }, [card, called.length, currentPatternId, isCellMarked]);

  // Fire celebratory feedback when bingo is achieved
  const prevBingoRef = useRef(false);
  useEffect(() => {
    if (hasBingo && !prevBingoRef.current) {
      playSuccess(soundEnabled);
      fireConfetti();

      if (speechEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Bingo! Congratulations!");
        window.speechSynthesis.speak(utterance);
      }
    }
    prevBingoRef.current = hasBingo;
  }, [hasBingo, soundEnabled, speechEnabled]);

  // Toggle player manual mark on cell
  const handleCellClick = (col: number, row: number) => {
    if ((col === 2 && row === 2) || !card || hasBingo) return;
    const key = `${col},${row}`;

    // Sound effect
    playPop(soundEnabled);

    // If auto-daub is active, manual clicking isn't needed
    if (autoDaub) return;

    setManualMarks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Announce called value using speech synthesis
  const speakCall = useCallback(
    (text: string, colPrefix?: string) => {
      if (!speechEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();
      const message = colPrefix ? `${colPrefix}, ${text}` : text;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    },
    [speechEnabled]
  );

  // Call next item
  const callNext = () => {
    if (hasBingo || !card) return;
    const remaining = currentTheme.items.filter((item) => !called.includes(item));
    if (remaining.length === 0) return;

    const nextItem = remaining[Math.floor(Math.random() * remaining.length)];
    const updated = [...called, nextItem];
    setCalled(updated);
    playPop(soundEnabled);

    // Announce
    let colPrefix = "";
    if (currentTheme.isNumbers) {
      const num = parseInt(nextItem, 10);
      colPrefix = COLUMNS[Math.floor((num - 1) / 15)] || "";
    }
    speakCall(nextItem, colPrefix);
  };

  // Reset entire round
  const resetGame = () => {
    setCard(generateThemedBingoCard(currentTheme));
    setCalled([]);
    setManualMarks(new Set(["2,2"]));
  };

  const lastCalled = called[called.length - 1];
  const lastCalledColumn =
    currentTheme.isNumbers && lastCalled
      ? COLUMNS[Math.floor((parseInt(lastCalled, 10) - 1) / 15)]
      : null;

  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Header Section */}
        <div className="reveal reveal-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) mb-4">
            <GameIcon className="w-4 h-4 text-teal-400" />
            <span className="text-sm text-muted-foreground">{currentTheme.name}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Bingo</h1>

          <div className="flex items-center justify-center gap-3 mb-6">
            <p className="text-muted-foreground">
              Mark your card as items are called. Goal:{" "}
              <strong className="text-foreground">{currentPattern.name}</strong>.
            </p>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound On" : "Sound Off"}
              aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
              className="p-1.5 rounded-lg border border-(--border-hairline) bg-(--surface-sunken) hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title={speechEnabled ? "Voice Caller On" : "Voice Caller Off"}
              aria-label={speechEnabled ? "Disable voice announcer" : "Enable voice announcer"}
              className={`p-1.5 rounded-lg border border-(--border-hairline) transition-colors ${
                speechEnabled
                  ? "bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/40"
                  : "bg-(--surface-sunken) hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Megaphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Customize Game"
              aria-label="Toggle game settings and themes"
              aria-expanded={showConfig}
              className={`p-1.5 rounded-lg border border-(--border-hairline) transition-colors ${
                showConfig
                  ? "bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/40"
                  : "bg-(--surface-sunken) hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Settings Drawer */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 text-left space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-(--border-hairline) pb-3">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-teal-500" /> Game Theme & Winning Rule
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentTheme.items.length} items in pool
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Theme Selector */}
                  <div className="space-y-1.5">
                    <label htmlFor="bingo-theme-select" className="text-xs font-medium text-muted-foreground">
                      Card Theme
                    </label>
                    <select
                      id="bingo-theme-select"
                      value={currentThemeId}
                      onChange={(e) => {
                        setCurrentThemeId(e.target.value);
                      }}
                      className="w-full bg-(--surface-sunken) border border-(--border-hairline) rounded-xl px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {BINGO_THEMES.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Winning Pattern */}
                  <div className="space-y-1.5">
                    <label htmlFor="bingo-pattern-select" className="text-xs font-medium text-muted-foreground">
                      Winning Pattern
                    </label>
                    <select
                      id="bingo-pattern-select"
                      value={currentPatternId}
                      onChange={(e) => setCurrentPatternId(e.target.value as BingoPatternId)}
                      className="w-full bg-(--surface-sunken) border border-(--border-hairline) rounded-xl px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {BINGO_PATTERNS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}: {p.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Daubing Mode Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-(--border-hairline)">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoDaub}
                      onClick={() => setAutoDaub(!autoDaub)}
                      className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                        autoDaub ? "bg-teal-500" : "bg-(--surface-sunken) border border-(--border-hairline)"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          autoDaub ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-xs font-medium text-foreground">
                      Auto-Daub (mark numbers automatically)
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (typeof window !== "undefined") window.print();
                    }}
                    className="text-xs"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Card
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Win Celebration Banner */}
        {hasBingo && (
          <div className="mb-6">
            <CelebrationBanner
              icon={<Emoji name="party_popper" size={48} pop />}
              title="BINGO!"
              subtitle={`You achieved '${currentPattern.name}' in ${called.length} calls!`}
            />
          </div>
        )}

        {/* Current Call Display */}
        {lastCalled && !hasBingo && (
          <div className="mb-4">
            <Badge
              variant="outline"
              className="text-xs border-teal-500/30 text-teal-700 dark:text-teal-400 mb-1"
            >
              Latest Call #{called.length}
            </Badge>
            <p
              key={lastCalled}
              className="text-2xl sm:text-3xl font-black text-teal-700 dark:text-teal-400 reveal reveal-scale"
            >
              {lastCalledColumn ? `${lastCalledColumn}-${lastCalled}` : lastCalled}
            </p>
          </div>
        )}

        {/* Bingo Card Container */}
        <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-3 sm:p-4 mb-5 inline-block shadow-sm max-w-full">
          {/* Column Headers B-I-N-G-O */}
          <div className="grid grid-cols-5 gap-1 mb-1.5">
            {COLUMNS.map((col) => (
              <div
                key={col}
                className="w-14 sm:w-16 h-8 flex items-center justify-center font-black text-base text-teal-700 dark:text-teal-400 tracking-wider"
              >
                {col}
              </div>
            ))}
          </div>

          {/* 5x5 Grid Cells */}
          {card ? (
            [0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="grid grid-cols-5 gap-1.5 mb-1.5 last:mb-0">
                {COLUMNS.map((_, col) => {
                  const marked = isCellMarked(col, row);
                  const isFree = col === 2 && row === 2;
                  const cellText = card[col]?.[row] || "";
                  const isCalled = called.includes(cellText);

                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleCellClick(col, row)}
                      disabled={isFree || autoDaub}
                      aria-pressed={marked}
                      aria-label={`${COLUMNS[col]} ${row + 1}: ${
                        isFree ? "Free Space" : cellText
                      }, ${marked ? "Marked" : "Unmarked"}`}
                      className={`w-14 sm:w-16 h-14 sm:h-16 flex flex-col items-center justify-center rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all p-1 text-center select-none relative overflow-hidden ${
                        isFree
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                          : marked
                          ? "bg-teal-500/25 border-teal-500 text-teal-950 dark:text-teal-100 shadow-sm"
                          : isCalled && !autoDaub
                          ? "border-teal-500/40 bg-teal-500/5 text-foreground hover:border-teal-500 animate-pulse"
                          : "border-(--border-hairline) bg-(--surface-sunken) text-foreground hover:border-teal-500/40 hover:bg-muted"
                      }`}
                    >
                      {isFree ? (
                        <div className="flex flex-col items-center">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Free</span>
                        </div>
                      ) : (
                        <>
                          <span className="line-clamp-2 leading-tight break-words">{cellText}</span>
                          {marked && (
                            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-teal-500 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            [0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="grid grid-cols-5 gap-1.5 mb-1.5">
                {COLUMNS.map((_, col) => (
                  <div
                    key={col}
                    className="w-14 sm:w-16 h-14 sm:h-16 rounded-xl border border-(--border-hairline) bg-(--surface-sunken) animate-pulse"
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Primary Controls */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          <Button
            onClick={callNext}
            disabled={!card || hasBingo || called.length >= currentTheme.items.length}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-(--text-on-lime) border-0 font-bold px-6 shadow-md shadow-teal-500/10"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Call Next
          </Button>

          <Button onClick={resetGame} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" /> New Card
          </Button>

          <Button
            variant="ghost"
            onClick={() => setShowMasterBoard(!showMasterBoard)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Grid3X3 className="w-3.5 h-3.5 mr-1" />
            {showMasterBoard ? "Hide Board" : "Master Board"} ({called.length}/{currentTheme.items.length})
          </Button>
        </div>

        {/* Status Line */}
        <p className="text-xs text-muted-foreground">
          {called.length} of {currentTheme.items.length} items called
          {!autoDaub && " • Tap squares on your card to stamp them"}
        </p>

        {/* Master Board Grid (Expandable) */}
        <AnimatePresence>
          {showMasterBoard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4 text-left overflow-hidden shadow-sm"
            >
              <div className="flex items-center justify-between mb-3 border-b border-(--border-hairline) pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                  <Grid3X3 className="w-4 h-4" /> Called Board Matrix
                </span>
                <span className="text-xs text-muted-foreground">
                  {called.length} called • {currentTheme.items.length - called.length} remaining
                </span>
              </div>

              {currentTheme.isNumbers ? (
                // 75-Ball Column Matrix
                <div className="space-y-1.5">
                  {COLUMNS.map((col, cIdx) => {
                    const start = cIdx * 15 + 1;
                    const rowNums = Array.from({ length: 15 }, (_, i) => String(start + i));

                    return (
                      <div key={col} className="flex items-center gap-1">
                        <span className="w-6 text-xs font-black text-teal-700 dark:text-teal-400 shrink-0">
                          {col}
                        </span>
                        <div className="flex-1 flex flex-wrap gap-1">
                          {rowNums.map((numStr) => {
                            const isCalled = called.includes(numStr);
                            return (
                              <span
                                key={numStr}
                                className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-mono font-medium ${
                                  isCalled
                                    ? "bg-teal-500 text-white font-bold"
                                    : "bg-(--surface-sunken) text-muted-foreground border border-(--border-hairline)"
                                }`}
                              >
                                {numStr}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Word Theme Pill Badges
                <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {currentTheme.items.map((item) => {
                    const isCalled = called.includes(item);
                    return (
                      <Badge
                        key={item}
                        variant={isCalled ? "default" : "outline"}
                        className={`text-xs ${
                          isCalled
                            ? "bg-teal-500 hover:bg-teal-500 text-white font-bold"
                            : "opacity-60 border-(--border-hairline)"
                        }`}
                      >
                        {isCalled && <Check className="w-3 h-3 mr-1" />}
                        {item}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
