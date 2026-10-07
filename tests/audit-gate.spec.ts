import { test, expect } from '@playwright/test';
import { evaluateAudit, ghsaOf } from '../scripts/audit-gate-core.mjs';

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
