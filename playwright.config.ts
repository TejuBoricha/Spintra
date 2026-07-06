import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  // Both CI jobs (validate, db-integration) already run an explicit
  // `npm run build` step before this. In CI, reuse that output instead of
  // building a second time here — db-integration in particular runs
  // alongside ~10 Supabase Docker containers, and a redundant full compile
  // on top of that contention was pushing simple page loads past the test
  // timeouts below (observed: create-room-button, purely static markup,
  // never found within 30-45s).
  timeout: 60 * 1000,
  // A residual non-deterministic CI flake was accepted rather than chased
  // further (see TASKS.md's High-tier CI item) — an ephemeral Supabase
  // Docker stack on a shared runner has real timing/resource variance this
  // suite can hit even when nothing is actually broken. Retrying in CI lets
  // that class of flake self-heal instead of failing the whole run; a
  // genuinely broken test still fails after using up its retries.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4000',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: process.env.CI ? 'npx next start -p 4000' : 'npm run build && npx next start -p 4000',
    url: 'http://127.0.0.1:4000/create',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
