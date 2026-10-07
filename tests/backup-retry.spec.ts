import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The backup workflow retries every read of production through scripts/backup/retry.sh
// (PR #67: the 2 Oct scheduled backup failed on one refused pooler connection and that
// day had no backup). The helper decides, from the command's own error text, whether
// waiting can help, so its rules are checked here rather than only by waiting for a
// real outage. `sleep` is replaced, so nothing really waits.

const SCRIPT = path.join(__dirname, '../scripts/backup/retry.sh').replace(/\\/g, '/');
const URL_WITH_PASSWORD = 'postgresql://postgres.ref:hunter2@pooler.example:5432/postgres';

function run(fakeBody: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retry-'));
  const countFile = path.join(dir, 'count').replace(/\\/g, '/');
  const sleepFile = path.join(dir, 'sleeps').replace(/\\/g, '/');
  const script = `
set -euo pipefail
sleep() { echo "$1" >> "${sleepFile}"; }
source "${SCRIPT}"
fake() { echo x >> "${countFile}"; local n; n=$(wc -l < "${countFile}"); ${fakeBody}
}
rc=0
retry "the label" fake "${URL_WITH_PASSWORD}" || rc=$?
echo "retry returned $rc"
`;
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf-8' });
  const lines = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter(Boolean) : []);
  const stdout = r.stdout ?? '';
  const stderr = r.stderr ?? '';
  const returned = Number(/retry returned (\d+)/.exec(stdout)?.[1] ?? NaN);
  return { stdout, stderr, all: stdout + stderr, returned, attempts: lines(countFile).length, sleeps: lines(sleepFile).map(Number) };
}

test('a command that works is run once, with its output untouched', () => {
  const r = run('echo dumped');
  expect(r.returned).toBe(0);
  expect(r.attempts).toBe(1);
  expect(r.sleeps).toEqual([]);
  expect(r.stdout).toContain('dumped');
  expect(r.all).not.toContain('::warning');
});

test('a refused connection is retried, and the second and third wait twice as long', () => {
  const r = run('if [ "$n" -lt 3 ]; then echo "FATAL: (EAUTHQUERY) auth_query secret check timed out" >&2; return 1; fi; echo ok');
  expect(r.returned).toBe(0);
  expect(r.attempts).toBe(3);
  expect(r.sleeps).toEqual([15, 30]);
  expect(r.stderr).toContain('auth_query secret check timed out'); // the error is still shown
  expect(r.all.match(/::warning::Backup the label: attempt \d failed/g)).toHaveLength(2);
});

test('it gives up after five tries, waiting 15, 30, 60 and 120 seconds between them', () => {
  const r = run('echo "connection refused" >&2; return 1');
  expect(r.returned).toBe(1);
  expect(r.attempts).toBe(5);
  expect(r.sleeps).toEqual([15, 30, 60, 120]);
  expect(r.all).toContain('failed 5 times in a row');
});

test('a wrong password, a missing object or a denied permission stops at once', () => {
  for (const message of [
    'FATAL:  password authentication failed for user "postgres"',
    'FATAL:  no pg_hba.conf entry for host "1.2.3.4"',
    'ERROR:  permission denied for table users',
    'ERROR:  relation "x" does not exist',
    'FATAL:  (ECIRCUITBREAKER) too many authentication errors',
  ]) {
    const r = run(`echo '${message}' >&2; return 1`);
    expect(r.returned, message).toBe(1);
    expect(r.attempts, message).toBe(1);
    expect(r.sleeps, message).toEqual([]);
    expect(r.all, message).toContain("failed in a way waiting can't fix");
  }
});

test('"Tenant or user not found" gets three tries (a wrong user and a pooler reload say the same), not five', () => {
  const never = run('echo "FATAL: Tenant or user not found" >&2; return 1');
  expect(never.returned).toBe(1);
  expect(never.attempts).toBe(3);
  expect(never.sleeps).toEqual([15, 30]);

  const recovers = run('if [ "$n" -lt 2 ]; then echo "FATAL: Tenant or user not found" >&2; return 1; fi; echo ok');
  expect(recovers.returned).toBe(0);
  expect(recovers.attempts).toBe(2);
});

test('the database URL and its password are never printed by the helper', () => {
  for (const body of ['echo "connection refused" >&2; return 1', 'echo ok']) {
    const r = run(body);
    expect(r.all).not.toContain('hunter2');
    expect(r.all).not.toContain(URL_WITH_PASSWORD);
  }
});
