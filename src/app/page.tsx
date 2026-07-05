"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ArrowRight, Sparkles, Zap, Globe, MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrCreateRoomUser } from "@/lib/room-user";
import dynamic from "next/dynamic";
const HeroThreeScene = dynamic(() => import("@/components/landing/hero-scene").then((m) => m.HeroThreeScene), {
  ssr: false,
});
import { FeatureCard } from "@/components/landing/feature-card";
import { AuroraBackground } from "@/components/landing/aurora-bg";
import { GAMES } from "@/lib/games";

const heroFeatures = GAMES.map((game) => ({
  title: game.label,
  description: game.featureDescription,
  icon: game.icon,
  href: game.href,
  gradient: game.color,
  stats: game.stats,
}));

const perks = [
  { icon: Zap, label: "Instant Rooms", desc: "Create in seconds, join in milliseconds" },
  { icon: Globe, label: "Global Multiplayer", desc: "Real-time sync across the world" },
  { icon: MessageCircle, label: "Built-in Chat", desc: "Emoji-rich real-time chat in every room" },
  { icon: Star, label: "Viral Sharing", desc: "Share rooms via link or QR code" },
];

export default function HomePage() {
  const router = useRouter();
  const [currentUser] = useState(getOrCreateRoomUser);
  const [homeCode, setHomeCode] = useState("");
  const [homeJoining, setHomeJoining] = useState(false);

  const handleHomeJoin = useCallback(async () => {
    if (homeCode.length !== 6) return;
    setHomeJoining(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("is_locked, max_participants, host_id")
          .eq("code", homeCode)
          .maybeSingle();

        if (roomError || !room) {
          toast.error("Room code not found. Please double check.");
          setHomeJoining(false);
          return;
        }

        const isRoomHost = room.host_id === currentUser.id;

        // Check if user is already a participant of this room (for reconnects)
        const { data: existingPart } = await supabase
          .from("room_participants")
          .select("id")
          .eq("room_id", homeCode)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        const isRegistered = !!existingPart;

        // If the user is NEITHER the host NOR already registered, check restrictions
        if (!isRoomHost && !isRegistered) {
          // Ban check — must come before the "Joining room…" toast
          const { data: ban } = await supabase
            .from("room_bans")
            .select("id")
            .eq("room_id", homeCode)
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (ban) {
            toast.error("You have been removed from this room by the host and cannot rejoin.");
            setHomeJoining(false);
            return;
          }

          if (room.is_locked) {
            toast.error("This room is locked by the host.");
            setHomeJoining(false);
            return;
          }

          const { data: parts } = await supabase
            .from("room_participants")
            .select("id")
            .eq("room_id", homeCode);

          if (parts && parts.length >= room.max_participants) {
            toast.error("This room is full.");
            setHomeJoining(false);
            return;
          }
        }
      }

      toast.success("Joining room...");
      router.push(`/room/${homeCode}`);
    } catch (err) {
      console.error("Failed to join room from homepage:", err);
      toast.error("Unable to join room. Please try again.");
    } finally {
      setHomeJoining(false);
    }
  }, [homeCode, router, currentUser.id]);

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  return (
    <div ref={containerRef} className="relative">
      {/* Aurora Gradient Background */}
      <AuroraBackground />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* 3D Scene Background */}
        <div className="absolute inset-0 z-0">
          <HeroThreeScene />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background z-[1]" />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 max-w-5xl mx-auto px-4 py-20 text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-muted-foreground">Multiplayer platform for</span>
            <span className="text-foreground font-medium">Decisions. Games. Teams.</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            Turn Every{" "}
            <span className="gradient-text">Decision</span>
            <br />
            Into an Experience.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Create rooms, invite friends, spin wheels, draw names, build teams,
            run tournaments, and play together in real time.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/create">
              <Button
                size="lg"
                className="text-lg px-8 py-6 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0 shadow-xl shadow-purple-500/25 group"
              >
                <Sparkles className="w-5 h-5 mr-2 group-hover:animate-spin" />
                Create Room
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 glass border-border hover:border-foreground/20"
              >
                Explore Games
              </Button>
            </Link>
          </motion.div>

          {/* Join Room Code Input Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="max-w-md mx-auto mt-12 p-6 glass-card border border-border rounded-3xl space-y-4"
          >
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-left">
              Have a Room Code?
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={homeCode}
                onChange={(e) => setHomeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleHomeJoin()}
                placeholder="ENTER CODE"
                className="flex-1 px-4 h-12 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-center text-lg font-mono font-bold uppercase tracking-widest text-purple-600 dark:text-purple-300 focus:outline-none focus:border-cyan-500/50"
              />
              <Button
                onClick={handleHomeJoin}
                disabled={homeCode.length !== 6 || homeJoining}
                className="h-12 px-6 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/10 disabled:opacity-50"
              >
                {homeJoining ? "Verifying..." : "Join"}
              </Button>
            </div>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 border-2 border-background"
                  />
                ))}
              </div>
              <span>{GAMES.filter((g) => !g.createOnly).length} games to play</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <span className="hidden sm:inline">No download required</span>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <span className="hidden sm:inline">Free to start</span>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-1"
            >
              <motion.div className="w-1.5 h-3 rounded-full bg-muted-foreground/50" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Perks Bar */}
      <section className="relative z-10 py-12 border-y border-border bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {perks.map((perk, i) => (
              <motion.div
                key={perk.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <perk.icon className="w-6 h-6 text-purple-400 mx-auto mb-3" />
                <div className="font-semibold text-sm">{perk.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{perk.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero Features Grid */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Everything you need to{" "}
              <span className="gradient-text">play together</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {GAMES.length} games and room modes. All multiplayer-ready.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {heroFeatures.map((feature, i) => (
              <FeatureCard key={feature.title} {...feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 sm:p-16 relative overflow-hidden"
          >
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-5xl font-bold mb-4">
                Ready to <span className="gradient-text">Spin</span>?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Create your first room in seconds. No account needed. Just click and play.
              </p>
              <Link href="/create">
                <Button
                  size="lg"
                  className="text-lg px-10 py-6 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0 shadow-xl shadow-purple-500/25"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Your First Room
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0">
              <Image src="/icons/logo.png" alt="Spintra" width={24} height={24} className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold">
              <span className="gradient-text">Spin</span>tra
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/explore" className="hover:text-foreground transition-colors">Explore</Link>
            <Link href="/create" className="hover:text-foreground transition-colors">Create Room</Link>
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span>© 2026 Spintra</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
