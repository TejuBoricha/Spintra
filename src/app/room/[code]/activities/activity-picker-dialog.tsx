"use client";

import { Sparkles, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GAMES } from "@/lib/games";
import type { RoomType } from "@/lib/types";

interface ActivityPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeActivityType?: string;
  roomType: RoomType;
  onSelect: (type: RoomType) => void;
}

/** Host-only dialog for switching the room's current game activity. */
export function ActivityPickerDialog({
  open,
  onOpenChange,
  activeActivityType,
  roomType,
  onSelect,
}: ActivityPickerDialogProps) {
  const isClassroom = roomType === "classroom";

  // Classroom rooms only show education-appropriate activities.
  // Party rooms show everything.
  const availableGames = GAMES.filter((g) => {
    if (g.createOnly) return false;
    if (isClassroom && g.classroomSafe === false) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Choose an Activity
          </DialogTitle>
          {isClassroom && (
            <DialogDescription className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
              Classroom mode — party/social games are hidden
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableGames.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.type}
                onClick={() => onSelect(g.type)}
                aria-label={`Select ${g.label}`}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm font-medium hover:border-purple-500/50 hover:bg-purple-500/10 ${
                  activeActivityType === g.type
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span>{g.label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
