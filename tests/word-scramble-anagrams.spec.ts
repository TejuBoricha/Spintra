import { test, expect } from '@playwright/test';
import { WORD_SCRAMBLE_WORDS } from '../src/lib/utils';
import { WORD_SCRAMBLE_ALTERNATES, isAnagramAlternate, lettersKey } from '../src/lib/word-scramble-anagrams';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration();

// Audit G-11: Word Scramble compared a guess with one exact word, so FOREST unscrambled as
// SOFTER, or MARBLE as RAMBLE, was answered "Not quite". These pin the table of other real
// words and the rule that uses it (the pages themselves are in word-scramble-tool-anagrams
// and qa-x39-word-scramble-anagrams).

test('every entry belongs to a bank word, and uses exactly that word\'s letters', () => {
  for (const [word, others] of Object.entries(WORD_SCRAMBLE_ALTERNATES)) {
    expect(WORD_SCRAMBLE_WORDS as readonly string[], `${word} is not in the word bank`).toContain(word);
    for (const other of others) {
      expect(lettersKey(other), `${other} does not use the letters of ${word}`).toBe(lettersKey(word));
      expect(other, `${other} is the word itself`).not.toBe(word);
    }
    expect(new Set(others).size, `${word} lists a word twice`).toBe(others.length);
  }
});

test('the real anagrams people actually type are covered', () => {
  expect(WORD_SCRAMBLE_ALTERNATES.FOREST).toEqual(expect.arrayContaining(['SOFTER', 'FOSTER']));
  expect(WORD_SCRAMBLE_ALTERNATES.MARBLE).toEqual(expect.arrayContaining(['RAMBLE']));
  expect(WORD_SCRAMBLE_ALTERNATES.CANDLE).toEqual(['LANCED']);
  expect(WORD_SCRAMBLE_ALTERNATES.CASTLE).toEqual(expect.arrayContaining(['CLEATS']));
  expect(WORD_SCRAMBLE_ALTERNATES.PLANET).toEqual(['PLATEN']);
});

test('another real word with the same letters is accepted, whatever the case or spacing', () => {
  expect(isAnagramAlternate('OFTRSE', 'SOFTER')).toBe(true);
  expect(isAnagramAlternate('OFTRSE', '  softer ')).toBe(true);
  expect(isAnagramAlternate('LBAMER', 'Ramble')).toBe(true);
  // It does not matter how the letters were jumbled.
  expect(isAnagramAlternate('TSROFE', 'FOSTER')).toBe(true);
});

test('the rule only adds real words: not the drawn word itself, not a jumble, not other letters', () => {
  // The drawn word is the caller's own check (the hash, or the text), so it is not counted here.
  expect(isAnagramAlternate('OFTRSE', 'FOREST')).toBe(false);
  // Same letters, not a word.
  expect(isAnagramAlternate('OFTRSE', 'TSROFE')).toBe(false);
  expect(isAnagramAlternate('OFTRSE', 'OFTRSE')).toBe(false);
  // Other letters.
  expect(isAnagramAlternate('OFTRSE', 'FORESTS')).toBe(false);
  expect(isAnagramAlternate('OFTRSE', '')).toBe(false);
});

test('a word with no other spelling accepts nothing extra', () => {
  expect(isAnagramAlternate('AXLAYG', 'GALAXY')).toBe(false);
  expect(isAnagramAlternate('AXLAYG', 'GALAXIES')).toBe(false);
});
