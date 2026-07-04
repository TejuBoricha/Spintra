// Checks docs/ARCHITECTURE.md's documented folder structure and migrations
// list against the real filesystem, and fails the run if they've drifted
// apart. Also validates React contexts, INDEX.md document references, local link existence,
// and npm script documentation.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, "..");
const ARCHITECTURE_PATH = path.join(ROOT, "docs", "ARCHITECTURE.md");
const INDEX_PATH = path.join(ROOT, "docs", "INDEX.md");
const README_PATH = path.join(ROOT, "README.md");
const CONTEXT_FILE_PATH = path.join(ROOT, "src", "app", "room", "[code]", "context", "room-activity-context.tsx");
const PACKAGE_PATH = path.join(ROOT, "package.json");

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

// --- Check 3: React Context Shapes ---

function extractDocumentedContextKeys(docText, contextName) {
  const lines = docText.split("\n");
  const headerIndex = lines.findIndex((l) => l.includes(contextName));
  if (headerIndex === -1) return null;
  const keys = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) break;
    const match = line.match(/^(?:├──|└──|│\s*├──|│\s*└──)\s*([a-zA-Z0-9_]+)\s*:/);
    if (match) {
      keys.push(match[1]);
    } else if (line && !line.startsWith("├") && !line.startsWith("└") && !line.startsWith("│")) {
      break;
    }
  }
  return keys;
}

