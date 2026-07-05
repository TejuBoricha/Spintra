// Verifies that a migration's objects actually exist LIVE in the linked
// Supabase project — not just that `supabase migration list` marks it
// "applied". Three migrations (0008, 0009, 0010) were each independently
// found tracked-as-applied while never having actually executed, only
// caught by a human/AI manually cross-checking each time (see
// docs/CHANGELOG_AI.md Sessions 37/38/40). This script makes that check
// repeatable instead of tribal knowledge.
//
// Usage:
//   node scripts/verify-migration.mjs                  # verifies the newest migration file
//   node scripts/verify-migration.mjs 0025              # verifies migration 0025_*.sql
//   node scripts/verify-migration.mjs supabase/migrations/0025_room_join_rate_limit.sql
//
// Requires the Supabase CLI to be linked already (`supabase link`), same as
// `supabase db push`. Runs one read-only query against the live database —
// never modifies anything.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

function resolveMigrationFile(arg) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (!arg) {
    return path.join(MIGRATIONS_DIR, files[files.length - 1]);
  }
  if (fs.existsSync(arg)) return path.resolve(arg);
  if (fs.existsSync(path.join(ROOT, arg))) return path.join(ROOT, arg);

  const match = files.find((f) => f.startsWith(arg) || f === arg || f === `${arg}.sql`);
  if (!match) {
    console.error(`✖ No migration file found matching "${arg}" in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  return path.join(MIGRATIONS_DIR, match);
}

function extractObjects(sql) {
  const objects = [];
  const seen = new Set();
  const add = (kind, name, sqlCheck) => {
    const key = `${kind}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    objects.push({ kind, name, sqlCheck });
  };

  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi)) {
    add("function", m[1], `exists (select 1 from pg_proc where proname = '${m[1]}' and pronamespace = 'public'::regnamespace)`);
  }
  for (const m of sql.matchAll(/create\s+trigger\s+(\w+)/gi)) {
    add("trigger", m[1], `exists (select 1 from pg_trigger where tgname = '${m[1]}')`);
  }
  for (const m of sql.matchAll(/create\s+policy\s+"([^"]+)"/gi)) {
    add("policy", m[1], `exists (select 1 from pg_policy where polname = '${m[1]}')`);
  }
  for (const m of sql.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.(\w+)/gi)) {
    add("table", m[1], `exists (select 1 from pg_tables where schemaname = 'public' and tablename = '${m[1]}')`);
  }
  for (const m of sql.matchAll(/create\s+(?:unique\s+)?index\s+if\s+not\s+exists\s+(\w+)/gi)) {
    add("index", m[1], `exists (select 1 from pg_indexes where schemaname = 'public' and indexname = '${m[1]}')`);
  }
  for (const m of sql.matchAll(/create\s+extension\s+if\s+not\s+exists\s+(\w+)/gi)) {
    add("extension", m[1], `exists (select 1 from pg_extension where extname = '${m[1]}')`);
  }
  for (const m of sql.matchAll(/alter\s+table\s+public\.(\w+)\s+add\s+column\s+if\s+not\s+exists\s+(\w+)/gi)) {
    const label = `${m[1]}.${m[2]}`;
    add("column", label, `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = '${m[1]}' and column_name = '${m[2]}')`);
  }

  return objects;
}

const migrationPath = resolveMigrationFile(process.argv[2]);
const migrationName = path.basename(migrationPath);
console.log(`Verifying live objects for: ${migrationName}\n`);

const sql = fs.readFileSync(migrationPath, "utf8");
const objects = extractObjects(sql);

if (objects.length === 0) {
  console.log("No verifiable objects found (this migration may only contain DML/seed data, drops, or column type changes — nothing to check).");
  process.exit(0);
}

const query = objects
  .map((o) => `select '${o.kind}' as kind, '${o.name.replace(/'/g, "''")}' as name, ${o.sqlCheck} as exists`)
  .join("\nunion all\n") + "\norder by 1, 2;";

const tmpFile = path.join(os.tmpdir(), `verify-migration-${Date.now()}.sql`);
fs.writeFileSync(tmpFile, query);

let output;
try {
  output = execFileSync("npx", ["supabase", "db", "query", "--linked", "--file", tmpFile], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
} catch (err) {
  console.error("✖ Failed to run verification query against the live database.");
  console.error(err.stdout || err.message);
  process.exit(1);
} finally {
  fs.unlinkSync(tmpFile);
}

const jsonStart = output.indexOf("{");
if (jsonStart === -1) {
  console.error("✖ Could not parse a response from `supabase db query` — raw output:");
  console.error(output);
  process.exit(1);
}

const parsed = JSON.parse(output.slice(jsonStart));
const rows = parsed.rows || [];

let allExist = true;
for (const row of rows) {
  const status = row.exists ? "✓" : "✖";
  if (!row.exists) allExist = false;
  console.log(`${status} ${row.kind}: ${row.name}`);
}

console.log("");
if (allExist) {
  console.log(`All ${rows.length} object(s) from ${migrationName} exist live. Verified, not just tracked as applied.`);
  process.exit(0);
} else {
  console.error(`${migrationName} is tracked as applied but is missing objects live — same failure mode as migrations 0008/0009/0010. Re-run its SQL directly (e.g. via 'supabase db query --linked --file <migration>') rather than assuming it's an ordering issue.`);
  process.exit(1);
}
