// Other real words that can be made from the same letters as a Word Scramble word
// (audit G-11). The game compared a guess with one exact word, so a student who
// unscrambled FOREST as SOFTER, or MARBLE as RAMBLE, was told "Not quite".
//
// Keyed by the bank word (WORD_SCRAMBLE_WORDS in utils.ts, which is also what the
// activity_prompts seed holds); the other spellings are the dictionary words with
// the same letters. Generated, not typed: for each bank word, take every word of
// the "word-list" npm package (4.1.0, run once outside the repo) whose sorted
// letters match, minus the word itself. A word with no other spelling has no entry.
// When a word is added to the bank, run that again and add its entry.

export const WORD_SCRAMBLE_ALTERNATES: Readonly<Record<string, readonly string[]>> = {
  BREEZE: ["BEEZER"],
  CANDLE: ["LANCED"],
  CASTLE: ["CLEATS", "ECLATS", "LACETS", "SCLATE"],
  FOREST: ["FETORS", "FORTES", "FOSTER", "SOFTER"],
  MARBLE: ["AMBLER", "BLAMER", "LAMBER", "RAMBLE"],
  PLANET: ["PLATEN"],
  PUZZLE: ["PUZZEL"],
};

/** A word's letters in alphabetical order: two words are anagrams when these match. */
export function lettersKey(word: string): string {
  return word.toUpperCase().split("").sort().join("");
}

const ALTERNATES_BY_LETTERS = new Map<string, readonly string[]>(
  Object.entries(WORD_SCRAMBLE_ALTERNATES).map(([word, others]) => [lettersKey(word), others]),
);

/**
 * True when the guess is a different real word made from the same letters as the
 * scrambled word on screen. The word itself is not counted: callers check that
 * first (the room game by its hash, the standalone tool by comparing the text).
 */
export function isAnagramAlternate(scrambled: string, guess: string): boolean {
  const others = ALTERNATES_BY_LETTERS.get(lettersKey(scrambled));
  return !!others && others.includes(guess.trim().toUpperCase());
}
