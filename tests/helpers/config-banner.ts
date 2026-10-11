import type { Page } from '@playwright/test';

/**
 * A production build made without the Supabase variables (CI's `validate` job builds that way on purpose, to test
 * the demo-mode fallback) shows a red warning bar across the top of every page. It sits over the navbar and takes
 * the clicks meant for the JOIN and "What's next" buttons. Real visitors never see it (the live site is always built
 * with the variables), so a test that clicks the navbar hides it first; in a build that has the variables it does not
 * exist and this changes nothing.
 */
export async function hideConfigBanner(page: Page) {
  await page.addStyleTag({ content: '[data-testid="production-config-warning"] { display: none !important; }' });
}
