import { test, expect, chromium } from '@playwright/test';
import {
  padWithByes,
  applySeeds,
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generateSwiss,
  recordMatchResult
} from '../src/lib/tournament-engine';
import type { Tournament } from '../src/lib/tournament-engine';

// ==========================================
// 1. TOURNAMENT ENGINE DIRECT MATRIX TESTS
// ==========================================

test.describe('Tournament Engine — Direct Unit & Matrix Tests', () => {
  // Test padWithByes boundary sizes
  test('padWithByes should correctly pad participant counts to powers of 2', () => {
    expect(padWithByes(['A'])).toEqual(['A']);
    expect(padWithByes(['A', 'B'])).toEqual(['A', 'B']);
    expect(padWithByes(['A', 'B', 'C'])).toEqual(['A', 'B', 'C', '__BYE__']);
    expect(padWithByes(['A', 'B', 'C', 'D', 'E'])).toEqual(['A', 'B', 'C', 'D', 'E', '__BYE__', '__BYE__', '__BYE__']);
    expect(padWithByes(Array(17).fill('P')).length).toBe(32);
  });

  // Test applySeeds sorting logic
  test('applySeeds should position seeded players first and randomly fill the rest', () => {
    const players = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
    const seeds = ['Charlie', 'Alpha'];
    const ordered = applySeeds(players, seeds);
    expect(ordered.slice(0, 2)).toContain('Alpha');
    expect(ordered.slice(0, 2)).toContain('Charlie');
    expect(ordered.slice(2)).toContain('Bravo');
    expect(ordered.slice(2)).toContain('Delta');
  });

  // Matrix generation checks for Single Elimination (Player counts 2 to 17)
  for (const size of [2, 3, 4, 5, 8, 9, 16, 17]) {
    test(`Single Elimination Generation Matrix: size=${size}`, () => {
      const players = Array.from({ length: size }, (_, i) => `Player ${i + 1}`);
      const rounds = generateSingleElimination(players, []);
      const paddedSize = Math.pow(2, Math.ceil(Math.log2(size)));
      const expectedRounds = Math.log2(paddedSize);

      expect(rounds.length).toBe(expectedRounds);
      expect(rounds[0].length).toBe(paddedSize / 2);
      expect(rounds[0][0].player1).toBeDefined();
      expect(rounds[0][0].status).toBe('pending');
    });
  }

  // Matrix generation checks for Double Elimination (Player counts 2 to 17)
  for (const size of [2, 3, 4, 5, 8, 9, 16, 17]) {
    test(`Double Elimination Generation Matrix: size=${size}`, () => {
      const players = Array.from({ length: size }, (_, i) => `Player ${i + 1}`);
      const result = generateDoubleElimination(players, []);
      const paddedSize = Math.pow(2, Math.ceil(Math.log2(size)));
      const expectedWinnersRounds = Math.log2(paddedSize);
      const expectedLosersRounds = Math.max(0, expectedWinnersRounds - 1) * 2;

      expect(result.winners.length).toBe(expectedWinnersRounds);
      expect(result.winners[0].length).toBe(paddedSize / 2);
      expect(result.losers.length).toBe(expectedLosersRounds);
    });
  }

  // Matrix generation checks for Round Robin (Player counts 2 to 10)
  for (const size of [2, 3, 4, 5, 8, 10]) {
    test(`Round Robin Generation Matrix: size=${size}`, () => {
      const players = Array.from({ length: size }, (_, i) => `Player ${i + 1}`);
      const matches = generateRoundRobin(players);
      const expectedMatchCount = (size * (size - 1)) / 2;

      expect(matches.length).toBe(1); // Flat round
      expect(matches[0].length).toBe(expectedMatchCount);
    });
  }

  // Matrix generation checks for Swiss (Player counts 2 to 10)
  for (const size of [2, 3, 4, 5, 8, 10]) {
    test(`Swiss Generation Matrix: size=${size}`, () => {
      const players = Array.from({ length: size }, (_, i) => `Player ${i + 1}`);
      const rounds = generateSwiss(players);

      expect(rounds.length).toBe(1);
      // Padded to even size, so matches per round is Ceil(size/2)
      expect(rounds[0].length).toBe(Math.ceil(size / 2));
    });
  }

  // Direct engine match scoring & tie-rejection integration tests
  test('recordMatchResult should reject ties in elimination brackets', () => {
    const players = ['A', 'B'];
    const rounds = generateSingleElimination(players, []);
    const tournament: Tournament = {
      type: 'single-elimination',
      rounds,
      participants: players,
      seeds: [],
      currentRound: 1,
      winner: null
    };

    const editMatch = {
      match: rounds[0][0],
      roundIdx: 0,
      position: 0,
      bracketKey: 'rounds' as const
    };

    const outcome = recordMatchResult(tournament, editMatch, 2, 2);
    expect(outcome.kind).toBe('invalid');
    if (outcome.kind === 'invalid') {
      expect(outcome.message).toContain('require a decisive winner');
    } else {
      throw new Error('Expected invalid outcome');
    }
  });

  test('recordMatchResult should accept ties in Swiss/Round Robin formats', () => {
    const players = ['A', 'B'];
    const matches = generateRoundRobin(players);
    const tournament: Tournament = {
      type: 'round-robin',
      rounds: matches,
      participants: players,
      seeds: [],
      currentRound: 1,
      winner: null
    };

    const editMatch = {
      match: matches[0][0],
      roundIdx: 0,
      position: 0,
      bracketKey: 'rounds' as const
    };

    const outcome = recordMatchResult(tournament, editMatch, 1, 1);
    expect(outcome.kind).toBe('champion'); // Completes the tournament
    if (outcome.kind === 'champion') {
      expect(outcome.tournament.rounds[0][0].winner).toBeNull(); // Tied match has no winner
      expect(outcome.tournament.rounds[0][0].score1).toBe(1);
      expect(outcome.tournament.rounds[0][0].score2).toBe(1);
    } else {
      throw new Error('Expected champion outcome');
    }
  });

  // Test removed since generateSwiss no longer accepts numRounds.

  test('generateRoundRobin with 0 or 1 player should generate empty brackets', () => {
    const emptyRR = generateRoundRobin([]);
    expect(emptyRR[0]).toEqual([]);
    const singleRR = generateRoundRobin(['A']);
    expect(singleRR[0]).toEqual([]);
  });

  test('generateSingleElimination with empty list should generate empty bracket', () => {
    const emptySE = generateSingleElimination([], []);
    expect(emptySE).toEqual([[]]);
  });

  test('recordMatchResult with out-of-bounds roundIdx or position should not advance players', () => {
    const players = ['A', 'B'];
    const rounds = generateSingleElimination(players, []);
    const tournament: Tournament = {
      type: 'single-elimination',
      rounds,
      participants: players,
      seeds: [],
      currentRound: 1,
      winner: null
    };

    // Invalid roundIdx
    const editMatchBadRound = {
      match: rounds[0][0],
      roundIdx: 99,
      position: 0,
      bracketKey: 'rounds' as const
    };
    const outcome1 = recordMatchResult(tournament, editMatchBadRound, 2, 1);
    expect(outcome1.kind).toBe('champion'); // For 2 players, single match completion crowns champion regardless of roundIdx!
    
    // Let's test with 4 players to check advancement out of bounds
    const players4 = ['A', 'B', 'C', 'D'];
    const rounds4 = generateSingleElimination(players4, []);
    const tournament4: Tournament = {
      type: 'single-elimination',
      rounds: rounds4,
      participants: players4,
      seeds: [],
      currentRound: 1,
      winner: null
    };

    const editMatchBadRound4 = {
      match: rounds4[0][0],
      roundIdx: 99, // Out of bounds round idx
      position: 0,
      bracketKey: 'rounds' as const
    };
    const outcome2 = recordMatchResult(tournament4, editMatchBadRound4, 2, 1);
    expect(outcome2.kind).toBe('advanced');
    if (outcome2.kind === 'advanced') {
      // Expect that next round (Round 2) was NOT populated since roundIdx was invalid
      expect(outcome2.tournament.rounds[1][0].player1).toBeNull();
      expect(outcome2.tournament.rounds[1][0].player2).toBeNull();
    }
  });

  test('recordMatchResult with duplicate player names should execute without crashing', () => {
    const players = ['Alpha', 'Alpha'];
    const rounds = generateSingleElimination(players, []);
    const tournament: Tournament = {
      type: 'single-elimination',
      rounds,
      participants: players,
      seeds: [],
      currentRound: 1,
      winner: null
    };
    const editMatch = {
      match: rounds[0][0],
      roundIdx: 0,
      position: 0,
      bracketKey: 'rounds' as const
    };
    const outcome = recordMatchResult(tournament, editMatch, 2, 1);
    expect(outcome.kind).toBe('champion');
    if (outcome.kind === 'champion') {
      expect(outcome.winner).toBe('Alpha');
    }
  });
});

