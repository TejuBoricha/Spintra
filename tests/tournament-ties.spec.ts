import { test, expect, chromium } from '@playwright/test';
import { skipIfDemoMode } from './qa-city-helpers';
import {
  calculateStandings,
  generateBracketForType,
  recordMatchResult,
  uniqueParticipantNames,
  BYE_PLAYER,
  type BracketMatch,
  type MatchRef,
  type Tournament,
} from '../src/lib/tournament-engine';

// Audit T-4: round robin and Swiss crowned `standings[0]` when players finished
// level on points, which meant whoever was typed first won. Ties are now broken by
// score difference, then by total scored; players still level share first place
// (`winners` lists them and `winner` names them all).

type Format = 'round-robin' | 'swiss';

function start(type: Format, players: string[]): Tournament {
  const gen = generateBracketForType(type, players, []);
  return { type: gen.type, rounds: gen.rounds, participants: players, seeds: [], currentRound: 1, winner: null };
}

function refOf(t: Tournament, x: string, y: string): MatchRef {
  for (let r = 0; r < t.rounds.length; r++) {
    for (let p = 0; p < t.rounds[r].length; p++) {
      const m = t.rounds[r][p];
      if ((m.player1 === x && m.player2 === y) || (m.player1 === y && m.player2 === x)) {
        return { match: m, roundIdx: r, position: p, bracketKey: 'rounds' };
      }
    }
  }
  throw new Error(`no match between ${x} and ${y}`);
}

/** Records "x scored sx, y scored sy", whichever way round the match lists them. */
function result(t: Tournament, x: string, y: string, sx: number, sy: number) {
  const ref = refOf(t, x, y);
  const [s1, s2] = ref.match.player1 === x ? [sx, sy] : [sy, sx];
  const out = recordMatchResult(t, ref, s1, s2);
  if (out.kind === 'invalid') throw new Error(out.message);
  return out;
}

const ABC = ['Ann', 'Bo', 'Cy'];

/** Ann beats Bo, Bo beats Cy, Cy beats Ann: everyone on 3 points. */
function cycle(scores: { ab: [number, number]; bc: [number, number]; ca: [number, number] }) {
  let t = start('round-robin', ABC);
  t = result(t, 'Ann', 'Bo', ...scores.ab).tournament;
  t = result(t, 'Bo', 'Cy', ...scores.bc).tournament;
  return result(t, 'Cy', 'Ann', ...scores.ca);
}

test('round robin: level on points, the better score difference wins', () => {
  // Ann +5 -1, Bo -5 +1, Cy -1 +1.
  const out = cycle({ ab: [5, 0], bc: [1, 0], ca: [1, 0] });
  expect(out.kind).toBe('champion');
  expect(out.kind === 'champion' && out.winner).toBe('Ann');
  const standings = calculateStandings(out.tournament.rounds, ABC);
  expect(standings.map((s) => [s.player, s.points, s.diff, s.rank])).toEqual([
    ['Ann', 3, 4, 1],
    ['Cy', 3, 0, 2],
    ['Bo', 3, -4, 3],
  ]);
  expect(out.tournament.winners).toBeUndefined();
});

test('round robin: level on points and difference, the higher total scored wins', () => {
  // Every difference is 0; totals scored are Ann 2, Bo 4, Cy 3.
  const out = cycle({ ab: [2, 1], bc: [3, 2], ca: [1, 0] });
  expect(out.kind === 'champion' && out.winner).toBe('Bo');
  expect(out.tournament.winners).toBeUndefined();
  const standings = calculateStandings(out.tournament.rounds, ABC);
  expect(standings.map((s) => [s.player, s.diff, s.scored])).toEqual([
    ['Bo', 0, 4],
    ['Cy', 0, 3],
    ['Ann', 0, 2],
  ]);
});

