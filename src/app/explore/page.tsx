"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  TrendingUp,
  Clock,
  Heart,
  Sparkles,
  Users,
  Radar,
  LayoutGrid,
  History,
  Plus,
  Lock,
  Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Emoji, type EmojiName } from "@/components/emoji";
import type { RoomType } from "@/lib/types";
import { GAMES } from "@/lib/games";
import { getOrCreateRoomUser } from "@/lib/room-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { checkCanJoinRoom, ROOM_JOIN_ERROR_MESSAGES } from "@/lib/room-join-check";

interface ExploreRoom {
  id: string;
  code: string;
  name: string;
  type: RoomType;
  participants: number;
  maxParticipants: number;
  host: string;
  hearts: number;
  isLocked: boolean;
  createdAt: string;
}

interface RecentActivity {
  user: string;
  action: string;
  item: string;
  time: string;
  emoji: EmojiName;
  type: RoomType;
  code: string;
}

const featuredTemplates = GAMES.map((game) => ({
  label: game.label,
  type: game.type,
  icon: game.icon,
  href: game.href,
  users: game.stats,
}));

const categories = ["All", "Trending", "New", "Popular", "Teams", "Party", "Classroom"];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getRelativeTimeString(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ExplorePage() {
  const router = useRouter();
  const [currentUser] = useState(getOrCreateRoomUser);
  const [authReady, setAuthReady] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [rooms, setRooms] = useState<ExploreRoom[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  // Set in an effect (not during render) to satisfy react-hooks/purity.
  const [cutoff24h, setCutoff24h] = useState<number | null>(null);

  // Join Widget State
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setCutoff24h(Date.now() - ONE_DAY_MS));
  }, []);

  // Sign in anonymously before querying. Without an authenticated session,
  // Supabase RLS blocks every rooms SELECT, returning an empty result set.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }
    const init = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          await supabase.auth.signInAnonymously();
        }
      } catch (err) {
        console.error("Explore page: anonymous sign-in failed:", err);
      } finally {
        setAuthReady(true);
      }
    };
    init();
  }, []);

  const fetchRooms = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select(`
          id,
          code,
          name,
          type,
          max_participants,
          is_locked,
          created_at,
          room_participants (
            username,
            role,
            is_online
          )
        `)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) throw error;

      if (data) {
        const dbRooms = data.map((room) => {
          const participants = (room.room_participants as unknown as {
            username: string | null;
            role: string;
            is_online: boolean;
          }[]) || [];
          const onlineCount = participants.filter((p) => p.is_online).length;
          const hostUser = participants.find((p) => p.role === "host" && p.is_online)?.username ||
                           participants.find((p) => p.role === "host")?.username ||
                           "Guest";

          // Deterministic seed for decorative hearts (not engagement data)
          let hash = 0;
          for (let i = 0; i < room.id.length; i++) {
            hash = room.id.charCodeAt(i) + ((hash << 5) - hash);
          }
          const seedHearts = Math.abs(hash % 180) + 12;

          return {
            id: room.id,
            code: room.code,
            name: room.name,
            type: room.type as RoomType,
            participants: onlineCount,
            maxParticipants: room.max_participants,
            host: hostUser,
            hearts: seedHearts,
            isLocked: !!room.is_locked,
            createdAt: room.created_at,
          };
        });
        setRooms(dbRooms);
      }

      // Only fetch public rooms for Recent Activity — private rooms must not
      // appear here because their codes would be exposed to anyone on the page.
      const { data: activityData } = await supabase
        .from("rooms")
        .select(`
          id,
          code,
          name,
          type,
          created_at,
          room_participants (
            username,
            role
          )
        `)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(5);

      if (activityData) {
        const mapped = activityData.map((r) => {
          const participants = (r.room_participants as unknown as {
            username: string | null;
            role: string;
          }[] | null) || [];
          const hostObj = participants.find((p) => p.role === "host");
          const hostName = hostObj?.username || "Guest";
          const game = GAMES.find((g) => g.type === r.type);
          const gameLabel = game?.label || "Game";

          const emojiMap: Record<string, EmojiName> = {
            "lucky-wheel": "ferris_wheel",
            "coin-flip": "coin",
            "dice": "game_die",
            "rps": "scissors",
            "would-you-rather": "thinking_face",
            "never-have-i-ever": "see_no_evil_monkey",
            "truth-or-dare": "performing_arts",
            "word-scramble": "books",
            "guess-number": "question_mark",
            "trivia": "trophy",
            "bingo": "bullseye",
            "team-maker": "busts_in_silhouette",
            "tournament": "sports_medal",
            "name-draw": "admission_tickets",
          };
          const emoji = emojiMap[r.type] || "thinking_face";

          return {
            user: hostName,
            action: "created the",
            item: `${r.name} (${gameLabel})`,
            time: getRelativeTimeString(r.created_at),
            emoji,
            type: r.type as RoomType,
            code: r.code,
          };
        });
        setRecentActivities(mapped);
      }
    } catch (err) {
      console.error("Failed to load public rooms from Supabase:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch rooms only after auth is ready, then subscribe to realtime updates.
  // room_participants changes anywhere (any room, public or private) can't be
  // filtered to "belongs to a public room" server-side, so refetches from
  // that table are debounced/coalesced rather than firing one full refetch
  // per event — a burst of joins/leaves across many rooms triggers at most
  // one refetch per debounce window instead of one per row change.
  useEffect(() => {
    if (!authReady) return;
    queueMicrotask(() => fetchRooms());

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { fetchRooms(); }, 1200);
    };

    const channel = supabase
      .channel("explore-room-tracker")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: "is_public=eq.true" },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [authReady, fetchRooms]);

  // Join room — validates access including ban check before navigating
  const handleJoinRoom = useCallback(async (code: string) => {
    if (!code || code.length !== 6) return;
    setJoining(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const result = await checkCanJoinRoom(supabase, code, currentUser.id);
        if (!result.ok) {
          toast.error(ROOM_JOIN_ERROR_MESSAGES[result.reason]);
          setJoining(false);
          return;
        }
      }

      toast.success("Joining room...");
      router.push(`/room/${code}`);
    } catch (err) {
      console.error("Failed to join room from explore page:", err);
      toast.error("Unable to join room. Please try again.");
    } finally {
      setJoining(false);
    }
  }, [router, currentUser.id]);

  const filteredRooms = rooms.filter((room) => {
    // Search check
    const query = search.toLowerCase().trim();
    if (query) {
      const matchName = room.name.toLowerCase().includes(query);
      const matchCode = room.code.toLowerCase().includes(query);
      const matchHost = room.host.toLowerCase().includes(query);
      const matchType = room.type.toLowerCase().includes(query);
      if (!matchName && !matchCode && !matchHost && !matchType) return false;
    }

    // Category check
    if (activeCategory === "All") return true;
    // Trending: rooms with at least 2 online participants right now
    if (activeCategory === "Trending") return room.participants >= 2;
    // New: created in the last 24 hours (cutoff set in effect; show all until ready)
    if (activeCategory === "New") return cutoff24h === null || new Date(room.createdAt).getTime() > cutoff24h;
    // Popular: any room with at least 1 online participant
    if (activeCategory === "Popular") return room.participants >= 1;
    if (activeCategory === "Teams") return room.type === "team-maker" || room.type === "tournament";
    if (activeCategory === "Party") {
      return ["party", "truth-or-dare", "lucky-wheel", "rps", "would-you-rather", "never-have-i-ever", "coin-flip", "dice", "trivia", "bingo", "word-scramble"].includes(room.type);
    }
    if (activeCategory === "Classroom") {
      return room.type === "classroom" || ["name-draw", "team-maker", "guess-number", "trivia", "bingo", "word-scramble", "tournament"].includes(room.type);
    }
    return true;
  });

  const filteredTemplates = featuredTemplates.filter((t) => {
    const query = search.toLowerCase().trim();
    if (query) {
      const matchLabel = t.label.toLowerCase().includes(query);
      const matchType = t.type.toLowerCase().includes(query);
      if (!matchLabel && !matchType) return false;
    }

    if (activeCategory === "All") return true;
    if (activeCategory === "Teams") return t.type === "team-maker" || t.type === "tournament";
    if (activeCategory === "Party") {
      return ["party", "lucky-wheel", "coin-flip", "dice", "rps", "truth-or-dare", "would-you-rather", "never-have-i-ever", "trivia", "bingo", "word-scramble"].includes(t.type);
    }
    if (activeCategory === "Classroom") {
      return t.type === "classroom" || ["name-draw", "team-maker", "guess-number", "trivia", "bingo", "word-scramble", "tournament"].includes(t.type);
    }
    return true;
  });

  const filteredActivities = recentActivities.filter((act) => {
    const query = search.toLowerCase().trim();
    if (query) {
      const matchUser = act.user.toLowerCase().includes(query);
      const matchItem = act.item.toLowerCase().includes(query);
      if (!matchUser && !matchItem) return false;
    }

    if (activeCategory === "All") return true;
    if (activeCategory === "Teams") return act.type === "team-maker" || act.type === "tournament";
    if (activeCategory === "Party") {
      return ["party", "lucky-wheel", "coin-flip", "dice", "rps", "truth-or-dare", "would-you-rather", "never-have-i-ever", "trivia", "bingo", "word-scramble"].includes(act.type);
    }
    if (activeCategory === "Classroom") {
      return act.type === "classroom" || ["name-draw", "team-maker", "guess-number", "trivia", "bingo", "word-scramble", "tournament"].includes(act.type);
    }
    return true;
  });

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-bold">
              Explore <span className="gradient-text">Spintra</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Discover live public rooms, join custom games, or build your own activities.
            </p>
          </div>

          {/* Quick Join Widget & Search Bar Grid */}
          <div className="max-w-2xl mx-auto grid sm:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
              <Input
                placeholder="Search rooms, templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-12 bg-muted/50 border-border rounded-2xl"
              />
            </div>

            {/* Quick Join Input */}
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom(joinCode)}
                placeholder="JOIN BY CODE (EX: 89PB5T)"
                className="flex-1 px-4 h-12 bg-muted/50 border border-border rounded-2xl text-center text-sm font-mono font-bold uppercase tracking-wider text-purple-300 focus:outline-none focus:border-cyan-500/50"
              />
              <Button
                onClick={() => handleJoinRoom(joinCode)}
                disabled={joinCode.length !== 6 || joining}
                className="h-12 px-5 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50"
              >
                {joining ? "..." : "Join"}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Categories Navigation */}
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                  : "glass-card hover:border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Live Trending Rooms Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="text-2xl font-black text-foreground">Live Trending Rooms</h2>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25 ml-2 font-mono uppercase text-[10px] tracking-widest animate-pulse">
              Live Feed
            </Badge>
          </div>

          {loading ? (
            /* Loading skeletons matching live layout */
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="glass-card p-5 border border-border rounded-3xl space-y-4 animate-pulse bg-muted/30"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded-md w-3/4" />
                      <div className="h-3 bg-muted rounded-md w-1/3" />
                    </div>
                    <div className="h-5 bg-muted rounded-full w-16" />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-3 w-1/2">
                      <div className="h-3 bg-muted rounded w-8" />
                      <div className="h-3 bg-muted rounded w-8" />
                    </div>
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            /* Beautiful empty state */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-12 text-center border border-border rounded-3xl flex flex-col items-center justify-center gap-6 max-w-lg mx-auto"
            >
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Radar className="w-8 h-8 text-purple-400 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-foreground">No Public Rooms Active</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  There are no live public rooms matching this filter. Be the first to create one and invite the community!
                </p>
              </div>
              <Link href="/create">
                <Button className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-2xl font-bold h-11 px-6 shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Public Room
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredRooms.map((room, i) => (
                  <motion.button
                    key={room.id}
                    type="button"
                    onClick={() => handleJoinRoom(room.code)}
                    aria-label={`Join ${room.name}, code ${room.code}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-5 group cursor-pointer hover:border-purple-500/30 card-3d rounded-3xl transition-all w-full text-left"
                  >
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1 pr-2">
                          <h3 className="font-bold text-foreground group-hover:text-purple-400 transition-colors line-clamp-1">
                            {room.name}
                          </h3>
                          <p className="text-xs font-mono text-purple-400/80 uppercase font-semibold tracking-wider mt-0.5">
                            CODE: {room.code}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="secondary" className="capitalize text-[10px] tracking-wider font-semibold bg-muted border-border text-muted-foreground">
                            {room.type.replace(/-/g, " ")}
                          </Badge>
                          {room.isLocked && (
                            <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/25 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Locked
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 font-semibold text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                            <Users className="w-3.5 h-3.5" />
                            {room.participants}
                            {room.maxParticipants ? `/${room.maxParticipants}` : ""}
                          </span>
                          <span className="flex items-center gap-1 text-sky-400/80">
                            <Globe className="w-3 h-3" /> Public
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-rose-400">
                            <Heart className="w-3.5 h-3.5 fill-rose-500/20 text-rose-400" /> {room.hearts}
                          </span>
                        </div>
                        <span className="font-medium">by @{room.host}</span>
                      </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Featured Templates */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-2xl font-black text-foreground">Featured Templates</h2>
          </div>
          {filteredTemplates.length === 0 ? (
            <div className="glass-card p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-3 rounded-3xl">
              <LayoutGrid className="w-8 h-8 text-amber-400/60" />
              No matching templates found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredTemplates.map((t, i) => {
                const Icon = t.icon;
                return (
                  <Link key={t.label} href={t.href}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass-card p-5 text-center group cursor-pointer card-3d rounded-3xl"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/10">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-bold text-foreground text-sm group-hover:text-purple-300 transition-colors">
                        {t.label}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">{t.users} active uses</p>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-purple-400" />
            <h2 className="text-2xl font-black text-foreground">Recent Activity</h2>
          </div>
          {filteredActivities.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-3 rounded-3xl">
              <History className="w-8 h-8 text-purple-400/60" />
              No recent activity matching your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity, i) => (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => handleJoinRoom(activity.code)}
                  aria-label={`Join @${activity.user}'s ${activity.item}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card p-4 flex items-center gap-4 rounded-2xl hover:border-purple-500/30 transition-all cursor-pointer bg-muted/30 w-full text-left"
                >
                  <Emoji name={activity.emoji} size={28} />
                  <div className="flex-1 text-sm">
                    <span className="font-bold text-foreground">@{activity.user}</span>{" "}
                    <span className="text-muted-foreground">{activity.action}</span>{" "}
                    <span className="font-bold text-purple-300">{activity.item}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">{activity.time}</span>
                </motion.button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
