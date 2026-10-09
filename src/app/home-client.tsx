"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Sparkles, Zap, Globe, MessageCircle, Star, DownloadCloud, Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrCreateRoomUser } from "@/lib/room-user";
import { loadJoinCheck } from "@/lib/join-check-loader";
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
  tagline: game.tagline,
}));

const socialProofGames = GAMES.filter((g) => !g.createOnly).slice(0, 4);

const perks = [
  { icon: Zap, label: "One-click rooms", desc: "Share a 6-character code and people are in" },
  { icon: Globe, label: "Everyone sees the same thing", desc: "Spins and scores update for the whole room at once" },
  { icon: MessageCircle, label: "Chat in every room", desc: "Talk while you play" },
  { icon: Star, label: "Invite by link or QR", desc: "Handy when everyone is in the same place" },
];

// Footer links are 44px tall by default (a phone, any device with a touchscreen: WCAG 2.5.8 asks for 24px, and 44px
// is the size a thumb hits reliably) and 36px only where there is room and no touch input at all (md and up, mouse
// only), where the row is compact. `any-pointer` rather than `pointer`: a touchscreen laptop or a 2-in-1 with a
// trackpad reports a fine primary pointer, and a finger still taps those links. The compact size has to be asked for.
const FOOTER_LINK = "inline-flex items-center min-h-11 md:not-any-pointer-coarse:min-h-9 hover:text-foreground transition-colors";

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
      // Loaded now, not in the page's first load (search audit S-7); null when it could not be
      // fetched: skip the pre-check and go to the room, which checks again.
      const join = await loadJoinCheck();
      const supabase = join?.getSupabaseBrowserClient();
      if (join && supabase) {
        const result = await join.checkCanJoinRoom(supabase, homeCode, currentUser.id);
        if (!result.ok) {
          toast.error(join.ROOM_JOIN_ERROR_MESSAGES[result.reason]);
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
    // Data Saver: the 3D scene is a few hundred KB of JavaScript for decoration.
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const el = heroSectionRef.current;
    if (!el) return;

    // Start the scene only after the page has loaded and the browser is idle. Its chunk (three.js,
    // about 900 KB before compression) used to start downloading and running with the page, in the
    // window where a phone is still painting the headline and hydrating (search audit S-7). `load`
    // can come late (a hung image or font), so a plain timer starts it after 6 s at the latest.
    let observer: IntersectionObserver | undefined;
    let idleHandle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (observer) return;
      observer = new IntersectionObserver(
        ([entry]) => setIsHeroVisible(entry.isIntersecting),
        { threshold: 0 }
      );
      observer.observe(el);
    };
    const whenIdle = () => {
      if ("requestIdleCallback" in window) idleHandle = window.requestIdleCallback(start, { timeout: 4000 });
      else timer = setTimeout(start, 2000);
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
    const fallback = setTimeout(start, 6000);

    return () => {
      window.removeEventListener("load", whenIdle);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timer !== undefined) clearTimeout(timer);
      clearTimeout(fallback);
      observer?.disconnect();
    };
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="relative">
      {/* Aurora Gradient Background */}
      <AuroraBackground />

      {/* Hero Section */}
      <section ref={heroSectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
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
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) text-sm mb-8 reveal reveal-up reveal-delay-1"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-muted-foreground">Free games and group tools,</span>
            <span className="text-foreground font-medium">played in one shared room</span>
          </div>

          {/* Main Headline */}
          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] mb-6 reveal reveal-up-lg"
          >
            Can&apos;t decide?
            <br />
            <span className="gradient-text">Spin</span> for it.
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed reveal reveal-up reveal-delay-1"
          >
            Make a room, share the code, and everyone watches the same wheel,
            bracket, or game play out on their own screen.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 reveal reveal-up reveal-delay-2"
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
          </div>

          {/* Join Room Code Input Widget */}
          <div
            className="max-w-md mx-auto mt-12 p-6 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) shadow-1 space-y-4 reveal reveal-up reveal-delay-3"
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
                onFocus={() => void loadJoinCheck()}
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
           </div>

           {roomHistory.length > 0 && (
             <div
               className="max-w-md mx-auto mt-6 p-6 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) shadow-1 space-y-3 text-left reveal reveal-up-sm reveal-delay-4"
             >
               <h3 className="font-body text-xs font-bold text-muted-foreground uppercase tracking-widest">
                 Recently Visited Rooms
               </h3>
               <div className="flex flex-col gap-2">
                 {roomHistory.map((room) => {
                   const game = GAMES.find((g) => g.type === room.type);
                   const Icon = game?.icon || Star;
                   return (
                      <div
                        key={room.code}
                        onClick={() => {
                          setHomeCode(room.code);
                          router.push(`/room/${room.code}`);
                        }}
                        className="flex items-center justify-between p-3 rounded-control border border-(--border-hairline) bg-(--surface-sunken) hover:border-primary/40 transition-all group w-full cursor-pointer relative"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setHomeCode(room.code);
                            router.push(`/room/${room.code}`);
                          }
                        }}
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
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-(--brand-primary-strong) group-hover:text-primary bg-primary/10 px-2.5 py-1 rounded-control">
                            {room.code}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all md:flex hidden"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newHistory = roomHistory.filter(h => h.code !== room.code);
                              setRoomHistory(newHistory);
                              if (typeof window !== "undefined") {
                                localStorage.setItem("spintra-room-history", JSON.stringify(newHistory));
                              }
                            }}
                            title="Remove from history"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          {/* Mobile-always-visible button variant for touch screens */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all md:hidden"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newHistory = roomHistory.filter(h => h.code !== room.code);
                              setRoomHistory(newHistory);
                              if (typeof window !== "undefined") {
                                localStorage.setItem("spintra-room-history", JSON.stringify(newHistory));
                              }
                            }}
                            title="Remove from history"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                 })}
               </div>
             </div>
           )}

           {/* Social proof */}
          <div
            className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground reveal reveal-fade reveal-delay-5"
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
              Free to play
            </span>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 reveal reveal-fade reveal-delay-6"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-1"
            >
              <motion.div className="w-1.5 h-3 rounded-full bg-muted-foreground/50" />
            </motion.div>
          </div>
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
              Pick something to{" "}
              <span className="gradient-text">play</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {GAMES.length} games and room modes. Use any of them on your own, or open a room and play with everyone.
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
            data-testid="closing-card"
            className="rounded-2xl border border-(--border-hairline) bg-(--surface-panel) px-5 py-12 min-[380px]:px-12 sm:p-16 relative overflow-hidden shadow-2"
          >
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-(--cyan-500)/10" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-(--cyan-500)/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl sm:text-5xl font-black mb-4">
                Start a <span className="gradient-text">room</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                It&apos;s free, and nobody needs an account, including the people you invite.
              </p>
              <Link href="/create">
                <Button variant="brand" size="lg" wrap className="text-lg">
                  <Sparkles className="w-5 h-5" />
                  Create a room
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-4 pt-12 pb-8 text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col items-center md:flex-row md:items-start md:justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-3 max-w-sm text-center md:text-left">
              {/* The same wordmark as the navbar (only "Spin" is brand-coloured), a size down. */}
              <div className="flex items-center gap-2 md:h-11">
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border-2 border-(--brand-primary-strong)">
                  <Image src="/icons/logo.png" alt="" width={28} height={28} className="w-full h-full object-cover" />
                </div>
                <span className="font-display text-lg font-black tracking-tight text-foreground">
                  <span className="text-(--brand-primary-strong)">Spin</span>tra
                </span>
              </div>
              {/* A plain statement of what Spintra is, in the page's own text: search engines
                  and AI summaries take the answer to "what is Spintra?" from page text, and the
                  word is otherwise read as the Roman "spintria". Two short sentences: the
                  definition, then the thing that sets it apart. It names no tool on purpose (it
                  is the short answer to "what is Spintra?"); the tools are named by the page's
                  own headings and cards above, and by the meta description. */}
              <p className="leading-relaxed text-pretty">
                Spintra is a free set of games and group tools that run in your browser. No account needed.
              </p>
            </div>
            {/* Each link is a 44px-tall tap target on a phone or any touch device (36px with a mouse; see FOOTER_LINK). The row wraps, so
                five items fit a phone instead of running off both edges (the old single row was
                449px wide in a 390px window). The narrow box on a phone only balances the wrap (3 and 2,
                not 4 and 1): it is cosmetic, and a longer label would just wrap differently. */}
            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center md:justify-end gap-x-6 max-w-[17rem] md:max-w-none">
              <Link href="/explore" className={FOOTER_LINK}>Explore</Link>
              <Link href="/tools" className={FOOTER_LINK}>Tools</Link>
              <Link href="/create" className={FOOTER_LINK}>Create Room</Link>
              <Link href="/for-teachers" className={FOOTER_LINK}>For Teachers</Link>
              <Link href="/spintra-city" className={FOOTER_LINK}>Spintra City</Link>
            </nav>
          </div>
          {/* Copyright and the legal pages in their own bar: the copyright is not a link, and it
              should not sit in the row of links looking like one. */}
          <div className="flex flex-col-reverse items-center gap-1 sm:flex-row sm:justify-between border-t border-border pt-6">
            {/* The year is the one of the build; the flag stops React flagging a visit in a later year (it keeps the built text). */}
            <span suppressHydrationWarning>© {new Date().getFullYear()} Spintra</span>
            <nav aria-label="Legal" className="flex items-center gap-6">
              <Link href="/legal/terms" className={FOOTER_LINK}>Terms</Link>
              <Link href="/legal/privacy" className={FOOTER_LINK}>Privacy</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
