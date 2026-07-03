"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import { useRoomActivity, useRoomParticipants } from "../context/room-activity-context";
import { shuffleArray } from "@/lib/utils";

export function TeamMakerActivity() {
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
      key="team-maker"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 max-w-lg mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Split className="w-6 h-6 text-cyan-400" /> Team Maker
      </h2>
      {isHost && (
        <div className="flex gap-3 flex-wrap">
          {[2, 3, 4].map((n) => (
            <Button
              key={n}
              variant="outline"
              className="border-cyan-500/30 hover:bg-cyan-500/10"
              onClick={() => {
                const names = participants.filter((p) => p.is_online).map((p) => p.user?.username || "Guest");
                const shuffled = shuffleArray(names);
                const teams = Array.from({ length: n }, (_, i) => ({
                  name: `Team ${i + 1}`,
                  members: shuffled.filter((_, j) => j % n === i),
                }));
                sendActivityEvent({ kind: "tm_teams", teams });
              }}
            >
              {n} Teams
            </Button>
          ))}
        </div>
      )}
      {tmTeams.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {tmTeams.map((team, i) => {
            const colors = ["border-purple-500/50 bg-purple-500/10","border-cyan-500/50 bg-cyan-500/10","border-amber-500/50 bg-amber-500/10","border-emerald-500/50 bg-emerald-500/10"];
            return (
              <div key={i} className={`p-4 rounded-2xl border-2 ${colors[i % colors.length]}`}>
                <p className="font-bold mb-2 text-sm">{team.name}</p>
                {team.members.map((m, j) => (
                  <p key={j} className="text-sm text-muted-foreground">{m}</p>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="busts_in_silhouette" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Choose how many teams to create" : "Waiting for host to create teams…"}</p>
        </div>
      )}
    </motion.div>
  );
}
