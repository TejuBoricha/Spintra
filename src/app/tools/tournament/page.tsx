"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Trophy,
  Swords,
  Users,
  Share2,
  RotateCcw,
  Crown,
  ArrowRight,
  Check,
  LayoutTemplate,
  Volume2,
  VolumeX,
} from "lucide-react";
import { playPop, playSuccess } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChipGroup } from "@/components/ui/chip-group";
import { toast } from "sonner";
import type { TournamentType } from "@/lib/types";
import { Emoji } from "@/components/emoji";
import { fireConfetti, CelebrationBanner } from "@/components/celebration";
import { getGameByType } from "@/lib/games";
import {
  type BracketMatch,
  type Tournament,
  type MatchRef,
  generateBracketForType,
  recordMatchResult,
} from "@/lib/tournament-engine";

const GameIcon = getGameByType("tournament")!.icon;

// ──── Templates ────
const TEMPLATES: Record<
  string,
  { names: string[]; type: TournamentType; seeds: string[] }
> = {
  "8-player-single": {
    names: ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"],
    type: "single-elimination",
    seeds: ["Alpha", "Bravo"],
  },
  "16-player-single": {
    names: Array.from({ length: 16 }, (_, i) => `Player ${i + 1}`),
    type: "single-elimination",
    seeds: ["Player 1", "Player 2", "Player 3", "Player 4"],
  },
  "4-team-rr": {
    names: ["Team Alpha", "Team Bravo", "Team Charlie", "Team Delta"],
    type: "round-robin",
    seeds: [],
  },
  "8-player-double": {
    names: ["Ace", "Blaze", "Cipher", "Drift", "Ember", "Frost", "Ghost", "Hawk"],
    type: "double-elimination",
    seeds: ["Ace", "Blaze"],
  },
  "8-player-swiss": {
    names: Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`),
    type: "swiss",
    seeds: [],
  },
};

// ──── Score Editor Dialog ────
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
        className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 w-full max-w-sm"
      >
        <h3 className="text-lg font-bold mb-4 text-center">Update Score</h3>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold mb-2 truncate">
              {match.player1 || "TBD"}
            </p>
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
            <p className="text-sm font-semibold mb-2 truncate">
              {match.player2 || "TBD"}
            </p>
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
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(score1, score2)}
            className="flex-1 border-2 border-(--border-strong) bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-95"
          >
            <Check className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ──── Match Card ────
function MatchCard({
  match,
  onClick,
  compact = false,
}: {
  match: BracketMatch;
  onClick?: () => void;
  compact?: boolean;
}) {
  const isBye1 = match.player1 === "BYE";
  const isBye2 = match.player2 === "BYE";
  const isBye = isBye1 || isBye2;

  const statusColors = {
    pending: "border-(--border-hairline) bg-(--surface-sunken)",
    "in-progress": "border-amber-500/30 bg-amber-500/5",
    completed: "border-emerald-500/30 bg-emerald-500/5",
  };

  const statusDot = {
    pending: "bg-muted-foreground/40",
    "in-progress": "bg-amber-400",
    completed: "bg-emerald-400",
  };

  return (
    <motion.div
      whileHover={onClick && !isBye ? { scale: 1.02 } : undefined}
      onClick={isBye ? undefined : onClick}
      data-testid="tournament-match"
      data-match-status={match.status}
      data-match-ready={!!(match.player1 && match.player2 && !isBye)}
      className={`
        rounded-lg border px-3 py-2 cursor-pointer transition-colors
        ${statusColors[match.status]}
        ${onClick && !isBye ? "hover:border-emerald-500/40" : ""}
        ${isBye ? "cursor-default" : ""}
        ${compact ? "text-xs" : "text-sm"}
      `}
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
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[match.status]}`} />
          <span className={match.status === "completed" ? "text-emerald-400" : "text-amber-400"}>
            {match.winner} won
          </span>
        </div>
      )}
    </motion.div>
  );
}


