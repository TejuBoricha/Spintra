"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { toast } from "sonner";

import { playSwipe, playSuccess } from "@/lib/audio";

export function LuckyWheelActivity() {
  const { isHost, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();

  const [wheelEntries, setWheelEntries] = useState<string[]>(["Option 1", "Option 2", "Option 3"]);
  const [newWheelEntryText, setNewWheelEntryText] = useState("");
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelSpinAngle, setWheelSpinAngle] = useState(1440);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "wheel_entries": {
          const payload = event as { entries: string[] };
          setWheelEntries(payload.entries);
          break;
        }
        case "wheel_spinning":
          setWheelSpinAngle(1440 + Math.random() * 360);
          setWheelSpinning(true);
          playSwipe(soundEnabled);
          break;
        case "wheel_spin": {
          const payload = event as { winner: string };
          setWheelWinner(payload.winner);
          setWheelSpinning(false);
          playSuccess(soundEnabled);
          break;
        }
        case "activity_reset":
          setWheelWinner(null);
          setWheelSpinning(false);
          break;
      }
    });
  }, [registerEventListener, soundEnabled]);

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
    <motion.div
      key="lucky-wheel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Emoji name="ferris_wheel" size={28} /> Lucky Wheel
      </h2>
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
                style={{
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: "center",
                  clipPath: `polygon(50% 50%, 100% 0, 100% ${100 / wheelEntries.length * 2}%)`,
                }}
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
                  onDoubleClick={() => {
                    if (!wheelSpinning) {
                      setEditingIndex(i);
                      setEditingText(e);
                    }
                  }}
                >
                  <span title="Double click to edit">{e}</span>
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
              );
            })}
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
              setTimeout(() => {
                const winner = wheelEntries[Math.floor(Math.random() * wheelEntries.length)];
                sendActivityEvent({ kind: "wheel_spin", winner });
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
