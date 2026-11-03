import { test, expect } from '@playwright/test';
import { evaluateAudit, ghsaOf, readAuditReport } from '../scripts/audit-gate-core.mjs';

// The CI dependency gate (`npm run audit`) is npm audit plus a time-boxed allowlist for
// an advisory with no fix yet (7 Oct 2026: braces, which has no patched release). A bug
// in the allowlist logic would silently switch the security gate off, so its rules are
// checked here against the report shapes npm produces.

const BRACES_URL = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';

/** The shape of `npm audit --json`: an advisory object under its package, strings for packages that only depend on it. */
function report(...advisories: { name: string; severity: string; url: string; source: number }[]) {
  const vulnerabilities: Record<string, { name: string; severity: string; via: unknown[] }> = {};
  for (const a of advisories) {
    // One package can carry several advisories, as in npm's own report.
    vulnerabilities[a.name] ??= { name: a.name, severity: a.severity, via: [] };
    vulnerabilities[a.name].via.push({ ...a, title: `${a.name} problem` });
    // A package that depends on the vulnerable one lists it by name.
    vulnerabilities[`uses-${a.name}`] = { name: `uses-${a.name}`, severity: a.severity, via: [a.name] };
  }
  return { vulnerabilities };
}
const braces = { name: 'braces', severity: 'high', url: BRACES_URL, source: 1240992 };
const other = { name: 'sharp', severity: 'high', url: 'https://github.com/advisories/GHSA-wq5f-xc86-pv6w', source: 1241331 };
const entry = { id: 'GHSA-vfj7-8cjw-p6xm', reason: 'no patched release', expires: '2026-11-07' };

test('a clean report passes', () => {
  expect(evaluateAudit({ vulnerabilities: {} }, [], 'moderate', '2026-10-07')).toEqual({ failures: [], allowed: [], stale: [] });
});

test('an advisory at or above the level fails, one below it does not, and a chain of dependants is one finding', () => {
  const r = evaluateAudit(report(other, { ...braces, severity: 'low' }), [], 'moderate', '2026-10-07');
  expect(r.failures).toHaveLength(1); // sharp only; the low one is under the level, "uses-sharp" is a string
  expect(r.failures[0]).toContain('sharp');
  expect(r.failures[0]).toContain('GHSA-WQ5F-XC86-PV6W');
});

test('an allowlisted advisory passes while it is in date, and says so', () => {
  const r = evaluateAudit(report(braces), [entry], 'moderate', '2026-10-07');
  expect(r.failures).toEqual([]);
  expect(r.allowed).toHaveLength(1);
  expect(r.allowed[0]).toContain('allowed until 2026-11-07');
  // The last day still counts; the day after does not.
  expect(evaluateAudit(report(braces), [entry], 'moderate', '2026-11-07').failures).toEqual([]);
  const expired = evaluateAudit(report(braces), [entry], 'moderate', '2026-11-08');
  expect(expired.failures).toHaveLength(1);
  expect(expired.failures[0]).toContain('expired on 2026-11-07');
});

