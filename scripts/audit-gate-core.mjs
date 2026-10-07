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
    failures.push(`npm audit could not run: ${report.error.summary ?? report.error.code ?? "unknown error"}`);
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
