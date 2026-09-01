import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import type { Page } from '@playwright/test';

export const SCRATCH = 'C:/Users/tejas/AppData/Local/Temp/claude/c--Users-tejas-Desktop-Spintra-1/cec4ff14-1fcd-49b4-a12a-68214422c5ee/scratchpad';
export const SHOTS = path.join(SCRATCH, 'qa-shots');
export const BASE = 'http://127.0.0.1:4020';

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
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  return page.url().split('/room/')[1].split(/[?#]/)[0];
}

/** Reads authoritative rows straight from Postgres, bypassing the UI entirely. */
export function sql(q: string): string {
  return execSync(
    `docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -At -c "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8' }
  ).trim();
}
