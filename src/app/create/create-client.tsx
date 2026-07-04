"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { RoomType } from "@/lib/types";
import { GAMES } from "@/lib/games";
import { getOrCreateRoomUser, setLocalRoomCreator } from "@/lib/room-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    e2eRoomClicked?: boolean;
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 2000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
  ]);
}

export default function CreateRoomClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams?.get("type") as RoomType | null;

  const [currentUser, setCurrentUser] = useState(getOrCreateRoomUser);
  const [selectedType, setSelectedType] = useState<RoomType>(preselected || "team-maker");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const signIn = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let sessionUser = sessionData.session?.user;

        if (!sessionUser) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          sessionUser = data?.user || undefined;
        }

        if (sessionUser) {
          setCurrentUser((prev) => {
            if (prev.id === sessionUser.id) return prev;
            const updated = { ...prev, id: sessionUser.id };
            if (typeof window !== "undefined") {
              window.localStorage.setItem("spintra-room-user", JSON.stringify(updated));
            }
            return updated;
          });
        }
      } catch (err) {
        console.error("Failed to initialize Supabase anonymous session:", err);
        const errMsg = (err as { message?: string })?.message || "";
        if (errMsg.includes("Anonymous sign-ins are disabled")) {
          toast.error(
            "Anonymous sign-ins are disabled in your Supabase project. Please enable 'Allow Anonymous Sign-ins' in your Supabase Dashboard (Settings -> Authentication)."
          );
        }
      }
    };

    signIn();
  }, []);
  const [roomName, setRoomName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    // 32-character alphabet divides 2^32 evenly, so this is unbiased.
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      const bytes = new Uint32Array(6);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => chars[b % chars.length]).join("");
    }
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const handleCreate = useCallback(async () => {
    setIsCreating(true);

    const supabase = getSupabaseBrowserClient();
    let code = generateCode();
    const gameLabel = GAMES.find((g) => g.type === selectedType)?.label || "Game";
    const finalRoomName = roomName || `${gameLabel} Room`;

    if (supabase) {
      try {
        // Regenerate on collision so we never silently reuse an existing room's code.
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: existing } = await withTimeout(
            supabase.from("rooms").select("code").eq("code", code).maybeSingle(),
            2000
          );
          if (!existing) break;
          code = generateCode();
        }

        const { error } = await withTimeout(
          supabase.from("rooms").insert({
            code,
            name: finalRoomName,
            type: selectedType,
            host_id: currentUser.id,
            is_public: isPublic,
            is_locked: false,
            max_participants: maxParticipants,
            settings: {},
          }),
          2000
        );

        if (error) throw error;
      } catch (error) {
        console.error("Failed to persist room to Supabase:", error);
        const errMsg = (error as { message?: string })?.message || "";
        toast.error(
          errMsg.toLowerCase().includes("rate limit exceeded")
            ? errMsg
            : "Couldn't create the room. Please check your connection and try again."
        );
        setIsCreating(false);
        return;
      }
    }

    const url = `${window.location.origin}/room/${code}`;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`spintra-room-type-${code}`, selectedType);
      window.localStorage.setItem(`spintra-room-name-${code}`, finalRoomName);
    }

    setCreatedRoom({ code, url });
    setLocalRoomCreator(code, currentUser.id);
    setIsCreating(false);
    toast.success(`Room ${code} created!`);
    router.push(`/room/${code}`);
  }, [currentUser.id, selectedType, roomName, isPublic, maxParticipants, router]);

  // If E2E clicks the server-rendered button, forward that click to this client handler
  useEffect(() => {
    if (typeof window !== "undefined" && window.e2eRoomClicked) {
      window.e2eRoomClicked = false;
      // Defer out of the effect body itself so the resulting setState chain
      // (inside handleCreate) isn't triggered synchronously during the effect.
      setTimeout(() => handleCreate(), 0);
    }

    const el = document.querySelector('[data-testid="create-room-button"]');
    if (!el) return;
    const onClick = (e: Event) => {
      e.preventDefault();
      handleCreate();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [handleCreate]);

  const copyToClipboard = async () => {
    if (!createdRoom) return;
    await navigator.clipboard.writeText(createdRoom.url);
    setCopied(true);
    toast.success("Room link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const joinRoom = () => {
    if (!createdRoom) return;
    router.push(`/room/${createdRoom.code}`);
  };

  const selectedGame = GAMES.find((game) => game.type === selectedType);
  const SelectedGameIcon = selectedGame?.icon;

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Room Types */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Choose Game Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {GAMES.map((rt, i) => (
            <motion.button
              key={rt.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedType(rt.type)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                selectedType === rt.type
                  ? "glass-card border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/10"
                  : "glass-card border-border hover:border-foreground/20"
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
                maxLength={60}
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="public" className="cursor-pointer">Public Room</Label>
              <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="max-participants-slider">Max Participants</Label>
                <span className="text-sm font-semibold text-purple-400">{maxParticipants}</span>
              </div>
              <Slider
                id="max-participants-slider"
                min={2}
                max={50}
                value={[maxParticipants]}
                onValueChange={(v) => setMaxParticipants(Array.isArray(v) ? v[0] : v)}
                className="mt-2"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Selected Game
              </Label>
              {selectedGame && SelectedGameIcon && (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${selectedGame.color}`}
                  >
                    <SelectedGameIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{selectedGame.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedGame.desc}</p>
                  </div>
                </div>
              )}
            </div>

            {!createdRoom ? (
              <Button
                onClick={handleCreate}
                data-testid="create-room-button-client"
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
                  <p data-testid="created-room-badge" className="text-sm font-medium text-emerald-400 mb-1">Room Created!</p>
                  <p className="text-2xl font-bold tracking-wider text-foreground">{createdRoom.code}</p>
                </div>

                <Button
                  onClick={copyToClipboard}
                  data-testid="copy-link-button"
                  variant="outline"
                  className="w-full border-border"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>

                <Button
                  onClick={joinRoom}
                  data-testid="join-room-button"
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
  );
}
