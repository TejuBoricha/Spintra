import { test, expect } from '@playwright/test';
import { canSeePick, rpsLabels } from '../src/lib/rps-round';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration();

// Audit G-6: the in-room Rock Paper Scissors list decided who may see a pick, and how to name
// its owner, from the display name. Names are editable and not unique, so two players called
// alike each saw the other's pick before the round was decided, and a result could read
// "Sam, Sam win!". These pin the two rules (the room itself is in qa-x40-rps-pick-privacy).

test('before the round resolves you see your own pick and nobody else\'s', () => {
  expect(canSeePick('me', 'me', false)).toBe(true);
  expect(canSeePick('them', 'me', false)).toBe(false);
});

test('once the round has resolved everyone sees everyone\'s pick', () => {
  expect(canSeePick('me', 'me', true)).toBe(true);
  expect(canSeePick('them', 'me', true)).toBe(true);
});

test('it is the user id that decides, so a player with the same name is still someone else', () => {
  const picks = {
    'aaaa-1': { username: 'Sam', choice: 'Rock' },
    'bbbb-2': { username: 'Sam', choice: 'Paper' },
  };
  // Viewer is aaaa-1: bbbb-2 has the same name and must stay hidden.
  expect(canSeePick('bbbb-2', 'aaaa-1', false)).toBe(false);
  expect(canSeePick('aaaa-1', 'aaaa-1', false)).toBe(true);
  expect(Object.keys(picks)).toHaveLength(2);
});

test('names nobody else uses are left as they are', () => {
  expect(
    rpsLabels({
      'aaaa-1': { username: 'Ann', choice: 'Rock' },
      'bbbb-2': { username: 'Bo', choice: 'Paper' },
    }),
  ).toEqual({ 'aaaa-1': 'Ann', 'bbbb-2': 'Bo' });
  expect(rpsLabels({})).toEqual({});
});

test('players who share a name are told apart by a short id, and others are untouched', () => {
  const labels = rpsLabels({
    'aaaa-1111': { username: 'Sam', choice: 'Rock' },
    'bbbb-2222': { username: 'Sam', choice: 'Paper' },
    'cccc-3333': { username: 'Cy', choice: 'Rock' },
  });
  expect(labels['aaaa-1111']).toBe('Sam (aaaa)');
  expect(labels['bbbb-2222']).toBe('Sam (bbbb)');
  expect(labels['cccc-3333']).toBe('Cy');
  expect(labels['aaaa-1111']).not.toBe(labels['bbbb-2222']);
});
