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
  Grip,
  Globe,
  Wrench,
  Gamepad2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
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
      className="fixed top-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-50 md:min-w-[600px] md:max-w-4xl w-[calc(100%-2rem)] transition-all duration-500"
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

          {/* Center: Funky Actions (Desktop Only) */}
          <div className="hidden md:flex items-center p-1 rounded-[1.5rem] bg-gradient-to-b from-(--surface-sunken)/80 to-transparent border border-(--border-hairline) shadow-inner gap-1 backdrop-blur-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsJoinOpen(true)}
              className="rounded-full px-6 font-bold tracking-widest text-xs hover:bg-primary/10 hover:text-(--brand-primary-strong) transition-colors text-muted-foreground h-9"
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
            {/* Grid Mega Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground hover:text-foreground hover:bg-(--surface-sunken) transition-colors h-10 w-10"
                    aria-label="Navigation Menu"
                  >
                    <Grip className="w-5 h-5" />
                  </Button>
                }
              />
              <DropdownMenuContent
                align="end"
                sideOffset={12}
                className="w-56 rounded-[1.5rem] p-2 border-(--border-glass) bg-(--surface-glass-strong) backdrop-blur-3xl shadow-2xl"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                    Browse
                  </DropdownMenuLabel>
                  <DropdownMenuItem render={<Link href="/explore" className="cursor-pointer rounded-xl p-2.5 transition-colors focus:bg-primary/10" />}>
                    <Globe className="w-4 h-4 mr-2 text-blue-400" />
                    <span className="font-semibold text-sm">Live Rooms</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/tools" className="cursor-pointer rounded-xl p-2.5 transition-colors focus:bg-primary/10" />}>
                    <Wrench className="w-4 h-4 mr-2 text-orange-400" />
                    <span className="font-semibold text-sm">Quick Tools</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-(--border-hairline) my-1" />
                  
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                    Host
                  </DropdownMenuLabel>
                  <DropdownMenuItem render={<Link href="/create" className="cursor-pointer rounded-xl p-2.5 transition-colors focus:bg-primary/10" />}>
                    <Gamepad2 className="w-4 h-4 mr-2 text-green-400" />
                    <span className="font-semibold text-sm">Create a Room</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

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
              className="md:hidden rounded-full text-foreground hover:bg-(--surface-sunken) h-10 w-10"
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
              className="md:hidden border-t border-(--border-hairline) bg-transparent"
            >
              <div className="px-4 py-4 flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setMobileOpen(false);
                    setIsJoinOpen(true);
                  }}
                  variant="outline"
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
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
        <DialogContent className="max-w-lg sm:max-w-lg text-center rounded-[2.5rem] border-0 bg-white/70 dark:bg-black/70 backdrop-blur-3xl shadow-[0_0_80px_-15px_rgba(100,255,100,0.3)] overflow-hidden p-8 sm:p-10">
          {/* Funky Background Blob */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <DialogHeader className="relative z-10">
            <DialogTitle className="flex flex-col items-center justify-center gap-3 font-display text-4xl sm:text-5xl font-black tracking-tight mb-2">
              <div className="p-4 rounded-3xl bg-gradient-to-br from-primary to-green-400 text-white shadow-xl shadow-primary/20 rotate-[-5deg] hover:rotate-0 transition-transform">
                <Gamepad2 className="w-8 h-8" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">
                Join a Room
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8 my-6 relative z-10">
            <p className="font-display text-sm text-muted-foreground text-center uppercase tracking-[0.2em] font-bold">
              Enter 6-Character Code
            </p>
            <div className="flex items-center justify-center gap-2 sm:gap-3" role="group" aria-label="6-character room code">
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    codeInputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="text"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(index, e)}
                  onFocus={(e) => e.target.select()}
                  aria-label={`Room code character ${index + 1}`}
                  className="h-14 w-12 sm:h-16 sm:w-14 p-0 rounded-2xl border border-white/20 dark:border-white/10 bg-white/50 dark:bg-black/50 text-center text-3xl font-display font-black uppercase text-foreground outline-none transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:-translate-y-1 focus-visible:bg-white dark:focus-visible:bg-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]"
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>

          <Button
            disabled={joinCode.length !== 6 || joining}
            onClick={handleJoinRoomSubmit}
            className="relative z-10 w-full rounded-[1.5rem] h-16 font-display font-black tracking-widest text-xl bg-gradient-to-r from-primary via-green-400 to-blue-500 hover:from-primary hover:to-primary text-white border-none shadow-xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 group"
          >
            {joining ? (
              <span className="animate-pulse">VERIFYING...</span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                ENTER GAME
                <motion.span
                  initial={{ x: -5, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="inline-block"
                >
                  &rarr;
                </motion.span>
              </span>
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </motion.nav>
  );
}
