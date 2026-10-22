// The decision logic of the dependency security gate (see audit-gate.mjs). Kept apart
// from the command so tests/audit-gate.spec.ts can load it without running npm.

// "none" is accepted by npm audit and by the docs-drift check: it never fails the gate.
export const LEVELS = ["info", "low", "moderate", "high", "critical", "none"];
/** The GHSA id inside an advisory URL, upper-cased, or null. */
export function ghsaOf(url) {
  const match = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i.exec(url ?? "");
  return match ? match[0].toUpperCase() : null;
}

/**
 * Decide what `npm audit --json` found.
 * @param {any} report parsed output of `npm audit --json`
 * @param {{id: string, reason: string, expires: string}[]} allowlist
 * @param {string} level lowest severity that counts
 * @param {string} today YYYY-MM-DD
 * @returns {{failures: string[], allowed: string[], stale: string[]}}
 */
export function evaluateAudit(report, allowlist, level, today) {
  const threshold = LEVELS.indexOf(level);
  if (threshold < 0) throw new Error(`Unknown audit level "${level}" (use ${LEVELS.join(", ")})`);

  const failures = [];
  const allowed = [];
  if (report?.error) {
    failures.push(`npm audit could not run: ${report.error.summary || report.error.code || "unknown error"}`);
  }

  const entries = new Map(allowlist.map((entry) => [entry.id.toUpperCase(), entry]));
  const used = new Set();
  const seen = new Set();
  for (const vulnerability of Object.values(report?.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      // A string is a package that only depends on a vulnerable one; the advisory itself is an object.
      if (typeof via === "string") continue;
      const key = via.source ?? via.url;
      if (seen.has(key)) continue;
      seen.add(key);
      if (LEVELS.indexOf(via.severity) < threshold) continue;

      const id = ghsaOf(via.url);
      const label = `${via.name}: ${via.title} (${id ?? via.url ?? via.source}, ${via.severity})`;
      const entry = id ? entries.get(id) : undefined;
      if (entry) used.add(id);
      if (entry && entry.expires >= today) {
        allowed.push(`${label}: allowed until ${entry.expires}. ${entry.reason}`);
      } else if (entry) {
        failures.push(`${label}: the exception for it expired on ${entry.expires}. Fix the dependency, or renew the entry with a new reason.`);
      } else {
        failures.push(label);
      }
    }
  }

  const stale = [...entries.keys()].filter((id) => !used.has(id)).map((id) => `${id} is on the allowlist but npm audit no longer reports it; remove it from scripts/audit-allowlist.json.`);
  return { failures, allowed, stale };
}

/**
 * Run `npm audit --json` until it returns a report. The advisory endpoint (registry.npmjs.org/-/npm/v1/security/advisories/bulk)
 * sometimes accepts a request and never answers it: on 22 Oct 2026 about half of them, from GitHub's runners and from a laptop
 * alike. npm then waits out its 5-minute fetch timeout, falls back to a retired endpoint and reports that it "could not run",
 * after 7 minutes, and a retry of the whole job is a coin toss again. One hung request costs the caller's timeout instead,
 * and the next attempt usually answers in about a second. Only a report is accepted: after the last attempt the result is
 * what it was before this retry existed, the last failure, which the gate reports and fails on. It never passes on a report
 * it did not read.
 * @param {() => {stdout?: string | null, stderr?: string | null, signal?: string | null}} run one `npm audit --json`, with its own time limit
 * @param {number} attempts how many times to run it at most
 * @param {(message: string) => void} log
 * @returns {{report?: any, unreadable?: string}} `report` is the parsed JSON (it may carry npm's own `error`); `unreadable` says what came back when it was not JSON
 */
export function readAuditReport(run, attempts, log) {
  let last = {};
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = run();
    let report;
    try {
      report = JSON.parse(result.stdout ?? "");
    } catch {
      report = undefined;
    }
    // An audit report has a `vulnerabilities` object (even an empty one); JSON without it (a proxy's page, `{}`) is not a report.
    if (report && !report.error && report.vulnerabilities && typeof report.vulnerabilities === "object") return { report };
    const why = report?.error
      ? `npm audit reported an error: ${report.error.summary || report.error.code || "unknown error"}`
      : report
        ? `npm audit returned JSON that is not an audit report: ${(result.stdout || "").slice(0, 200)}`
        : result.signal
          ? `npm audit was stopped (${result.signal}) before it answered`
          : `npm audit did not return JSON: ${(result.stderr || result.stdout || "").slice(0, 300)}`;
    last = report?.error ? { report } : { unreadable: (result.stderr || result.stdout || why).slice(0, 800) };
    if (attempt < attempts) log(`npm audit attempt ${attempt} of ${attempts} returned no report (${why}); trying again.`);
  }
  return last;
}
