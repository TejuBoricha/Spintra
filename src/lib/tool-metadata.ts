import type { Metadata } from "next";
import { GAMES } from "@/lib/games";

/**
 * The <title> of each tool page. It leads with what people type into a search
 * engine ("random name picker", "team generator", "coin flip") instead of the
 * tool's own label, and stays under about 60 characters so it is not cut off in
 * results (audit X-5: the titles were just "Name Draw | Spintra").
 */
export const TOOL_SEO_TITLES: Record<string, string> = {
  "/tools/team-maker": "Random Team Generator: Split Into Teams | Spintra",
  "/tools/lucky-wheel": "Wheel Spinner: Free Online Random Wheel | Spintra",
  "/tools/name-draw": "Random Name Picker: Free Online Name Draw | Spintra",
  "/tools/tournament": "Tournament Bracket Generator: Free Online | Spintra",
  "/tools/coin-flip": "Coin Flip: Free Online Heads or Tails | Spintra",
  "/tools/dice": "Dice Roller: Free Online Dice Simulator | Spintra",
  "/tools/guess-number": "Number Guessing Game: Play Online | Spintra",
  "/tools/rps": "Rock Paper Scissors Online: Free Game | Spintra",
  "/tools/truth-or-dare": "Truth or Dare Generator: Free Questions and Dares | Spintra",
  "/tools/would-you-rather": "Would You Rather Questions: Free Online Game | Spintra",
  "/tools/never-have-i-ever": "Never Have I Ever Questions: Free Online Game | Spintra",
  "/tools/trivia": "Trivia Quiz Game: Free Online Trivia | Spintra",
  "/tools/bingo": "Bingo Card Generator: Free Online Bingo | Spintra",
  "/tools/word-scramble": "Word Scramble Game: Free Online Puzzle | Spintra",
};

/**
 * Build per-tool <head> metadata from the canonical GAMES registry, so tool
 * pages rank as distinct pages (each was previously invisible to search
 * engines behind the one root title). Tool pages are client components and
 * cannot export metadata themselves — each tool's layout.tsx calls this.
 */
export function toolMetadata(href: string): Metadata {
  const game = GAMES.find((g) => g.href === href);
  if (!game) throw new Error(`toolMetadata: no GAMES entry with href ${href}`);
  const title = TOOL_SEO_TITLES[href] ?? `${game.label} | Spintra`;
  return {
    title,
    description: game.featureDescription,
    alternates: { canonical: href },
    openGraph: {
      title,
      description: game.desc,
      url: href,
      type: "website",
    },
  };
}
