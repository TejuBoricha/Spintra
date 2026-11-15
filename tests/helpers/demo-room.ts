import { expect, type Page } from '@playwright/test';
import { hideConfigBanner } from './config-banner';

/**
 * Creates a party room as its host in demo mode (no Supabase) and waits until its lobby has rendered.
 * Shared by the specs that need a room on screen without a database (the contrast scan, the activity picker).
 */
export async function createDemoPartyRoom(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/create?type=party');
  await hideConfigBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45000 });
  await hideConfigBanner(page);
  // The room has joined and its lobby has rendered: the host's switch-game button is there and usable.
  await expect(page.locator('button[aria-label="Switch game activity"]')).toBeEnabled({ timeout: 30000 });
}
