#!/usr/bin/env node
// Runs the Playwright specs that cover what you changed, instead of the whole suite.
//
//   npm run test:related                       the specs for the files changed since main (committed, uncommitted, new)
//   npm run test:related -- --list             only say which specs it would run, and why
//   npm run test:related -- --full             the whole suite (the same as npm run test:smoke)
//   npm run test:related -- --files a.ts,b.ts  pretend these files changed (to see what a change would run)
//   npm run test:related -- -- --headed        everything after a second `--` goes to Playwright
//
// Why it exists: CI runs the whole suite on every pull request, so a full local run after each small edit repeats it
// (about four minutes). The rule is conservative on purpose: a file this script cannot place as local to one page
// or one component area runs the FULL suite. Only changes it can place (a tool page, a top-level page, the home
// page's landing components, a spec itself) run a handful of specs. See docs/DECISIONS.md (ADR-013) and
// docs/AI_RULES.md section 11.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const split = argv.indexOf("--");
const own = split === -1 ? argv : argv.slice(0, split);
const passthrough = split === -1 ? [] : argv.slice(split + 1);
const flag = (name) => own.includes(name);
const option = (name) => {
  const i = own.indexOf(name);
  return i === -1 ? null : (own[i + 1] ?? null);
};

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** The files changed relative to main: committed, uncommitted and new. null when that cannot be told. */
function changedFiles() {
  const given = option("--files");
  if (given) return given.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const base = git("merge-base", "HEAD", "origin/main")[0];
    if (!base) return null;
    return [...new Set([...git("diff", "--name-only", base), ...git("ls-files", "--others", "--exclude-standard")])];
  } catch {
    return null;
  }
}

const norm = (file) => file.replace(/\\/g, "/");
const specDir = "tests";
const specs = fs.existsSync(specDir) ? fs.readdirSync(specDir).filter((f) => f.endsWith(".spec.ts")).map((f) => `${specDir}/${f}`) : [];
const text = new Map(specs.map((s) => [s, fs.readFileSync(s, "utf8")]));

// Documentation and housekeeping: no browser test can fail because of them (npm run verify covers the docs).
const DOCS = [/^docs\//, /\.md$/, /^\.claude\//, /^\.gitignore$/, /^LICENSE/];
// Shared code and configuration: any page can break, so the whole suite is the only honest answer.
const SHARED = [
  /^package(-lock)?\.json$/,
  /^(next|playwright|eslint|postcss|tailwind|vitest)\.config\./,
  /^tsconfig/,
  /^src\/app\/(globals\.css|layout\.tsx|providers\.tsx|not-found\.tsx|global-error|manifest|robots|sitemap|opengraph|icon|favicon)/,
  /^src\/components\/(ui|layout)\//,
  /^src\/(lib|hooks|contexts?|types?|proxy|middleware|instrumentation)/,
  /^(public|supabase|scripts|\.github)\//,
];

/** Does a spec visit this route? The route followed by a quote, a slash, a query or a template hole. */
function visits(spec, route) {
  const body = text.get(spec) ?? "";
  if (route === "/") return /goto\(\s*(?:`\$\{[^}]+\}\/`|['"]\/['"])/.test(body);
  return ["'", '"', "`", "?", "/", "#"].some((end) => body.includes(route + end));
}

/** Specs for one route, plus the specs that walk every page (they catch layout and overflow problems anywhere). */
const EVERY_PAGE = ["tests/no-sideways-scroll.spec.ts"].filter((s) => text.has(s));
function forRoute(route) {
  return new Set([...EVERY_PAGE, ...specs.filter((s) => visits(s, route))]);
}

function plan(files) {
  const chosen = new Set();
  const notes = [];
  const full = (why) => ({ full: true, specs: chosen, notes: [...notes, why] });
  for (const raw of files) {
    const file = norm(raw);
    let m;
    if (DOCS.some((r) => r.test(file))) {
      notes.push(`${file}: documentation (npm run verify checks it)`);
    } else if (/^tests\/.+\.spec\.ts$/.test(file)) {
      if (fs.existsSync(file)) {
        chosen.add(file);
        notes.push(`${file}: the spec itself`);
      }
    } else if (/^tests\//.test(file)) {
      const name = path.basename(file).replace(/\.[tj]s$/, "");
      const users = specs.filter((s) => new RegExp(`from ['"]\\.{1,2}/(?:helpers/)?${name}['"]`).test(text.get(s)));
      if (users.length === 0 || users.length > 6) return full(`${file}: a test helper used by ${users.length} specs`);
      users.forEach((s) => chosen.add(s));
      notes.push(`${file}: the ${users.length} specs that import it`);
    } else if (SHARED.some((r) => r.test(file))) {
      return full(`${file}: shared code or configuration, any page can break`);
    } else if ((m = file.match(/^src\/app\/tools\/([^/]+)\//))) {
      forRoute(`/tools/${m[1]}`).forEach((s) => chosen.add(s));
      notes.push(`${file}: the /tools/${m[1]} page`);
    } else if (/^src\/app\/tools\/(page|layout)\.tsx$/.test(file)) {
      forRoute("/tools").forEach((s) => chosen.add(s));
      notes.push(`${file}: the /tools hub`);
    } else if ((m = file.match(/^src\/app\/(explore|create|for-teachers|settings|spintra-city|legal)\//))) {
      forRoute(`/${m[1]}`).forEach((s) => chosen.add(s));
      notes.push(`${file}: the /${m[1]} page`);
    } else if (file === "src/app/page.tsx" || file === "src/app/home-client.tsx" || /^src\/components\/landing\//.test(file)) {
      forRoute("/").forEach((s) => chosen.add(s));
      notes.push(`${file}: the home page`);
    } else {
      return full(`${file}: not a file this script can place`);
    }
  }
  return { full: false, specs: chosen, notes };
}

const files = changedFiles();
let result;
if (flag("--full")) result = { full: true, specs: new Set(), notes: ["--full"] };
else if (files === null) result = { full: true, specs: new Set(), notes: ["could not tell what changed (no origin/main to compare with)"] };
else result = plan(files);

console.log(`Changed since main: ${files === null ? "unknown" : files.length} file(s)`);
for (const note of result.notes.slice(0, 12)) console.log(`  ${note}`);
if (result.notes.length > 12) console.log(`  ... and ${result.notes.length - 12} more`);

if (result.full) {
  console.log("\nRunning the FULL suite.");
} else if (result.specs.size === 0) {
  console.log("\nNothing to run in a browser. Run npm run verify. CI runs the full suite on the pull request.");
  process.exit(0);
} else {
  console.log(`\nRunning ${result.specs.size} spec file(s):\n  ${[...result.specs].sort().join("\n  ")}\nCI runs the full suite on the pull request.`);
}
if (flag("--list")) process.exit(0);

const run = spawnSync("npx", ["playwright", "test", ...(result.full ? [] : [...result.specs].sort()), ...passthrough], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(run.status ?? 1);
