export type RoomType = "team-maker" | "lucky-wheel" | "name-draw" | "tournament" | "coin-flip" | "dice" | "guess-number" | "rps" | "truth-or-dare" | "would-you-rather" | "never-have-i-ever" | "party" | "classroom";

export type GameMode = "easy" | "medium" | "hard" | "extreme";

export type TournamentType = "single-elimination" | "double-elimination" | "round-robin" | "swiss";

export type UserRole = "host" | "participant" | "spectator";

export type UserRank = "rookie" | "explorer" | "challenger" | "master" | "legend";

export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  xp: number;
  rank: UserRank;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  type: RoomType;
  host_id: string;
  is_public: boolean;
  is_locked: boolean;
  max_participants: number;
  created_at: string;
  settings: Record<string, unknown>;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  role: UserRole;
  is_online: boolean;
  joined_at: string;
  user?: User;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  members: string[];
}

export interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  player1?: string;
  player2?: string;
  score1?: number;
  score2?: number;
  winner?: string;
  status: "pending" | "in-progress" | "completed";
}

export interface WheelEntry {
  id: string;
  label: string;
  color: string;
  weight: number;
  image?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at?: string;
}

export interface ShareCard {
  title: string;
  subtitle: string;
  type: RoomType;
  data: Record<string, unknown>;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "room-invite" | "mention" | "winner" | "achievement" | "tournament";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}