// ==========================================
// 2. PLAYWRIGHT E2E INTERACTION TESTS
// ==========================================

test.describe('Tournament UI E2E & Edge Cases Spec', () => {
  // Direct console capture for debugging
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[browser:${msg.type()}]`, msg.text()));
    page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));
  });

  // Test UI 1: Single Elimination 4-Player (Progression & Champion crowning)
  test('E2E: Single Elimination 4-player completes bracket successfully', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie\nDelta');
    await page.getByRole('radio', { name: 'Single Elim' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    // 4-player Single Elim needs 3 matches to finish: 2 in Round 1 + 1 in Final
    for (let i = 0; i < 3; i++) {
      const readyMatch = page
        .locator('[data-testid="tournament-match"][data-match-ready="true"]:not([data-match-status="completed"])')
        .first();

      await expect(readyMatch).toBeVisible({ timeout: 5000 });
      await readyMatch.click();

      const scoreInputs = page.locator('input[type="number"]');
      await scoreInputs.nth(0).fill('3');
      await scoreInputs.nth(1).fill('1');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    await expect(page.getByText('Tournament Champion')).toBeVisible({ timeout: 5000 });
  });

  // Test UI 2: Single Elimination 3-Player BYE Progression Lock (Odd count failure check)
  test('E2E: Single Elimination 3-player completes successfully with BYE', async ({ page }) => {
    // 3 players + 1 BYE = 4 slots (2 matches in round 1)
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie');
    await page.getByRole('radio', { name: 'Single Elim' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    // Verify 2 matches in round 1
    const matchCount = await page.locator('[data-testid="tournament-match"]').count();
    expect(matchCount).toBeGreaterThanOrEqual(2);

    const byeMatch = page.locator('[data-testid="tournament-match"]').nth(1);
    const text = await byeMatch.textContent();
    expect(text).toContain('__BYE__');

    // Verify BYE match is auto-completed
    await expect(byeMatch).toHaveAttribute('data-match-status', 'completed');

    // Score the real match
    const realMatch = page.locator('[data-testid="tournament-match"]').first();
    await expect(realMatch).toHaveAttribute('data-match-status', 'pending');
    await realMatch.click();

    await page.getByPlaceholder('0').first().fill('3');
    await page.getByPlaceholder('0').nth(1).fill('1');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify final match is now pending and has both players
    const finalMatch = page.locator('[data-testid="tournament-match"]').nth(2);
    await expect(finalMatch).toHaveAttribute('data-match-status', 'pending');
    await expect(finalMatch).toHaveAttribute('data-match-ready', 'true');
    
    // Complete the final match
    await finalMatch.click();
    await page.getByPlaceholder('0').first().fill('2');
    await page.getByPlaceholder('0').nth(1).fill('0');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Tournament Champion')).toBeVisible();
  });

  // Test UI 3: Typo Correction Lock check (Matches can never be edited after completion)
  test('E2E: Completed matches are locked against typo correction and edits', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo');
    await page.getByRole('radio', { name: 'Single Elim' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    const match = page.locator('[data-testid="tournament-match"]').first();
    await match.click();

    const scoreInputs = page.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('2');
    await scoreInputs.nth(1).fill('1');
    await page.getByRole('button', { name: 'Save' }).click();

    // Assert status updated to completed
    await expect(match).toHaveAttribute('data-match-status', 'completed');

    // Try clicking again to trigger score update modal
    await match.click({ force: true });

    // Assert that the scoring popup did NOT open (Score inputs not visible on page)
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
  });

  // Test UI 4: Double Elimination 2-Player Completes Successfully
  test('E2E: Double Elimination 2-player completes successfully', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo');
    await page.getByRole('radio', { name: 'Double Elim' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    const winnersMatch = page.locator('[data-testid="tournament-match"]').first();
    await expect(winnersMatch).toBeVisible();

    await winnersMatch.click();
    const scoreInputs = page.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('3');
    await scoreInputs.nth(1).fill('2');
    await page.getByRole('button', { name: 'Save' }).click();

    // Winners match completes, and the tournament is finished (2 player special case)
    await expect(winnersMatch).toHaveAttribute('data-match-status', 'completed');
    await expect(page.getByText('Tournament Champion')).toBeVisible();
  });

  // Test UI 5: Round Robin Standings & Completion Defect
  test('E2E: Round Robin computes points on standalone page and completes', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie');
    await page.getByRole('radio', { name: 'Round Robin' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    // Record results for the 3 matches
    for (let i = 0; i < 3; i++) {
      const readyMatch = page
        .locator('[data-testid="tournament-match"][data-match-ready="true"]:not([data-match-status="completed"])')
        .first();

      await expect(readyMatch).toBeVisible();
      await readyMatch.click();

      const scoreInputs = page.locator('input[type="number"]');
      if (i === 2) {
        await scoreInputs.nth(0).fill('1');
        await scoreInputs.nth(1).fill('1');
      } else {
        await scoreInputs.nth(0).fill('2');
        await scoreInputs.nth(1).fill(i === 0 ? '1' : '0');
      }
      await page.getByRole('button', { name: 'Save' }).click();
    }

    // Verify standings dashboard calculates math correctly
    await expect(page.getByText('Standings')).toBeVisible();
    await expect(page.getByText('Pts', { exact: false }).first()).toBeVisible();

    // Verify that the tournament has a champion banner (since we fixed completion detection)
    await expect(page.getByText('Tournament Champion')).toBeVisible();
  });

  // Test UI 6: Name Collision checking
  test('E2E: Player named BYE triggers logic collision', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('BYE\nAlpha');
    await page.getByRole('radio', { name: 'Single Elim' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    const match = page.locator('[data-testid="tournament-match"]').first();
    // Should be locked as ready="false" because the name collides with dummy slot logic
    await expect(match).toHaveAttribute('data-match-ready', 'false');
  });

  // Test UI 7: Validation edge case
  test('E2E: Validation enforces at least 2 participants', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha');
    const generateBtn = page.getByRole('button', { name: 'Generate Bracket' });
    await expect(generateBtn).toBeDisabled();
  });

  // Test UI 8: Whitespace-only participant names are blocked (disabled button)
  test('E2E: Whitespace-only participant list disables generation button', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('   \n   ');
    const generateBtn = page.getByRole('button', { name: 'Generate Bracket' });
    await expect(generateBtn).toBeDisabled();
  });

  // Test UI 9: Duplicate names list is accepted but behaves ambiguously
  test('E2E: Duplicate names list is accepted and advances successfully', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nAlpha');
    await page.getByRole('radio', { name: 'Single Elim' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    const match = page.locator('[data-testid="tournament-match"]').first();
    await expect(match).toBeVisible();

    await match.click();
    const scoreInputs = page.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('3');
    await scoreInputs.nth(1).fill('2');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify Alpha won and tournament finishes
    await expect(page.getByText('Tournament Champion')).toBeVisible();
    await expect(page.locator('.text-3xl.font-bold')).toContainText('Alpha');
  });

  // Test UI 10: Negative scores are compared correctly (recordMatchResult's
  // `s1 > s2 ? player1 : s2 > s1 ? player2 : null` is plain numeric
  // comparison, so -3 > -5 correctly picks Bravo — verified directly against
  // src/lib/tournament-engine.ts, no defect found there).
  test('E2E: Score editor accepts negative integers and processes them', async ({ page }) => {
    await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

    await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo');
    await page.getByRole('radio', { name: 'Single Elim' }).click();
    await page.getByRole('button', { name: 'Generate Bracket' }).click();

    const match = page.locator('[data-testid="tournament-match"]').first();
    await expect(match).toBeVisible();

    await match.click();
    const scoreInputs = page.locator('input[type="number"]');
    await expect(scoreInputs).toHaveCount(2);

    // Bracket generation shuffles participant order into the player1/player2
    // slots when no seeds are given (generateSingleElimination -> applySeeds
    // -> shuffleArray), so which score input belongs to "Bravo" isn't fixed
    // at index 1 — read the on-screen name labels to find it, rather than
    // assuming a slot order that doesn't actually exist.
    const names = await page.locator('div.flex-1.text-center > p').allTextContents();
    const bravoIndex = names.findIndex((n) => n.trim() === 'Bravo');
    expect(bravoIndex).toBeGreaterThanOrEqual(0);

    // Input negative scores: -5 vs -3 (-3 is larger than -5, so Bravo wins!)
    await scoreInputs.nth(bravoIndex).fill('-3');
    await scoreInputs.nth(1 - bravoIndex).fill('-5');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify Bravo is crowned champion (since -3 > -5)
    await expect(page.getByText('Tournament Champion')).toBeVisible();
    await expect(page.locator('.text-3xl.font-bold')).toContainText('Bravo');
  });
});

// ==========================================
// 3. MULTIPLAYER ROOM SYNCHRONIZATION TESTS
// ==========================================

test.describe('Tournament Multiplayer E2E Sync & Permissions Spec', () => {
  test('Multiplayer: Guest synchronizes bracket updates and is blocked from score edits', async ({ page, baseURL }) => {
    test.setTimeout(90_000);

    // 1. Host creates a tournament room
    await page.goto('/create?type=tournament');
    await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
    await page.click('[data-testid="create-room-button"]');
    await page.waitForURL(/\/room\/[A-Z0-9]+/);
    const roomCode = page.url().split('/room/')[1];

    // Check if we are running in local-only demo mode. If so, skip multi-browser test.
    await Promise.race([
      page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ]);
    const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
    if (isLocalOnlyMode) {
      test.skip(true, 'Running in local-only mode (No Supabase realtime). Skipping multi-browser test.');
    }

    // 2. Launch Guest browser instance
    const browser = await chromium.launch();
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      await guestPage.goto(`${baseURL}/room/${roomCode}`);
      
      // Wait for Guest and Host to establish liveness and sync presence
      await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

      // 3. Host generates bracket (Default 2-player single elim)
      await page.getByRole('button', { name: /generate bracket/i }).click();

      // 4. Assert Guest sees the generated bracket in real-time
      const guestMatchCard = guestPage.locator('[data-testid="tournament-match"]').first();
      await expect(guestMatchCard).toBeVisible({ timeout: 15000 });

      // 5. Check UI Permission Gate: Guest MatchCard should be disabled
      await expect(guestMatchCard).toBeDisabled();

      // 6. Host plays the match
      const hostMatchCard = page.locator('[data-testid="tournament-match"]').first();
      await hostMatchCard.click();
      
      const scoreInputs = page.locator('input[type="number"]');
      await scoreInputs.nth(0).fill('3');
      await scoreInputs.nth(1).fill('1');
      await page.getByRole('button', { name: 'Save' }).click();

      // 7. Verify Guest immediately sees the updated score and champion in real-time
      await expect(guestMatchCard).toHaveAttribute('data-match-status', 'completed', { timeout: 15000 });
      await expect(guestPage.getByText('Tournament Champion')).toBeVisible({ timeout: 15000 });
    } finally {
      await guestContext.close();
      await browser.close();
    }
  });
});
