import { test, expect } from '@playwright/test';
import { addGuess, roundWinner, type GuessEntry } from '../src/lib/guess-number-round';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration();

// Audit G-10: in the in-room Guess the Number game nothing ended a round. The server keeps
// answering "correct" for the same secret, so after one player found the number everyone
// else could "win" too. The round is decided from the shared event log; these are the two
// rules every client applies to it (the room-level behaviour is in qa-x38-guess-number-round).

const g = (username: string, guess: number, hint: string): GuessEntry => ({ username, guess, hint });

test('nobody has won until a guess is correct', () => {
  expect(roundWinner([])).toBeNull();
  expect(roundWinner([g('Ann', 10, 'too low'), g('Bo', 90, 'too high')])).toBeNull();
});

test('the winner is the first correct guess', () => {
  const log = [g('Ann', 10, 'too low'), g('Bo', 42, 'correct'), g('Cy', 42, 'correct')];
  expect(roundWinner(log)).toEqual(g('Bo', 42, 'correct'));
});

test('guesses are added while the round is open', () => {
  let history: GuessEntry[] = [];
  history = addGuess(history, g('Ann', 10, 'too low'));
  history = addGuess(history, g('Bo', 90, 'too high'));
  expect(history.map((h) => h.username)).toEqual(['Ann', 'Bo']);
  expect(roundWinner(history)).toBeNull();
});

test('a second correct guess, already in flight when the first landed, does not make a second winner', () => {
  let history: GuessEntry[] = [g('Ann', 10, 'too low')];
  history = addGuess(history, g('Bo', 42, 'correct'));
  history = addGuess(history, g('Cy', 42, 'correct'));
  expect(history.map((h) => h.username)).toEqual(['Ann', 'Bo']);
  expect(roundWinner(history)?.username).toBe('Bo');
});

test('a guess that arrives after the result is dropped, not listed under it', () => {
  const won = addGuess([], g('Bo', 42, 'correct'));
  expect(addGuess(won, g('Ann', 7, 'too low'))).toEqual(won);
});

test('the input list is never changed', () => {
  const before: GuessEntry[] = [g('Bo', 42, 'correct')];
  const snapshot = JSON.stringify(before);
  addGuess(before, g('Ann', 1, 'too low'));
  expect(JSON.stringify(before)).toBe(snapshot);
});

test('replaying the same log in the same order gives every client the same round', () => {
  const log = [
    g('Ann', 10, 'too low'),
    g('Bo', 42, 'correct'),
    g('Cy', 42, 'correct'),
    g('Ann', 11, 'too low'),
  ];
  const replay = () => log.reduce<GuessEntry[]>((h, e) => addGuess(h, e), []);
  expect(replay()).toEqual(replay());
  expect(replay()).toHaveLength(2);
  expect(roundWinner(replay())?.username).toBe('Bo');
});
