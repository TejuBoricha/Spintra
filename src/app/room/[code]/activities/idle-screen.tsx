"use client";

import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface IdleScreenProps {
  isHost: boolean;
  onChooseActivity: () => void;
}

/** Shown in a room when no game activity has been picked yet. */
export function IdleScreen({ isHost, onChooseActivity }: IdleScreenProps) {
  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center justify-center min-h-[400px]"
    >
      <div className="text-center rounded-2xl border border-(--border-hairline) bg-(--surface-panel) shadow-1 p-12 max-w-md w-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden border-2 border-(--border-strong)"
        >
          <Image src="/icons/logo.png" alt="Spintra" width={80} height={80} className="w-full h-full object-cover" />
        </motion.div>
        {isHost ? (
          <>
            <h2 className="font-display text-2xl font-bold mb-2">You are the Host</h2>
            <p className="text-muted-foreground mb-6">
              Pick an activity to play with your room. Participants will see it automatically.
            </p>
            <Button onClick={onChooseActivity} variant="brand">
              <Shuffle className="w-4 h-4" />
              Choose Activity
            </Button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold mb-2">Waiting for Host</h2>
            <p className="text-muted-foreground">
              The host will start an activity soon. Chat with participants while you wait!
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
