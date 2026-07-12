"use client";

import { create as createConfetti } from "canvas-confetti";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SITE_PALETTE = ["#e2f72a", "#3ddaee", "#e43c20", "#6d3ee0"];

// The site's CSP has no worker-src allowance, so canvas-confetti's default
// export (which always renders via a blob Worker) gets silently blocked —
// the Worker never throws, it just never responds, so nothing renders.
// Creating our own instance with useWorker: false forces main-thread canvas
// rendering instead, which isn't subject to that restriction.
const fire = typeof window !== "undefined" ? createConfetti(undefined, { resize: true, useWorker: false }) : null;

/** Fires a confetti burst tuned to the site's lime/cyan/coral/violet palette. */
export function fireConfetti() {
  fire?.({
    particleCount: 120,
    spread: 80,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors: SITE_PALETTE,
    zIndex: 100,
    disableForReducedMotion: true,
  });
}

const ACCENT_TITLE_CLASS: Record<"brand" | "gold", string> = {
  brand: "gradient-text",
  gold: "bg-gradient-to-r from-amber-400 to-(--coral-400) bg-clip-text text-transparent",
};

interface CelebrationBannerProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  className?: string;
  /** Title gradient preset. "brand" (default) is the lime/cyan brand gradient; "gold" is the
   *  amber/coral gradient used for the site's biggest win moment (tournament champion). */
  accent?: "brand" | "gold";
  /** Escape hatch for a fully custom title gradient — overrides `accent` when provided. */
  titleClassName?: string;
}

/** Shared "you won" banner: flat toy-block card, spring-in icon, gradient-text title. */
export function CelebrationBanner({ icon, title, subtitle, className, accent = "brand", titleClassName }: CelebrationBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-(--border-hairline) bg-(--surface-panel) p-6 text-center shadow-1",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-(--lime-400)/10 via-(--cyan-400)/10 to-(--lime-400)/10" />
      <div className="relative z-10">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-3 flex justify-center"
        >
          {icon}
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn("font-display text-3xl sm:text-4xl font-bold", titleClassName ?? ACCENT_TITLE_CLASS[accent])}
        >
          {title}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-2 flex items-center justify-center gap-1.5 font-body font-medium text-(--brand-primary-strong)"
        >
          {subtitle}
        </motion.p>
      </div>
    </motion.div>
  );
}
