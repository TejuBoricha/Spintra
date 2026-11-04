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
  /** Short factual tag shown on game cards. Not a usage count. */
  tagline: string;
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
    desc: "Split a group into teams",
    featureDescription:
      "Add names, pick how many teams, and everyone is shuffled into even groups. In a room, each person sees their team on their own screen.",
    tagline: "Even teams, one click",
    href: "/tools/team-maker",
    classroomSafe: true,
  },
  {
    type: "lucky-wheel",
    label: "Lucky Wheel",
    icon: Disc3,
    color: "from-cyan-500 to-blue-500",
    desc: "Spin to pick something",
    featureDescription:
      "Customize slices with your own names, options, and colors, then spin the wheel. In a room, everyone watches the wheel land together in real time.",
    tagline: "Everyone watches together",
    href: "/tools/lucky-wheel",
    classroomSafe: true,
  },
  {
    type: "name-draw",
    label: "Name Draw",
    icon: UserRoundPen,
    color: "from-amber-500 to-orange-500",
    desc: "Draw a random name",
    featureDescription:
      "Pick a random name from your list with custom animations. Turn on elimination mode to draw several winners, or paste names directly from a CSV.",
    tagline: "Elimination mode included",
    href: "/tools/name-draw",
    classroomSafe: true,
  },
  {
    type: "tournament",
    label: "Tournament",
    icon: Trophy,
    color: "from-emerald-500 to-teal-500",
    desc: "Run a bracket",
    featureDescription:
      "Generate single elimination, double elimination, round robin, or Swiss brackets. Update match scores live and the bracket updates for everyone.",
    tagline: "Four bracket formats",
    href: "/tools/tournament",
    classroomSafe: true,
  },
  {
    type: "coin-flip",
    label: "Coin Flip",
    icon: Coins,
    color: "from-yellow-500 to-amber-500",
    desc: "Heads or tails",
    featureDescription:
      "Flip a 3D virtual coin with realistic physics for quick decisions. Play solo or in a room where everyone watches the flip land simultaneously.",
    tagline: "One tap",
    href: "/tools/coin-flip",
    classroomSafe: true,
  },
  {
    type: "dice",
    label: "Dice Roller",
    icon: Dice1,
    color: "from-red-500 to-rose-500",
    desc: "Roll any dice",
    featureDescription:
      "Roll any combination of 3D polyhedral dice for board games and tabletop RPGs. View live totals, roll histories, and synchronized room rolls.",
    tagline: "Any dice, any count",
    href: "/tools/dice",
    classroomSafe: true,
  },
  {
    type: "guess-number",
    label: "Guess Number",
    icon: Hash,
    color: "from-blue-500 to-indigo-500",
    desc: "Number guessing game",
    featureDescription:
      "A secret number is chosen and players guess the answer with higher or lower hints after each try. Compete solo or with friends in real time.",
    tagline: "Higher or lower",
    href: "/tools/guess-number",
    classroomSafe: true,
  },
  {
    type: "rps",
    label: "Rock Paper Scissors",
    icon: Sword,
    color: "from-orange-500 to-red-500",
    desc: "Rock, paper, or scissors",
    featureDescription:
      "Play classic Rock Paper Scissors against the computer or live friends. In a room, all player choices remain hidden and reveal at the exact same moment.",
    tagline: "Picks revealed together",
    href: "/tools/rps",
    classroomSafe: true,
  },
  {
    type: "truth-or-dare",
    label: "Truth or Dare",
    icon: MessageCircleQuestion,
    color: "from-pink-500 to-rose-500",
    desc: "Truths and dares for groups",
    featureDescription:
      "Pick from hundreds of clean, fun, and spicy truth or dare prompts, or add your own custom cards. Great for parties, icebreakers, and game nights.",
    tagline: "For parties",
    href: "/tools/truth-or-dare",
    classroomSafe: false,
  },
  {
    type: "would-you-rather",
    label: "Would You Rather",
    icon: Split,
    color: "from-indigo-500 to-purple-500",
    desc: "Tough choices",
    featureDescription:
      "Vote on hilarious dilemmas and tough choices, then watch how the room votes split in real time. Perfect for parties, classrooms, and stream games.",
    tagline: "Either-or votes",
    href: "/tools/would-you-rather",
    classroomSafe: false,
  },
  {
    type: "never-have-i-ever",
    label: "Never Have I Ever",
    icon: HeartHandshake,
    color: "from-violet-500 to-purple-500",
    desc: "Group confessions",
    featureDescription:
      "Read exciting prompts and discover who among your friends has done it. Built-in themed decks and custom prompt support for unforgettable game nights.",
    tagline: "Good icebreaker",
    href: "/tools/never-have-i-ever",
    classroomSafe: false,
  },
  {
    type: "trivia",
    label: "Trivia",
    icon: Lightbulb,
    color: "from-yellow-400 to-orange-500",
    desc: "Quiz your group",
    featureDescription:
      "Answer fast-paced multiple-choice trivia questions across multiple categories. Track live scoreboards and find out who has the highest knowledge score.",
    tagline: "Multiple choice",
    href: "/tools/trivia",
    classroomSafe: true,
  },
  {
    type: "bingo",
    label: "Bingo",
    icon: Grid3x3,
    color: "from-teal-500 to-cyan-600",
    desc: "Classic number bingo",
    featureDescription:
      "Generate custom bingo cards, call random numbers or terms, and track cards live. Includes auto-check verification and cards that survive page reloads.",
    tagline: "Cards survive a reload",
    href: "/tools/bingo",
    classroomSafe: true,
  },
  {
    type: "word-scramble",
    label: "Word Scramble",
    icon: Shuffle,
    color: "from-lime-500 to-green-600",
    desc: "Unscramble the word",
    featureDescription:
      "Race against the clock to unscramble jumbled words. Take advantage of smart letter hints, score multipliers, and compete solo or with your friends.",
    tagline: "Hints available",
    href: "/tools/word-scramble",
    classroomSafe: true,
  },
  {
    type: "party",
    label: "Party Mode",
    icon: PartyPopper,
    color: "from-fuchsia-500 to-pink-500",
    desc: "Every game in one room",
    featureDescription:
      "Access every Spintra party game and decision tool in one shared multiplayer room. Switch between games seamlessly without creating new room codes.",
    tagline: "For game nights",
    href: "/create?type=party",
    createOnly: true,
  },
  {
    type: "classroom",
    label: "Classroom",
    icon: GraduationCap,
    color: "from-sky-500 to-cyan-500",
    desc: "Classroom-safe games only",
    featureDescription:
      "Launch classroom-safe decision wheels, name pickers, and quizzes. Safe student mode automatically filters out all party and social confession decks.",
    tagline: "For teachers",
    href: "/create?type=classroom",
    createOnly: true,
  },
  {
    type: "city",
    label: "Spintra City",
    icon: Building2,
    color: "from-amber-500 to-yellow-500",
    desc: "A Monopoly-style board game for 2 to 8 players",
    featureDescription:
      "Buy cities, build on them, and trade with the other players until one of you owns the board. The server checks every move, so nobody can cheat.",
    tagline: "2-8 players, one winner",
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
