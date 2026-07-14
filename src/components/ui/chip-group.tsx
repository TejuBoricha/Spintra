"use client"

import { useRef, type ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface ChipGroupOption {
  value: string
  label: string
  icon?: ReactNode
}

interface ChipGroupProps {
  options: ChipGroupOption[]
  value: string
  onChange: (value: string) => void
  size?: "sm" | "md"
  ariaLabel?: string
  className?: string
}

/** Single-select chip/segmented row with full keyboard support — arrow-key roving tabindex, Home/End, role="radiogroup". Use for game switchers, category filters, mode toggles: anywhere a row of mutually-exclusive chips replaces a native select. */
export function ChipGroup({ options, value, onChange, size = "md", ariaLabel, className }: ChipGroupProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next: number | null = null
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + options.length) % options.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = options.length - 1
    if (next !== null) {
      e.preventDefault()
      onChange(options[next].value)
      refs.current[next]?.focus()
    }
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-pill font-body font-semibold whitespace-nowrap transition-colors",
              size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs",
              active
                ? "border-2 border-primary bg-primary/10 text-(--brand-primary-strong)"
                : "border border-(--border-hairline) bg-(--surface-sunken) text-(--text-secondary) hover:text-foreground"
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
