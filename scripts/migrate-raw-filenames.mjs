#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const VALID_TYPES = ["articles", "papers", "repos", "notes", "data"];

function kstIsoDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseArgs(argv) {
  const args = { dryRun: true, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wiki") args.wiki = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.wiki) {
    throw new Error("Usage: node scripts/migrate-raw-filenames.mjs --wiki <wiki-root> [--dry-run|--apply]");
  }
  return args;
}

function toIsoDateFromFilename(name) {
  const dashed = name.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  const ymd = name.match(/^(\d{8})_/);
  if (ymd) return `${ymd[1].slice(0, 4)}-${ymd[1].slice(4, 6)}-${ymd[1].slice(6, 8)}`;
  return null;
}

function toYmd(isoDate) {
  return isoDate.replaceAll("-", "");
}

function sanitizeTitle(input) {
  return (
    input
      .normalize("NFC")
      .replace(/[^\p{Script=Hangul}A-Za-z0-9_.\-\s]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/_+/g, "_")
      .replace(/-+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "")
      .slice(0, 80) || "source"
  );
}

function isCanonicalRawFilename(name) {
  return /^\d{8}_(?!\d{2}_).+\.md$/.test(name);
}

function titleFromFilename(name) {
  return name
    .replace(/\.md$/, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/^\d{8}_\d{2}_/, "")
    .replace(/^\d{8}_/, "");
}

function uniqueName(baseName, used) {
  const parsed = path.parse(baseName);
  let candidate = baseName;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${parsed.name}_${String(suffix).padStart(2, "0")}${parsed.ext}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function frontmatterValue(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return match ? match[1].trim() : "";
}

function assertInside(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes wiki root: ${target}`);
  }
}

async function listMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdownFiles(full)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

async function buildMapping(wikiRoot) {
  const mapping = [];
  for (const type of VALID_TYPES) {
    const dir = path.join(wikiRoot, "raw", type);
    const files = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const used = new Set(files.filter((file) => file.isFile()).map((file) => file.name));
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "_index.md") continue;
      if (isCanonicalRawFilename(entry.name)) continue;
      const oldAbs = path.join(dir, entry.name);
      const text = await fs.readFile(oldAbs, "utf8");
      const isoDate = frontmatterValue(text, "ingested") || toIsoDateFromFilename(entry.name);
      if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        throw new Error(`Cannot determine ingested date for ${oldAbs}`);
      }
      const ymd = toYmd(isoDate);
      const title = sanitizeTitle(frontmatterValue(text, "title") || titleFromFilename(entry.name));
      const newName = uniqueName(`${ymd}_${title}.md`, used);
      mapping.push({
        oldRel: path.relative(wikiRoot, oldAbs).replaceAll("\\", "/"),
        newRel: path.relative(wikiRoot, path.join(dir, newName)).replaceAll("\\", "/"),
      });
    }
  }
  return mapping;
}

function rewriteText(text, mapping) {
  let out = text;
  for (const { oldRel, newRel } of mapping) {
    const oldBase = oldRel.split("/").pop();
    const newBase = newRel.split("/").pop();
    out = out.split(oldRel).join(newRel);
    out = out.split(oldRel.replace(/^raw\//, "../../raw/")).join(newRel.replace(/^raw\//, "../../raw/"));
    out = out.split(`](${oldBase})`).join(`](${newBase})`);
    out = out.split(`](<${oldBase}>)`).join(`](<${newBase}>)`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wikiRoot = path.resolve(args.wiki);
  assertInside(path.dirname(wikiRoot), wikiRoot);
  const mapping = await buildMapping(wikiRoot);
  console.log(JSON.stringify({ mode: args.apply ? "apply" : "dry-run", wikiRoot, count: mapping.length, mapping }, null, 2));
  if (!args.apply) return;

  for (const item of mapping) {
    const oldPath = path.join(wikiRoot, item.oldRel);
    const newPath = path.join(wikiRoot, item.newRel);
    assertInside(wikiRoot, oldPath);
    assertInside(wikiRoot, newPath);
    await fs.rename(oldPath, newPath);
  }

  const rewriteRoots = ["raw", "wiki", "output"];
  const files = ["_index.md", "log.md"];
  for (const root of rewriteRoots) files.push(...(await listMarkdownFiles(path.join(wikiRoot, root))));
  for (const file of files.map((file) => (path.isAbsolute(file) ? file : path.join(wikiRoot, file)))) {
    const oldText = await fs.readFile(file, "utf8").catch(() => null);
    if (oldText === null) continue;
    const newText = rewriteText(oldText, mapping);
    if (newText !== oldText) await fs.writeFile(file, newText, "utf8");
  }

  await fs.appendFile(
    path.join(wikiRoot, "log.md"),
    `\n## [${kstIsoDate()}] migrate | Raw filenames normalized to YYYYMMDD (${mapping.length} files)\n`,
    "utf8"
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
