import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const ACTIVITY_REGISTRY: Record<string, ComponentType> = {
  "coin-flip":         dynamic(() => import("./coin-flip-activity").then(m => m.CoinFlipActivity),         { ssr: false }),
  "dice":              dynamic(() => import("./dice-activity").then(m => m.DiceActivity),                  { ssr: false }),
  "lucky-wheel":       dynamic(() => import("./lucky-wheel-activity").then(m => m.LuckyWheelActivity),     { ssr: false }),
  "guess-number":      dynamic(() => import("./guess-number-activity").then(m => m.GuessNumberActivity),   { ssr: false }),
  "bingo":             dynamic(() => import("./bingo-activity").then(m => m.BingoActivity),                { ssr: false }),
  "word-scramble":     dynamic(() => import("./word-scramble-activity").then(m => m.WordScrambleActivity), { ssr: false }),
  "truth-or-dare":     dynamic(() => import("./truth-or-dare-activity").then(m => m.TruthOrDareActivity),  { ssr: false }),
  "would-you-rather":  dynamic(() => import("./would-you-rather-activity").then(m => m.WouldYouRatherActivity), { ssr: false }),
  "never-have-i-ever": dynamic(() => import("./never-have-i-ever-activity").then(m => m.NeverHaveIEverActivity), { ssr: false }),
  "rps":               dynamic(() => import("./rps-activity").then(m => m.RpsActivity),                   { ssr: false }),
  "team-maker":        dynamic(() => import("./team-maker-activity").then(m => m.TeamMakerActivity),       { ssr: false }),
  "tournament":        dynamic(() => import("./tournament-activity").then(m => m.TournamentActivity),      { ssr: false }),
  "name-draw":         dynamic(() => import("./name-draw-activity").then(m => m.NameDrawActivity),         { ssr: false }),
  "trivia":            dynamic(() => import("./trivia-activity").then(m => m.TriviaActivity),              { ssr: false }),
};
