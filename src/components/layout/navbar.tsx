"use client";

import { useState, useEffect, useSyncExternalStore, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  ChevronDown,
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
import { GAMES } from "@/lib/games";

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// Letter-wave hover: each character staggers a small bounce, matching the
// design system's nav-link interaction spec (~30ms stagger, --ease-toy).
function WaveLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex">
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="inline-block transition-transform duration-150 ease-toy group-hover:-translate-y-0.5"
          style={{ transitionDelay: `${i * 30}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(() => Array(6).fill(""));
  const [joining, setJoining] = useState(false);
  const [currentUser] = useState(getOrCreateRoomUser);
  const createBtnRef = useRef<HTMLAnchorElement>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const joinCode = codeDigits.join("");

  const router = useRouter();
  const pathname = usePathname();
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
    // Handles both a single keystroke and a full paste landing in one box.
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

  const isExploreActive = pathname === "/explore";

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-(--border-glass) bg-(--surface-glass-strong) shadow-1 backdrop-blur-(--blur-glass)"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 4 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="w-8 h-8 rounded-control overflow-hidden flex-shrink-0 border-2 border-(--border-strong)"
            >
              <Image
                src="/icons/logo.png"
                alt="Spintra"
                width={32}
                height={32}
                className="w-full h-full object-cover"
                priority
              />
            </motion.div>
            <span className="font-display text-xl font-black tracking-tight text-foreground">
              <span className="text-(--brand-primary-strong)">Spin</span>tra
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1.5">
            <Link
              href="/explore"
              className={cn(
                "group inline-flex items-center rounded-pill px-3.5 py-2 font-body text-sm font-semibold transition-colors",
                isExploreActive
                  ? "bg-primary/10 text-(--brand-primary-strong)"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <WaveLabel text="Explore" />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-pill text-muted-foreground hover:text-foreground"
                  >
                    <Gamepad2 className="w-4 h-4 mr-2" />
                    Games
                    <ChevronDown className="w-4 h-4 ml-1 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>All Games</DropdownMenuLabel>
                  {GAMES.filter((game) => !game.createOnly).map((game) => (
                    <DropdownMenuItem key={game.type} render={<Link href={game.href} />}>
                      <game.icon className="w-4 h-4" />
                      {game.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Room Modes</DropdownMenuLabel>
                  {GAMES.filter((game) => game.createOnly).map((game) => (
                    <DropdownMenuItem key={game.type} render={<Link href={game.href} />}>
                      <game.icon className="w-4 h-4" />
                      {game.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Link href="/settings" className="hidden sm:block">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Settings"
                className="rounded-full border border-(--border-hairline) bg-(--surface-sunken) text-foreground"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </Link>

            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="rounded-full border border-(--border-hairline) bg-(--surface-sunken) text-foreground"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsJoinOpen(true)}
              className="hidden sm:flex"
            >
              Join Room
            </Button>

            <Link href="/create" ref={createBtnRef} onClick={() => fireConfetti()} className="hidden sm:block">
              <Button variant="brand" size="sm" icon={<Sparkles className="w-4 h-4" />}>
                Create Room
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-(--border-hairline) bg-(--surface-glass-strong) backdrop-blur-(--blur-glass) overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
              <Link
                href="/explore"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-control hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                Explore
              </Link>
              <p className="px-3 pt-2 pb-1 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Games
              </p>
              {GAMES.map((game) => (
                <Link
                  key={game.type}
                  href={game.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-control hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <game.icon className="w-5 h-5" />
                  {game.label}
                </Link>
              ))}

              <button
                onClick={() => {
                  setMobileOpen(false);
                  setIsJoinOpen(true);
                }}
                className="flex items-center justify-center gap-3 px-3 py-2 rounded-pill border-2 border-(--border-strong) bg-(--surface-contrast) text-(--text-on-contrast) w-full mt-2 font-body font-semibold text-sm transition-all h-10"
              >
                Join Room
              </button>

              <Link
                href="/create"
                onClick={() => {
                  setMobileOpen(false);
                  fireConfetti();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-pill border-2 border-(--border-strong) bg-primary text-primary-foreground mt-2 h-10 justify-center font-body font-semibold text-sm"
              >
                <Sparkles className="w-5 h-5" />
                Create Room
              </Link>

              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-control hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <Settings className="w-5 h-5" />
                Settings
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Gamepad2 className="w-5 h-5 text-(--brand-primary-strong)" />
              Join Room
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="font-body text-xs text-muted-foreground text-left uppercase tracking-wider font-semibold">
              Enter 6-Character Room Code:
            </p>
            <div className="flex items-center justify-center gap-2" role="group" aria-label="6-character room code">
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
                  className="h-13 w-11 rounded-control border border-(--border-hairline) bg-(--surface-sunken) text-center text-xl font-mono font-bold uppercase text-(--brand-primary-strong) outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>

          <Button
            disabled={joinCode.length !== 6 || joining}
            onClick={handleJoinRoomSubmit}
            variant="brand"
            className="w-full"
          >
            {joining ? "Verifying..." : "Join Game"}
          </Button>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
