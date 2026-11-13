// Display rules for the in-room Rock Paper Scissors list (audit G-5 and G-6).
//
// Picks are stored by user id, but the list used to decide who may see a pick, and
// how to name its owner, from the display name. Names are editable and not unique, so
// two players called alike each saw the other's pick before the round was decided, and
// the result could read "Sam, Sam win!".

export interface RpsPick {
  username: string;
  choice: string;
}

/**
 * Whether the viewer may see a pick yet: their own always, everyone's once the round
 * has resolved. Decided by user id, never by name.
 */
export function canSeePick(pickUserId: string, viewerId: string, roundResolved: boolean): boolean {
  return roundResolved || pickUserId === viewerId;
}

/**
 * The name to show for each player who has picked. A name that more than one of them
 * uses gets a short user-id suffix (the same style as disambiguatedUsernames in
 * utils.ts); a name nobody else uses is returned as it is.
 */
export function rpsLabels(picks: Readonly<Record<string, RpsPick>>): Record<string, string> {
  const counts = new Map<string, number>();
  for (const { username } of Object.values(picks)) {
    counts.set(username, (counts.get(username) ?? 0) + 1);
  }
  return Object.fromEntries(
    Object.entries(picks).map(([userId, { username }]) => [
      userId,
      (counts.get(username) ?? 0) > 1 ? `${username} (${userId.slice(0, 4)})` : username,
    ]),
  );
}