test('round robin: the result does not depend on the order names were typed in, and players level on everything share first place', () => {
  for (const order of [ABC, [...ABC].reverse(), ['Bo', 'Cy', 'Ann']]) {
    let t = start('round-robin', order);
    t = result(t, 'Ann', 'Bo', 1, 1).tournament;
    t = result(t, 'Bo', 'Cy', 2, 2).tournament;
    const out = result(t, 'Cy', 'Ann', 0, 0);
    expect(out.kind).toBe('champion');
    if (out.kind !== 'champion') return;
    // Every game drawn: 2 points each, difference 0; scored Ann 1, Bo 3, Cy 2, so Bo leads on scored
    // however the names were typed.
    expect(out.tournament.winners).toBeUndefined();
    expect(out.winner).toBe('Bo');
  }
  // Truly level: identical draws everywhere.
  let t = start('round-robin', ABC);
  t = result(t, 'Ann', 'Bo', 1, 1).tournament;
  t = result(t, 'Bo', 'Cy', 1, 1).tournament;
  const out = result(t, 'Cy', 'Ann', 1, 1);
  expect(out.kind).toBe('champion');
  if (out.kind !== 'champion') return;
  expect(out.tournament.winners?.slice().sort()).toEqual(['Ann', 'Bo', 'Cy']);
  // `winner` is the display line, built from `winners` in their order.
  const [w1, w2, w3] = out.tournament.winners!;
  expect(out.winner).toBe(`${w1}, ${w2}, and ${w3}`);
  const standings = calculateStandings(out.tournament.rounds, ABC);
  expect(standings.map((s) => s.rank)).toEqual([1, 1, 1]);
});

test('ranks: two level at the top share rank 1 and the next player is 3rd', () => {
  let t = start('round-robin', ['Ann', 'Bo', 'Cy']);
  t = result(t, 'Ann', 'Bo', 1, 1).tournament; // Ann 1, Bo 1
  t = result(t, 'Ann', 'Cy', 2, 0).tournament; // Ann 4
  t = result(t, 'Bo', 'Cy', 2, 0).tournament; // Bo 4
  // Ann: 3 pts+1, diff +2, scored 3; Bo: diff +2, scored 3; Cy: 0 points.
  const standings = calculateStandings(t.rounds, ['Ann', 'Bo', 'Cy']);
  expect(standings.map((s) => s.rank)).toEqual([1, 1, 3]);
});

test('round robin: re-scoring a match can break a shared first place, and the shared marker goes away', () => {
  let t = start('round-robin', ABC);
  t = result(t, 'Ann', 'Bo', 1, 1).tournament;
  t = result(t, 'Bo', 'Cy', 1, 1).tournament;
  let out = result(t, 'Cy', 'Ann', 1, 1);
  expect(out.tournament.winners).toHaveLength(3);
  out = result(out.tournament, 'Ann', 'Bo', 4, 0); // Ann now clearly ahead
  expect(out.kind === 'champion' && out.winner).toBe('Ann');
  expect(out.tournament.winners).toBeUndefined();
});

test('swiss: a field that draws every game ends with first place shared, not given to the first name typed', () => {
  const players = ['Ann', 'Bo', 'Cy', 'Di'];
  let t = start('swiss', players);
  for (let guard = 0; guard < 20 && !t.winner; guard++) {
    const open = t.rounds.flat().find((m: BracketMatch) => m.player1 && m.player2 && m.status !== 'completed');
    if (!open) throw new Error('stuck');
    const idx = t.rounds.findIndex((r) => r.includes(open));
    const ref: MatchRef = { match: open, roundIdx: idx, position: t.rounds[idx].indexOf(open), bracketKey: 'rounds' };
    const out = recordMatchResult(t, ref, 1, 1);
    if (out.kind === 'invalid') throw new Error(out.message);
    t = out.tournament;
  }
  expect(t.winner).toBeTruthy();
  expect(t.winners?.slice().sort()).toEqual(['Ann', 'Bo', 'Cy', 'Di']);
});

