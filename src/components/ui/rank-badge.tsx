import { Compass, Flame, Star, Crown, Circle, type LucideIcon } from "lucide-react"

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { UserRank } from "@/lib/types"

interface RankTier {
  rank: UserRank
  label: string
  icon: LucideIcon | null
  color: string
  floor: number
  desc: string
}

export const RANK_TIERS: RankTier[] = [
  { rank: "rookie", label: "Rookie", icon: null, color: "var(--fog-500)", floor: 0, desc: "Everyone starts here — no XP earned yet." },
  { rank: "explorer", label: "Explorer", icon: Compass, color: "var(--cyan-500)", floor: 100, desc: "First 100 XP — you've started earning points." },
  { rank: "challenger", label: "Challenger", icon: Flame, color: "var(--coral-500)", floor: 300, desc: "300+ XP — a regular winner." },
  { rank: "master", label: "Master", icon: Star, color: "var(--violet-500)", floor: 700, desc: "700+ XP — one of the room's strongest players." },
  { rank: "legend", label: "Legend", icon: Crown, color: "var(--lime-400)", floor: 1500, desc: "1500+ XP — the top tier. Rare and hard-earned." },
]
const TIER_BY_RANK = Object.fromEntries(RANK_TIERS.map((t) => [t.rank, t])) as Record<UserRank, RankTier>

/**
 * XP-tier badge shown next to a participant's name. Renders nothing at 0 XP
 * (ADR-009) — most rooms never touch the 3 XP-earning games (Trivia/RPS/
 * Bingo), so showing "Rookie" for everyone would just be noise.
 */
export function RankBadge({ xp, rank }: { xp?: number; rank?: UserRank }) {
  if (!xp || xp <= 0 || !rank) return null
  const tier = TIER_BY_RANK[rank]
  if (!tier) return null
  const Icon = tier.icon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-pill px-2 font-body text-[10px] font-bold"
            style={{
              color: tier.color,
              background: `color-mix(in srgb, ${tier.color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tier.color} 35%, transparent)`,
            }}
          />
        }
      >
        {Icon ? <Icon className="size-2.5" /> : null}
        {tier.label}
      </TooltipTrigger>
      <TooltipContent>
        {tier.label} — {tier.desc}
      </TooltipContent>
    </Tooltip>
  )
}

/** Full reference card explaining every rank tier — drop into a Dialog/Popover anywhere a RankBadge appears. */
export function RankLegend() {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="font-body text-sm text-(--text-secondary)">
        Rank is earned from XP — points from Trivia, Rock Paper Scissors, and Bingo. Other games don&apos;t award XP.
      </p>
      {RANK_TIERS.map((t) => {
        const Icon = t.icon ?? Circle
        return (
          <div key={t.rank} className="flex items-center gap-2.5">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{
                color: t.color,
                background: `color-mix(in srgb, ${t.color} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${t.color} 35%, transparent)`,
              }}
            >
              <Icon className={t.icon ? "size-3.5" : "size-2.5"} />
            </span>
            <div className="flex-1">
              <div className="font-body text-[13px] font-bold text-foreground">
                {t.label}{" "}
                <span className="font-semibold text-(--text-secondary)">— {t.floor} XP</span>
              </div>
              <div className="font-body text-xs text-(--text-secondary)">{t.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
