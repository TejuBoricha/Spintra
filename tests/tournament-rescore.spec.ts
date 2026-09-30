import { test, expect } from '@playwright/test';
import {
  generateBracketForType,
  recordMatchResult,
  type BracketMatch,
  type MatchRef,
  type Tournament,
} from '../src/lib/tournament-engine';

// Audit T-2: re-scoring a finished match with a different winner did not update
// the rounds that had already used that result, so the bracket showed the wrong
// champion (or a Grand Final between the wrong two players). The in-room
// Tournament guarded this in its click handler; the standalone page and the
// engine did not. The engine now refuses a winner change that a later match has
// already used, and a score correction that keeps the winner is always allowed.

const BYE = '__BYE__';
const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Format = 'single-elimination' | 'double-elimination';
type Key = 'rounds' | 'losersBracket';

const real = (m: BracketMatch) => !!m.player1 && !!m.player2 && m.player1 !== BYE && m.player2 !== BYE;
const playable = (m: BracketMatch) => real(m) && m.status !== 'completed';

function fresh(type: Format, n: number): Tournament {
  const players = names(n);
  const gen = generateBracketForType(type, players, []);
  return { type: gen.type, rounds: gen.rounds, losersBracket: gen.losersBracket, participants: players, seeds: [], currentRound: 1, winner: null };
}

function refs(t: Tournament, pick: (m: BracketMatch) => boolean): MatchRef[] {
  const out: MatchRef[] = [];
  for (const key of ['rounds', 'losersBracket'] as Key[]) {
    const bracket = key === 'rounds' ? t.rounds : (t.losersBracket ?? []);
    bracket.forEach((round, r) => round.forEach((m, p) => pick(m) && out.push({ match: m, roundIdx: r, position: p, bracketKey: key })));
  }
  if (t.grandFinal && pick(t.grandFinal)) out.push({ match: t.grandFinal, roundIdx: 0, position: 0, bracketKey: 'grandFinal' });
  return out;
}

/** Scores the match so `winnerIsFirst` wins; the scores differ from any earlier ones by `bump`. */
const score = (winnerIsFirst: boolean, bump = 0): [number, number] => (winnerIsFirst ? [2 + bump, 1] : [1, 2 + bump]);

function play(t: Tournament, ref: MatchRef, winnerIsFirst: boolean, bump = 0) {
  const [a, b] = score(winnerIsFirst, bump);
  return recordMatchResult(t, ref, a, b);
}

/** What must be true of any bracket, however it got there. */
function problems(t: Tournament): string[] {
  const out: string[] = [];
  const all: { label: string; m: BracketMatch }[] = [];
  t.rounds.forEach((r, ri) => r.forEach((m, pi) => all.push({ label: `WB r${ri} p${pi}`, m })));
  (t.losersBracket ?? []).forEach((r, ri) => r.forEach((m, pi) => all.push({ label: `LB r${ri} p${pi}`, m })));
  if (t.grandFinal) all.push({ label: 'GF', m: t.grandFinal });

  for (const { label, m } of all) {
    if (m.status === 'completed' && real(m) && m.winner !== m.player1 && m.winner !== m.player2) {
      out.push(`${label}: winner ${m.winner} is not one of ${m.player1} / ${m.player2}`);
    }
  }
  // Winners bracket: each slot holds exactly what its feeder decided.
  for (let r = 1; r < t.rounds.length; r++) {
    t.rounds[r].forEach((m, p) => {
      const f1 = t.rounds[r - 1][2 * p];
      const f2 = t.rounds[r - 1][2 * p + 1];
      if ((m.player1 ?? null) !== (f1?.winner ?? null)) out.push(`WB r${r} p${p}: player1 ${m.player1} but feeder decided ${f1?.winner ?? null}`);
      if ((m.player2 ?? null) !== (f2?.winner ?? null)) out.push(`WB r${r} p${p}: player2 ${m.player2} but feeder decided ${f2?.winner ?? null}`);
    });
  }
  if (t.grandFinal) {
    const wf = t.rounds[t.rounds.length - 1]?.[0];
    const lb = t.losersBracket ?? [];
    const lf = lb[lb.length - 1]?.[0];
    if (t.grandFinal.player1 !== wf?.winner) out.push(`GF: player1 ${t.grandFinal.player1} but the winners final was won by ${wf?.winner}`);
    if (t.grandFinal.player2 !== lf?.winner) out.push(`GF: player2 ${t.grandFinal.player2} but the losers final was won by ${lf?.winner}`);
  }
  // Nobody is waiting to play two matches at once.
  const waiting = new Map<string, string>();
  for (const { label, m } of all) {
    if (m.status === 'completed' || !real(m)) continue;
    for (const who of [m.player1!, m.player2!]) {
      if (waiting.has(who)) out.push(`${who} is in two unplayed matches: ${waiting.get(who)} and ${label}`);
      waiting.set(who, label);
    }
  }
  // The champion is the last match's winner, and only that.
  const expected = t.type === 'double-elimination' && t.grandFinal ? t.grandFinal.winner : t.type === 'single-elimination' ? t.rounds[t.rounds.length - 1]?.[0]?.winner ?? null : null;
  if (t.type === 'single-elimination' || t.grandFinal) {
    if ((t.winner ?? null) !== (expected ?? null)) out.push(`champion ${t.winner} but the deciding match says ${expected}`);
  }
  return out;
}

