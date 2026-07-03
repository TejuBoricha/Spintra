"use client";

import { motion } from "framer-motion";
import { Swords, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import type { ActivityEvent, RoomParticipant } from "@/lib/types";

interface TournamentActivityProps {
  isHost: boolean;
  participants: RoomParticipant[];
  tmTeams: { name: string; members: string[] }[];
  sendActivityEvent: (event: ActivityEvent) => void;
  onActivityEventRef: React.RefObject<((event: ActivityEvent) => void) | null>;
}

export function TournamentActivity({ isHost, participants, tmTeams, sendActivityEvent, onActivityEventRef }: TournamentActivityProps) {
  return (
    <motion.div
      key="tournament"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 max-w-lg mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Swords className="w-6 h-6 text-amber-400" /> Tournament Bracket
      </h2>
      {tmTeams.length > 0 ? (
        <div className="space-y-3">
          {tmTeams.map((round, i) => (
            <div key={i} className="flex items-center gap-3 glass p-3 rounded-xl">
              <Badge className="bg-amber-500/20 text-amber-300">Match {i + 1}</Badge>
              <span className="font-medium">{round.members.join(" vs ")}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="trophy" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Generate bracket below" : "Waiting for host to set up bracket…"}</p>
        </div>
      )}
      {isHost && (
        <Button
          onClick={() => {
            const names = participants.filter((p) => p.is_online).map((p) => p.user?.username || "Guest");
            const shuffled = [...names].sort(() => Math.random() - 0.5);
            const matches: { name: string; members: string[] }[] = [];
            for (let i = 0; i < shuffled.length - 1; i += 2) {
              matches.push({ name: `Match ${matches.length + 1}`, members: [shuffled[i], shuffled[i + 1] || "BYE"] });
            }
            sendActivityEvent({ kind: "tm_teams", teams: matches });
            if (onActivityEventRef.current) onActivityEventRef.current({ kind: "tm_teams", teams: matches });
          }}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
        >
          <Shuffle className="w-4 h-4 mr-2" /> Generate Bracket
        </Button>
      )}
    </motion.div>
  );
}
