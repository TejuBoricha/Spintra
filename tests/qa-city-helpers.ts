import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import type { Page } from '@playwright/test';

export const SCRATCH = 'C:/Users/tejas/AppData/Local/Temp/claude/c--Users-tejas-Desktop-Spintra-1/cec4ff14-1fcd-49b4-a12a-68214422c5ee/scratchpad';
export const SHOTS = path.join(SCRATCH, 'qa-shots');
export const BASE = 'http://127.0.0.1:4000';

export interface LogEntry { who: string; type: string; text: string; }
export interface NetEntry { who: string; status: number; method: string; url: string; body?: string; }

export class Collector {
  logs: LogEntry[] = [];
  net: NetEntry[] = [];
  reqCount = new Map<string, number>();

  attach(page: Page, who: string) {
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error' || t === 'warning') this.logs.push({ who, type: t, text: m.text().slice(0, 600) });
    });
    page.on('pageerror', (e) => this.logs.push({ who, type: 'pageerror', text: String(e.message).slice(0, 600) }));
    page.on('requestfailed', (r) =>
      this.net.push({ who, status: -1, method: r.method(), url: r.url(), body: r.failure()?.errorText }));
    page.on('request', (r) => {
      const u = r.url();
      const key = r.method() + ' ' + u.replace(/\?.*$/, '');
      this.reqCount.set(key, (this.reqCount.get(key) ?? 0) + 1);
    });
    page.on('response', async (r) => {
      if (r.status() >= 400) {
        let body = '';
        try { body = (await r.text()).slice(0, 400); } catch { /* ignore */ }
        this.net.push({ who, status: r.status(), method: r.request().method(), url: r.url(), body });
      }
    });
  }

  dump(name: string) {
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, `${name}.json`),
      JSON.stringify({ logs: this.logs, net: this.net, reqCount: Object.fromEntries([...this.reqCount].sort((a,b)=>b[1]-a[1])) }, null, 2));
  }
}

export function shot(p: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

/** Creates a city room, returns the code. */
export async function createCityRoom(page: Page): Promise<string> {
  await page.goto(`${BASE}/create?type=city`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  return page.url().split('/room/')[1].split(/[?#]/)[0];
}

/**
 * Dismisses the cookie-consent banner (src/components/cookie-consent-banner.tsx).
 * Its button label depends on NEXT_PUBLIC_GA_MEASUREMENT_ID: "Accept"/"Decline"
 * when set, a single "Got it" when unset -- true in CI, where this banner
 * would otherwise sit fixed at the bottom of the viewport and can intercept
 * clicks on anything rendered near there (confirmed directly: a narrow
 * mobile viewport with the banner never dismissed left create-room-button
 * unreachable, hanging every test.setTimeout it was given).
 *
 * Scoped to the "Cookie notice" region rather than a page-wide button
 * search: the city trade panel has its own real "Accept" button (accepting
 * a trade offer, city-trade.tsx), and an unscoped search could click that
 * instead once the cookie banner itself is already gone.
 *
 * The 5000ms visible-wait matches what the pre-consolidation qa-x13/qa-x14
 * helpers used, chosen there because a shorter wait had caused a real,
 * confirmed click-interception failure (Playwright's own actionability
 * retry log named the cookie-notice region as the intercepting element).
 * Keep it at that proven value for every caller -- callers that already
 * dismissed the banner once in this same browser context (consent persists
 * in localStorage, so it can't reappear) should NOT call this again at all;
 * that redundant-call cost belongs at the call site (skip the call), not
 * fixed by shortening the one number that exists specifically to survive
 * slow, contended CI runs.
 */
export async function acceptCookieBanner(p: Page): Promise<void> {
  const region = p.getByRole('region', { name: /cookie notice/i });
  await region.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if ((await region.count()) === 0) return;
  await region
    .getByRole('button', { name: /^(accept|got it)$/i })
    .first()
    .click()
    .catch((e) => console.warn(`acceptCookieBanner: banner was present but click failed (${String(e).slice(0, 150)})`));
  await region.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
}

/** Reads authoritative rows straight from Postgres, bypassing the UI entirely. */
export function sql(q: string): string {
  return execSync(
    `docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -At -c "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8' }
  ).trim();
}
