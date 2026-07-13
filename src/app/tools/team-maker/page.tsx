"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Shuffle,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeftRight,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn, shuffleArray } from "@/lib/utils";
import { getGameByType } from "@/lib/games";
import { Emoji, type EmojiName } from "@/components/emoji";
import { playPop, playSuccess } from "@/lib/audio";
import { toast } from "sonner";

const GameIcon = getGameByType("team-maker")!.icon;

// ── Constants ──────────────────────────────────────────────
const TEAM_COLORS: { bg: string; text: string; ring: string; label: string }[] = [
  { bg: "dark:bg-purple-500/20 bg-purple-500/10", text: "dark:text-purple-300 text-purple-700 font-medium", ring: "dark:ring-purple-500/30 ring-purple-500/20", label: "Purple" },
  { bg: "dark:bg-cyan-500/20 bg-cyan-500/10", text: "dark:text-cyan-300 text-cyan-700 font-medium", ring: "dark:ring-cyan-500/30 ring-cyan-500/20", label: "Cyan" },
  { bg: "dark:bg-emerald-500/20 bg-emerald-500/10", text: "dark:text-emerald-300 text-emerald-700 font-medium", ring: "dark:ring-emerald-500/30 ring-emerald-500/20", label: "Emerald" },
  { bg: "dark:bg-amber-500/20 bg-amber-500/10", text: "dark:text-amber-300 text-amber-800 font-medium", ring: "dark:ring-amber-500/30 ring-amber-500/20", label: "Amber" },
  { bg: "dark:bg-pink-500/20 bg-pink-500/10", text: "dark:text-pink-300 text-pink-700 font-medium", ring: "dark:ring-pink-500/30 ring-pink-500/20", label: "Pink" },
  { bg: "dark:bg-blue-500/20 bg-blue-500/10", text: "dark:text-blue-300 text-blue-700 font-medium", ring: "dark:ring-blue-500/30 ring-blue-500/20", label: "Blue" },
  { bg: "dark:bg-orange-500/20 bg-orange-500/10", text: "dark:text-orange-300 text-orange-800 font-medium", ring: "dark:ring-orange-500/30 ring-orange-500/20", label: "Orange" },
  { bg: "dark:bg-teal-500/20 bg-teal-500/10", text: "dark:text-teal-300 text-teal-700 font-medium", ring: "dark:ring-teal-500/30 ring-teal-500/20", label: "Teal" },
  { bg: "dark:bg-red-500/20 bg-red-500/10", text: "dark:text-red-300 text-red-700 font-medium", ring: "dark:ring-red-500/30 ring-red-500/20", label: "Red" },
  { bg: "dark:bg-indigo-500/20 bg-indigo-500/10", text: "dark:text-indigo-300 text-indigo-700 font-medium", ring: "dark:ring-indigo-500/30 ring-indigo-500/20", label: "Indigo" },
  { bg: "dark:bg-lime-500/20 bg-lime-500/10", text: "dark:text-lime-300 text-lime-800 font-medium", ring: "dark:ring-lime-500/30 ring-lime-500/20", label: "Lime" },
  { bg: "dark:bg-rose-500/20 bg-rose-500/10", text: "dark:text-rose-300 text-rose-700 font-medium", ring: "dark:ring-rose-500/30 ring-rose-500/20", label: "Rose" },
];

const TEMPLATES = [
  { label: "Cricket", teams: 2, perTeam: 11, icon: "cricket_game" },
  { label: "Football", teams: 2, perTeam: 11, icon: "soccer_ball" },
  { label: "Valorant", teams: 2, perTeam: 5, icon: "bullseye" },
  { label: "BGMI", teams: 4, perTeam: 4, icon: "video_game" },
  { label: "CS2", teams: 2, perTeam: 5, icon: "water_pistol" },
  { label: "Office", teams: 0, perTeam: 0, icon: "briefcase" },
] satisfies { label: string; teams: number; perTeam: number; icon: EmojiName }[];