test('the tournament page says first place is shared, ranks tied players alike, and lists them all', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie');
  await page.getByRole('radio', { name: 'Round Robin' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();

  for (let i = 0; i < 3; i++) {
    const open = page.locator('[data-testid="tournament-match"]:not([data-match-status="completed"])').first();
    await expect(open).toBeVisible({ timeout: 5000 });
    await open.click();
    const scores = page.locator('input[type="number"]');
    await scores.nth(0).fill('1');
    await scores.nth(1).fill('1');
    await page.getByRole('button', { name: 'Save' }).click();
  }

  await expect(page.getByText('Shared first place')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Tournament Champion')).toHaveCount(0);
  // All three are level: three "#1" rows, no "#2" or "#3".
  await expect(page.getByText('#1', { exact: true })).toHaveCount(3);
  await expect(page.getByText('#2', { exact: true })).toHaveCount(0);
});

test('a shared first place reads clearly even when the names contain "&"', () => {
  const teams = ['Sam & Max', 'Ann & Bo'];
  const out = result(start('round-robin', teams), 'Sam & Max', 'Ann & Bo', 1, 1);
  expect(out.kind).toBe('champion');
  if (out.kind !== 'champion') return;
  expect(out.tournament.winners?.slice().sort()).toEqual(['Ann & Bo', 'Sam & Max']);
  // Joined with " & " this read "Sam & Max & Ann & Bo", four names or two.
  const [w1, w2] = out.tournament.winners!;
  expect(out.winner).toBe(`${w1} and ${w2}`);
});

// In a room the standings are ranked by points, then score difference, then total
// scored; the table now shows the difference, so a player level on points who is
// ranked lower can see why (the standalone page already showed it).
test('in a room, the standings show the score difference that breaks ties', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  await page.goto('/create?type=tournament');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];
  await skipIfDemoMode(page);

  const browser = await chromium.launch();
  const guest = await (await browser.newContext()).newPage();
  try {
    await guest.goto(`${baseURL}/room/${roomCode}`);
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });
    await page.getByRole('radio', { name: 'Round Robin' }).click();
    await page.getByRole('button', { name: /generate bracket/i }).click();
    await page.locator('[data-testid="tournament-match"]').first().click();
    const scores = page.locator('input[type="number"]');
    await scores.nth(0).fill('3');
    await scores.nth(1).fill('1');
    await page.getByRole('button', { name: 'Save' }).click();

    const table = page.locator('table', { has: page.getByRole('columnheader', { name: '+/-' }) });
    await expect(table).toBeVisible({ timeout: 15000 });
    // The values arrive when the host's own score update has been through the server and
    // back, so they get the same allowance as the table (the default 5s failed once, under load).
    await expect(table.getByRole('cell', { name: '+2', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(table.getByRole('cell', { name: '-2', exact: true })).toBeVisible({ timeout: 15000 });
  } finally {
    await browser.close();
  }
});

// Code review of PR #68, round 2: results are recorded by name, so two entries
// with one name merged in the standings and a single winner was announced as
// "Ann and Ann share first place". Repeats are numbered when the bracket is made.
test('repeated names are numbered, skipping a number already in the list', () => {
  expect(uniqueParticipantNames(['Ann', 'Bo', 'Cy'])).toEqual(['Ann', 'Bo', 'Cy']);
  expect(uniqueParticipantNames(['Ann', 'Bo', 'Ann'])).toEqual(['Ann', 'Bo', 'Ann (2)']);
  expect(uniqueParticipantNames(['Ann', 'Ann', 'Ann (2)'])).toEqual(['Ann', 'Ann (3)', 'Ann (2)']);
  expect(uniqueParticipantNames(['Ann', 'Ann', 'Ann'])).toEqual(['Ann', 'Ann (2)', 'Ann (3)']);
});

test('the tournament page numbers a repeated name and crowns one champion', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Enter participant names/).fill('Ann\nBo\nAnn');
  await page.getByRole('radio', { name: 'Round Robin' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();
  await expect(page.getByText(/Repeated names are numbered/)).toBeVisible({ timeout: 5000 });

  // Ann beats both; Bo and Ann (2) draw.
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const play = async (a: string, b: string, sa: number, sb: number) => {
    const card = page.getByRole('button', {
      name: new RegExp(`^Record score: (${esc(a)} vs ${esc(b)}|${esc(b)} vs ${esc(a)})$`),
    });
    const aFirst = ((await card.getAttribute('aria-label')) ?? '').startsWith(`Record score: ${a} vs `);
    await card.click();
    const scores = page.locator('input[type="number"]');
    await scores.nth(0).fill(String(aFirst ? sa : sb));
    await scores.nth(1).fill(String(aFirst ? sb : sa));
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
  };
  await play('Ann', 'Bo', 2, 0);
  await play('Ann', 'Ann (2)', 2, 0);
  await play('Bo', 'Ann (2)', 1, 1);

  await expect(page.getByText('Tournament Champion')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Shared first place')).toHaveCount(0);
});

// Code review of PR #68, round 3: the bye is the string "__BYE__", kept in the same
// field as names. A participant with that exact name (a room username can be anything)
// was treated as a bye: their matches were disabled, so the event could never finish.
test('a participant named like the bye placeholder is numbered, not treated as a bye', () => {
  expect(uniqueParticipantNames([BYE_PLAYER, 'Ann'])).toEqual([`${BYE_PLAYER} (2)`, 'Ann']);
  const names = uniqueParticipantNames([BYE_PLAYER, 'Ann', 'Bo']);
  const t = start('round-robin', names);
  const real = t.rounds.flat().filter((m) => m.player1 !== BYE_PLAYER && m.player2 !== BYE_PLAYER);
  expect(real).toHaveLength(3); // all three pairings are real matches, none is a bye
  expect(t.rounds.flat().some((m) => m.player1 === BYE_PLAYER || m.player2 === BYE_PLAYER)).toBe(false);
});
