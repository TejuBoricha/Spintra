"use client";

import { useState, useEffect, useSyncExternalStore, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { checkCanJoinRoom, ROOM_JOIN_ERROR_MESSAGES } from "@/lib/room-join-check";
import { getOrCreateRoomUser } from "@/lib/room-user";
import { fireConfetti } from "@/components/celebration";
import {
  Sun,
  Moon,
  Menu,
  X,
  Sparkles,
  Globe,
  Wrench,
  Gamepad2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useWhatsNew, WhatsNewTrigger, WhatsNewDialog } from "@/components/layout/whats-new-dialog";
import { cn } from "@/lib/utils";

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const whatsNew = useWhatsNew(() => setMobileOpen(false));
  const [codeDigits, setCodeDigits] = useState<string[]>(() => Array(6).fill(""));
  const [joining, setJoining] = useState(false);
  const [currentUser] = useState(getOrCreateRoomUser);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const joinCode = codeDigits.join("");

  const router = useRouter();
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);



  const handleJoinRoomSubmit = useCallback(async () => {
    if (codeDigits.some((d) => !d)) return;
    setJoining(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const result = await checkCanJoinRoom(supabase, joinCode, currentUser.id);
        if (!result.ok) {
          toast.error(ROOM_JOIN_ERROR_MESSAGES[result.reason]);
          setJoining(false);
          setCodeDigits(Array(6).fill(""));
          codeInputRefs.current[0]?.focus();
          return;
        }
      }

      toast.success("Joining room...");
      setIsJoinOpen(false);
      setCodeDigits(Array(6).fill(""));
      router.push(`/room/${joinCode}`);
    } catch (err) {
      console.error("Failed to join room:", err);
      toast.error("Unable to join room. Please try again.");
    } finally {
      setJoining(false);
    }
  }, [codeDigits, joinCode, router, currentUser.id]);

  const handleDigitChange = useCallback((index: number, raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) {
      setCodeDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }
    setCodeDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < clean.length && index + i < 6; i += 1) {
        next[index + i] = clean[i];
      }
      return next;
    });
    const lastFilledIndex = Math.min(index + clean.length, 5);
    codeInputRefs.current[lastFilledIndex]?.focus();
  }, []);

  const handleDigitKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleJoinRoomSubmit();
        return;
      }
      if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
        e.preventDefault();
        codeInputRefs.current[index - 1]?.focus();
        setCodeDigits((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
        return;
      }
      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        codeInputRefs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowRight" && index < 5) {
        e.preventDefault();
        codeInputRefs.current[index + 1]?.focus();
      }
    },
    [codeDigits, handleJoinRoomSubmit]
  );

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      // The desktop pill nav (logo + 4 center items + right icons) clipped
      // itself against this panel's own overflow-hidden at exactly 768px —
      // md:'s breakpoint — with no page-level scroll to reveal it (BUG-041).
      // Raised every toggle in this file from md: to lg: so the mobile
      // hamburger (already correct at every width) covers the range where
      // the desktop row doesn't actually fit, instead of redesigning the
      // pill row's spacing to squeeze into 768px.
      className="fixed top-4 inset-x-4 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 z-50 lg:min-w-[600px] lg:max-w-4xl w-[calc(100%-2rem)] transition-all duration-500"
    >
      <div
        className={cn(
          "mx-auto flex flex-col overflow-hidden transition-all duration-500 rounded-[2rem]",
          "border border-(--border-glass) bg-(--surface-glass-strong)/80 backdrop-blur-2xl",
          scrolled || mobileOpen
            ? "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] bg-(--surface-glass-strong)/95"
            : "shadow-xl"
        )}
      >
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 8 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-(--brand-primary-strong) shadow-[0_0_15px_-3px_var(--color-brand-primary-strong)] relative"
            >
              <Image
                src="/icons/logo.png"
                alt="Spintra Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
            <span className="hidden sm:block font-display text-xl font-black tracking-tight text-foreground">
              <span className="text-(--brand-primary-strong)">Spin</span>tra
            </span>
          </Link>

          {/* Center: Main Navigation (Desktop Only) */}
          <div className="hidden lg:flex items-center p-1 rounded-[1.5rem] bg-gradient-to-b from-(--surface-sunken)/80 to-transparent border border-(--border-hairline) shadow-inner gap-1 backdrop-blur-md">
            <Link href="/explore">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full px-5 font-bold tracking-widest text-xs hover:bg-primary/10 hover:text-(--brand-primary-strong) transition-colors text-muted-foreground h-9"
              >
                <Globe className="w-3.5 h-3.5 mr-2 text-blue-400" />
                LIVE ROOMS
              </Button>
            </Link>
            <Link href="/tools">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full px-5 font-bold tracking-widest text-xs hover:bg-primary/10 hover:text-(--brand-primary-strong) transition-colors text-muted-foreground h-9"
              >
                <Wrench className="w-3.5 h-3.5 mr-2 text-orange-400" />
                TOOLS
              </Button>
            </Link>
            <div className="w-px h-5 bg-(--border-glass) mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsJoinOpen(true)}
              className="rounded-full px-5 font-bold tracking-widest text-xs hover:bg-primary/10 hover:text-(--brand-primary-strong) transition-colors text-muted-foreground h-9"
            >
              JOIN
            </Button>
            <Link href="/create" onClick={() => fireConfetti()}>
              <Button
                variant="brand"
                size="sm"
                className="rounded-full px-6 font-bold tracking-widest text-xs shadow-lg shadow-primary/25 relative overflow-hidden group border border-white/20 h-9"
              >
                <span className="relative z-10 flex items-center gap-2">
                  HOST
                  <Sparkles className="w-3.5 h-3.5 group-hover:animate-spin-slow" />
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
              </Button>
            </Link>
          </div>

          {/* Right: Icons & Menus */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:block">
              <WhatsNewTrigger variant="icon" whatsNew={whatsNew} />
            </div>

            <Link href="/settings" className="hidden sm:block">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:text-foreground hover:bg-(--surface-sunken) transition-colors h-10 w-10"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </Link>

            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="rounded-full text-muted-foreground hover:text-foreground hover:bg-(--surface-sunken) transition-colors h-10 w-10"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-full text-foreground hover:bg-(--surface-sunken) h-10 w-10"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Expanding Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-(--border-hairline) bg-transparent"
            >
              <div className="px-4 py-4 flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setMobileOpen(false);
                    setIsJoinOpen(true);
                  }}
                  variant="brand"
                  className="w-full rounded-full h-12 font-bold tracking-widest text-sm"
                >
                  JOIN ROOM
                </Button>

                <Link
                  href="/create"
                  onClick={() => {
                    setMobileOpen(false);
                    fireConfetti();
                  }}
                  className="w-full"
                >
                  <Button variant="brand" className="w-full rounded-full h-12 font-bold tracking-widest text-sm shadow-lg shadow-primary/25">
                    <Sparkles className="w-4 h-4 mr-2" />
                    HOST GAME
                  </Button>
                </Link>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Link href="/explore" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full rounded-2xl h-12 bg-(--surface-sunken)/50">
                      <Globe className="w-4 h-4 mr-2 text-blue-400" />
                      Live Rooms
                    </Button>
                  </Link>
                  <Link href="/tools" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full rounded-2xl h-12 bg-(--surface-sunken)/50">
                      <Wrench className="w-4 h-4 mr-2 text-orange-400" />
                      Quick Tools
                    </Button>
                  </Link>
                  <Link href="/settings" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full rounded-2xl h-12 bg-(--surface-sunken)/50">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </Link>
                  <WhatsNewTrigger variant="full" whatsNew={whatsNew} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog 
        open={isJoinOpen} 
        onOpenChange={(open) => {
          setIsJoinOpen(open);
          if (!open) setCodeDigits(Array(6).fill(""));
        }}
      >
        <DialogContent className="max-w-md sm:max-w-[420px] p-0 border-0 bg-transparent shadow-none overflow-visible">
          {/* Animated gradient border wrapper */}
          <div className="relative p-[2px] rounded-[2.5rem] overflow-hidden group">
            {/* Rotating gradient background using brand colors */}
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(125,187,37,0.8)_360deg)] animate-[spin_4s_linear_infinite] opacity-100" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-green-400/20 to-blue-500/20 opacity-40" />
            
            {/* Inner Glass Container */}
            <div className="relative bg-(--surface-glass-strong)/95 backdrop-blur-3xl rounded-[calc(2.5rem-2px)] p-8 overflow-hidden flex flex-col items-center shadow-[0_0_40px_rgba(125,187,37,0.15)]">
              
              {/* Decorative ambient light */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary/10 blur-[80px] pointer-events-none rounded-full" />

              {/* Header */}
              <div className="relative z-10 flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-(--surface-sunken) border border-(--border-glass) flex items-center justify-center mb-5 shadow-inner relative overflow-hidden group-hover:border-primary/30 transition-colors duration-500">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Gamepad2 className="w-8 h-8 text-(--brand-primary-strong) drop-shadow-sm" />
                </div>
                <h2 className="text-3xl font-display font-black tracking-widest text-foreground uppercase">
                  Join Room
                </h2>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.3em] mt-3">
                  Initialize Connection
                </p>
              </div>

              {/* Inputs */}
              <div className="relative z-10 flex gap-2 sm:gap-3 w-full justify-center mb-10">
                {codeDigits.map((digit, index) => (
                  <div key={index} className="relative group/input">
                    <input
                      ref={(el) => { codeInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="text"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(index, e)}
                      onFocus={(e) => e.target.select()}
                      className="peer w-10 h-14 sm:w-12 sm:h-16 p-0 bg-(--surface-sunken) border border-(--border-strong) rounded-xl text-center text-2xl font-mono font-bold uppercase text-foreground outline-none transition-all focus:bg-background focus:border-(--brand-primary-strong) focus:shadow-[0_0_20px_rgba(125,187,37,0.2)] focus:-translate-y-1 placeholder:text-muted-foreground/30"
                      placeholder="-"
                      autoFocus={index === 0}
                    />
                    {/* Input glow effect */}
                    <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 peer-focus:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <Button
                disabled={joinCode.length !== 6 || joining}
                onClick={handleJoinRoomSubmit}
                className="relative z-10 w-full h-14 rounded-xl bg-(--brand-primary-strong) text-white hover:bg-primary/90 font-display font-black tracking-widest text-lg overflow-hidden transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 group/btn border-0 shadow-[0_0_20px_rgba(125,187,37,0.3)] hover:shadow-[0_0_30px_rgba(125,187,37,0.5)]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {joining ? "CONNECTING..." : "ENTER GAME"}
                  {!joining && (
                    <motion.span
                      animate={{ x: [0, 4, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    >
                      &rarr;
                    </motion.span>
                  )}
                </span>
                {/* Button hover gradient sweep */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover/btn:animate-[shimmer_1.5s_infinite]" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rendered once here, not inside either trigger — both the desktop
          icon and the mobile-menu button above just call whatsNew.show().
          A prior version gave each trigger its own Dialog; nesting one of
          them inside the hamburger's conditionally-unmounted panel meant
          opening it also tore it down moments later. See
          whats-new-dialog.tsx's own comment for the full story. */}
      <WhatsNewDialog whatsNew={whatsNew} />
    </motion.nav>
  );
}
