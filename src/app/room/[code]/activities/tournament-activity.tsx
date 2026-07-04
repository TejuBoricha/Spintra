"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Swords, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity, useRoomParticipants } from "../context/room-activity-context";
import { shuffleArray } from "@/lib/utils";

export function TournamentActivity() {
  const { isHost, sendActivityEvent, registerEventListener } = useRoomActivity();
  const { participants } = useRoomParticipants();
  const [tmTeams, setTmTeams] = useState<{ name: string; members: string[] }[]>([]);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "tm_teams") {
        setTmTeams(event.teams);
      } else if (event.kind === "activity_reset") {
        setTmTeams([]);
      }
    });
  }, [registerEventListener]);

  return (
    <motion.div
      key="tournament"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 max-w-xl mx-auto pt-8 w-full"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Swords className="w-6 h-6 text-amber-500" /> Tournament Bracket
      </h2>

      {tmTeams.length > 0 ? (
        <div className="space-y-4 w-full">
          {tmTeams.map((match, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 p-4 rounded-3xl shadow-lg w-full"
            >
              <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/20 px-3 py-1 font-bold uppercase tracking-wider text-[10px] shrink-0">
                Match {i + 1}
              </Badge>
              <div className="flex-1 flex items-center justify-center sm:justify-start gap-4 w-full min-w-0">
                <span className="font-bold text-sm text-neutral-200 truncate max-w-[140px] text-right">
                  {match.members[0]}
                </span>
                <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 select-none">
                  VS
                </span>
                <span className="font-bold text-sm text-neutral-200 truncate max-w-[140px] text-left">
                  {match.members[1]}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 rounded-3xl text-center w-full border border-white/10 shadow-xl">
          <p className="mb-4 flex justify-center">
            <Emoji name="trophy" size={48} />
          </p>
          <p className="text-muted-foreground font-medium">
            {isHost ? "Generate bracket below" : "Waiting for host to set up bracket…"}
          </p>
        </div>
      )}

      {isHost && (
        <Button
          onClick={() => {
            const names = participants
              .filter((p) => p.is_online)
              .map((p) => p.user?.username || "Guest");
            const shuffled = shuffleArray(names);
            const matches: { name: string; members: string[] }[] = [];
            for (let i = 0; i < shuffled.length - 1; i += 2) {
              matches.push({
                name: `Match ${matches.length + 1}`,
                members: [shuffled[i], shuffled[i + 1] || "BYE"],
              });
            }
            sendActivityEvent({ kind: "tm_teams", teams: matches });
          }}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white border-0 rounded-full h-11 font-bold shadow-lg shadow-amber-500/10"
        >
          <Shuffle className="w-4 h-4 mr-2" /> Generate Bracket
        </Button>
      )}
    </motion.div>
  );
}