test('the allowlist covers one advisory, not the package or anything else', () => {
  const r = evaluateAudit(report(braces, other), [entry], 'moderate', '2026-10-07');
  expect(r.allowed).toHaveLength(1);
  expect(r.failures).toHaveLength(1);
  expect(r.failures[0]).toContain('sharp');
  // A different advisory on the same package is not covered.
  const second = { ...braces, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', source: 1 };
  const r2 = evaluateAudit(report(braces, second), [entry], 'moderate', '2026-10-07');
  expect(r2.allowed).toHaveLength(1);
  expect(r2.failures).toHaveLength(1);
});

test('an entry npm no longer reports is flagged as stale, and a failed npm audit fails the gate', () => {
  const r = evaluateAudit({ vulnerabilities: {} }, [entry], 'moderate', '2026-10-07');
  expect(r.failures).toEqual([]);
  expect(r.stale).toHaveLength(1);
  expect(r.stale[0]).toContain('GHSA-VFJ7-8CJW-P6XM');

  const broken = evaluateAudit({ error: { code: 'ENOAUDIT', summary: 'audit endpoint returned an error' } }, [entry], 'moderate', '2026-10-07');
  expect(broken.failures).toHaveLength(1);
  expect(broken.failures[0]).toContain('could not run');

  // npm printed an error object with an empty summary and no code in CI (22 Oct 2026): the line must still say something.
  const silent = evaluateAudit({ error: { code: '', summary: '' } }, [], 'moderate', '2026-10-07');
  expect(silent.failures).toEqual(['npm audit could not run: unknown error']);
});

test('the level "none" never fails, as with npm audit, and an unknown level is still rejected', () => {
  expect(evaluateAudit(report(other, braces), [], 'none', '2026-10-07').failures).toEqual([]);
  expect(() => evaluateAudit({ vulnerabilities: {} }, [], 'severe', '2026-10-07')).toThrow(/Unknown audit level/);
});

test('ids are matched case-insensitively and an unknown level is rejected', () => {
  expect(ghsaOf(BRACES_URL)).toBe('GHSA-VFJ7-8CJW-P6XM');
  expect(ghsaOf('https://example.com/no-id')).toBeNull();
  expect(evaluateAudit(report(braces), [{ ...entry, id: 'ghsa-vfj7-8cjw-p6xm' }], 'moderate', '2026-10-07').failures).toEqual([]);
  expect(() => evaluateAudit({ vulnerabilities: {} }, [], 'severe', '2026-10-07')).toThrow(/Unknown audit level/);
});

// 22 Oct 2026: the registry's advisory endpoint accepted about half of the requests and never answered the rest, so
// `npm audit` waited 7 minutes and reported "could not run" (on GitHub's runners and on a laptop alike). The gate runs it
// again; what it must never do is pass on anything but a report.
const hung = { stdout: '', stderr: '', signal: 'SIGTERM' };
const answered = { stdout: JSON.stringify({ vulnerabilities: {}, metadata: {} }), stderr: '', signal: null };
const failedToRun = { stdout: JSON.stringify({ error: { code: 'ENOAUDIT', summary: 'audit endpoint returned an error' } }), stderr: '', signal: null };
/** A runner that returns these results in turn, and counts its calls. */
function runner(...results: { stdout: string; stderr: string; signal: string | null }[]) {
  const calls = { count: 0 };
  return { calls, run: () => results[Math.min(calls.count++, results.length - 1)] };
}

test('npm audit is run again after a request that never answered, and the first report is used', () => {
  const log: string[] = [];
  const { run, calls } = runner(hung, failedToRun, answered);
  expect(readAuditReport(run, 6, (m) => log.push(m))).toEqual({ report: { vulnerabilities: {}, metadata: {} } });
  expect(calls.count).toBe(3);
  expect(log).toHaveLength(2); // one line per failed attempt, none for the one that worked
  expect(log[0]).toContain('attempt 1 of 6');
  expect(log[0]).toContain('SIGTERM');
  expect(log[1]).toContain('audit endpoint returned an error');
});

test('a report on the first attempt costs no retry and no log line', () => {
  const log: string[] = [];
  const { run, calls } = runner(answered);
  expect(readAuditReport(run, 6, (m) => log.push(m)).report).toBeDefined();
  expect(calls.count).toBe(1);
  expect(log).toEqual([]);
});

test('when every attempt fails the gate still fails: the last failure comes back, never a pass', () => {
  const stuck = runner(hung);
  expect(readAuditReport(stuck.run, 4, () => {})).toEqual({ unreadable: 'npm audit was stopped (SIGTERM) before it answered' });
  expect(stuck.calls.count).toBe(4);

  const broken = runner(failedToRun);
  const last = readAuditReport(broken.run, 3, () => {});
  expect(broken.calls.count).toBe(3);
  // npm's own error report goes on to evaluateAudit, which fails the gate on it.
  expect(evaluateAudit(last.report, [], 'moderate', '2026-10-22').failures).toEqual(['npm audit could not run: audit endpoint returned an error']);
  expect(last.unreadable).toBeUndefined();
});

test('JSON that is not an audit report is no report either: it is run again and never passes', () => {
  const log: string[] = [];
  const notAReport = { stdout: JSON.stringify({ message: 'Bad Gateway' }), stderr: '', signal: null };
  const { run, calls } = runner(notAReport, answered);
  expect(readAuditReport(run, 6, (m) => log.push(m)).report).toEqual({ vulnerabilities: {}, metadata: {} });
  expect(calls.count).toBe(2);
  expect(log[0]).toContain('not an audit report');

  const always = runner({ stdout: '{}', stderr: '', signal: null });
  const last = readAuditReport(always.run, 3, () => {});
  expect(last.report).toBeUndefined(); // so the gate prints it and exits 1, as for any unreadable output
  expect(last.unreadable).toBe('{}');
  expect(last.notAReport).toBe(true);

  // what is shown is the JSON that came back, not a warning npm printed beside it
  const beside = runner({ stdout: '{"message":"Bad Gateway"}', stderr: 'npm warn config something', signal: null });
  expect(readAuditReport(beside.run, 2, () => {}).unreadable).toBe('{"message":"Bad Gateway"}');
});

test('output that is not JSON counts as no report, with what npm printed', () => {
  const { run } = runner({ stdout: '', stderr: 'npm error code EAI_AGAIN', signal: null });
  expect(readAuditReport(run, 2, () => {})).toEqual({ unreadable: 'npm error code EAI_AGAIN' });
});
