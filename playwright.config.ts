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
