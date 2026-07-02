"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// 3D emoji renders from Microsoft's Fluent Emoji set (MIT licensed):
// https://github.com/microsoft/fluentui-emoji — self-hosted under
// public/emoji/ so the site doesn't depend on an external CDN staying up.
export const EMOJI_UNICODE = {
  thumbs_up: "👍",
  red_heart: "❤️",
  face_with_tears_of_joy: "😂",
  party_popper: "🎉",
  fire: "🔥",
  hundred_points: "💯",
  eyes: "👀",
  raising_hands: "🙌",
  game_die: "🎲",
  ferris_wheel: "🎡",
  thinking_face: "🤔",
  performing_arts: "🎭",
  raised_hand: "✋",
  person_gesturing_no: "🙅",
  see_no_evil_monkey: "🙈",
  raised_fist: "✊",
  victory_hand: "✌️",
  shushing_face: "🤫",
  busts_in_silhouette: "👥",
  admission_tickets: "🎟️",
  trophy: "🏆",
  books: "📚",
  bullseye: "🎯",
  sports_medal: "🏅",
  coin: "🪙",
  eagle: "🦅",
  disappointed_face: "😞",
  wrapped_gift: "🎁",
  pizza: "🍕",
  crying_face: "😢",
  clapper_board: "🎬",
  broom: "🧹",
  face_screaming_in_fear: "😱",
  flushed_face: "😳",
  baby_angel: "👼",
  rock: "🪨",
  page_facing_up: "📄",
  scissors: "✂️",
  handshake: "🤝",
  question_mark: "❓",
  robot: "🤖",
  cricket_game: "🏏",
  soccer_ball: "⚽",
  video_game: "🎮",
  water_pistol: "🔫",
  briefcase: "💼",
  two_hearts: "💕",
} as const;

export type EmojiName = keyof typeof EMOJI_UNICODE;

interface EmojiProps {
  name: EmojiName;
  /** Pixel size (square). Default 24. */
  size?: number;
  /** Wiggle + scale on hover/tap. Default true. */
  animated?: boolean;
  /** Spring pop-in on mount, for result reveals (dice rolls, wheel winners, wins). Default false. */
  pop?: boolean;
  className?: string;
  /** Override the accessible label (defaults to the emoji's native glyph). */
  label?: string;
}

export function Emoji({ name, size = 24, animated = true, pop = false, className, label }: EmojiProps) {
  return (
    <motion.img
      src={`/emoji/${name}.png`}
      alt={label ?? EMOJI_UNICODE[name]}
      role="img"
      aria-label={label ?? EMOJI_UNICODE[name]}
      draggable={false}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("inline-block select-none pointer-events-auto", className)}
      initial={pop ? { scale: 0, rotate: -20 } : false}
      animate={pop ? { scale: 1, rotate: 0 } : undefined}
      whileHover={animated ? { scale: 1.25, rotate: [0, -8, 8, -4, 0] } : undefined}
      whileTap={animated ? { scale: 0.85 } : undefined}
      transition={
        pop
          ? {
              scale: { type: "spring", stiffness: 350, damping: 14 },
              rotate: { type: "tween", duration: 0.4, ease: "easeInOut" },
            }
          : {
              scale: { type: "spring", stiffness: 400, damping: 12 },
              rotate: { type: "tween", duration: 0.4, ease: "easeInOut" },
            }
      }
    />
  );
}

const UNICODE_TO_NAME = new Map<string, EmojiName>(
  (Object.entries(EMOJI_UNICODE) as [EmojiName, string][]).map(([name, glyph]) => [glyph, name])
);

const SPLIT_PATTERN = new RegExp(
  `(${[...UNICODE_TO_NAME.keys()]
    .sort((a, b) => b.length - a.length)
    .map((glyph) => glyph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
  "g"
);

/** Splits text on any known emoji glyph and renders those as inline 3D images. */
export function renderTextWithEmoji(text: string, size = 20) {
  return text.split(SPLIT_PATTERN).map((part, i) => {
    const name = UNICODE_TO_NAME.get(part);
    return name ? (
      <Emoji key={i} name={name} size={size} animated={false} className="mx-0.5 align-text-bottom" />
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}
