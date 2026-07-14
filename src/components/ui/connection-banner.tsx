import { Loader2, WifiOff, DoorClosed, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConnectionState = "connected" | "reconnecting" | "offline" | "host-left" | "full"

interface ConnectionBannerProps {
  state?: ConnectionState
  onRetry?: () => void
  onExit?: () => void
  className?: string
}

const CONFIG = {
  reconnecting: {
    bg: "bg-primary/12",
    border: "border-primary",
    icon: Loader2,
    spin: true,
    text: "Reconnecting…",
    sub: "Your seat is held — this usually takes a few seconds.",
  },
  offline: {
    bg: "bg-destructive/12",
    border: "border-destructive",
    icon: WifiOff,
    spin: false,
    text: "You're offline",
    sub: "Check your connection — we'll reconnect automatically.",
  },
  "host-left": {
    bg: "bg-destructive/12",
    border: "border-destructive",
    icon: DoorClosed,
    spin: false,
    text: "The host ended this room",
    sub: "You can start a new room or head back home.",
  },
  full: {
    bg: "bg-destructive/12",
    border: "border-destructive",
    icon: Users,
    spin: false,
    text: "This room is full",
    sub: "Ask the host to raise the participant limit, or try again later.",
  },
} as const

/** Global connection-state banner — pin to the top of the room viewport; only one state renders at a time. */
export function ConnectionBanner({ state, onRetry, onExit, className }: ConnectionBannerProps) {
  if (!state || state === "connected") return null
  const c = CONFIG[state]
  const Icon = c.icon

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b-2 px-5 py-3 font-body text-foreground",
        c.bg,
        c.border,
        className
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", c.spin && "animate-spin")} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold">{c.text}</div>
        <div className="text-sm text-muted-foreground">{c.sub}</div>
      </div>
      {(state === "host-left" || state === "full") && (
        <Button variant="secondary" size="sm" onClick={onExit}>
          Go home
        </Button>
      )}
      {state === "offline" && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry now
        </Button>
      )}
    </div>
  )
}
