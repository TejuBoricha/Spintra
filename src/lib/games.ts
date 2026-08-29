import type { LucideIcon } from "lucide-react";
import {
  Users,
  Disc3,
  UserRoundPen,
  Trophy,
  Coins,
  Dice1,
  Hash,
  Sword,
  MessageCircleQuestion,
  Split,
  HeartHandshake,
  PartyPopper,
  GraduationCap,
  Lightbulb,
  Grid3x3,
  Shuffle,
  Building2,
} from "lucide-react";
import type { RoomType } from "@/lib/types";

export interface GameDefinition {
  type: RoomType;
  label: string;
  icon: LucideIcon;
  color: string;
  desc: string;
  featureDescription: string;
  stats: string;
  href: string;
  createOnly?: boolean;
  /** Safe to offer in a Classroom-mode room (no party/social/confessional content) */
  classroomSafe?: boolean;
}

export const GAMES: GameDefinition[] = [
  {
    type: "team-maker",
    label: "Team Maker",
    icon: Users,
    color: "from-purple-500 to-pink-500",
    desc: "Build balanced teams together",
    featureDescription:
      "Build balanced teams instantly with intelligent algorithms. Drag, drop, customize — real-time for everyone.",
    stats: "Millions of teams created",
    href: "/tools/team-maker",
    classroomSafe: true,
  },
  {
    type: "lucky-wheel",
    label: "Lucky Wheel",
    icon: Disc3,
    color: "from-cyan-500 to-blue-500",
    desc: "Spin and win together",
    featureDescription:
      "Physics-based 3D spinning wheel with custom entries, colors, and sounds. Multiplayer synchronized.",
    stats: "Everyone watches together",
    href: "/tools/lucky-wheel",
    classroomSafe: true,
  },
  {
    type: "name-draw",
    label: "Name Draw",
    icon: UserRoundPen,
    color: "from-amber-500 to-orange-500",
    desc: "Pick random winners",
    featureDescription:
      "Random name picker with elimination mode, CSV imports, and winner spotlight animations.",
    stats: "Fair draws guaranteed",
    href: "/tools/name-draw",
    classroomSafe: true,
  },
  {
    type: "tournament",
    label: "Tournament",
    icon: Trophy,
    color: "from-emerald-500 to-teal-500",
    desc: "Run competitive brackets",
    featureDescription:
      "Generate brackets for single/double elimination, round robin, Swiss. Live updates, shareable.",
    stats: "Pro-level brackets",
    href: "/tools/tournament",
    classroomSafe: true,
  },
  {
    type: "coin-flip",
    label: "Coin Flip",
    icon: Coins,
    color: "from-yellow-500 to-amber-500",
    desc: "Heads or tails",
    featureDescription: "Flip a coin with friends and settle debates in real time.",
    stats: "Quick decisions made fun",
    href: "/tools/coin-flip",
    classroomSafe: true,
  },
  {
    type: "dice",
    label: "Dice Roller",
    icon: Dice1,
    color: "from-red-500 to-rose-500",
    desc: "Roll any dice",
    featureDescription: "Roll custom dice sets together — perfect for tabletop and party games.",
    stats: "Any dice, any count",
    href: "/tools/dice",
    classroomSafe: true,
  },
  {
    type: "guess-number",
    label: "Guess Number",
    icon: Hash,
    color: "from-blue-500 to-indigo-500",
    desc: "Number guessing game",
    featureDescription: "Take turns guessing the secret number with live hints and reactions.",
    stats: "Classic group fun",
    href: "/tools/guess-number",
    classroomSafe: true,
  },
  {
    type: "rps",
    label: "Rock Paper Scissors",
    icon: Sword,
    color: "from-orange-500 to-red-500",
    desc: "Classic showdown",
    featureDescription: "Challenge friends to rock paper scissors with synchronized reveals.",
    stats: "Instant showdowns",
    href: "/tools/rps",
    classroomSafe: true,
  },
  {
    type: "truth-or-dare",
    label: "Truth or Dare",
    icon: MessageCircleQuestion,
    color: "from-pink-500 to-rose-500",
    desc: "Spicy questions",
    featureDescription: "Draw truths and dares together — great for parties and friend groups.",
    stats: "Party favorite",
    href: "/tools/truth-or-dare",
    classroomSafe: false,
  },
  {
    type: "would-you-rather",
    label: "Would You Rather",
    icon: Split,
    color: "from-indigo-500 to-purple-500",
    desc: "Tough choices",
    featureDescription: "Vote on impossible choices and see what your group picks live.",
    stats: "Debate starter",
    href: "/tools/would-you-rather",
    classroomSafe: false,
  },
  {
    type: "never-have-i-ever",
    label: "Never Have I Ever",
    icon: HeartHandshake,
    color: "from-violet-500 to-purple-500",
    desc: "Group confessions",
    featureDescription: "Play never have I ever with prompts that keep the room laughing.",
    stats: "Icebreaker classic",
    href: "/tools/never-have-i-ever",
    classroomSafe: false,
  },
  {
    type: "trivia",
    label: "Trivia",
    icon: Lightbulb,
    color: "from-yellow-400 to-orange-500",
    desc: "Test your knowledge",
    featureDescription: "Answer multiple-choice trivia questions together and see who gets the most right.",
    stats: "Know-it-alls welcome",
    href: "/tools/trivia",
    classroomSafe: true,
  },
  {
    type: "bingo",
    label: "Bingo",
    icon: Grid3x3,
    color: "from-teal-500 to-cyan-600",
    desc: "Classic number bingo",
    featureDescription: "Call numbers, mark your card, and shout bingo the moment you get a line.",
    stats: "A party classic",
    href: "/tools/bingo",
    classroomSafe: true,
  },
  {
    type: "word-scramble",
    label: "Word Scramble",
    icon: Shuffle,
    color: "from-lime-500 to-green-600",
    desc: "Unscramble the word",
    featureDescription: "Race to unscramble the word before anyone else — hints included.",
    stats: "Fast-paced wordplay",
    href: "/tools/word-scramble",
    classroomSafe: true,
  },
  {
    type: "party",
    label: "Party Mode",
    icon: PartyPopper,
    color: "from-fuchsia-500 to-pink-500",
    desc: "All games unlocked",
    featureDescription: "Unlock every game in one room — perfect for game nights and hangouts.",
    stats: "Everything in one room",
    href: "/create?type=party",
    createOnly: true,
  },
  {
    type: "classroom",
    label: "Classroom",
    icon: GraduationCap,
    color: "from-sky-500 to-cyan-500",
    desc: "Educational activities",
    featureDescription: "Teacher-friendly tools for picks, teams, and classroom activities.",
    stats: "Built for educators",
    href: "/create?type=classroom",
    createOnly: true,
  },
  {
    type: "city",
    label: "Spintra City",
    icon: Building2,
    color: "from-amber-500 to-yellow-500",
    desc: "Buy, build, and trade your way to the top",
    featureDescription:
      "A property-trading board game for 2-8 players. Roll, buy, develop, and negotiate — the board is refereed by the server, so nobody can cheat.",
    stats: "2-8 players, one winner",
    // No standalone tool page: Spintra City needs at least 2 real people (no
    // bots by design), so there is nothing to play solo. Uses the same
    // createOnly + /create?type= shape as Party Mode and Classroom.
    href: "/create?type=city",
    createOnly: true,
    // Deliberately explicit, NOT left undefined. create-client.tsx's classroom
    // filter tests `classroomSafe !== false`, so an unset flag would silently
    // opt this into Classroom mode — see docs/SPINTRA_CITY_SPEC.md §5.5.
    // A full match runs far longer than a class period, so it's excluded.
    classroomSafe: false,
  },
];

export function getGameByType(type: RoomType): GameDefinition | undefined {
  return GAMES.find((game) => game.type === type);
}

export function getGameHref(type: RoomType): string {
  return getGameByType(type)?.href ?? `/create?type=${type}`;
}
