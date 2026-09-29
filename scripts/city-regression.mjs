// Spintra City — release-blocker regression runner.
//
// Executes scripts/city-regression.sql against the LOCAL Supabase Postgres
// container and fails the process if any assertion is red. Each assertion
// encodes one release-blocking bug from the 2026-08-30 QA audit
// (QA_REPORT.md §4/§5), written to assert the CORRECT behaviour — so the
// suite starts fully red and every fix should turn exactly one row green.
//
// Two checks live here rather than in SQL because they are not database
// behaviour: the /api/health realtime probe path (BUG-013), and the
// unfiltered realtime subscriptions (BUG-038).
//
// Usage:
//   node scripts/city-regression.mjs
//   node scripts/city-regression.mjs --container supabase_db_OtherProject
//
// Local only. This never contacts production and only touches rooms in the
// CITYRG* namespace, which it tears down itself.

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

const argv = process.argv.slice(2);
const containerIdx = argv.indexOf("--container");
const CONTAINER =
  containerIdx >= 0 ? argv[containerIdx + 1] : "supabase_db_Spintra-1";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

/** Assertions that are about source, not database state. */
function sourceChecks() {
  const out = [];

  // BUG-013 — the health check probes a path that does not exist. supabase-js
  // connects to /realtime/v1/websocket; /realtime/v1/ws 404s, so the endpoint
  // reports "realtime: error" forever and returns 503 while realtime is fine.
  const health = fs.readFileSync(
    path.join(repo, "src/app/api/health/route.ts"),
    "utf8"
  );
  const probesWrongPath = /realtime\/v1\/ws["'`]/.test(health);
  out.push({
    bug: "BUG-013",
    name: "health check probes the real realtime endpoint",
    expected: "/realtime/v1/websocket (or the probe removed)",
    actual: probesWrongPath
      ? "still probes /realtime/v1/ws, which 404s"
      : "does not probe the non-existent /realtime/v1/ws",
    status: probesWrongPath ? "FAIL" : "PASS",
  });

  // BUG-038 — city_auctions and city_trade_offers subscribed with no filter
  // and a bare `() => void refetch()` handler, so activity in any other
  // match, in any room, forced every open client to run a full refetch.
  //
  // The fix does NOT add Realtime's `filter:` option to these two — a baked-in
  // `match_id=eq.<id>` goes stale the moment a post-match flow opens a new
  // match in the same room without remounting the hook. Instead it extends
  // the client-side matchIdRef guard city_match_players already used to all
  // three tables. So the correct static check is not "does a filter: string
  // appear near this table" (that was the bug, not the fix) — it's "is this
  // table's handler still the unguarded bare refetch". city_matches is exempt:
  // its filter is on room_code, which genuinely cannot change under a mounted
  // hook, so a real server-side filter is the correct and complete fix there.
  const hook = fs.readFileSync(
    path.join(repo, "src/app/room/[code]/city/use-city-match.ts"),
    "utf8"
  );
  const BARE_HANDLER = /,\s*\(\)\s*=>\s*void refetch\(\)\s*\)/;
  const unguarded = ["city_auctions", "city_trade_offers", "city_match_players"].filter((t) => {
    const m = hook.match(new RegExp(`table:\\s*"${t}"[^}]*\\}([\\s\\S]{0,80})`, "m"));
    return m && BARE_HANDLER.test(m[1]);
  });
  out.push({
    bug: "BUG-038",
    name: "realtime subscriptions are scoped to the match",
    expected: "city_auctions, city_trade_offers and city_match_players all guard on matchIdRef, not a bare refetch",
    actual: unguarded.length
      ? `still an unguarded bare refetch: ${unguarded.join(", ")}`
      : "all three are guarded",
    status: unguarded.length ? "FAIL" : "PASS",
  });

  return out;
}

// The SQL pauses the server's background jobs while it runs (0109's presence
// sweep, 0110's City tick) and switches them on at the end. If the run fails
// or is interrupted before then, or a job was already off on purpose, that
// would leave the local database wrong, so the runner records each job's
// state first and puts exactly that back afterwards.
const PAUSED_JOBS = ["city-tick", "room-presence-sweep"];

