import { test, expect } from '@playwright/test';
import {
  generateBracketForType,
  recordMatchResult,
  type BracketMatch,
  type MatchRef,
  type Tournament,
} from '../src/lib/tournament-engine';

// Audit T-1 and T-3: brackets for 5, 6, 7 and many other player counts got stuck,
// and seeds met in round one. The bye padding put every bye at the end of the
// list, so a bye met a bye (which never resolves) and neighbours in seed order
// were paired. These tests play EVERY size from 2 to 17 to a champion through the
// real entry points (generateBracketForType, recordMatchResult), many times each
// with random results, in both elimination formats.

const BYE = '__BYE__';
const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

// A small deterministic PRNG so a failure names a reproducible case.
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

const isPlayable = (m: BracketMatch) =>
  !!m.player1 && !!m.player2 && m.player1 !== BYE && m.player2 !== BYE && m.status !== 'completed';

type Format = 'single-elimination' | 'double-elimination';

function playToEnd(type: Format, players: string[], seeds: string[], next: () => number) {
  const gen = generateBracketForType(type, players, seeds);
  let t: Tournament = {
    type: gen.type,
    rounds: gen.rounds,
    losersBracket: gen.losersBracket,
    participants: players,
    seeds,
    currentRound: 1,
    winner: null,
  };
  let played = 0;
  for (let guard = 0; guard < 500; guard++) {
    if (t.winner) return { t, played, stuck: false as const };
    let ref: MatchRef | null = null;
    if (t.grandFinal && !t.grandFinal.winner) {
      ref = { match: t.grandFinal, roundIdx: 0, position: 0, bracketKey: 'grandFinal' };
    } else {
      outer: for (const key of ['rounds', 'losersBracket'] as const) {
        const bracket = key === 'rounds' ? t.rounds : (t.losersBracket ?? []);
        for (let r = 0; r < bracket.length; r++) {
          for (let p = 0; p < bracket[r].length; p++) {
            if (isPlayable(bracket[r][p])) {
              ref = { match: bracket[r][p], roundIdx: r, position: p, bracketKey: key };
              break outer;
            }
          }
        }
      }
    }
    if (!ref) return { t, played, stuck: true as const };
    const firstWins = next() < 0.5;
    const out = recordMatchResult(t, ref, firstWins ? 2 : 1, firstWins ? 1 : 2);
    if (out.kind === 'invalid') return { t, played, stuck: true as const, message: out.message };
    played++;
    t = out.tournament;
  }
  return { t, played, stuck: true as const };
}

for (const type of ['single-elimination', 'double-elimination'] as Format[]) {
  test(`${type}: every size from 2 to 17 plays through to a champion (no stuck bracket)`, () => {
    const failures: string[] = [];
    for (let n = 2; n <= 17; n++) {
      for (let trial = 0; trial < 25; trial++) {
        const players = names(n);
        const r = playToEnd(type, players, [], rng(n * 1000 + trial));
        if (r.stuck) {
          failures.push(`n=${n} trial ${trial}: stuck after ${r.played} matches${'message' in r && r.message ? ` (${r.message})` : ''}`);
          break;
        }
        if (!r.t.winner || !players.includes(r.t.winner)) {
          failures.push(`n=${n} trial ${trial}: champion is ${String(r.t.winner)}`);
          break;
        }
        if (type === 'single-elimination' && r.played !== n - 1) {
          failures.push(`n=${n} trial ${trial}: ${r.played} real matches, expected ${n - 1}`);
          break;
        }
      }
    }
    expect(failures, `stuck or wrong sizes:\n${failures.join('\n')}`).toEqual([]);
  });
}

test('round one never pairs a bye with a bye, and every bye faces a real player', () => {
  const problems: string[] = [];
  for (let n = 2; n <= 17; n++) {
    for (let trial = 0; trial < 10; trial++) {
      const { rounds } = generateBracketForType('single-elimination', names(n), []);
      const size = 2 ** Math.ceil(Math.log2(n));
      // Byes auto-resolve, so look at who each first-round match ended with.
      const round1 = rounds[0];
      const byeMatches = round1.filter((m) => m.player1 === BYE || m.player2 === BYE);
      if (byeMatches.some((m) => m.player1 === BYE && m.player2 === BYE)) problems.push(`n=${n}: a bye faces a bye`);
      if (byeMatches.length !== size - n) problems.push(`n=${n}: ${byeMatches.length} bye matches, expected ${size - n}`);
    }
  }
  expect(problems).toEqual([]);
});

test('seeds are placed in the standard bracket order: top seeds meet late, and byes go to the top seeds', () => {
  const where = (rounds: BracketMatch[][], p: string) => rounds[0].findIndex((m) => m.player1 === p || m.player2 === p);

  // With 8, 16 and 32 players the four seeds land in four different quarters, so
  // no two of them can meet before the semi-finals, and seeds 1 and 2 are in
  // opposite halves (they can only meet in the final).
  for (const size of [8, 16, 32]) {
    const seeds = ['P1', 'P2', 'P3', 'P4'];
    const { rounds } = generateBracketForType('single-elimination', names(size), seeds);
    const [m1, m2] = seeds.map((p) => where(rounds, p));
    const half = rounds[0].length / 2;
    expect(m1 < half, `${size}: seeds 1 and 2 share a half`).not.toBe(m2 < half);
    const quarter = rounds[0].length / 4;
    const quarters = new Set(seeds.map((p) => Math.floor(where(rounds, p) / quarter)));
    expect(quarters.size, `${size}: two of the top four seeds share a quarter`).toBe(4);
  }

  // With 4 players seeds 1 and 2 are in different matches (they meet in the final).
  {
    const { rounds } = generateBracketForType('single-elimination', names(4), ['P1', 'P2']);
    expect(where(rounds, 'P1'), 'seeds 1 and 2 meet in round one').not.toBe(where(rounds, 'P2'));
  }

  // With byes (6 players in an 8-slot bracket) the two byes go to seeds 1 and 2,
  // and with 5 players (three byes) to seeds 1, 2 and 3.
  for (const [n, top] of [[6, ['P1', 'P2']], [5, ['P1', 'P2', 'P3']]] as [number, string[]][]) {
    const { rounds } = generateBracketForType('single-elimination', names(n), top);
    for (const p of top) {
      const m = rounds[0].find((x) => x.player1 === p || x.player2 === p)!;
      expect([m.player1, m.player2], `${n} players: ${p} should have a bye`).toContain(BYE);
    }
  }
});
