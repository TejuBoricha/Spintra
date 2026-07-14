"use client";

import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import { Emoji } from "@/components/emoji";

interface AggregateIdleScreenProps {
  activityType: "party" | "classroom";
  isHost: boolean;
}

/** Shown for "party"/"classroom" room types before a sub-game has been picked. */
export function AggregateIdleScreen({ activityType, isHost }: AggregateIdleScreenProps) {
  return (
    <motion.div
      key="aggregate-idle"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex items-center justify-center min-h-[400px]"
    >
      <div className="text-center border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-12 max-w-md w-full">
        <p className="mb-4 flex justify-center">
          <Emoji name={activityType === "party" ? "party_popper" : "books"} size={56} />
        </p>
        <h2 className="text-2xl font-bold mb-2 capitalize">{activityType} Mode</h2>
        <p className="text-muted-foreground mb-6">
          {isHost ? (
            <>Use the <Shuffle className="w-4 h-4 inline align-text-bottom" /> button in the header to pick a game activity for the room.</>
          ) : (
            "The host will choose an activity soon!"
          )}
        </p>
      </div>
    </motion.div>
  );
}