function finish(t: Tournament, next: () => number): Tournament {
  for (let guard = 0; guard < 500 && !t.winner; guard++) {
    const ready = refs(t, playable);
    if (t.grandFinal && !t.grandFinal.winner) ready.push({ match: t.grandFinal, roundIdx: 0, position: 0, bracketKey: 'grandFinal' });
    if (!ready.length) throw new Error('stuck: no playable match and no champion');
    const out = play(t, ready[0], next() < 0.5);
    if (out.kind === 'invalid') throw new Error(out.message);
    t = out.tournament;
  }
  return t;
}

const BLOCKED = /later match already used this result/i;

test('single elimination: a winner change is refused once the next match is played, and the bracket is left as it was', () => {
  let t = fresh('single-elimination', 4);
  for (const ref of refs(t, playable).slice(0, 2)) {
    // Play the first two matches (round one) with the first player winning.
    const live = refs(t, playable).find((r) => r.match.id === ref.match.id)!;
    const out = play(t, live, true);
    if (out.kind === 'invalid') throw new Error(out.message);
    t = out.tournament;
  }
  const final = refs(t, playable)[0];
  const out = play(t, final, true);
  if (out.kind === 'invalid') throw new Error(out.message);
  t = out.tournament;
  expect(t.winner).toBe(t.rounds[1][0].player1);

  // Flip the winner of the first round-one match: the final was already played.
  const r1 = { match: t.rounds[0][0], roundIdx: 0, position: 0, bracketKey: 'rounds' as const };
  const flip = play(t, r1, false);
  expect(flip.kind).toBe('invalid');
  if (flip.kind === 'invalid') expect(flip.message).toMatch(BLOCKED);
  expect(problems(t)).toEqual([]);
});

test('single elimination: correcting a score without changing the winner is still allowed after the next match is played', () => {
  let t = fresh('single-elimination', 4);
  for (let i = 0; i < 3; i++) {
    const out = play(t, refs(t, playable)[0], true);
    if (out.kind === 'invalid') throw new Error(out.message);
    t = out.tournament;
  }
  const champion = t.winner;
  const r1 = { match: t.rounds[0][0], roundIdx: 0, position: 0, bracketKey: 'rounds' as const };
  const fix = play(t, r1, true, 5); // same winner, different score
  expect(fix.kind).not.toBe('invalid');
  if (fix.kind !== 'invalid') {
    expect(fix.tournament.rounds[0][0].score1).toBe(7);
    expect(fix.tournament.winner).toBe(champion);
    expect(problems(fix.tournament)).toEqual([]);
  }
});

test('single elimination: a winner change is allowed while the next match is unplayed, and the new winner takes the slot', () => {
  let t = fresh('single-elimination', 4);
  const first = refs(t, playable)[0];
  const out = play(t, first, true);
  if (out.kind === 'invalid') throw new Error(out.message);
  t = out.tournament;
  const r1 = { match: t.rounds[0][0], roundIdx: 0, position: 0, bracketKey: 'rounds' as const };
  const flip = play(t, r1, false);
  expect(flip.kind).not.toBe('invalid');
  if (flip.kind === 'invalid') return;
  expect(flip.tournament.rounds[1][0].player1).toBe(r1.match.player2);
  expect(problems(flip.tournament)).toEqual([]);
});

test('double elimination: the winners final cannot be flipped once the Grand Final is set, and the Grand Final keeps its players', () => {
  const next = rng(7);
  let t = fresh('double-elimination', 4);
  // Play until the Grand Final is set (both finals decided), but do not play it.
  for (let guard = 0; guard < 100 && !t.grandFinal; guard++) {
    const out = play(t, refs(t, playable)[0], next() < 0.5);
    if (out.kind === 'invalid') throw new Error(out.message);
    t = out.tournament;
  }
  expect(t.grandFinal).toBeTruthy();
  const wbFinal = { match: t.rounds[t.rounds.length - 1][0], roundIdx: t.rounds.length - 1, position: 0, bracketKey: 'rounds' as const };
  const before = JSON.stringify(t);
  const flipWinner = wbFinal.match.winner === wbFinal.match.player1;
  const out = play(t, wbFinal, !flipWinner);
  expect(out.kind).toBe('invalid');
  if (out.kind === 'invalid') expect(out.message).toMatch(BLOCKED);
  expect(JSON.stringify(t)).toBe(before);
  expect(problems(t)).toEqual([]);
});