function extractSourceContextKeys(srcText, interfaceName) {
  const match = srcText.match(new RegExp(`interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) return null;
  const body = match[1];
  const lines = body.split("\n");
  const keys = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const propMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\??\s*[:(]/);
    if (propMatch) {
      keys.push(propMatch[1]);
    }
  }
  return keys;
}

if (fs.existsSync(CONTEXT_FILE_PATH)) {
  const contextSrc = fs.readFileSync(CONTEXT_FILE_PATH, "utf8");

  // RoomActivityContext
  const docActivityKeys = extractDocumentedContextKeys(architectureDoc, "RoomActivityContext (STABLE");
  const srcActivityKeys = extractSourceContextKeys(contextSrc, "RoomActivityContextType");

  if (!docActivityKeys || !srcActivityKeys) {
    fail("Could not find RoomActivityContext definitions in ARCHITECTURE.md or source");
  } else {
    let contextOk = true;
    for (const key of srcActivityKeys) {
      if (!docActivityKeys.includes(key)) {
        fail(`Context key '${key}' exists in RoomActivityContextType (source) but is not documented in ARCHITECTURE.md`);
        contextOk = false;
      }
    }
    for (const key of docActivityKeys) {
      if (!srcActivityKeys.includes(key)) {
        fail(`Context key '${key}' is documented in ARCHITECTURE.md under RoomActivityContext but does not exist in source`);
        contextOk = false;
      }
    }
    if (contextOk) ok(`RoomActivityContext shapes are fully in sync (${srcActivityKeys.length} properties)`);
  }

  // RoomParticipantsContext
  const docParticipantsKeys = extractDocumentedContextKeys(architectureDoc, "RoomParticipantsContext (DYNAMIC");
  const srcParticipantsKeys = extractSourceContextKeys(contextSrc, "RoomParticipantsContextType");

  if (!docParticipantsKeys || !srcParticipantsKeys) {
    fail("Could not find RoomParticipantsContext definitions in ARCHITECTURE.md or source");
  } else {
    let contextOk = true;
    for (const key of srcParticipantsKeys) {
      if (!docParticipantsKeys.includes(key)) {
        fail(`Context key '${key}' exists in RoomParticipantsContextType (source) but is not documented in ARCHITECTURE.md`);
        contextOk = false;
      }
    }
    for (const key of docParticipantsKeys) {
      if (!srcParticipantsKeys.includes(key)) {
        fail(`Context key '${key}' is documented in ARCHITECTURE.md under RoomParticipantsContext but does not exist in source`);
        contextOk = false;
      }
    }
    if (contextOk) ok(`RoomParticipantsContext shapes are fully in sync (${srcParticipantsKeys.length} properties)`);
  }
} else {
  fail(`Source context file not found at ${CONTEXT_FILE_PATH}`);
}

// --- Check 4: docs/INDEX.md Alignment ---

if (fs.existsSync(INDEX_PATH)) {
  const indexDocText = fs.readFileSync(INDEX_PATH, "utf8");
  let indexOk = true;
  for (const file of realDocsFiles) {
    if (!indexDocText.includes(file)) {
      fail(`docs/${file} exists but is not referenced in docs/INDEX.md`);
      indexOk = false;
    }
  }
  if (indexOk) ok(`INDEX.md correctly references all docs (${realDocsFiles.length} files)`);
} else {
  fail(`docs/INDEX.md not found`);
}

// --- Check 5: File & Relative Link Validation ---

const markdownFiles = realDocsFiles.map((f) => path.join(ROOT, "docs", f));
if (fs.existsSync(README_PATH)) {
  markdownFiles.push(README_PATH);
}

let linksChecked = 0;
let brokenLinks = 0;

for (const filePath of markdownFiles) {
  const filePathRel = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf8");

  // Regex to match [label](url) where url is not external or anchor-only
  const linkRegex = /\[[^\]]*?\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[1].trim();

    // Skip external links, mailto, and in-page anchor-only links
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("mailto:") ||
      url.startsWith("#")
    ) {
      continue;
    }

    linksChecked++;
    let cleanUrl = decodeURIComponent(url.split("#")[0]);
    let targetPath;

    if (url.startsWith("file:///")) {
      // Extract sub-path to accommodate developer machine filesystem path roots
      if (cleanUrl.includes("/Spintra-1/") || cleanUrl.includes("/Spintra/")) {
        const parts = cleanUrl.split(/\/Spintra(?:-1)?\//);
        targetPath = path.join(ROOT, parts[parts.length - 1]);
      } else {
        try {
          targetPath = fileURLToPath(url.split("#")[0]);
        } catch {
          targetPath = cleanUrl.replace(/^file:\/\/\//, "");
        }
      }
    } else {
      // Relative path link
      targetPath = path.resolve(path.dirname(filePath), cleanUrl);
    }

    // Check if target file actually exists
    if (!fs.existsSync(targetPath)) {
      fail(`Broken link in ${filePathRel}: '${url}' (resolved target not found at: ${targetPath})`);
      brokenLinks++;
    }
  }
}

if (brokenLinks === 0) {
  ok(`Checked ${linksChecked} local links: no broken references found`);
}

// --- Check 6: Script Inventory Validation ---

if (fs.existsSync(PACKAGE_PATH)) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
  const scripts = Object.keys(pkg.scripts || {});

  const readmeContent = fs.readFileSync(README_PATH, "utf8");

  let scriptsOk = true;
  for (const script of scripts) {
    const searchStr = `npm run ${script}`;
    // Assert script name exists in ARCHITECTURE.md or is documented as the command/script
    if (!architectureDoc.includes(searchStr) && !architectureDoc.includes(script)) {
      fail(`npm script '${script}' is defined in package.json but not documented in docs/ARCHITECTURE.md`);
      scriptsOk = false;
    }
    // Assert script name exists in README.md
    if (!readmeContent.includes(searchStr) && !readmeContent.includes(script)) {
      fail(`npm script '${script}' is defined in package.json but not documented in README.md`);
      scriptsOk = false;
    }
  }
  if (scriptsOk) ok(`All package.json scripts (${scripts.length}) are documented in README.md and ARCHITECTURE.md`);
} else {
  fail("package.json not found");
}

// --- Check 7: Node.js Version Sync ---

const ciWorkflowPath = path.join(ROOT, ".github", "workflows", "ci.yml");
if (fs.existsSync(ciWorkflowPath) && fs.existsSync(PACKAGE_PATH)) {
  const ciContent = fs.readFileSync(ciWorkflowPath, "utf8");
  const nodeVersionMatch = ciContent.match(/node-version:\s*['"]?(\d+)['"]?/);
  const ciNodeVersion = nodeVersionMatch ? nodeVersionMatch[1] : null;

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
  const enginesNode = pkg.engines ? pkg.engines.node : null;

  if (!ciNodeVersion) {
    fail("Could not find Node.js node-version in .github/workflows/ci.yml");
  } else {
    let nodeOk = true;

    // Validate engines.node range compliance
    if (enginesNode) {
      const cleanRange = enginesNode.replace(/[^\d.>=]/g, "");
      const versionMatch = cleanRange.match(/(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const minMajor = parseInt(versionMatch[1], 10);
        const targetMajor = parseInt(ciNodeVersion, 10);
        if (targetMajor < minMajor) {
          fail(`Node.js version in CI (${ciNodeVersion}) is lower than the minimum allowed version in package.json engines.node (${enginesNode})`);
          nodeOk = false;
        }
      }
    }

    // Check .nvmrc if it exists
    const nvmrcPath = path.join(ROOT, ".nvmrc");
    if (fs.existsSync(nvmrcPath)) {
      const nvmrcVersion = fs.readFileSync(nvmrcPath, "utf8").trim().replace(/^v/, "");
      const nvmrcMajor = parseInt(nvmrcVersion, 10);
      if (nvmrcMajor !== parseInt(ciNodeVersion, 10)) {
        fail(`Node.js version in .nvmrc (${nvmrcVersion}) does not match CI Node version (${ciNodeVersion})`);
        nodeOk = false;
      }
    }

    // Check .node-version if it exists
    const nodeVersionFilePath = path.join(ROOT, ".node-version");
    if (fs.existsSync(nodeVersionFilePath)) {
      const nvVersion = fs.readFileSync(nodeVersionFilePath, "utf8").trim().replace(/^v/, "");
      const nvMajor = parseInt(nvVersion, 10);
      if (nvMajor !== parseInt(ciNodeVersion, 10)) {
        fail(`Node.js version in .node-version (${nvVersion}) does not match CI Node version (${ciNodeVersion})`);
        nodeOk = false;
      }
    }

    if (nodeOk) {
      ok(`Node.js versions are synchronized across CI (${ciNodeVersion}) and package.json (${enginesNode || "none"})`);
    }
  }
} else {
  if (!fs.existsSync(ciWorkflowPath)) {
    fail("CI workflow file not found at .github/workflows/ci.yml");
  }
}

// --- Check 8: Activity Registry & GAMES Slug Integrity ---

const registryPath = path.join(ROOT, "src", "app", "room", "[code]", "activities", "activity-registry.ts");
const activitiesDir = path.join(ROOT, "src", "app", "room", "[code]", "activities");
const gamesPath = path.join(ROOT, "src", "lib", "games.ts");

if (fs.existsSync(registryPath) && fs.existsSync(activitiesDir) && fs.existsSync(gamesPath)) {
  const registryContent = fs.readFileSync(registryPath, "utf8");
  const gamesSrc = fs.readFileSync(gamesPath, "utf8");

  // 1. Get real activity component filenames & slugs
  const realActivityFiles = fs
    .readdirSync(activitiesDir)
    .filter((f) => f.endsWith("-activity.tsx"));
  const realActivitySlugs = realActivityFiles.map((f) => f.replace("-activity.tsx", ""));

  // 2. Parse slugs from activity-registry.ts
  const registryBlock = registryContent.match(/ACTIVITY_REGISTRY\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\};/);
  let registrySlugs = [];
  if (!registryBlock) {
    fail("Could not parse ACTIVITY_REGISTRY block in activity-registry.ts");
  } else {
    const blockText = registryBlock[1];
    registrySlugs = Array.from(blockText.matchAll(/["']([a-z-]+)["']\s*:/g)).map((m) => m[1]);
  }

  // 3. Parse slugs from games.ts (distinguishing standard playable games from createOnly templates)
  const gameBlocks = Array.from(gamesSrc.matchAll(/\{([\s\S]*?)\}/g)).map((m) => m[1]);
  const playableSlugs = [];
  const createOnlySlugs = [];
  for (const block of gameBlocks) {
    const typeMatch = block.match(/type\s*:\s*["']([a-z-]+)["']/);
    if (typeMatch) {
      const type = typeMatch[1];
      const isCreateOnly = block.includes("createOnly: true");
      if (isCreateOnly) {
        createOnlySlugs.push(type);
      } else {
        playableSlugs.push(type);
      }
    }
  }

  let registryOk = true;

  // Check for duplicate slugs in registry
  const seenRegistrySlugs = new Set();
  const duplicateRegistrySlugs = [];
  for (const slug of registrySlugs) {
    if (seenRegistrySlugs.has(slug)) {
      duplicateRegistrySlugs.push(slug);
    }
    seenRegistrySlugs.add(slug);
  }
  if (duplicateRegistrySlugs.length > 0) {
    fail(`Duplicate slugs registered in activity-registry.ts: ${duplicateRegistrySlugs.join(", ")}`);
    registryOk = false;
  }

  // Check for duplicate slugs in games.ts
  const seenGameSlugs = new Set();
  const duplicateGameSlugs = [];
  for (const slug of playableSlugs.concat(createOnlySlugs)) {
    if (seenGameSlugs.has(slug)) {
      duplicateGameSlugs.push(slug);
    }
    seenGameSlugs.add(slug);
  }
  if (duplicateGameSlugs.length > 0) {
    fail(`Duplicate game slugs defined in games.ts: ${duplicateGameSlugs.join(", ")}`);
    registryOk = false;
  }

  // Check for orphaned activity files (exist on disk, but not in registry)
  for (const slug of realActivitySlugs) {
    if (!registrySlugs.includes(slug)) {
      fail(`Orphaned activity file: 'src/app/room/[code]/activities/${slug}-activity.tsx' exists but is not registered in activity-registry.ts`);
      registryOk = false;
    }
  }

  // Check for orphaned registry entries (in registry, but file does not exist on disk)
  for (const slug of registrySlugs) {
    if (!realActivitySlugs.includes(slug)) {
      fail(`Orphaned registry entry: '${slug}' is registered in activity-registry.ts but component file '${slug}-activity.tsx' does not exist`);
      registryOk = false;
    }
  }

  // Check for mismatched/orphaned game definitions in games.ts vs registry
  for (const slug of registrySlugs) {
    if (!playableSlugs.includes(slug)) {
      fail(`Mismatched slug: '${slug}' is registered in activity-registry.ts but is not defined as a playable game type in games.ts`);
      registryOk = false;
    }
  }

  for (const slug of playableSlugs) {
    if (!registrySlugs.includes(slug)) {
      fail(`Orphaned game definition: Playable game slug '${slug}' is defined in games.ts but is not registered in activity-registry.ts`);
      registryOk = false;
    }
  }

  if (registryOk) {
    ok(`Activity Registry and games.ts catalog are structurally synchronized (${registrySlugs.length} games)`);
  }
} else {
  if (!fs.existsSync(registryPath)) fail(`Activity registry file not found at ${registryPath}`);
  if (!fs.existsSync(activitiesDir)) fail(`Activities folder not found at ${activitiesDir}`);
  if (!fs.existsSync(gamesPath)) fail(`Games catalog file not found at ${gamesPath}`);
}

// --- Final Decision ---

if (failed) {
  console.error("\nDocumentation drift detected — please fix the mismatches above.");
  process.exit(1);
} else {
  console.log("\nNo documentation drift detected.");
}
