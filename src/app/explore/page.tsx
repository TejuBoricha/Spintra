"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Search, TrendingUp, Clock, Heart, Sparkles, Users, Radar, LayoutGrid, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Emoji, type EmojiName } from "@/components/emoji";
import type { RoomType } from "@/lib/types";
import { GAMES } from "@/lib/games";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const trendingRooms = [
  { id: "1", code: "X7F82K", name: "Friday Game Night", type: "party" as RoomType, participants: 12, host: "GameMaster42", hearts: 234 },
  { id: "2", code: "A3BC12", name: "CS2 Team Draft", type: "team-maker" as RoomType, participants: 10, host: "ProGamerX", hearts: 189 },
  { id: "3", code: "M9ZK44", name: "Giveaway Wheel!", type: "lucky-wheel" as RoomType, participants: 45, host: "StreamerDan", hearts: 567 },
  { id: "4", code: "P2XY77", name: "Classroom Pick", type: "name-draw" as RoomType, participants: 28, host: "MsTeacher", hearts: 156 },
  { id: "5", code: "R8LM33", name: "Weekend Tournament", type: "tournament" as RoomType, participants: 16, host: "TourneyKing", hearts: 312 },
  { id: "6", code: "T5VN90", name: "Truth or Dare Party", type: "truth-or-dare" as RoomType, participants: 8, host: "PartyStarter", hearts: 145 },
];

const featuredTemplates = GAMES.map((game) => ({
  label: game.label,
  type: game.type,
  icon: game.icon,
  href: game.href,
  users: game.stats,
}));

const categories = ["All", "Trending", "New", "Popular", "Teams", "Party", "Classroom"];

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [rooms, setRooms] = useState<typeof trendingRooms>(trendingRooms);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let isMounted = true;

    const fetchRooms = async () => {
      try {
        const { data, error } = await supabase
          .from("rooms")
          .select(`
            id,
            code,
            name,
            type,
            max_participants,
            created_at,
            room_participants (
              username,
              role,
              is_online
            )
          `)
          .eq("is_public", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (isMounted && data) {
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
            return {
              id: room.id,
              code: room.code,
              name: room.name,
              type: room.type as RoomType,
              participants: onlineCount,
              host: hostUser,
              hearts: Math.floor(Math.random() * 200) + 15, // Dynamic visual hearts
            };
          });

          if (dbRooms.length > 0) {
            setRooms(dbRooms);
          }
        }
      } catch (err) {
        console.error("Failed to load public rooms from Supabase:", err);
      }
    };

    fetchRooms();

    return () => {
      isMounted = false;
    };
  }, []);

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
    if (activeCategory === "Trending") return room.hearts > 200;
    if (activeCategory === "New") return room.code.startsWith("X") || room.code.startsWith("A");
    if (activeCategory === "Popular") return room.hearts > 300 || room.participants > 15;
    if (activeCategory === "Teams") return room.type === "team-maker" || room.type === "tournament";
    if (activeCategory === "Party") {
      return ["party", "truth-or-dare", "lucky-wheel", "rps", "would-you-rather", "never-have-i-ever", "coin-flip", "dice", "trivia", "bingo", "word-scramble"].includes(room.type);
    }
    if (activeCategory === "Classroom") return ["name-draw", "guess-number"].includes(room.type);
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
      return ["lucky-wheel", "coin-flip", "dice", "rps", "truth-or-dare", "would-you-rather", "never-have-i-ever", "trivia", "bingo", "word-scramble"].includes(t.type);
    }
    if (activeCategory === "Classroom") return ["name-draw", "guess-number"].includes(t.type);
    return true;
  });

  const recentActivities: { action: string; item: string; user: string; time: string; emoji: EmojiName; type: string }[] = [
    { action: "created a", item: "Team Room", user: "Alex", time: "2 min ago", emoji: "busts_in_silhouette", type: "team-maker" },
    { action: "spun the", item: "Giveaway Wheel", user: "Sarah", time: "5 min ago", emoji: "ferris_wheel", type: "lucky-wheel" },
    { action: "won the", item: "Fortune Wheel", user: "Mike", time: "8 min ago", emoji: "trophy", type: "lucky-wheel" },
    { action: "ran a", item: "Tournament Bracket", user: "Jordan", time: "12 min ago", emoji: "sports_medal", type: "tournament" },
    { action: "drew a winner in", item: "Name Draw", user: "Emma", time: "15 min ago", emoji: "bullseye", type: "name-draw" },
  ];
  const filteredActivities = recentActivities.filter((act) => {
    const query = search.toLowerCase().trim();
    if (query) {
      const matchUser = act.user.toLowerCase().includes(query);
      const matchItem = act.item.toLowerCase().includes(query);
      const matchAction = act.action.toLowerCase().includes(query);
      if (!matchUser && !matchItem && !matchAction) return false;
    }

    if (activeCategory === "All") return true;
    if (activeCategory === "Teams") return act.type === "team-maker" || act.type === "tournament";
    if (activeCategory === "Party") {
      return ["lucky-wheel", "coin-flip", "dice", "rps", "truth-or-dare", "would-you-rather", "never-have-i-ever", "trivia", "bingo", "word-scramble"].includes(act.type);
    }
    if (activeCategory === "Classroom") return ["name-draw", "guess-number"].includes(act.type);
    return true;
  });

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Explore <span className="gradient-text">Spintra</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Discover trending rooms, popular wheels, and community creations.
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search rooms, templates, creators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </motion.div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                  : "glass-card hover:border-white/10 text-muted-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Trending Rooms */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="text-2xl font-bold">Trending Rooms</h2>
            <Badge variant="secondary" className="ml-2">Live</Badge>
          </div>
          {filteredRooms.length === 0 ? (
            <div className="glass-card p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
              <Radar className="w-8 h-8 text-purple-400/60" />
              No live matching rooms found. Create a room to start playing!
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room, i) => (
                <Link key={room.id} href={`/room/${room.code}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-5 group cursor-pointer hover:border-purple-500/30 card-3d"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold group-hover:text-white transition-colors">{room.name}</h3>
                        <p className="text-sm text-muted-foreground">#{room.code}</p>
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {room.type.replace("-", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> {room.participants}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-red-400" /> {room.hearts}
                        </span>
                      </div>
                      <span>by @{room.host}</span>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Featured Templates */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-2xl font-bold">Featured Templates</h2>
          </div>
          {filteredTemplates.length === 0 ? (
            <div className="glass-card p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
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
                      transition={{ delay: i * 0.08 }}
                      className="glass-card p-5 text-center group cursor-pointer card-3d"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-sm">{t.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{t.users} uses</p>
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
            <h2 className="text-2xl font-bold">Recent Activity</h2>
          </div>
          {filteredActivities.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
              <History className="w-8 h-8 text-purple-400/60" />
              No recent activity matching your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-4 flex items-center gap-4"
                >
                  <Emoji name={activity.emoji} size={28} />
                  <div className="flex-1">
                    <span className="font-medium">{activity.user}</span>{" "}
                    <span className="text-muted-foreground">{activity.action}</span>{" "}
                    <span className="font-medium">{activity.item}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{activity.time}</span>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