for (const type of ['single-elimination', 'double-elimination'] as Format[]) {
  test(`${type}: random plays and random re-scores never leave a bracket inconsistent, and it still reaches a champion`, () => {
    const failures: string[] = [];
    let accepted = 0;
    let refused = 0;
    for (let n = type === 'single-elimination' ? 2 : 3; n <= 9; n++) {
      for (let trial = 0; trial < 40; trial++) {
        const next = rng(n * 7919 + trial);
        let t = fresh(type, n);
        for (let step = 0; step < 60 && !t.winner; step++) {
          const completed = refs(t, (m) => m.status === 'completed' && real(m));
          const ready = refs(t, playable);
          if (t.grandFinal && !t.grandFinal.winner) ready.push({ match: t.grandFinal, roundIdx: 0, position: 0, bracketKey: 'grandFinal' });
          const reScore = completed.length > 0 && (ready.length === 0 || next() < 0.4);
          const pool = reScore ? completed : ready;
          if (!pool.length) break;
          const ref = pool[Math.floor(next() * pool.length)];
          // A re-score flips the winner half the time and only corrects the score otherwise.
          const flip = reScore && next() < 0.5;
          const winnerIsFirst = reScore ? (flip ? ref.match.winner !== ref.match.player1 : ref.match.winner === ref.match.player1) : next() < 0.5;
          const out = play(t, ref, winnerIsFirst, reScore ? 1 + Math.floor(next() * 3) : 0);
          if (out.kind === 'invalid') {
            refused++;
            if (!reScore) failures.push(`n=${n} trial ${trial}: a first result was refused: ${out.message}`);
            continue;
          }
          if (reScore) accepted++;
          t = out.tournament;
          const bad = problems(t);
          if (bad.length) {
            failures.push(`n=${n} trial ${trial} step ${step} (${reScore ? 're-score' : 'play'}): ${bad.slice(0, 2).join('; ')}`);
            break;
          }
        }
        if (failures.length) break;
        try {
          t = finish(t, next);
        } catch (e) {
          failures.push(`n=${n} trial ${trial}: ${(e as Error).message}`);
          break;
        }
        const bad = problems(t);
        if (bad.length) failures.push(`n=${n} trial ${trial} at the end: ${bad.slice(0, 2).join('; ')}`);
        else if (!t.winner || !t.participants.includes(t.winner)) failures.push(`n=${n} trial ${trial}: champion is ${String(t.winner)}`);
        if (failures.length) break;
      }
      if (failures.length) break;
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(accepted, 'the walk should include accepted re-scores').toBeGreaterThan(20);
    expect(refused, 'the walk should include refused re-scores').toBeGreaterThan(0);
  });
}

test('the tournament page refuses to change an early winner after the final, says why, and keeps the champion', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie\nDelta');
  await page.getByRole('radio', { name: 'Single Elim' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();

  // Play all three matches, the first-listed player of each winning.
  for (let i = 0; i < 3; i++) {
    const ready = page
      .locator('[data-testid="tournament-match"][data-match-ready="true"]:not([data-match-status="completed"])')
      .first();
    await expect(ready).toBeVisible({ timeout: 5000 });
    await ready.click();
    const scores = page.locator('input[type="number"]');
    await scores.nth(0).fill('3');
    await scores.nth(1).fill('1');
    await page.getByRole('button', { name: 'Save' }).click();
  }
  await expect(page.getByText('Tournament Champion')).toBeVisible({ timeout: 5000 });
  // The final is the last match on the page; it names who won.
  const finalMatch = page.locator('[data-testid="tournament-match"]').last();
  const finalBefore = await finalMatch.innerText();
  expect(finalBefore).toMatch(/ won/);

  // Reopen the first round-one match and try to make the other player the winner.
  await page.locator('[data-testid="tournament-match"]').first().click();
  const scores = page.locator('input[type="number"]');
  await scores.nth(0).fill('1');
  await scores.nth(1).fill('3');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(/later match already used this result/i)).toBeVisible({ timeout: 5000 });
  // Nothing moved: the final still shows the same players, score and winner, and
  // the champion banner is still up.
  expect(await finalMatch.innerText()).toBe(finalBefore);
  await expect(page.getByText('Tournament Champion')).toBeVisible();
});
