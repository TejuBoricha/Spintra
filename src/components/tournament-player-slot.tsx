import { isByePlayer } from "@/lib/tournament-engine";

/**
 * One player's name on a tournament match card: the name itself, an italic "BYE"
 * for a bye, or an italic "TBD" while the slot waits for its player. Shared by the
 * tool page's card and the room's card, which had the same expression pasted four
 * times and drifted once already (audit T-14).
 */
export function PlayerSlot({ name }: { name: string | null | undefined }) {
  if (isByePlayer(name)) return <span className="text-muted-foreground italic">BYE</span>;
  return name ? <>{name}</> : <span className="text-muted-foreground italic">TBD</span>;
}
