"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, History } from "lucide-react";
import { Button } from "@/components/ui/button";

const diceTypes = [
  { sides: 4, label: "D4" },
  { sides: 6, label: "D6" },
  { sides: 8, label: "D8" },
  { sides: 10, label: "D10" },
  { sides: 12, label: "D12" },
  { sides: 20, label: "D20" },
  { sides: 100, label: "D100" },
];

const DiceIcon = ({ sides }: { sides: number }) => {
  const icons: Record<number, React.ComponentType<{ className?: string }>> = { 4: Dice1, 6: Dice2, 8: Dice3, 10: Dice4, 12: Dice5, 20: Dice6, 100: Dice6 };
  const Icon = icons[sides] || Dice6;
  return <Icon className="w-5 h-5" />;
};

export default function DicePage() {
  const [selectedDice, setSelectedDice] = useState(6);
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<{ dice: number; count: number; results: number[] }[]>([]);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setResults([]);
    setTimeout(() => {
      const newResults = Array.from({ length: count }, () => Math.floor(Math.random() * selectedDice) + 1);
      setResults(newResults);
      setHistory((prev) => [{ dice: selectedDice, count, results: newResults }, ...prev].slice(0, 20));
      setRolling(false);
    }, 600);
  };

  const total = results.reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Dice Roller</h1>
          <p className="text-muted-foreground mb-8">Roll any dice, any amount.</p>
        </motion.div>

        {/* Dice Selection */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {diceTypes.map((d) => (
            <button
              key={d.sides}
              onClick={() => { setSelectedDice(d.sides); setResults([]); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedDice === d.sides
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                  : "glass-card hover:border-white/10"
              }`}
            >
              <DiceIcon sides={d.sides} />
              <span className="ml-2">{d.label}</span>
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Button variant="outline" size="sm" onClick={() => setCount(Math.max(1, count - 1))} className="w-8 h-8">-</Button>
          <span className="text-xl font-bold w-8">{count}</span>
          <Button variant="outline" size="sm" onClick={() => setCount(Math.min(20, count + 1))} className="w-8 h-8">+</Button>
          <span className="text-muted-foreground text-sm ml-2">dice</span>
        </div>

        {/* Results */}
        <div className="flex flex-wrap justify-center gap-3 mb-8 min-h-[80px]">
          {rolling ? (
            <motion.div
              animate={{ rotate: [0, 90, 180, 270, 360] }}
              transition={{ duration: 0.6, ease: "linear" }}
            >
              <Dice6 className="w-12 h-12 text-purple-400" />
            </motion.div>
          ) : results.length > 0 ? (
            results.map((r, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: i * 0.05 }}
                className="w-14 h-14 rounded-xl glass-card flex items-center justify-center text-xl font-bold"
              >
                {r}
              </motion.div>
            ))
          ) : (
            <div className="flex items-center justify-center text-muted-foreground">
              <Dice6 className="w-12 h-12 opacity-20" />
            </div>
          )}
        </div>

        {results.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
            <div className="text-3xl font-bold gradient-text">Total: {total}</div>
          </motion.div>
        )}

        <Button
          size="lg"
          onClick={roll}
          disabled={rolling}
          className="text-lg px-10 py-6 bg-gradient-to-r from-purple-600 to-cyan-500 text-white border-0 shadow-xl shadow-purple-500/25"
        >
          <Dice6 className={`w-5 h-5 mr-2 ${rolling ? "animate-spin" : ""}`} />
          Roll {count}d{selectedDice}
        </Button>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-16 text-left max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" /> History
            </h3>
            <div className="space-y-2">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="glass-card p-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{h.count}d{h.dice}</span>
                  <span className="flex gap-1">
                    {h.results.map((r, j) => (
                      <span key={j} className="font-mono font-bold">{r}</span>
                    ))}
                  </span>
                  <span className="font-bold text-purple-400">= {h.results.reduce((a, b) => a + b, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
