#!/usr/bin/env node
// The dependency security gate behind `npm run audit` (CI and the local "ci" script).
//
// It is `npm audit --audit-level=<level>` plus one thing plain npm audit cannot do:
// a short, time-boxed list of advisories that are known and cannot be fixed yet
// (scripts/audit-allowlist.json). Each entry names one advisory (not a package),
// says why, and expires, so a forgotten exception turns the gate red again instead
// of hiding a vulnerability for good. Everything not on the list fails the build
// exactly as before. If npm audit itself cannot run, the gate fails (it never
// passes on a report it could not read). The rules are in audit-gate-core.mjs and
// are tested in tests/audit-gate.spec.ts.
//
// Usage: node scripts/audit-gate.mjs [--audit-level=info|low|moderate|high|critical|none]
// ("none" never fails on an advisory, like npm audit's own; npm audit still has to run and be readable.)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateAudit } from "./audit-gate-core.mjs";

const ALLOWLIST_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "audit-allowlist.json");

function main() {
  const levelArg = process.argv.find((arg) => arg.startsWith("--audit-level="));
  const level = levelArg ? levelArg.split("=")[1] : "moderate";
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));

  // One fixed command string through the shell: it finds npm.cmd on Windows too.
  const run = spawnSync("npm audit --json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: true });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error(`npm audit did not return JSON:\n${(run.stderr || run.stdout || "").slice(0, 800)}`);
    process.exit(1);
  }

  const { failures, allowed, stale } = evaluateAudit(report, allowlist, level, new Date().toISOString().slice(0, 10));
  for (const line of allowed) console.log(`::notice::npm audit exception: ${line}`);
  for (const line of stale) console.log(`::notice::${line}`);
  if (failures.length > 0) {
    for (const line of failures) console.error(`::error::${line}`);
    console.error(`\nnpm audit gate: ${failures.length} advisor${failures.length === 1 ? "y" : "ies"} at ${level} or above. Run "npm audit" for the dependency paths.`);
    process.exit(1);
  }
  if (level === "none") {
    console.log("npm audit gate: --audit-level=none, so no advisory can fail the build (npm audit ran and its report was read).");
    return;
  }
  console.log(`npm audit gate: no advisory at ${level} or above${allowed.length ? ` besides ${allowed.length} time-boxed exception${allowed.length === 1 ? "" : "s"}` : ""}.`);
}

main();
