#!/usr/bin/env node
// Runs the Playwright specs that cover what you changed, instead of the whole suite.
//
//   npm run test:related                       the specs for the files changed since main (committed, uncommitted, new)
//   npm run test:related -- --list             only say which specs it would run, and why
//   npm run test:related -- --full             the whole suite (the same as npm run test:smoke)
//   npm run test:related -- --files a.ts,b.ts  pretend these files changed (to see what a change would run)
//   npm run test:related -- -- --headed        everything after a second `--` goes to Playwright, unchanged
//
// Why it exists: CI runs the whole suite on every pull request, so a full local run after each small edit repeats it
// (about four minutes). A change is placed by the routes the specs visit, following the specs' own imports inside
// tests/ (a spec that reaches a page through a helper counts), and by specs that name the changed file. Any file
// this script cannot place as local to one page or one component area runs the FULL suite. It finds specs by the
// routes they mention, so a spec that reaches a page some other way can be missed: CI is the backstop.
//
// Server: if a preview server answers on port 3200 (npm run dev -- -p 3200 -H 127.0.0.1) and PLAYWRIGHT_PORT is not
// set, the specs run against it; otherwise Playwright builds and starts its own, which takes minutes.
// See docs/DECISIONS.md (ADR-013) and docs/AI_RULES.md section 11.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const argv = process.argv.slice(2);
const split = argv.indexOf("--");
const own = split === -1 ? argv : argv.slice(0, split);
const passthrough = split === -1 ? [] : argv.slice(split + 1);
const KNOWN = new Set(["--list", "--full", "--files"]);
for (let i = 0; i < own.length; i++) {
  if (own[i] === "--files") {
    if (!own[i + 1] || own[i + 1].startsWith("--")) fail("--files needs a comma-separated list of paths");
    i++;
  } else if (!KNOWN.has(own[i])) {
    fail(`Unknown option ${own[i]}. Playwright's own options go after a second --, for example: npm run test:related -- -- --headed`);
  }
}
const flag = (name) => own.includes(name);
const option = (name) => {
  const i = own.indexOf(name);
  return i === -1 ? null : own[i + 1];
};

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** The files changed relative to main: committed, uncommitted and new; a rename counts as both paths. null when unknown. */
function changedFiles() {
  const given = option("--files");
  if (given) return given.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const base = git("merge-base", "HEAD", "origin/main")[0];
    if (!base) return null;
    return [...new Set([...git("diff", "--name-only", "--no-renames", base), ...git("ls-files", "--others", "--exclude-standard")])];
  } catch {
    return null;
  }
}

const norm = (file) => file.replace(/\\/g, "/");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];
const read = (file) => (fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, "utf8") : "");
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(`${dir}/${entry.name}`);
    return [`${dir}/${entry.name}`];
  });
}
const isCode = (f) => /\.(ts|tsx|js|mjs)$/.test(f);
const testFiles = walk("tests").filter(isCode);
const specs = testFiles.filter((f) => f.endsWith(".spec.ts"));
const sourceFiles = walk("src").filter(isCode);

/** Resolve an import written in `from` to a file: relative, or the `@/` alias for src/. null for packages. */
function resolveImport(from, specifier) {
  const base = specifier.startsWith("@/") ? `src/${specifier.slice(2)}` : path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  for (const candidate of [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => `${base}/index${e}`)]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}
