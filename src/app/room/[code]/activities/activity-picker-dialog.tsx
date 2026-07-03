"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { GAMES } from "@/lib/games";
import type { RoomType } from "@/lib/types";

interface ActivityPickerDialogProps {
  activeActivityType?: string;
  onClose: () => void;
  onSelect: (type: RoomType) => void;
}

/** Host-only dialog for switching the room's current game activity. */
export function ActivityPickerDialog({ activeActivityType, onClose, onSelect }: ActivityPickerDialogProps) {
  return (
    <motion.div
      key="picker"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-6 w-full max-w-lg rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          Choose an Activity
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {GAMES.filter((g) => g.type !== "party" && g.type !== "classroom").map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.type}
                onClick={() => onSelect(g.type)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm font-medium hover:border-purple-500/50 hover:bg-purple-500/10 ${
                  activeActivityType === g.type
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-white/10 text-muted-foreground"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span>{g.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
