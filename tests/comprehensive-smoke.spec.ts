import { test, expect } from '@playwright/test';

test('comprehensive smoke test of all tools and room activities', async ({ page }) => {
  // Direct console capture
  page.on('console', (msg) => console.log(`[browser:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  // 1. Test homepage elements and navigation links
  await page.goto('/');
  await expect(page.locator('h1').first()).toContainText('Turn Every');
  await expect(page.getByRole('button', { name: 'Create Room' }).first()).toBeVisible();

  // 2. Go to /explore and check room feed
  await page.goto('/explore');
  await expect(page.locator('h1').first()).toContainText('Explore Spintra');

  // 3. Go to /tools/coin-flip (Solo Play layout with warning banner)
  await page.goto('/tools/coin-flip');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  await page.click('button:has-text("Flip Coin")');
  await page.waitForTimeout(500);

  // 4. Go to /tools/dice
  await page.goto('/tools/dice');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  await page.locator('button').filter({ hasText: /Roll/i }).first().click();
  await page.waitForTimeout(500);

  // 5. Go to /tools/never-have-i-ever
  await page.goto('/tools/never-have-i-ever');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  await page.locator('button').filter({ hasText: /Have/i }).first().click();

  // 6. Go to /tools/would-you-rather
  await page.goto('/tools/would-you-rather');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  // Option text is drawn randomly per load, so this targets the first
  // clickable option button by structure (sibling of the "Would you
  // rather..." prompt), not by a styling class — .glass-card was removed
  // in the design-system migration, which is why this previously timed out.
  await page.getByText('Would you rather...').locator('..').locator('button').first().click();

  // 7. Go to /tools/truth-or-dare
  await page.goto('/tools/truth-or-dare');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  await page.click('button:has-text("Truth")');

  // 8. Go to /tools/name-draw
  await page.goto('/tools/name-draw');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  await page.fill('textarea[placeholder*="names"]', 'Alice\nBob\nCharlie');
  await page.click('button:has-text("Draw One")');

  // 9. Go to /tools/team-maker
  await page.goto('/tools/team-maker');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  await page.fill('textarea[placeholder*="names"]', 'Alice\nBob\nCharlie\nDavid');
  await page.click('button:has-text("Generate Teams")');

  // 10. Go to /tools/lucky-wheel
  await page.goto('/tools/lucky-wheel');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();
  await page.click('button:has-text("Spin!")');

  // 11. Go to /tools/guess-number
  await page.goto('/tools/guess-number');
  await expect(page.getByText('Want to play with friends?').first()).toBeVisible();

  // 12. Create a Party Room to test active activities changing
  await page.goto('/create?type=party');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);

  // Check the initial Party room layout (which has the activity picker)
  await expect(page.getByText('Party Mode').first()).toBeVisible();

  // 13. Test Trivia in Multiplayer Room (as host)
  await page.click('button[aria-label="Switch game activity"]');
  await page.click('button:has-text("Trivia")');
  await expect(page.getByText('Host Settings').first()).toBeVisible();

  // 14. Exit room verification
  await page.click('button[aria-label="Leave room"]');
  await page.click('button:has-text("Leave Room")');
  await page.waitForURL('/');
});
