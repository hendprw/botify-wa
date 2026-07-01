#!/usr/bin/env node
/**
 * botify-wa CLI
 * -------------
 * Usage:
 *   npx botify-wa build <bot-name>   scaffold a new bot workspace
 *   npx botify-wa help               show this help
 *   npx botify-wa version            print the framework version
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs";
import { writeFileSync, readFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, "../src/templates");

// ── helpers ──────────────────────────────────────────────────────────────────

function version() {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, "../package.json"), "utf8")
  );
  return pkg.version;
}

function ok(msg)   { console.log(`  \x1b[32m✔\x1b[0m  ${msg}`); }
function info(msg) { console.log(`  \x1b[36mℹ\x1b[0m  ${msg}`); }
function err(msg)  { console.error(`  \x1b[31m✖\x1b[0m  ${msg}`); }
function bold(s)   { return `\x1b[1m${s}\x1b[0m`; }
function dim(s)    { return `\x1b[2m${s}\x1b[0m`; }

/**
 * Copy every file from srcDir into destDir, creating subdirectories as
 * needed. Skips files that already exist so re-running is safe.
 */
function copyDir(srcDir, destDir, rootDest, results) {
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir)) {
    const srcPath  = join(srcDir, entry);
    const destPath = join(destDir, entry);

    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath, rootDest, results);
      continue;
    }

    const rel = destPath.slice(rootDest.length + 1); // for display

    if (existsSync(destPath)) {
      results.skipped.push(rel);
    } else {
      copyFileSync(srcPath, destPath);
      results.created.push(rel);
    }
  }
}

// ── commands ─────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${bold("botify-wa")} — WhatsApp bot framework CLI
${dim("─".repeat(42))}

  ${bold("build")} <bot-name>    Scaffold a new bot workspace in ./<bot-name>/
  ${bold("version")}             Print the installed framework version
  ${bold("help")}                Show this help message

${bold("Examples:")}
  npx botify-wa build my-bot
  npx botify-wa build sales-bot

${bold("After scaffolding:")}
  cd <bot-name>
  npm install
  node index.js
`);
}

function runBuild(botName) {
  if (!botName) {
    err("Please provide a bot name.");
    console.log(`  Usage: ${bold("npx botify-wa build <bot-name>")}`);
    process.exit(1);
  }

  // Sanitise: lowercase, replace spaces/special chars with hyphens.
  const safeName = botName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (!safeName) {
    err(`"${botName}" is not a valid bot name.`);
    process.exit(1);
  }

  const dest = resolve(process.cwd(), safeName);

  console.log(`
${bold("botify-wa")} — scaffolding ${bold(safeName)}
${dim("─".repeat(42))}
`);

  if (existsSync(dest) && readdirSync(dest).length > 0) {
    err(`Directory "${safeName}" already exists and is not empty.`);
    err("Pick a different name or remove the directory first.");
    process.exit(1);
  }

  const results = { created: [], skipped: [] };

  // ── Copy template files ────────────────────────────────────────────────────
  copyDir(TEMPLATES_DIR, dest, dest, results);

  // ── Generate package.json ──────────────────────────────────────────────────
  const pkgPath = join(dest, "package.json");
  if (!existsSync(pkgPath)) {
    const pkg = {
      name:    safeName,
      version: "1.0.0",
      type:    "module",
      engines: { node: ">=20.0.0" },
      scripts: {
        start: "node index.js",
        dev:   "node --watch index.js",
      },
      dependencies: {
        "botify-wa": `^${version()}`,
      },
    };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    results.created.push("package.json");
  } else {
    results.skipped.push("package.json");
  }

  // ── Generate .gitignore ────────────────────────────────────────────────────
  const gitignorePath = join(dest, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(
      gitignorePath,
      [
        "node_modules/",
        "session/",       // WA auth credentials — never commit
        ".env",
        "*.log",
        "",
      ].join("\n")
    );
    results.created.push(".gitignore");
  } else {
    results.skipped.push(".gitignore");
  }

  // ── Print results ──────────────────────────────────────────────────────────
  for (const f of results.created) ok(f);
  for (const f of results.skipped) info(`${f} ${dim("(already exists, skipped)")}`);

  console.log(`
${bold("Done!")} Your bot workspace is ready.
${dim("─".repeat(42))}
  Next steps:

    ${dim("$")} ${bold(`cd ${safeName}`)}
    ${dim("$")} ${bold("npm install")}
    ${dim("$")} ${bold("node index.js")}

  Then scan the QR code in your terminal with WhatsApp (Linked Devices).

  ${dim("Add commands:")} drop a new .js file in ${bold("plugins/")}
  ${dim("Configure:")}    edit ${bold("config.bt")}
`);
}

// ── router ────────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case "build":
    runBuild(args[0]);
    break;
  case "version":
  case "-v":
  case "--version":
    console.log(version());
    break;
  case "help":
  case "-h":
  case "--help":
  default:
    showHelp();
}
