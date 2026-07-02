"use client";

import { create as createConfetti } from "canvas-confetti";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SITE_PALETTE = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"];

// The site's CSP has no worker-src allowance, so canvas-confetti's default
// export (which always renders via a blob Worker) gets silently blocked —
// the Worker never throws, it just never responds, so nothing renders.
// Creating our own instance with useWorker: false forces main-thread canvas
// rendering instead, which isn't subject to that restriction.
const fire = typeof window !== "undefined" ? createConfetti(undefined, { resize: true, useWorker: false }) : null;

/** Fires a confetti burst tuned to the site's violet/cyan/amber palette. */
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

interface CelebrationBannerProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  className?: string;
  /** Title gradient. Defaults to the site's standard violet/cyan brand gradient; tournament's
   *  bracket-champion moment uses an amber/gold gradient since it's the site's biggest win. */
  titleClassName?: string;
}

/** Shared "you won" banner: glass-card, gradient overlay, spring-in icon, gradient-text title. */
export function CelebrationBanner({ icon, title, subtitle, className, titleClassName = "gradient-text" }: CelebrationBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("glass-card p-6 text-center relative overflow-hidden", className)}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10" />
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
          className={cn("text-3xl sm:text-4xl font-bold", titleClassName)}
        >
          {title}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-emerald-400/80 font-medium mt-2 flex items-center justify-center gap-1.5"
        >
          {subtitle}
        </motion.p>
      </div>
    </motion.div>
  );
}
