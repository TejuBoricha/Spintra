import { defineConfig } from '@playwright/test';

// Throwaway QA-audit config. No webServer block: the audit runs against the
// already-running dev server on 4010 pointed at the LOCAL Supabase stack.
export default defineConfig({
  testDir: 'tests',
  timeout: 180 * 1000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4020',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 20000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
