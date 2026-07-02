"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import Link from "next/link";
import Image from "next/image";
import {
  Sun,
  Moon,
  Menu,
  X,
  Sparkles,
  ChevronDown,
  Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "glass shadow-lg shadow-purple-500/5"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.08 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
            >
              <Image
                src="/logo.png"
                alt="Spintra"
                width={32}
                height={32}
                className="w-full h-full object-cover"
                priority
              />
            </motion.div>
            <span className="text-xl font-bold tracking-tight">
              <span className="gradient-text">Spin</span>
              <span className="text-foreground">tra</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1.5">
            <Link href="/explore">
              <Button
                variant="ghost"
                size="sm"
                className="border border-border/70 bg-background/35 text-muted-foreground shadow-sm hover:bg-muted/60 hover:text-foreground"
              >
                Explore
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border border-border/70 bg-background/35 text-muted-foreground shadow-sm hover:bg-muted/60 hover:text-foreground"
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
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="text-muted-foreground"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>
            )}
            <Link href="/create">
              <Button
                size="sm"
                className="hidden sm:flex bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white border-0"
              >
                <Sparkles className="w-4 h-4 mr-2" />
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
            className="md:hidden glass border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
              <Link
                href="/explore"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
              >
                Explore
              </Link>
              <p className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Games
              </p>
              {GAMES.map((game) => (
                <Link
                  key={game.type}
                  href={game.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <game.icon className="w-5 h-5" />
                  {game.label}
                </Link>
              ))}
              <Link
                href="/create"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white mt-2"
              >
                <Sparkles className="w-5 h-5" />
                Create Room
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
