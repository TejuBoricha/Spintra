"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import { useRoomActivity, useRoomParticipants } from "../context/room-activity-context";
import { shuffleArray, disambiguatedUsernames } from "@/lib/utils";

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
      className="flex flex-col gap-8 max-w-xl mx-auto pt-8 w-full"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Split className="w-6 h-6 text-cyan-400" /> Team Maker
      </h2>

      {isHost && (
        <div className="flex gap-3 flex-wrap justify-center bg-muted/30 border border-border p-3 rounded-2xl w-full">
          <span className="text-xs font-semibold text-muted-foreground self-center mr-2">
            Create:
          </span>
          {[2, 3, 4].map((n) => (
            <Button
              key={n}
              variant="outline"
              className="h-10 px-5 text-sm font-semibold border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300 rounded-full transition-all"
              onClick={() => {
                const names = disambiguatedUsernames(participants.filter((p) => p.is_online));
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {tmTeams.map((team, i) => {
            const colors = [
              "border-purple-500/40 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 shadow-purple-500/5",
              "border-cyan-500/40 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 shadow-cyan-500/5",
              "border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-orange-500/5 shadow-amber-500/5",
              "border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 shadow-emerald-500/5",
            ];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`p-5 rounded-3xl border shadow-lg ${colors[i % colors.length]}`}
              >
                <p className="font-extrabold mb-3 text-base text-foreground tracking-wide border-b border-border pb-1.5">
                  {team.name}
                </p>
                <div className="space-y-2">
                  {team.members.map((m, j) => (
                    <p
                      key={j}
                      className="text-sm font-semibold text-muted-foreground flex items-center gap-2"
                    >
                      <Emoji name="busts_in_silhouette" size={14} animated={false} />
                      <span className="text-neutral-200">{m}</span>
                    </p>
                  ))}
                  {team.members.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No members</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 rounded-3xl text-center w-full border border-border shadow-xl">
          <p className="mb-4 flex justify-center">
            <Emoji name="busts_in_silhouette" size={48} />
          </p>
          <p className="text-muted-foreground font-medium">
            {isHost ? "Choose how many teams to create" : "Waiting for host to create teams…"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