function psqlAt(query) {
  return execFileSync(
    "docker",
    ["exec", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", query],
    { encoding: "utf8" }
  ).trim();
}

function readJobStates() {
  try {
    const list = PAUSED_JOBS.map((j) => `'${j}'`).join(",");
    return psqlAt(`select jobid || '|' || active from cron.job where jobname in (${list})`)
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("|"));
  } catch {
    return [];
  }
}

function restoreJobStates(states) {
  for (const [jobid, active] of states) {
    try {
      psqlAt(`select cron.alter_job(${Number(jobid)}, active := ${active === "true" || active === "t"})`);
    } catch {
      // Best effort: the stack may be down, in which case there is nothing to restore.
    }
  }
}

function runSql() {
  const jobStates = readJobStates();
  const onInterrupt = () => {
    restoreJobStates(jobStates);
    process.exit(130);
  };
  process.once("SIGINT", onInterrupt);
  try {
    return runSqlOnce();
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    restoreJobStates(jobStates);
  }
}

function runSqlOnce() {
  const sql = fs.readFileSync(path.join(here, "city-regression.sql"), "utf8");
  let stdout;
  try {
    stdout = execFileSync(
      "docker",
      ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-q", "-f", "-"],
      { input: sql, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
    );
  } catch (err) {
    console.error(
      `\n${RED}Could not run the suite against container "${CONTAINER}".${RESET}\n` +
        `Is the local Supabase stack up?  npx supabase start\n\n` +
        String(err.stderr || err.message).trim().split("\n").slice(0, 5).join("\n")
    );
    return null; // runSql restores the jobs, then the caller exits
  }
  return stdout
    .split("\n")
    .filter((l) => l.startsWith("RESULT|"))
    .map((l) => {
      const [, bug, status, name, expected, actual] = l.split("|");
      return { bug, status, name, expected, actual };
    });
}

// A block that errors out inserts no row, which would otherwise show up as a
// smaller total rather than a failure — the quietest way for a suite to lie.
// 70 = 69 + BUG-ROOM-LOCK-KEY-MISMATCH (migration 0103 — city_create_match
// locked a room via a different hash function than elect_room_host, so the
// two never actually excluded each other; also gave the proposer-side trade
// debt check its own distinct error code instead of reusing the accepting
// seat's — no new assertion for that, BUG-TRADE-PROPOSER-DEBT's existing
// check was tightened in place to the exact new code).
// 78 = 70 + eight for migration 0110 (the server timekeeper): a due turn is
// claimed, a turn not yet due is left alone, an expired auction is settled,
// an empty match is paused, players still need a seat to claim, a player
// detained mid-turn has the turn ended (tick and autopilot), and a match that
// just failed waits its turn.
const EXPECTED_SQL_ASSERTIONS = 78;

const sqlRows = runSql();
if (sqlRows === null) process.exit(2);
if (sqlRows.length !== EXPECTED_SQL_ASSERTIONS) {
  console.error(
    `
${RED}Harness error:${RESET} expected ${EXPECTED_SQL_ASSERTIONS} SQL assertions, ` +
      `got ${sqlRows.length}. A block raised before recording its result.
` +
      `Run the SQL directly to see it:
` +
      `  docker exec -i ${CONTAINER} psql -U postgres -d postgres -q -f - < scripts/city-regression.sql
`
  );
  process.exit(2);
}

const rows = [...sqlRows, ...sourceChecks()];
rows.sort((a, b) => a.bug.localeCompare(b.bug));

const pass = rows.filter((r) => r.status === "PASS").length;
const fail = rows.filter((r) => r.status === "FAIL").length;

console.log(`\n${BOLD}Spintra City — release-blocker regression${RESET}\n`);
for (const r of rows) {
  const tag =
    r.status === "PASS" ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${tag}  ${BOLD}${r.bug}${RESET}  ${r.name}`);
  if (r.status !== "PASS") {
    console.log(`        ${DIM}expected:${RESET} ${r.expected}`);
    console.log(`        ${DIM}actual:  ${RESET} ${r.actual}`);
  }
}

console.log(
  `\n  ${pass} passed, ${fail === 0 ? "0" : `${RED}${fail}${RESET}`} failed, ${rows.length} total\n`
);

if (fail > 0) {
  console.log(
    `${DIM}This suite is expected to be red until the fixes land. Each fix should\n` +
      `turn exactly one row green without turning any other row red.${RESET}\n`
  );
  process.exit(1);
}
