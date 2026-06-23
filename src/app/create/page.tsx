"use client";

import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Users, Disc3, UserRoundPen, Trophy, Coins, Dice1, Hash, Sword, MessageCircleQuestion, Split, HeartHandshake, Gift, PartyPopper, GraduationCap, Copy, QrCode, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { RoomType } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roomTypes: { type: RoomType; label: string; icon: React.ComponentType<{ className?: string }>; color: string; desc: string }[] = [
  { type: "team-maker", label: "Team Maker", icon: Users, color: "from-purple-500 to-pink-500", desc: "Build balanced teams together" },
  { type: "lucky-wheel", label: "Lucky Wheel", icon: Disc3, color: "from-cyan-500 to-blue-500", desc: "Spin and win together" },
  { type: "name-draw", label: "Name Draw", icon: UserRoundPen, color: "from-amber-500 to-orange-500", desc: "Pick random winners" },
  { type: "tournament", label: "Tournament", icon: Trophy, color: "from-emerald-500 to-teal-500", desc: "Run competitive brackets" },
  { type: "coin-flip", label: "Coin Flip", icon: Coins, color: "from-yellow-500 to-amber-500", desc: "Heads or tails" },
  { type: "dice", label: "Dice Roller", icon: Dice1, color: "from-red-500 to-rose-500", desc: "Roll any dice" },
  { type: "guess-number", label: "Guess Number", icon: Hash, color: "from-blue-500 to-indigo-500", desc: "Number guessing game" },
  { type: "rps", label: "Rock Paper Scissors", icon: Sword, color: "from-orange-500 to-red-500", desc: "Classic showdown" },
  { type: "truth-or-dare", label: "Truth or Dare", icon: MessageCircleQuestion, color: "from-pink-500 to-rose-500", desc: "Spicy questions" },
  { type: "would-you-rather", label: "Would You Rather", icon: Split, color: "from-indigo-500 to-purple-500", desc: "Tough choices" },
  { type: "never-have-i-ever", label: "Never Have I Ever", icon: HeartHandshake, color: "from-violet-500 to-purple-500", desc: "Group confessions" },
  { type: "party", label: "Party Mode", icon: PartyPopper, color: "from-fuchsia-500 to-pink-500", desc: "All games unlocked" },
  { type: "classroom", label: "Classroom", icon: GraduationCap, color: "from-sky-500 to-cyan-500", desc: "Educational activities" },
];

export default function CreateRoomPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-24 flex items-center justify-center"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CreateRoomPage />
    </Suspense>
  );
}

function CreateRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("type") as RoomType | null;

  const [selectedType, setSelectedType] = useState<RoomType>(preselected || "team-maker");
  const [roomName, setRoomName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const handleCreate = async () => {
    setIsCreating(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    const code = generateCode();
    const url = `spintra.com/room/${code}`;
    setCreatedRoom({ code, url });
    setIsCreating(false);
    toast.success("Room created!");
  };

  const copyToClipboard = async () => {
    if (!createdRoom) return;
    await navigator.clipboard.writeText(createdRoom.url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const joinRoom = () => {
    if (!createdRoom) return;
    router.push(`/room/${createdRoom.code}`);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Create a <span className="gradient-text">Room</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Pick a game type, set up your room, and invite people in seconds.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Room Types */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Choose Game Type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {roomTypes.map((rt, i) => (
                <motion.button
                  key={rt.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedType(rt.type)}
                  className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                    selectedType === rt.type
                      ? "glass-card border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/10"
                      : "glass-card border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${rt.color} flex items-center justify-center mb-2`}>
                    <rt.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm font-semibold">{rt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{rt.desc}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Settings Panel */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-6">Room Settings</h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="room-name">Room Name (optional)</Label>
                  <Input
                    id="room-name"
                    placeholder="My Awesome Room"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="public" className="cursor-pointer">Public Room</Label>
                  <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
                </div>

                <div>
                  <Label>Max Participants: {maxParticipants}</Label>
                  <input
                    type="range"
                    min={2}
                    max={50}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full mt-2 accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>2</span>
                    <span>50</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      <div className={`w-6 h-6 rounded bg-gradient-to-br ${roomTypes.find((r) => r.type === selectedType)?.color} flex items-center justify-center mr-1.5`}>
                        {(() => {
                          const Icon = roomTypes.find((r) => r.type === selectedType)?.icon;
                          return Icon ? <Icon className="w-3.5 h-3.5 text-white" /> : null;
                        })()}
                      </div>
                      {roomTypes.find((r) => r.type === selectedType)?.label}
                    </Badge>
                  </div>
                </div>

                {!createdRoom ? (
                  <Button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0 h-12"
                  >
                    {isCreating ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <Sparkles className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Create Room
                      </>
                    )}
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-sm font-medium text-emerald-400 mb-1">Room Created!</p>
                      <p className="text-2xl font-bold tracking-wider text-white">{createdRoom.code}</p>
                    </div>

                    <Button
                      onClick={copyToClipboard}
                      variant="outline"
                      className="w-full border-white/10"
                    >
                      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>

                    <Button
                      onClick={joinRoom}
                      className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0"
                    >
                      Join Room
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
