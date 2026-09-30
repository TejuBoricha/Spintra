import { test, expect } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, sql, BASE } from './qa-city-helpers';

// Audit L-6: a new room defaulted to 10 seats, so a teacher who never touched
// the slider turned student 11 away with "room full". A Classroom room now
// starts at 30; every other type still starts at 10; a value the host chose
// is never overridden by a later change of room type.

const createAndReadCapacity = async (page: import('@playwright/test').Page, type: string) => {
  await page.goto(`${BASE}/create?type=${type}`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  const code = page.url().split('/room/')[1].split(/[?#]/)[0];
  return Number(sql(`select max_participants from rooms where code='${code}'`));
};

test('classroom rooms start at 30 seats, other rooms at 10', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(`${BASE}/create?type=classroom`);
  await acceptCookieBanner(page);
  await expect(page.getByText(/^30 people$/)).toBeVisible({ timeout: 30000 });

  await page.goto(`${BASE}/create?type=trivia`);
  await expect(page.getByText(/^10 people$/)).toBeVisible({ timeout: 30000 });

  // Picking the Classroom card on the same page moves the untouched default.
  await page.getByRole('button', { name: /^Classroom/ }).click();
  await expect(page.getByText(/^30 people$/)).toBeVisible();
});

test('a value the host chose is kept when the room type changes', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(`${BASE}/create?type=classroom`);
  await acceptCookieBanner(page);
  await expect(page.getByText(/^30 people$/)).toBeVisible({ timeout: 30000 });

  const slider = page.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText(/^29 people$/)).toBeVisible();

  await page.getByRole('button', { name: /^Trivia/ }).click();
  await expect(page.getByText(/^29 people$/)).toBeVisible();
});

test('the room created without touching the slider gets the type default in the database', async ({ page }) => {
  test.setTimeout(150_000);
  expect(await createAndReadCapacity(page, 'classroom')).toBe(30);
  expect(await createAndReadCapacity(page, 'trivia')).toBe(10);
});
