"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Trophy, Crown, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { TournamentType } from "@/lib/types";
import { Emoji } from "@/components/emoji";
import { fireConfetti, CelebrationBanner } from "@/components/celebration";
import { playPop, playSuccess } from "@/lib/audio";
import { useRoomActivity, useRoomParticipants } from "../context/room-activity-context";
import {
  type BracketMatch,
  type Tournament,
  type MatchRef,
  generateBracketForType,
  recordMatchResult,
} from "@/lib/tournament-engine";

function MatchCard({
  match,
  onClick,
}: {
  match: BracketMatch;
  onClick?: () => void;
}) {
  const isBye = match.player1 === "BYE" || match.player2 === "BYE";
  const statusColors = {
    pending: "border-border bg-muted/30",
    "in-progress": "border-amber-500/30 bg-amber-500/5",
    completed: "border-emerald-500/30 bg-emerald-500/5",
  };

  return (
    <motion.div
      whileHover={onClick && !isBye ? { scale: 1.02 } : undefined}
      onClick={isBye ? undefined : onClick}
      data-testid="tournament-match"
      data-match-status={match.status}
      data-match-ready={!!(match.player1 && match.player2 && !isBye)}
      className={`rounded-lg border px-3 py-2 text-xs transition-colors ${statusColors[match.status]} ${
        onClick && !isBye ? "cursor-pointer hover:border-amber-500/40" : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="truncate flex-1 font-medium">
          {match.player1 || <span className="text-muted-foreground italic">TBD</span>}
        </span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {match.score1 !== null ? match.score1 : "-"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate flex-1 font-medium">
          {match.player2 || <span className="text-muted-foreground italic">TBD</span>}
        </span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {match.score2 !== null ? match.score2 : "-"}
        </span>
      </div>
      {match.winner && (
        <div className="mt-1 text-[11px] text-amber-400">{match.winner} won</div>
      )}
    </motion.div>
  );
}

function ScoreEditor({
  match,
  onSave,
  onClose,
}: {
  match: BracketMatch;
  onSave: (s1: number, s2: number) => void;
  onClose: () => void;
}) {
  const [score1, setScore1] = useState(match.score1 ?? 0);
  const [score2, setScore2] = useState(match.score2 ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card p-6 w-full max-w-sm"
      >
        <h3 className="text-lg font-bold mb-4 text-center">Update Score</h3>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold mb-2 truncate">{match.player1 || "TBD"}</p>
            <Input
              type="number"
              min={0}
              value={score1}
              onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
              className="w-20 mx-auto text-center text-lg font-bold"
            />
          </div>
          <span className="text-muted-foreground font-bold mt-6">vs</span>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold mb-2 truncate">{match.player2 || "TBD"}</p>
            <Input
              type="number"
              min={0}
              value={score2}
              onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
              className="w-20 mx-auto text-center text-lg font-bold"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 glass border-border">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(score1, score2)}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
          >
            <Check className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BracketColumns({
  rounds,
  onMatchClick,
}: {
  rounds: BracketMatch[][];
  onMatchClick?: (match: BracketMatch, roundIdx: number, position: number) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {rounds.map((round, ri) => {
        const hasAnyData = round.some((m) => m.player1 || m.player2);
        if (!hasAnyData && ri > 0) return null;
        return (
          <div key={ri} className="flex flex-col justify-center gap-2 min-w-[160px]">
            <div className="text-[10px] text-muted-foreground text-center font-semibold uppercase tracking-wider mb-1">
              {ri === rounds.length - 1 ? "Final" : ri === rounds.length - 2 ? "Semi" : `R${ri + 1}`}
            </div>
            {round.map((match, mi) => (
              <MatchCard
                key={match.id}
                match={match}
                onClick={onMatchClick ? () => onMatchClick(match, ri, mi) : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function TournamentActivity() {
  const { isHost, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();
  const { participants } = useRoomParticipants();
  const [tournamentType, setTournamentType] = useState<TournamentType>("single-elimination");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [editingMatch, setEditingMatch] = useState<MatchRef | null>(null);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "tournament_update") {
        setTournament(event.tournament);
        if (event.outcome === "champion") {
          fireConfetti();
          toast.success(`${event.tournament.winner} wins the tournament!`, {
            icon: <Emoji name="trophy" size={18} />,
          });
        } else if (event.outcome === "grand-final-set") {
          toast.success("Grand Final is set!");
        }
      } else if (event.kind === "activity_reset") {
        setTournament(null);
        setEditingMatch(null);
      }
    });
  }, [registerEventListener]);

  const generateBracket = useCallback(() => {
    const names = participants.filter((p) => p.is_online).map((p) => p.user?.username || "Guest");
    if (names.length < 2) {
      toast.error("Need at least 2 online participants!");
      return;
    }

    const { rounds, losersBracket } = generateBracketForType(tournamentType, names, []);
    const next: Tournament = {
      type: tournamentType,
      rounds,
      participants: names,
      seeds: [],
      currentRound: 1,
      winner: null,
      losersBracket,
    };
    sendActivityEvent({ kind: "tournament_update", tournament: next });
  }, [participants, tournamentType, sendActivityEvent]);

  const handleScoreSave = useCallback(
    (s1: number, s2: number) => {
      if (!editingMatch || !tournament) return;

      const outcome = recordMatchResult(tournament, editingMatch, s1, s2);
      setEditingMatch(null);

      if (outcome.kind === "invalid") {
        toast.error(outcome.message);
        return;
      }

      if (outcome.kind === "advanced" && !outcome.winner) {
        playPop(soundEnabled);
      } else {
        playSuccess(soundEnabled);
      }

      sendActivityEvent({
        kind: "tournament_update",
        tournament: outcome.tournament,
        outcome: outcome.kind === "advanced" ? "advanced" : outcome.kind,
      });
    },
    [editingMatch, tournament, soundEnabled, sendActivityEvent]
  );

  return (
    <motion.div
      key="tournament"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 max-w-3xl mx-auto pt-8 w-full"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Swords className="w-6 h-6 text-amber-500" /> Tournament Bracket
      </h2>

      {!tournament && isHost && (
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format</p>
          <Tabs value={tournamentType} onValueChange={(v) => setTournamentType(v as TournamentType)}>
            <TabsList className="w-full">
              <TabsTrigger value="single-elimination" className="flex-1 text-xs">Single Elim</TabsTrigger>
              <TabsTrigger value="double-elimination" className="flex-1 text-xs">Double Elim</TabsTrigger>
              <TabsTrigger value="round-robin" className="flex-1 text-xs">Round Robin</TabsTrigger>
              <TabsTrigger value="swiss" className="flex-1 text-xs">Swiss</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {!tournament ? (
        <div className="glass-card p-12 rounded-3xl text-center w-full border border-border shadow-xl">
          <p className="mb-4 flex justify-center">
            <Emoji name="trophy" size={48} />
          </p>
          <p className="text-muted-foreground font-medium">
            {isHost
              ? "Pick a format above, then generate the bracket from everyone currently online."
              : "Waiting for host to set up the bracket…"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {tournament.winner && (
            <CelebrationBanner
              icon={<Crown className="w-12 h-12 text-amber-400" />}
              title={tournament.winner}
              subtitle={<><Emoji name="trophy" size={20} pop /> Tournament Champion</>}
              titleClassName="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 bg-clip-text text-transparent"
            />
          )}

          <div className="glass-card p-4 overflow-x-auto">
            {tournament.type === "single-elimination" && (
              <BracketColumns
                rounds={tournament.rounds}
                onMatchClick={
                  isHost
                    ? (match, roundIdx, position) =>
                        setEditingMatch({ match, roundIdx, position, bracketKey: "rounds" })
                    : undefined
                }
              />
            )}

            {tournament.type === "double-elimination" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Winners Bracket
                  </h3>
                  <BracketColumns
                    rounds={tournament.rounds}
                    onMatchClick={
                      isHost
                        ? (match, roundIdx, position) =>
                            setEditingMatch({ match, roundIdx, position, bracketKey: "rounds" })
                        : undefined
                    }
                  />
                </div>
                {tournament.losersBracket && (
                  <div>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Losers Bracket
                    </h3>
                    <BracketColumns
                      rounds={tournament.losersBracket}
                      onMatchClick={
                        isHost
                          ? (match, roundIdx, position) =>
                              setEditingMatch({ match, roundIdx, position, bracketKey: "losersBracket" })
                          : undefined
                      }
                    />
                  </div>
                )}
                {tournament.grandFinal && (
                  <div>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Grand Final
                    </h3>
                    <div className="max-w-[200px]">
                      <MatchCard
                        match={tournament.grandFinal}
                        onClick={
                          isHost
                            ? () =>
                                setEditingMatch({
                                  match: tournament.grandFinal!,
                                  roundIdx: 0,
                                  position: 0,
                                  bracketKey: "grandFinal",
                                })
                            : undefined
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {(tournament.type === "round-robin" || tournament.type === "swiss") && (
              <div className="space-y-4">
                {tournament.rounds.map((round, ri) => (
                  <div key={ri}>
                    {tournament.type === "swiss" && (
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Round {ri + 1}
                      </h3>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {round.map((match, mi) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          onClick={
                            isHost && match.player1 !== "BYE" && match.player2 !== "BYE"
                              ? () => setEditingMatch({ match, roundIdx: ri, position: mi, bracketKey: "rounds" })
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isHost && (
            <Button
              variant="outline"
              onClick={() => sendActivityEvent({ kind: "activity_reset" })}
              className="w-full glass border-border"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Start a New Bracket
            </Button>
          )}
        </div>
      )}

      {!tournament && isHost && (
        <Button
          onClick={generateBracket}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white border-0 rounded-full h-11 font-bold shadow-lg shadow-amber-500/10"
        >
          <Trophy className="w-4 h-4 mr-2" /> Generate Bracket
        </Button>
      )}

      <AnimatePresence>
        {editingMatch && (
          <ScoreEditor
            match={editingMatch.match}
            onSave={handleScoreSave}
            onClose={() => setEditingMatch(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
