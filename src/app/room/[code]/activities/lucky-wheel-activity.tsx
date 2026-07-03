"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Emoji } from "@/components/emoji";
import type { ActivityEvent } from "@/lib/types";

interface LuckyWheelActivityProps {
  isHost: boolean;
  wheelEntries: string[];
  newWheelEntryText: string;
  setNewWheelEntryText: (value: string) => void;
  wheelWinner: string | null;
  wheelSpinning: boolean;
  wheelSpinAngle: number;
  sendActivityEvent: (event: ActivityEvent) => void;
  onActivityEventRef: React.RefObject<((event: ActivityEvent) => void) | null>;
  addWheelEntry: () => void;
  removeWheelEntry: (index: number) => void;
}

export function LuckyWheelActivity({
  isHost,
  wheelEntries,
  newWheelEntryText,
  setNewWheelEntryText,
  wheelWinner,
  wheelSpinning,
  wheelSpinAngle,
  sendActivityEvent,
  onActivityEventRef,
  addWheelEntry,
  removeWheelEntry,
}: LuckyWheelActivityProps) {
  return (
    <motion.div
      key="lucky-wheel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2"><Emoji name="ferris_wheel" size={28} /> Lucky Wheel</h2>
      <div className="relative w-64 h-64">
        <motion.div
          animate={wheelSpinning ? { rotate: [0, wheelSpinAngle] } : {}}
          transition={{ duration: 3, ease: "easeOut" }}
          className="w-full h-full rounded-full border-4 border-purple-500/50 overflow-hidden"
        >
          {wheelEntries.map((entry, i) => {
            const angle = (360 / wheelEntries.length) * i;
            const colors = ["from-purple-500", "from-cyan-500", "from-amber-500", "from-pink-500", "from-emerald-500", "from-indigo-500"];
            return (
              <div
                key={i}
                className={`absolute inset-0 flex items-center justify-end pr-6 text-xs font-bold text-white bg-gradient-to-r ${colors[i % colors.length]} to-transparent`}
                style={{ transform: `rotate(${angle}deg)`, transformOrigin: "center", clipPath: `polygon(50% 50%, 100% 0, 100% ${100 / wheelEntries.length * 2}%)` }}
              >
                <span className="max-w-[70px] truncate">{entry}</span>
              </div>
            );
          })}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-background border-2 border-purple-500/50 flex items-center justify-center">
              <Emoji name="ferris_wheel" size={28} animated={!wheelSpinning} />
            </div>
          </div>
        </motion.div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-2xl">▼</div>
      </div>
      {wheelWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-4 glass-card rounded-xl"
        >
          <p className="text-sm text-muted-foreground mb-1">Winner!</p>
          <p className="text-2xl font-bold text-purple-400 flex items-center justify-center gap-2">
            {wheelWinner} <Emoji name="party_popper" size={28} pop />
          </p>
        </motion.div>
      )}
      {isHost && (
        <div className="w-full space-y-3">
          <div className="flex flex-wrap gap-2">
            {wheelEntries.map((e, i) => (
              <Badge
                key={i}
                className="bg-purple-500/20 text-purple-300 pr-1 gap-1"
              >
                {e}
                <button
                  type="button"
                  onClick={() => removeWheelEntry(i)}
                  disabled={wheelSpinning}
                  aria-label={`Remove ${e}`}
                  className="rounded-full hover:bg-white/10 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newWheelEntryText}
              onChange={(e) => setNewWheelEntryText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWheelEntry()}
              placeholder="Add an option..."
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
              sendActivityEvent({ kind: "wheel_spinning" });
              if (onActivityEventRef.current) onActivityEventRef.current({ kind: "wheel_spinning" });
              setTimeout(() => {
                const winner = wheelEntries[Math.floor(Math.random() * wheelEntries.length)];
                sendActivityEvent({ kind: "wheel_spin", winner });
                if (onActivityEventRef.current) onActivityEventRef.current({ kind: "wheel_spin", winner });
              }, 3100);
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0"
          >
            {wheelSpinning ? "Spinning…" : "Spin the Wheel!"}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
