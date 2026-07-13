"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { checkCanJoinRoom, ROOM_JOIN_ERROR_MESSAGES } from "@/lib/room-join-check";
import { ArrowRight, Sparkles, Zap, Globe, MessageCircle, Star, DownloadCloud, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrCreateRoomUser } from "@/lib/room-user";
import dynamic from "next/dynamic";
const HeroThreeScene = dynamic(() => import("@/components/landing/hero-scene").then((m) => m.HeroThreeScene), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gradient-to-b from-(--violet-800)/40 to-background" />,
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

const socialProofGames = GAMES.filter((g) => !g.createOnly).slice(0, 4);

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
  const [roomHistory, setRoomHistory] = useState<{ code: string; name: string; type: string }[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("spintra-room-history");
      if (stored) {
        try {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setRoomHistory(JSON.parse(stored));
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, []);

  const handleHomeJoin = useCallback(async () => {
    if (homeCode.length !== 6) return;
    setHomeJoining(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const result = await checkCanJoinRoom(supabase, homeCode, currentUser.id);
        if (!result.ok) {
          toast.error(ROOM_JOIN_ERROR_MESSAGES[result.reason]);
          setHomeJoining(false);
          return;
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

  // The WebGL scene's render loop (useFrame) runs continuously for as long
  // as the Canvas is mounted — with no visibility check, it kept animating
  // (burning GPU/battery) even after the user scrolled past the hero
  // entirely. Only mount it once the hero section actually scrolls into
  // view, and unmount it again once it scrolls out — and skip it outright
  // for prefers-reduced-motion, matching every other animation in this app
  // (see globals.css's reduce-motion block).
  const prefersReducedMotion = useReducedMotion();
  const heroSectionRef = useRef<HTMLElement>(null);
  const [isHeroVisible, setIsHeroVisible] = useState(false);

  // Scoped to the hero section's own scroll distance (top of hero hitting
  // the viewport top, through its bottom hitting the viewport top) rather
  // than the whole page's scrollYProgress — the hero's content column can
  // run taller than one viewport (e.g. once "Recently Visited Rooms" is
  // showing), and tying the fade to a fixed fraction of the *entire* page
  // (badge through footer) meant opacity could already be near 0 while
  // the lower half of the hero — Recently Visited Rooms included — was
  // still the thing actually on screen, making it unreadable rather than
  // gone. Scoping to the hero itself keeps the fade proportional to how
  // much of the hero has actually scrolled past.
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroSectionRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(heroScrollProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(heroScrollProgress, [0, 1], [1, 0.95]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = heroSectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="relative">
      {/* Aurora Gradient Background */}
      <AuroraBackground />

      {/* Hero Section */}
      <section ref={heroSectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* 3D Scene Background — only mounted while visible and motion isn't reduced */}
        <div className="absolute inset-0 z-0">
          {!prefersReducedMotion && isHeroVisible ? (
            <HeroThreeScene />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-(--violet-800)/40 to-background" />
          )}
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) text-sm mb-8"
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
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] mb-6"
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
              <Button variant="brand" size="lg" className="group text-lg">
                <Sparkles className="w-5 h-5 group-hover:animate-spin" />
                Create Room
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button variant="secondary" size="lg" className="text-lg">
                Explore Games
              </Button>
            </Link>
          </motion.div>

          {/* Join Room Code Input Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="max-w-md mx-auto mt-12 p-6 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) shadow-1 space-y-4"
          >
            <label
              htmlFor="home-code-input"
              className="block font-body text-sm font-bold text-muted-foreground uppercase tracking-widest text-left cursor-pointer"
            >
              Have a Room Code?
            </label>
            <div className="flex gap-2">
              <Input
                id="home-code-input"
                type="text"
                maxLength={6}
                value={homeCode}
                onChange={(e) => setHomeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleHomeJoin()}
                placeholder="ENTER CODE"
                aria-label="Enter room code"
                className="flex-1 h-12 text-center text-lg font-mono font-bold uppercase tracking-widest text-(--brand-primary-strong)"
              />
              <Button
                onClick={handleHomeJoin}
                disabled={homeCode.length !== 6 || homeJoining}
                variant="brand"
                className="h-12"
              >
                {homeJoining ? "Verifying..." : "Join"}
              </Button>
            </div>
           </motion.div>

           {roomHistory.length > 0 && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.8, duration: 0.6 }}
               className="max-w-md mx-auto mt-6 p-6 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) shadow-1 space-y-3 text-left"
             >
               <h3 className="font-body text-xs font-bold text-muted-foreground uppercase tracking-widest">
                 Recently Visited Rooms
               </h3>
               <div className="flex flex-col gap-2">
                 {roomHistory.map((room) => {
                   const game = GAMES.find((g) => g.type === room.type);
                   const Icon = game?.icon || Star;
                   return (
                     <button
                       key={room.code}
                       onClick={() => {
                         setHomeCode(room.code);
                         router.push(`/room/${room.code}`);
                       }}
                       className="flex items-center justify-between p-3 rounded-control border border-(--border-hairline) bg-(--surface-sunken) hover:border-primary/40 transition-all group w-full cursor-pointer"
                     >
                       <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-control bg-gradient-to-br ${game?.color || "from-(--violet-500) to-(--violet-800)"} text-white`}>
                           <Icon className="w-4 h-4" />
                         </div>
                         <div>
                           <p className="font-body text-sm font-bold group-hover:text-(--brand-primary-strong) transition-colors">
                             {room.name}
                           </p>
                           <p className="text-xs text-muted-foreground">
                             {game?.label || "Multiplayer"} Activity
                           </p>
                         </div>
                       </div>
                       <span className="font-mono text-xs font-bold text-(--brand-primary-strong) group-hover:text-primary bg-primary/10 px-2.5 py-1 rounded-control">
                         {room.code}
                       </span>
                     </button>
                   );
                 })}
               </div>
             </motion.div>
           )}

           {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {socialProofGames.map((game) => (
                  <div
                    key={game.href}
                    className="w-7 h-7 rounded-full bg-(image:--gradient-avatar) border-2 border-background flex items-center justify-center"
                  >
                    <game.icon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                  </div>
                ))}
              </div>
              <span>{GAMES.filter((g) => !g.createOnly).length} games to play</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <span className="hidden sm:flex items-center gap-1.5">
              <DownloadCloud className="w-4 h-4 text-(--brand-primary-strong)" />
              No download required
            </span>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <span className="hidden sm:flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-(--brand-primary-strong)" />
              Free to start
            </span>
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
                <perk.icon className="w-6 h-6 text-(--brand-primary-strong) mx-auto mb-3" />
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
            <h2 className="font-display text-3xl sm:text-5xl font-black mb-4">
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
            className="rounded-2xl border border-(--border-hairline) bg-(--surface-panel) p-12 sm:p-16 relative overflow-hidden shadow-2"
          >
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-(--cyan-500)/10" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-(--cyan-500)/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl sm:text-5xl font-black mb-4">
                Ready to <span className="gradient-text">Spin</span>?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Create your first room in seconds. No account needed. Just click and play.
              </p>
              <Link href="/create">
                <Button variant="brand" size="lg" className="text-lg">
                  <Sparkles className="w-5 h-5" />
                  Create Your First Room
                  <ArrowRight className="w-5 h-5" />
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
              <Image src="/icons/logo.png" alt="" width={24} height={24} className="w-full h-full object-cover" />
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
