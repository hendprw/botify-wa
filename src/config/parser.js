/**
 * config.bt parser
 * ----------------
 * Parses Botify's TOML-style config file (.bt extension).
 *
 * Supported syntax:
 *   # comment
 *   key = value
 *   key = "string value"
 *   key = true / false
 *   key = 1234
 *   key = ["a", "b", "c"]    (inline arrays)
 *
 *   [section]
 *   key = value
 *
 * Section keys are returned as nested objects:
 *   { section: { key: value } }
 *
 * Top-level keys (before any section header) go into the root object.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ─── value coercions ────────────────────────────────────────────────────────

function coerce(raw) {
  const s = raw.trim();

  // boolean
  if (s === "true") return true;
  if (s === "false") return false;

  // inline array  ["a", 1, true]
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => coerce(item.trim()));
  }

  // quoted string  "hello world"
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }

  // number
  const n = Number(s);
  if (!Number.isNaN(n) && s !== "") return n;

  // bare string (unquoted)
  return s;
}

// ─── parser ─────────────────────────────────────────────────────────────────

/**
 * Parse a .bt config string into a plain object.
 * @param {string} src  Raw file contents.
 * @returns {Record<string, any>}
 */
export function parse(src) {
  const result = {};
  let section = null; // current [section], null = root

  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();

    // blank line or comment
    if (!line || line.startsWith("#")) continue;

    // section header  [name]
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1).trim();
      if (!result[section]) result[section] = {};
      continue;
    }

    // key = value
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue; // malformed line — skip silently

    const key = line.slice(0, eqIdx).trim();
    const value = coerce(line.slice(eqIdx + 1));

    if (section) {
      result[section][key] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ─── loader ─────────────────────────────────────────────────────────────────

/**
 * Load and parse a config.bt file from the given directory.
 * Returns an empty object if the file doesn't exist (config is optional).
 *
 * @param {string} [dir=process.cwd()]  Directory to look in.
 * @returns {Record<string, any>}
 */
export function loadConfig(dir = process.cwd()) {
  const filePath = resolve(dir, "config.bt");
  if (!existsSync(filePath)) return {};

  const src = readFileSync(filePath, "utf8");
  return parse(src);
}
