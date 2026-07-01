# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> create and join room shows host for creator
- Location: tests\smoke.spec.ts:3:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4000/create
Call log:
  - navigating to "http://127.0.0.1:4000/create", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('create and join room shows host for creator', async ({ page }) => {
> 4  |   await page.goto('/create', { waitUntil: 'networkidle' });
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4000/create
  5  | 
  6  |   // Wait for the client to hydrate and the create button to appear
  7  |   await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  8  |   await page.click('[data-testid="create-room-button"]');
  9  | 
  10 |   // Wait for created badge
  11 |   await page.waitForSelector('[data-testid="created-room-badge"]', { timeout: 5000 });
  12 | 
  13 |   // Click Join Room
  14 |   await page.click('[data-testid="join-room-button"]');
  15 | 
  16 |   // Verify URL and host UI
  17 |   await expect(page).toHaveURL(/\/room\/[A-Z0-9]+/);
  18 |   await expect(page.locator('text=You are the host')).toBeVisible();
  19 | });
  20 | 
```