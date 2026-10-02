import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { TRUTH_OR_DARE_ALL_DARES, TRUTH_OR_DARE_ALL_TRUTHS } from '../src/lib/utils';

// Audit K-1, K-2, K-3, K-5 and K-6: dares that force someone to show private photos,
// post something that cannot be taken back, hand over their phone or call someone,
// eat something a group chooses (allergy risk), and Never Have I Ever premises about
// fake IDs and other adult situations, in tools marketed for sleepovers and classrooms.
// The lists are checked as data so the flagged ones cannot come back.

const FLAGGED: RegExp[] = [
  /camera roll/i,
  /\bpost\b/i, // "post a status", "post an embarrassing photo ... on your story"
  /\bstory\b/i,
  /go through your phone|hand over your phone|unlock your phone/i,
  // Any dare about your phone puts it, or what stays on it, in the group's hands
  // ("Let the group choose your phone wallpaper" outlived the first sweep).
  /your phone/i,
  /call someone/i,
  /text your crush/i,
  /spoonful of a condiment|eat .*chosen by the group/i,
];

test('no truth or dare forces private photos, posting, phone access, calls or eating what a group picks', () => {
  const all = [...TRUTH_OR_DARE_ALL_DARES, ...TRUTH_OR_DARE_ALL_TRUTHS];
  const hits = all.flatMap((line) => FLAGGED.filter((re) => re.test(line)).map((re) => `${re} -> ${line}`));
  expect(hits, hits.join('\n')).toEqual([]);
  // The replacements from the audit are in.
  expect(TRUTH_OR_DARE_ALL_DARES).toContain("Show the funniest photo you're willing to share");
  expect(TRUTH_OR_DARE_ALL_DARES).toContain('Show the group an embarrassing photo, no posting');
  expect(TRUTH_OR_DARE_ALL_DARES).toContain('Let the group pick a nickname for you for the rest of the game');
  // Every category still has enough to play with.
  expect(TRUTH_OR_DARE_ALL_DARES.length).toBeGreaterThanOrEqual(15);
});

test('never have I ever no longer has the fake ID and other adult premises', () => {
  const file = fs.readFileSync(path.join(__dirname, '../src/app/tools/never-have-i-ever/page.tsx'), 'utf-8');
  for (const gone of [/fake ID/i, /job interview/i, /blind date/i, /talked my way out of a ticket/i, /stalked someone/i]) {
    expect(gone.test(file), `${gone} should be gone`).toBe(false);
  }
  expect(file).toContain('Never have I ever worn a costume when it wasn');
});