// ──── Main Component ────
export default function TournamentPage() {
  const [textInput, setTextInput] = useState("");
  const [seedInput, setSeedInput] = useState("");
  const [tournamentType, setTournamentType] = useState<TournamentType>("single-elimination");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [editingMatch, setEditingMatch] = useState<MatchRef | null>(null);

  const participants = useMemo(
    () =>
      textInput
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    [textInput]
  );

  const seeds = useMemo(
    () =>
      seedInput
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    [seedInput]
  );

  const generateBracket = useCallback(() => {
    if (participants.length < 2) {
      toast.error("Need at least 2 participants!");
      return;
    }
    playSuccess(soundEnabled);

    // type may differ from tournamentType (silently downgraded for <3
    // players) — must use the returned value, not the original UI
    // selection, or recordMatchResult takes the wrong branch against
    // bracket data shaped for a different format.
    const { type, rounds, losersBracket } = generateBracketForType(tournamentType, participants, seeds);

    setTournament({
      type,
      rounds,
      participants,
      seeds,
      currentRound: 1,
      winner: null,
      losersBracket,
    });

    toast.success("Bracket generated!");
  }, [participants, seeds, tournamentType, soundEnabled]);

  const handleScoreSave = useCallback(
    (s1: number, s2: number) => {
      if (!editingMatch || !tournament) return;

      const outcome = recordMatchResult(tournament, editingMatch, s1, s2);

      if (outcome.kind === "invalid") {
        toast.error(outcome.message);
        return;
      }

      if (outcome.kind === "advanced" && !outcome.winner) {
        playPop(soundEnabled);
      } else {
        playSuccess(soundEnabled);
      }

      setTournament(outcome.tournament);
      setEditingMatch(null);

      if (outcome.kind === "champion") {
        fireConfetti();
        toast.success(`${outcome.winner} wins the tournament!`, { icon: <Emoji name="trophy" size={18} /> });
        return;
      }
      if (outcome.kind === "grand-final-set") {
        toast.success("Grand Final is set!");
        return;
      }
      toast.success(outcome.winner ? `${outcome.winner} advances!` : "Draw recorded!");
    },
    [editingMatch, tournament, soundEnabled]
  );

  const applyTemplate = useCallback((key: string) => {
    const t = TEMPLATES[key];
    if (!t) return;
    setTextInput(t.names.join("\n"));
    setSeedInput(t.seeds.join("\n"));
    setTournamentType(t.type);
    setTournament(null);
    toast.success(`${key.replace(/-/g, " ")} template loaded!`);
  }, []);

  const shareBracket = useCallback(async () => {
    if (!tournament) {
      toast.error("Generate a bracket first!");
      return;
    }

    const lines: string[] = [
      `🏆 Spintra Tournament Bracket`,
      `Type: ${tournament.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      `Participants: ${tournament.participants.length}`,
      "",
    ];

    tournament.rounds.forEach((round, ri) => {
      if (round.every((m) => !m.player1 && !m.player2)) return;
      lines.push(`Round ${ri + 1}:`);
      round.forEach((m) => {
        if (m.player1 || m.player2) {
          const s1 = m.score1 !== null ? m.score1 : "-";
          const s2 = m.score2 !== null ? m.score2 : "-";
          lines.push(
            `  ${m.player1 || "TBD"} ${s1} - ${s2} ${m.player2 || "TBD"}${m.winner ? ` → ${m.winner}` : ""}`
          );
        }
      });
      lines.push("");
    });

    if (tournament.winner) {
      lines.push(`🏆 Champion: ${tournament.winner}`);
    }

    lines.push("");
    lines.push("Powered by Spintra — spintra.io");

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Bracket copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  }, [tournament]);

  const completedMatches = useMemo(() => {
    if (!tournament) return 0;
    let count = 0;
    tournament.rounds.forEach((r) =>
      r.forEach((m) => {
        if (m.status === "completed") count++;
      })
    );
    if (tournament.losersBracket) {
      tournament.losersBracket.forEach((r) =>
        r.forEach((m) => {
          if (m.status === "completed") count++;
        })
      );
    }
    return count;
  }, [tournament]);

  const totalMatches = useMemo(() => {
    if (!tournament) return 0;
    let count = 0;
    tournament.rounds.forEach((r) => (count += r.length));
    if (tournament.losersBracket) {
      tournament.losersBracket.forEach((r) => (count += r.length));
    }
    return count;
  }, [tournament]);

  // ──── Render bracket ────
  const renderSingleEliminationBracket = (rounds: BracketMatch[][], bracketKey: "rounds" | "losersBracket" = "rounds") => {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {rounds.map((round, ri) => {
          const hasAnyData = round.some((m) => m.player1 || m.player2);
          if (!hasAnyData && ri > 0) return null;

          return (
            <div key={ri} className="flex flex-col justify-center gap-2 min-w-[180px]">
              <div className="text-xs text-muted-foreground text-center font-semibold uppercase tracking-wider mb-1">
                {ri === rounds.length - 1 ? "Final" : ri === rounds.length - 2 ? "Semi" : `R${ri + 1}`}
              </div>
              {round.map((match, mi) => (
                <div
                  key={match.id}
                  style={{
                    marginTop:
                      ri > 0
                        ? `${mi * Math.pow(2, ri) * 20 + (Math.pow(2, ri) - 1) * 4}px`
                        : undefined,
                  }}
                >
                  <MatchCard
                    match={match}
                    compact={round.length > 8}
                    onClick={() =>
                      setEditingMatch({ match, roundIdx: ri, position: mi, bracketKey })
                    }
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderRoundRobin = (rounds: BracketMatch[][]) => {
    const allMatches = rounds.flat();
    if (allMatches.length === 0) return null;

    // Calculate standings
    const standings = new Map<string, { wins: number; losses: number; draws: number }>();
    tournament?.participants.forEach((p) => standings.set(p, { wins: 0, losses: 0, draws: 0 }));

    allMatches.forEach((m) => {
      if (m.status === "completed" && m.score1 !== null && m.score2 !== null) {
        const p1 = m.player1!;
        const p2 = m.player2!;
        if (m.score1 > m.score2) {
          standings.get(p1)!.wins++;
          standings.get(p2)!.losses++;
        } else if (m.score2 > m.score1) {
          standings.get(p2)!.wins++;
          standings.get(p1)!.losses++;
        } else {
          standings.get(p1)!.draws++;
          standings.get(p2)!.draws++;
        }
      }
    });

    const sorted = [...standings.entries()].sort(
      (a, b) => b[1].wins * 3 + b[1].draws - (a[1].wins * 3 + a[1].draws)
    );

    return (
      <div className="space-y-6">
        {/* Standings */}
        <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Standings
          </h3>
          <div className="space-y-1">
            {sorted.map(([name, record], i) => (
              <div
                key={name}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-(--surface-sunken) border border-(--border-hairline)"
              >
                <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                  #{i + 1}
                </span>
                <span className="text-sm font-medium flex-1">{name}</span>
                <span className="text-xs text-muted-foreground">
                  {record.wins}W {record.losses}L {record.draws}D
                </span>
                <span className="text-xs font-bold text-emerald-400 ml-2">
                  {record.wins * 3 + record.draws} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Matches grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {allMatches.map((match, i) => (
            <MatchCard
              key={match.id}
              match={match}
              compact
              onClick={() =>
                setEditingMatch({ match, roundIdx: 0, position: i, bracketKey: "rounds" })
              }
            />
          ))}
        </div>
      </div>
    );
  };

  const renderSwiss = (rounds: BracketMatch[][]) => {
    return (
      <div className="space-y-4">
        {rounds.map((round, ri) => (
          <div key={ri} className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Round {ri + 1}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {round.map((match, mi) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  compact
                  onClick={() =>
                    !match.player1?.includes("BYE") && !match.player2?.includes("BYE")
                      ? setEditingMatch({ match, roundIdx: ri, position: mi, bracketKey: "rounds" })
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) text-sm mb-4">
            <GameIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-muted-foreground">Bracket Generator</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black mb-3">
            Tournament{" "}
            <span className="gradient-text">Generator</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Create professional brackets for any tournament format. Single elim,
            double elim, round robin, or Swiss.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Panel: Setup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            {/* Tournament Type */}
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Format
                </h2>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Sound On" : "Sound Off"}
                  aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
                  className="p-1 rounded-control hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
              </div>
              <ChipGroup
                ariaLabel="Tournament format"
                value={tournamentType}
                onChange={(v) => {
                  setTournamentType(v as TournamentType);
                  setTournament(null);
                }}
                options={[
                  { value: "single-elimination", label: "Single Elim" },
                  { value: "double-elimination", label: "Double Elim" },
                  { value: "round-robin", label: "Round Robin" },
                  { value: "swiss", label: "Swiss" },
                ]}
              />
            </div>

            {/* Participants */}
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Participants
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {participants.length}
                </Badge>
              </div>

              <Textarea
                placeholder="Enter participant names, one per line...&#10;Alpha&#10;Bravo&#10;Charlie&#10;Delta"
                className="min-h-[120px] resize-y font-mono text-sm"
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  setTournament(null);
                }}
              />

              {/* Seeds Input */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Seeds (one per line, top seed first)
                </p>
                <Input
                  placeholder="Alpha&#10;Bravo"
                  className="font-mono text-sm min-h-[44px]"
                  value={seedInput}
                  onChange={(e) => {
                    setSeedInput(e.target.value);
                    setTournament(null);
                  }}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={generateBracket}
                disabled={participants.length < 2}
                className="w-full border-2 border-(--border-strong) bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25"
              >
                <Swords className="w-4 h-4 mr-2" />
                Generate Bracket
              </Button>
            </div>

            {/* Templates */}
            <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Templates
              </h2>
              <div className="space-y-2">
                {Object.entries(TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border border-(--border-hairline) bg-(--surface-sunken) hover:bg-muted hover:border-emerald-500/30 transition-colors text-sm"
                  >
                    <LayoutTemplate className="w-4 h-4 text-emerald-400/60 shrink-0" />
                    <span className="flex-1 capitalize">
                      {key.replace(/-/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.names.length}p
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Create Room CTA */}
            <Link href="/create?type=tournament">
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-emerald-500/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Play with Friends</p>
                    <p className="text-xs text-muted-foreground">
                      Create a multiplayer room
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </motion.div>

          {/* Right Panel: Bracket View */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-3 space-y-6"
          >
            {!tournament ? (
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-12 flex flex-col items-center justify-center min-h-[400px]">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-6"
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                    <Trophy className="w-12 h-12 text-emerald-400/50" />
                  </div>
                </motion.div>
                <p className="text-lg font-semibold text-muted-foreground mb-1">
                  No Bracket Yet
                </p>
                <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
                  Add participants, pick a format, and generate your bracket
                </p>
              </div>
            ) : (
              <>
                {/* Tournament Header */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold capitalize">
                        {tournament.type.replace(/-/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tournament.participants.length} players · {tournament.rounds.length} rounds
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Progress */}
                    {totalMatches > 0 && (
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-(--surface-sunken) overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.round((completedMatches / totalMatches) * 100)}%`,
                            }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {completedMatches}/{totalMatches}
                        </span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={shareBracket}
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1" />
                      Share
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTournament(null)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>

                {/* Champion Banner */}
                {tournament.winner && (
                  <CelebrationBanner
                    icon={<Crown className="w-12 h-12 text-amber-400" />}
                    title={tournament.winner}
                    subtitle={<><Emoji name="trophy" size={20} pop /> Tournament Champion</>}
                    titleClassName="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 bg-clip-text text-transparent"
                  />
                )}

                {/* Bracket Display */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 overflow-x-auto"
                >
                  {tournament.type === "single-elimination" &&
                    renderSingleEliminationBracket(tournament.rounds)}
                  {tournament.type === "double-elimination" && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Winners Bracket
                        </h3>
                        {renderSingleEliminationBracket(tournament.rounds, "rounds")}
                      </div>
                      {tournament.losersBracket && (
                        <div>
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Losers Bracket
                          </h3>
                          {renderSingleEliminationBracket(tournament.losersBracket, "losersBracket")}
                        </div>
                      )}
                      {tournament.grandFinal && (
                        <div>
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Grand Final
                          </h3>
                          <div className="max-w-[220px]">
                            <MatchCard
                              match={tournament.grandFinal}
                              onClick={() =>
                                setEditingMatch({
                                  match: tournament.grandFinal!,
                                  roundIdx: 0,
                                  position: 0,
                                  bracketKey: "grandFinal",
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {tournament.type === "round-robin" && renderRoundRobin(tournament.rounds)}
                  {tournament.type === "swiss" && renderSwiss(tournament.rounds)}
                </motion.div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Score Editor Modal */}
      <AnimatePresence>
        {editingMatch && (
          <ScoreEditor
            match={editingMatch.match}
            onSave={handleScoreSave}
            onClose={() => setEditingMatch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
