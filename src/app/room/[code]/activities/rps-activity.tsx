"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Swords, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import { useRoomActivity, useRoomParticipants } from "../context/room-activity-context";

const RPS_EMOJI = { Rock: "raised_fist", Paper: "raised_hand", Scissors: "victory_hand" } as const;

// Standard multiplayer RPS resolution: with only 2 distinct choices present,
// one side beats the other and every player on the winning side wins; with
// all 3 present, or everyone picking the same thing, nobody has an edge —
// standard multiplayer house rules call that a no-contest round rather than
// trying to invent a made-up tiebreak.
const BEATS: Record<string, string> = { Rock: "Scissors", Paper: "Rock", Scissors: "Paper" };

function resolveRound(
  choices: string[]
): { outcome: "tie" } | { outcome: "no-contest" } | { outcome: "decided"; winningChoice: string; losingChoice: string } {
  const distinct = Array.from(new Set(choices));
  if (distinct.length <= 1) return { outcome: "tie" };
  if (distinct.length === 3) return { outcome: "no-contest" };
  const [a, b] = distinct;
  return BEATS[a] === b
    ? { outcome: "decided", winningChoice: a, losingChoice: b }
    : { outcome: "decided", winningChoice: b, losingChoice: a };
}

export function RpsActivity() {
  const { isHost, currentUser, sendActivityEvent, registerEventListener, flushActivityState, awardScore } = useRoomActivity();
  const { participants } = useRoomParticipants();
  const [rpsChoices, setRpsChoices] = useState<Record<string, { username: string; choice: string }>>({});
  // Scoreboard/XP (ADR-008/009): guards against re-awarding for the same
  // round within this mount's lifetime — award_score's own idempotency
  // (the unique constraint on room_scores) is the real correctness
  // backstop regardless, this just avoids a redundant RPC call.
  const hasAwardedRoundRef = useRef(false);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "rps_choice") {
        setRpsChoices((prev) => ({
          ...prev,
          [event.userId]: { username: event.username, choice: event.choice },
        }));
      } else if (event.kind === "rps_reset" || event.kind === "activity_reset") {
        setRpsChoices({});
        hasAwardedRoundRef.current = false;
      }
    });
  }, [registerEventListener]);

  // Every client already receives the same rps_choice broadcasts and
  // arrives at the same rpsChoices map, so the outcome can be computed
  // independently and identically by each client — no server/host
  // arbitration needed (unlike a "who buzzed in first" race), since this is
  // a pure function of the final, already-synced set of choices.
  const onlineUserIds = useMemo(
    () => new Set(participants.filter((p) => p.is_online).map((p) => p.user_id)),
    [participants]
  );
  const onlineCount = onlineUserIds.size;
  // Only choices from currently-online participants count toward the
  // round's resolution — a participant who chose and then went offline
  // used to leave a stale entry in rpsChoices forever (no presence-based
  // cleanup), which could make a round wait on someone who already left, or
  // resolve using a choice from someone no longer present.
  const decidingChoices = useMemo(
    () => Object.fromEntries(Object.entries(rpsChoices).filter(([userId]) => onlineUserIds.has(userId))),
    [rpsChoices, onlineUserIds]
  );
  // Requires at least 2 online participants before resolving a round — with
  // only 1, that single choice alone used to satisfy `>= onlineCount` and
  // resolveRound() would return "tie" (its <=1-distinct-choice branch),
  // rendering a false "Everyone picked the same" claim about a round that
  // never had a second competing choice (e.g. a solo host testing, or a
  // duo where only one has joined so far).
  const allChosen = onlineCount >= 2 && Object.keys(decidingChoices).length >= onlineCount;
  const roundResult = useMemo(
    () => (allChosen ? resolveRound(Object.values(decidingChoices).map((r) => r.choice)) : null),
    [allChosen, decidingChoices]
  );
  const winners =
    roundResult?.outcome === "decided"
      ? Object.values(decidingChoices).filter((r) => r.choice === roundResult.winningChoice).map((r) => r.username)
      : [];

  // Scoreboard/XP (ADR-008/009): once this round resolves, the calling
  // client's own award_score('rps') independently re-derives the winner
  // server-side from the persisted choice events — never trusting a
  // client-supplied "I won" claim. flushActivityState() is called first
  // since that server-side check reads room_activity_state directly, which
  // could otherwise lag behind this client's already-resolved local view by
  // up to the persist debounce's 2s window.
  useEffect(() => {
    if (!roundResult || hasAwardedRoundRef.current) return;
    if (!decidingChoices[currentUser.id]) return;
    hasAwardedRoundRef.current = true;
    flushActivityState()
      .then((flushed) => {
        // A failed flush means the persisted state this round's server-side
        // verification would read may be stale — don't award against it.
        // Reset the guard so a later re-run (e.g. the next choice event
        // updating decidingChoices) gets another chance, rather than
        // permanently skipping this round's award.
        if (!flushed) {
          hasAwardedRoundRef.current = false;
          return;
        }
        return awardScore("rps");
      })
      .catch((err) => {
        console.error("Failed to award RPS score:", err);
        hasAwardedRoundRef.current = false;
      });
  }, [roundResult, decidingChoices, currentUser.id, flushActivityState, awardScore]);

  return (
    <motion.div
      key="rps"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Swords className="w-6 h-6 text-rose-500" /> Rock Paper Scissors
      </h2>

      {roundResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          role="status"
          aria-live="polite"
          className="glass-card p-4 rounded-2xl text-center w-full max-w-xs border border-rose-500/20"
        >
          {roundResult.outcome === "decided" ? (
            <p className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-2 flex-wrap">
              <Emoji name="party_popper" size={24} pop /> {winners.join(", ")} win{winners.length === 1 ? "s" : ""}!
              <span className="text-xs text-muted-foreground font-normal block w-full">
                {roundResult.winningChoice} beats {roundResult.losingChoice}
              </span>
            </p>
          ) : roundResult.outcome === "tie" ? (
            <p className="text-lg font-bold text-amber-400">Everyone picked the same — tie!</p>
          ) : (
            <p className="text-lg font-bold text-amber-400">
              Rock, Paper, and Scissors were all picked — no winner this round!
            </p>
          )}
        </motion.div>
      )}

      {isHost && !rpsChoices[currentUser.id] && !roundResult && (
        <p className="text-xs text-muted-foreground text-center">
          Pick Rock, Paper, or Scissors below — as host, you can start a new round anytime
        </p>
      )}

      {!rpsChoices[currentUser.id] ? (
        <div className="flex gap-4">
          {(["Rock", "Paper", "Scissors"] as const).map((choice) => {
            const config = {
              Rock: { border: "hover:border-rose-500/50 hover:bg-rose-500/10", text: "text-rose-400" },
              Paper: { border: "hover:border-cyan-500/50 hover:bg-cyan-500/10", text: "text-cyan-400" },
              Scissors: { border: "hover:border-purple-500/50 hover:bg-purple-500/10", text: "text-purple-400" },
            }[choice];

            return (
              <motion.button
                key={choice}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  sendActivityEvent({
                    kind: "rps_choice",
                    userId: currentUser.id,
                    username: currentUser.username,
                    choice,
                  });
                }}
                className={`flex flex-col items-center gap-3 p-6 w-28 rounded-2xl border border-border ${config.border} shadow-lg hover:shadow-2xl transition-all duration-300 bg-muted/30`}
              >
                <Emoji name={RPS_EMOJI[choice]} size={44} pop />
                <span className={`text-sm font-semibold ${config.text}`}>{choice}</span>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-6 rounded-2xl text-center w-full max-w-xs border border-border shadow-xl bg-gradient-to-br from-white/[0.01] to-white/[0.03]">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Your pick</p>
          <div className="flex flex-col items-center gap-2">
            <Emoji
              name={RPS_EMOJI[rpsChoices[currentUser.id].choice as keyof typeof RPS_EMOJI]}
              size={56}
              pop
            />
            <span className="text-xl font-bold text-foreground mt-1">
              {rpsChoices[currentUser.id].choice}
            </span>
          </div>
          {!roundResult && (
            <p aria-live="polite" className="text-xs text-muted-foreground mt-3">
              {onlineCount < 2
                ? "Need at least one more player online to resolve a round…"
                : "Waiting for everyone to lock in…"}
            </p>
          )}
        </div>
      )}

      <div className="w-full space-y-2 max-h-56 overflow-y-auto pr-1">
        {Object.values(rpsChoices).map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 bg-muted/30 border border-border rounded-xl shadow-sm"
          >
            <span className="font-semibold text-sm text-muted-foreground">{r.username}</span>
            <span className="text-[10px] text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/10">
              Locked In
            </span>
            <span className="ml-auto flex items-center gap-2">
              {r.username === currentUser.username || isHost ? (
                <>
                  <Emoji name={RPS_EMOJI[r.choice as keyof typeof RPS_EMOJI]} size={20} animated={false} />
                  <span className="text-xs font-semibold">{r.choice}</span>
                </>
              ) : (
                <>
                  <Emoji name="shushing_face" size={20} animated={false} />
                  <span className="text-xs text-muted-foreground">Chosen</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      {isHost && Object.keys(rpsChoices).length >= 1 && (
        <Button
          onClick={() => {
            sendActivityEvent({ kind: "rps_reset" });
          }}
          variant="outline"
          className="h-10 px-5 text-sm font-semibold border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-full transition-all"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> New Round
        </Button>
      )}
    </motion.div>
  );
}
