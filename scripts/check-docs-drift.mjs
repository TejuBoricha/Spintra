// Checks docs/ARCHITECTURE.md's documented folder structure and migrations
// list against the real filesystem, and fails the run if they've drifted
// apart. This exists because that exact drift (phantom files, missing new
// ones) went undetected for a full session before a manual review caught
// it — see docs/CHANGELOG_AI.md Session 21.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, "..");
const ARCHITECTURE_PATH = path.join(ROOT, "docs", "ARCHITECTURE.md");

let failed = false;

function fail(message) {
  console.error(`✖ ${message}`);
  failed = true;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

const architectureDoc = fs.readFileSync(ARCHITECTURE_PATH, "utf8");

// --- Check 1: docs/*.md files vs. ARCHITECTURE.md's folder structure diagram ---

const realDocsFiles = fs
  .readdirSync(path.join(ROOT, "docs"))
  .filter((f) => f.endsWith(".md"))
  .sort();

// Extract just the docs/ subtree from the folder-structure code block: the
// lines between "├── docs/" and the next top-level "├──"/"└──" entry.
const folderBlockMatch = architectureDoc.match(/```\nspintra\/\n([\s\S]*?)\n```/);
if (!folderBlockMatch) {
  fail("Could not find the folder structure code block in ARCHITECTURE.md §2");
} else {
  const lines = folderBlockMatch[1].split("\n");
  const docsStart = lines.findIndex((l) => l.includes("├── docs/"));
  if (docsStart === -1) {
    fail("ARCHITECTURE.md's folder structure no longer documents a docs/ entry");
  } else {
    let docsEnd = lines.length;
    for (let i = docsStart + 1; i < lines.length; i++) {
      if (/^\├──\s|^\└──\s/.test(lines[i].trim())) {
        docsEnd = i;
        break;
      }
    }
    const docsBlock = lines.slice(docsStart, docsEnd).join("\n");
    const documentedDocsFiles = Array.from(docsBlock.matchAll(/([A-Za-z0-9_-]+\.md)/g)).map((m) => m[1]);

    for (const file of realDocsFiles) {
      if (!documentedDocsFiles.includes(file)) {
        fail(`docs/${file} exists but is not listed in ARCHITECTURE.md §2's folder structure`);
      }
    }
    for (const file of documentedDocsFiles) {
      if (!realDocsFiles.includes(file)) {
        fail(`ARCHITECTURE.md §2 lists docs/${file}, but that file does not exist`);
      }
    }
    if (!failed) ok(`docs/ folder structure matches ARCHITECTURE.md §2 (${realDocsFiles.length} files)`);
  }
}

// --- Check 2: supabase/migrations/*.sql vs. ARCHITECTURE.md's Migrations Applied table ---

const migrationsDir = path.join(ROOT, "supabase", "migrations");
const realMigrations = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const migrationsTableMatch = architectureDoc.match(/### Migrations Applied\n([\s\S]*?)\n\n/);
if (!migrationsTableMatch) {
  fail("Could not find the 'Migrations Applied' table in ARCHITECTURE.md §4");
} else {
  const tableText = migrationsTableMatch[1];
  const documentedNumbers = Array.from(tableText.matchAll(/\|\s*(\d{4})\s*\|/g)).map((m) => m[1]);

  let migrationsOk = true;
  for (const file of realMigrations) {
    const number = file.slice(0, 4);
    if (!documentedNumbers.includes(number)) {
      fail(`supabase/migrations/${file} exists but migration ${number} is not in ARCHITECTURE.md §4's table`);
      migrationsOk = false;
    }
  }
  for (const number of documentedNumbers) {
    if (!realMigrations.some((f) => f.startsWith(number))) {
      fail(`ARCHITECTURE.md §4 documents migration ${number}, but no matching file exists in supabase/migrations/`);
      migrationsOk = false;
    }
  }
  if (migrationsOk) ok(`Migrations Applied table matches supabase/migrations/ (${realMigrations.length} files)`);
}

if (failed) {
  console.error("\nDocumentation drift detected — see docs/ARCHITECTURE.md and fix the mismatches above.");
  process.exit(1);
} else {
  console.log("\nNo documentation drift detected.");
}
