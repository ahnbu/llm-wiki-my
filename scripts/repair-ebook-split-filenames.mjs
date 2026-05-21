#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { deriveSourceFileName } from "./lib/source-file-name.mjs";

const SCAN_DIRS = [
  path.join("raw", "articles"),
  path.join("raw", "notes"),
];
const REWRITE_EXTENSIONS = new Set([".md", ".json", ".canvas"]);

function parseArgs(argv) {
  const args = { dryRun: true, apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--wiki") args.wiki = argv[++index];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.wiki) {
    throw new Error("Usage: node scripts/repair-ebook-split-filenames.mjs --wiki <wiki-root> [--dry-run|--apply]");
  }
  return args;
}

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

function assertInside(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes root: ${target}`);
  }
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { raw: "", values: new Map(), bodyStart: 0 };
  const values = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!item) continue;
    values.set(item[1], item[2].trim().replace(/^"|"$/g, ""));
  }
  return { raw: match[1], values, bodyStart: match[0].length };
}

function tagsInclude(frontmatter, tag) {
  const tags = frontmatter.values.get("tags") || "";
  return new RegExp(`(^|[^A-Za-z0-9_-])${tag}([^A-Za-z0-9_-]|$)`).test(tags);
}

function isEligible(frontmatter) {
  if (frontmatter.values.get("type") === "repos") return false;
  if (tagsInclude(frontmatter, "collection-manifest")) return false;
  return frontmatter.values.get("adapter") === "local-markdown-split" || tagsInclude(frontmatter, "ebook");
}

function splitFilename(filename) {
  const match = filename.match(/^(\d{8})_(.+)_([0-9]+(?:-[0-9]+)?)_(.+)\.md$/u);
  if (!match) return null;
  return {
    date: match[1],
    currentSourceName: match[2],
    partLabel: match[3],
    sectionSlug: match[4],
  };
}

function quoteYaml(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function upsertSourceFileName(markdown, sourceFileName) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return markdown;
  const lines = match[1].split(/\r?\n/);
  const field = `source_file_name: ${quoteYaml(sourceFileName)}`;
  const existingIndex = lines.findIndex((line) => /^source_file_name:/.test(line));
  if (existingIndex >= 0) {
    lines[existingIndex] = field;
  } else {
    const contentFormatIndex = lines.findIndex((line) => /^content_format:/.test(line));
    const sourceIndex = lines.findIndex((line) => /^source:/.test(line));
    const insertAfter = contentFormatIndex >= 0 ? contentFormatIndex : sourceIndex;
    lines.splice(insertAfter + 1, 0, field);
  }
  return `---\n${lines.join("\n")}\n---${markdown.slice(match[0].length)}`;
}

async function listCandidateFiles(wikiRoot) {
  const files = [];
  for (const scanDir of SCAN_DIRS) {
    const dir = path.join(wikiRoot, scanDir);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === "_index.md" || !entry.name.endsWith(".md")) continue;
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

async function planChanges(wikiRoot) {
  const changes = [];
  for (const filePath of await listCandidateFiles(wikiRoot)) {
    const markdown = await fs.readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(markdown);
    if (!isEligible(frontmatter)) continue;
    const source = frontmatter.values.get("source");
    if (!source) continue;
    const parsed = splitFilename(path.basename(filePath));
    if (!parsed) continue;
    const sourceFileName = deriveSourceFileName(source, frontmatter.values.get("source_file_name") || "");
    if (parsed.currentSourceName === sourceFileName) continue;

    const newName = `${parsed.date}_${sourceFileName}_${parsed.partLabel}_${parsed.sectionSlug}.md`;
    const from = path.relative(wikiRoot, filePath).replaceAll("\\", "/");
    const to = path.posix.join(path.posix.dirname(from), newName);
    changes.push({ from, to, source_file_name: sourceFileName });
  }
  return changes.sort((a, b) => a.from.localeCompare(b.from));
}

async function listRewriteFiles(dir) {
  const output = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listRewriteFiles(target)));
    } else if (entry.isFile() && REWRITE_EXTENSIONS.has(path.extname(entry.name))) {
      output.push(target);
    }
  }
  return output;
}

async function rewriteReferences(wikiRoot, changes) {
  const files = await listRewriteFiles(wikiRoot);
  let touched = 0;
  for (const file of files) {
    let text = await fs.readFile(file, "utf8");
    const original = text;
    for (const change of changes) {
      const oldName = path.posix.basename(change.from);
      const newName = path.posix.basename(change.to);
      text = text.split(change.from).join(change.to);
      text = text.split(oldName).join(newName);
    }
    if (text !== original) {
      await fs.writeFile(file, text, "utf8");
      touched += 1;
    }
  }
  return touched;
}

async function applyChanges(wikiRoot, changes) {
  for (const change of changes) {
    const fromPath = path.join(wikiRoot, change.from);
    const toPath = path.join(wikiRoot, change.to);
    assertInside(wikiRoot, fromPath);
    assertInside(wikiRoot, toPath);
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    const targetExists = await fs.access(toPath).then(() => true, () => false);
    if (targetExists) throw new Error(`Target already exists: ${change.to}`);
    await fs.rename(fromPath, toPath);
    const markdown = await fs.readFile(toPath, "utf8");
    await fs.writeFile(toPath, upsertSourceFileName(markdown, change.source_file_name), "utf8");
  }
  const rewrittenFiles = await rewriteReferences(wikiRoot, changes);
  const logLine = `## [${kstIsoDate()}] source_file_name repair | Repaired ${changes.length} ${changes.length === 1 ? "file" : "files"} and rewrote ${rewrittenFiles} reference files\n`;
  await fs.appendFile(path.join(wikiRoot, "log.md"), logLine, "utf8");
  return { rewrittenFiles };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wikiRoot = path.resolve(args.wiki);
  const changes = await planChanges(wikiRoot);
  const result = {
    mode: args.apply ? "apply" : "dry-run",
    count: changes.length,
    changes,
  };
  if (args.apply) {
    Object.assign(result, await applyChanges(wikiRoot, changes));
  }
  console.log(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
