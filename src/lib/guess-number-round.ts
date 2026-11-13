// Round rules for the in-room Guess the Number game (audit G-10).
//
// The server compares a guess with the secret (`check_guess_number`, migration
// 0028) but has no idea what a "round" is: it keeps answering "correct" for the
// same number for as long as the secret stays. The round therefore lives in the
// shared event log, and these two functions are the whole rule, so every client
// and every replay of the log (a refresh, a late joiner) reaches the same state.

export interface GuessEntry {
  username: string;
  guess: number;
  hint: string;
}

/** The first correct guess of the round, or null while nobody has found the number. */
export function roundWinner(history: readonly GuessEntry[]): GuessEntry | null {
  return history.find((g) => g.hint === "correct") ?? null;
}

/**
 * Add a guess to the round. Once someone has guessed the number the round is
 * over, so anything that arrives after it is dropped: a second "correct" that was
 * already in flight when the first one landed must not make a second winner, and
 * a guess typed after the result must not appear under it.
 */
export function addGuess(history: readonly GuessEntry[], entry: GuessEntry): GuessEntry[] {
  if (roundWinner(history)) return [...history];
  return [...history, entry];
}