const IMPORT = /(?:from|import)\s*\(?\s*['"]((?:\.{1,2}\/|@\/)[^'"]+)['"]/g;
const importCache = new Map();
function importsOf(file) {
  if (!importCache.has(file)) {
    const found = new Set();
    for (const m of read(file).matchAll(IMPORT)) {
      const target = resolveImport(file, m[1]);
      if (target) found.add(target);
    }
    importCache.set(file, found);
  }
  return importCache.get(file);
}

// Test side: what a spec pulls in from tests/, followed all the way down (src/ is left out on purpose: a library
// that a helper happens to import must not make a spec "visit" every route that library mentions).
const closureCache = new Map();
function closure(file) {
  if (!closureCache.has(file)) {
    const seen = new Set();
    const stack = [file];
    while (stack.length) {
      const next = stack.pop();
      if (seen.has(next) || !next.startsWith("tests/")) continue;
      seen.add(next);
      for (const imported of importsOf(next)) stack.push(imported);
    }
    closureCache.set(file, seen);
  }
  return closureCache.get(file);
}
const textCache = new Map();
const textOf = (spec) => {
  if (!textCache.has(spec)) textCache.set(spec, [...closure(spec)].map(read).join("\n"));
  return textCache.get(spec);
};

// Source side: who imports a source file (used to tell a component only the home page uses from a shared one).
let importerIndex = null;
function importersOf(file) {
  if (!importerIndex) {
    importerIndex = new Map();
    for (const source of sourceFiles) {
      for (const target of importsOf(source)) importerIndex.set(target, [...(importerIndex.get(target) ?? []), source]);
    }
  }
  return importerIndex.get(file) ?? [];
}
const HOME_ENTRIES = new Set(["src/app/page.tsx", "src/app/home-client.tsx"]);
function onlyHome(file, seen = new Set()) {
  if (seen.has(file)) return true;
  seen.add(file);
  if (HOME_ENTRIES.has(file)) return true;
  const users = importersOf(file);
  return users.length > 0 && users.every((user) => onlyHome(user, seen));
}

// Documentation and housekeeping: no browser test can fail because of them (npm run verify checks the docs).
const DOCS = [/^docs\//, /^[^/]+\.md$/, /^\.claude\//, /^\.gitignore$/, /^LICENSE/];
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

/** Does a spec (with the helpers and lists it imports from tests/) visit this route? */
function visits(spec, route) {
  const body = textOf(spec);
  if (route === "/") return /(?:goto|get|fetch)\(\s*(?:`\$\{[^}]+\}\/`|['"]\/['"])|\[\s*['"]\/['"]\s*[,\]]/.test(body);
  return ["'", '"', "`", "?", "/", "#"].some((end) => body.includes(route + end));
}
/** Specs that name a changed file by its path (a test that reads a page's source, for example). */
const naming = (file) => specs.filter((s) => textOf(s).includes(file));

/** The specs that walk every page of the site: they catch layout and overflow problems anywhere. */
const EVERY_PAGE = specs.filter((s) => closure(s).has("tests/site-routes.ts"));
const forRoute = (route) => new Set([...EVERY_PAGE, ...specs.filter((s) => visits(s, route))]);

function plan(files) {
  const chosen = new Set();
  const notes = [];
  const full = (why) => ({ full: true, specs: chosen, notes: [...notes, why] });
  const place = (file, route, what) => {
    forRoute(route).forEach((s) => chosen.add(s));
    naming(file).forEach((s) => chosen.add(s));
    notes.push(`${file}: ${what}`);
  };
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
      const users = specs.filter((s) => closure(s).has(file));
      if (users.length === 0 || users.length > 10) return full(`${file}: a test helper that ${users.length} specs import`);
      users.forEach((s) => chosen.add(s));
      notes.push(`${file}: the ${users.length} spec(s) that import it, directly or through another helper`);
    } else if (SHARED.some((r) => r.test(file))) {
      return full(`${file}: shared code or configuration, any page can break`);
    } else if ((m = file.match(/^src\/app\/tools\/([a-z0-9][a-z0-9-]*)\//))) {
      place(file, `/tools/${m[1]}`, `the /tools/${m[1]} page`);
    } else if (/^src\/app\/tools\/(page|layout)\.tsx$/.test(file)) {
      place(file, "/tools", "the /tools hub");
    } else if ((m = file.match(/^src\/app\/(explore|create|for-teachers|settings|spintra-city|legal)\//))) {
      place(file, `/${m[1]}`, `the /${m[1]} page`);
    } else if (HOME_ENTRIES.has(file) || (/^src\/components\/landing\//.test(file) && onlyHome(file))) {
      place(file, "/", "the home page");
    } else {
      return full(`${file}: not a file this script can place (or shared by several pages)`);
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

// Use the preview server when there is one: otherwise Playwright builds the app and starts its own (minutes).
let env = process.env;
if (!process.env.PLAYWRIGHT_PORT) {
  try {
    const answer = await fetch("http://127.0.0.1:3200/", { signal: AbortSignal.timeout(8000) });
    if (answer.status < 500) {
      env = { ...process.env, PLAYWRIGHT_PORT: "3200" };
      console.log("Using the preview server on port 3200 (set PLAYWRIGHT_PORT to use another).");
    }
  } catch {
    console.log("No preview server on port 3200: Playwright will build the app and start its own (slow). Start one with: npm run dev -- -p 3200 -H 127.0.0.1");
  }
}

// Playwright's own entry point, started with this Node and no shell: arguments reach it exactly as given
// (a --grep with spaces survives on Windows).
const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const run = spawnSync(process.execPath, [cli, "test", ...(result.full ? [] : [...result.specs].sort()), ...passthrough], { stdio: "inherit", env });
process.exit(run.status ?? 1);
