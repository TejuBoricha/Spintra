import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4000',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run build && npx next start -p 4000',
    url: 'http://127.0.0.1:4000/create',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