// ── Component ──────────────────────────────────────────────
export default function TeamMakerPage() {
  const [namesInput, setNamesInput] = useState("");
  const [numTeams, setNumTeams] = useState(2);
  const [teams, setTeams] = useState<{ name: string; colorIdx: number; members: string[] }[]>([]);
  const [autoBalance, setAutoBalance] = useState(true);
  const [copied, setCopied] = useState(false);
  const [newMemberInput, setNewMemberInput] = useState<Record<number, string>>({});
  const [collapsedTeams, setCollapsedTeams] = useState<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Parse names from input
  const parsedNames = namesInput
    .split(/[\n,]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  // ── Actions ──
  const generateTeams = useCallback(() => {
    const names = parsedNames;
    if (names.length === 0) return;
    playSuccess(soundEnabled);

    const count = Math.min(numTeams, names.length);
    const shuffled = shuffleArray(names);
    const result: { name: string; colorIdx: number; members: string[] }[] = Array.from(
      { length: count },
      (_, t) => ({ name: `Team ${t + 1}`, colorIdx: t % TEAM_COLORS.length, members: [] })
    );

    if (autoBalance) {
      // Even split: deal names out so every team's size differs by at most one.
      const minPerTeam = Math.floor(names.length / count);
      const extra = names.length % count;
      let idx = 0;
      for (let t = 0; t < count; t++) {
        const size = minPerTeam + (t < extra ? 1 : 0);
        result[t].members = shuffled.slice(idx, idx + size);
        idx += size;
      }
    } else {
      // Fully random assignment: each name independently lands on a random
      // team, so team sizes are not guaranteed to be equal.
      shuffled.forEach((name) => {
        const t = Math.floor(Math.random() * count);
        result[t].members.push(name);
      });
    }

    setTeams(result);
    setCollapsedTeams(new Set());
  }, [parsedNames, numTeams, soundEnabled, autoBalance]);

  useEffect(() => {
    if (teams.length > 0) {
      setTimeout(() => {
        generateTeams();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBalance]);

  const moveMember = useCallback((fromTeam: number, toTeam: number, memberIndex: number) => {
    playPop(soundEnabled);
    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, members: [...t.members] }));
      const member = next[fromTeam].members[memberIndex];
      next[fromTeam].members.splice(memberIndex, 1);
      next[toTeam].members.push(member);
      return next;
    });
  }, [soundEnabled]);

  const removeMember = useCallback((teamIdx: number, memberIdx: number) => {
    playPop(soundEnabled);
    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, members: [...t.members] }));
      next[teamIdx].members.splice(memberIdx, 1);
      return next;
    });
  }, [soundEnabled]);

  const addMember = useCallback((teamIdx: number) => {
    const name = (newMemberInput[teamIdx] || "").trim();
    if (!name) return;
    playPop(soundEnabled);
    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, members: [...t.members] }));
      next[teamIdx].members.push(name);
      return next;
    });
    setNewMemberInput((prev) => {
      const next = { ...prev };
      delete next[teamIdx];
      return next;
    });
  }, [newMemberInput, soundEnabled]);

  const toggleCollapse = useCallback((teamIdx: number) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamIdx)) next.delete(teamIdx);
      else next.add(teamIdx);
      return next;
    });
  }, []);

  const applyTemplate = useCallback((template: (typeof TEMPLATES)[0]) => {
    if (template.label === "Office") {
      setNumTeams(2);
    } else {
      setNumTeams(template.teams);
    }
  }, []);

  const exportTeams = useCallback(() => {
    const text = teams
      .map((t) => {
        const color = TEAM_COLORS[t.colorIdx].label;
        return `[${t.name}] (${color})\n${t.members.map((m) => `  - ${m}`).join("\n")}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Failed to copy to clipboard"));
  }, [teams]);

  // ── Render ──
  return (
    <div className="relative min-h-screen" ref={containerRef}>
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) text-sm text-muted-foreground mb-6">
            <GameIcon className="w-4 h-4" />
            Team Tool
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="gradient-text">Team Maker</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build balanced teams in seconds — shuffle, customize, and export with ease.
          </p>
        </motion.div>

        {/* ── Main grid: Input + Controls | Templates ── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Input column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="lg:col-span-2 border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 space-y-5"
          >
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Player Names
              </Label>
              <Textarea
                placeholder={"Enter names, one per line or comma-separated...\n\nAlex\nJordan\nTaylor\nMorgan\nCasey\nRiley\nQuinn\nSkyler"}
                value={namesInput}
                onChange={(e) => setNamesInput(e.target.value)}
                className="min-h-[160px] resize-y"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {parsedNames.length > 0
                  ? `${parsedNames.length} name${parsedNames.length !== 1 ? "s" : ""} entered`
                  : "Enter player names above"}
              </p>
            </div>

            {/* Number of teams */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Number of Teams</Label>
                <span className="text-sm font-mono text-primary">{numTeams}</span>
              </div>
              <Slider
                value={[numTeams]}
                onValueChange={(v) => {
                  const val = Array.isArray(v) ? v[0] : v;
                  if (val !== undefined) setNumTeams(val);
                }}
                min={2}
                max={12}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>2</span>
                <span>12</span>
              </div>
            </div>

            {/* Auto-balance toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-(--surface-sunken) border border-(--border-hairline)">
              <div className="space-y-0.5">
                <Label htmlFor="auto-balance-switch" className="text-sm font-medium cursor-pointer">Auto-Balance</Label>
                <p className="text-xs text-muted-foreground">Distribute names evenly across teams</p>
              </div>
              <Switch id="auto-balance-switch" checked={autoBalance} onCheckedChange={setAutoBalance} />
            </div>
 
            {/* Sound toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-(--surface-sunken) border border-(--border-hairline)">
              <div className="space-y-0.5">
                <Label htmlFor="sound-effects-switch" className="text-sm font-medium cursor-pointer">Sound Effects</Label>
                <p className="text-xs text-muted-foreground">Play sounds when shuffling or adding players</p>
              </div>
              <Switch id="sound-effects-switch" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>

            {/* Generate button */}
            <Button
              onClick={generateTeams}
              disabled={parsedNames.length === 0}
              className="w-full h-12 text-base font-semibold bg-(image:--gradient-brand) text-primary-foreground border-2 border-(--border-strong) hover:brightness-95"
            >
              <Shuffle className="w-5 h-5 mr-2" />
              Generate Teams
              <Sparkles className="w-4 h-4 ml-2 opacity-60" />
            </Button>
          </motion.div>

          {/* Templates column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Templates
            </h2>
            <div className="grid gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  onClick={() => applyTemplate(tpl)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-(--border-hairline) bg-(--surface-sunken) hover:bg-muted hover:border-primary/20 transition-all text-left group"
                >
                  <Emoji name={tpl.icon} size={24} animated={false} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium group-hover:text-(--brand-primary-strong) transition-colors">
                      {tpl.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tpl.label === "Office"
                        ? "Custom count"
                        : `${tpl.teams} teams × ${tpl.perTeam} players`}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-(--brand-primary-strong) group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Teams output ── */}
        <AnimatePresence mode="wait">
          {teams.length > 0 && (
            <motion.div
              key="teams-container"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold mr-auto">
                  {teams.length} Team{teams.length !== 1 ? "s" : ""} ·{" "}
                  {teams.reduce((sum, t) => sum + t.members.length, 0)} Players
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportTeams}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Export
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateTeams}
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reshuffle
                </Button>
              </div>

              {/* Team cards grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {teams.map((team, teamIdx) => {
                  const color = TEAM_COLORS[team.colorIdx % TEAM_COLORS.length];
                  const isCollapsed = collapsedTeams.has(teamIdx);

                  return (
                    <motion.div
                      key={`${teamIdx}-${team.members.length}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: teamIdx * 0.08, duration: 0.3 }}
                      className={cn(
                        "border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4 space-y-3 ring-1",
                        color.ring
                      )}
                    >
                      {/* Team header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full",
                              color.bg.replace("/20", "").replace("bg-", "bg-")
                            )}
                          />
                          <h3 className={cn("font-semibold text-sm", color.text)}>
                            {team.name}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            ({team.members.length})
                          </span>
                        </div>
                        <button
                          onClick={() => toggleCollapse(teamIdx)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>

                      {/* Member list */}
                      {!isCollapsed && (
                        <motion.ul
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="space-y-1.5"
                        >
                          <AnimatePresence mode="popLayout">
                            {team.members.map((member, memberIdx) => (
                              <motion.li
                                key={`${member}-${memberIdx}`}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10, height: 0 }}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-(--surface-sunken) border border-(--border-hairline) group/member hover:bg-muted transition-colors"
                              >
                                <span className="flex-1 text-sm truncate">
                                  {member}
                                </span>
                                {/* Move to other teams */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/member:opacity-100 transition-opacity">
                                  {teams
                                    .filter((_, i) => i !== teamIdx)
                                    .slice(0, 3)
                                    .map((targetTeam) => (
                                      <button
                                        key={targetTeam.colorIdx}
                                        onClick={() => moveMember(teamIdx, teams.indexOf(targetTeam), memberIdx)}
                                        className={cn(
                                          "p-1 rounded text-xs transition-colors hover:bg-muted",
                                          TEAM_COLORS[targetTeam.colorIdx % TEAM_COLORS.length].text
                                        )}
                                        title={`Move to ${targetTeam.name}`}
                                      >
                                        <ArrowLeftRight className="w-3.5 h-3.5" />
                                      </button>
                                    ))}
                                  <button
                                    onClick={() => removeMember(teamIdx, memberIdx)}
                                    className="p-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Remove"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </motion.ul>
                      )}

                      {/* Add member */}
                      {!isCollapsed && (
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="Add player..."
                            value={newMemberInput[teamIdx] || ""}
                            onChange={(e) =>
                              setNewMemberInput((prev) => ({
                                ...prev,
                                [teamIdx]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addMember(teamIdx);
                            }}
                            className="flex-1 text-xs"
                          />
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => addMember(teamIdx)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Create Room CTA */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 text-center space-y-4"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-(--brand-primary-strong) text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  Multiplayer
                </div>
                <h2 className="text-xl font-bold">Want to collaborate live?</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Create a room and build teams together with friends in real time.
                  Everyone sees changes instantly.
                </p>
                <Link href="/create?type=team-maker">
                  <Button className="gap-2 bg-(image:--gradient-brand) text-primary-foreground border-2 border-(--border-strong) hover:brightness-95">
                    <Users className="w-4 h-4" />
                    Create Room
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state when no names entered yet */}
        {parsedNames.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <UserPlus className="w-8 h-8 text-(--brand-primary-strong)" />
            </div>
            <p className="text-muted-foreground">
              Add some names above to start building teams.
            </p>
          </motion.div>
        )}

        {/* Empty state when no teams generated yet */}
        {teams.length === 0 && parsedNames.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Shuffle className="w-8 h-8 text-(--brand-primary-strong)" />
            </div>
            <p className="text-muted-foreground">
              {parsedNames.length} name{parsedNames.length !== 1 ? "s" : ""} ready.
              Hit <span className="text-(--brand-primary-strong) font-medium">Generate Teams</span> to
              get started!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
