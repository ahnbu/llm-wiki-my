#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildSplitPartsFromMarkdown, stripFrontmatter } from "./lib/markdown-split-units.mjs";
import { deriveSourceFileName, sanitizeSourceFileName } from "./lib/source-file-name.mjs";

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

function kstYmd() {
  return kstIsoDate().replaceAll("-", "");
}

function parseArgs(argv) {
  const args = { type: "notes", dryRun: true, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wiki") args.wiki = argv[++i];
    else if (arg === "--source") args.source = argv[++i];
    else if (arg === "--title") args.title = argv[++i];
    else if (arg === "--source-file-name") args.sourceFileName = argv[++i];
    else if (arg === "--source-key") args.sourceFileName = argv[++i];
    else if (arg === "--type") args.type = argv[++i];
    else if (arg === "--split-heading") args.level = Number(argv[++i]);
    else if (arg === "--manifest") args.manifest = argv[++i];
    else if (arg === "--date") args.date = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.wiki || !args.source || !args.title || !args.level) {
    throw new Error(
      "Usage: node scripts/split-markdown-source.mjs --wiki <wiki-root> --source <file.md> --title <title> --split-heading <1-6> [--source-file-name <source_file_name>] [--type notes] [--manifest <manifest.json>] [--date YYYYMMDD] [--dry-run|--apply]"
    );
  }
  if (!Number.isInteger(args.level) || args.level < 1 || args.level > 6) {
    throw new Error("--split-heading must be an integer from 1 to 6");
  }
  if (!VALID_TYPES.includes(args.type)) throw new Error(`Invalid type: ${args.type}`);
  args.date ||= kstYmd();
  args.sourceFileName = deriveSourceFileName(args.source, args.sourceFileName);
  if (!/^\d{8}$/.test(args.date)) throw new Error("--date must be YYYYMMDD");
  return args;
}

function assertInside(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes root: ${target}`);
  }
}

function sanitize(input, fallback = "source") {
  return sanitizeSourceFileName(input, fallback);
}

function sanitizeSectionHeading(input) {
  return sanitize(input.replace(/^\d{1,3}\s+/, "").replace(/\b(\d+)\.\s+/g, "$1 "), "section");
}

async function uniqueFilename(rawDir, baseName, reserved = new Set()) {
  const parsed = path.parse(baseName);
  const existing = new Set(
    (await fs.readdir(rawDir, { withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  );
  let candidate = baseName;
  let suffix = 2;
  while (existing.has(candidate) || reserved.has(candidate)) {
    candidate = `${parsed.name}_${String(suffix).padStart(2, "0")}${parsed.ext}`;
    suffix += 1;
  }
  reserved.add(candidate);
  return candidate;
}

function yamlEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function buildFrontmatter({ title, source, type, sourceFileName, part, total, level, indexLabel }) {
  const summary = `${title} 중 '${part.heading}' 원문 조각`;
  const parent = part.parent ? `split_parent_heading: "${yamlEscape(part.parent)}"\n` : "";
  const indexValue = Number.isInteger(Number(indexLabel)) ? Number(indexLabel) : `"${yamlEscape(indexLabel)}"`;
  return `---
title: "${yamlEscape(`${title} - ${indexLabel} ${part.heading}`)}"
source: "${yamlEscape(source)}"
type: ${type}
ingested: ${kstIsoDate()}
tags: [book, chapter]
summary: "${yamlEscape(summary)}"
book_title: "${yamlEscape(title)}"
content_format: markdown
source_file_name: "${yamlEscape(sourceFileName)}"
split_source: "${yamlEscape(source)}"
split_heading_level: ${level}
split_part_index: ${indexValue}
split_part_label: "${yamlEscape(indexLabel)}"
split_part_total: ${total}
split_heading: "${yamlEscape(part.heading)}"
split_unit_kind: ${part.unitKind || "target-heading"}
split_effective_heading_level: ${part.effectiveHeadingLevel || level}
${parent}---

`;
}

function normalizePath(value) {
  return path.resolve(value).replaceAll("\\", "/");
}

async function loadManifestEntry(manifestPath, sourcePath) {
  if (!manifestPath) return null;
  const manifest = JSON.parse(await fs.readFile(path.resolve(manifestPath), "utf8"));
  const normalizedSource = normalizePath(sourcePath);
  return (manifest.sources || []).find((source) => normalizePath(source.sourcePath) === normalizedSource) || null;
}

function applyManifest(parts, manifestEntry, markdown) {
  if (!manifestEntry) return parts;
  const labelMap = new Map((manifestEntry.generatedPartLabels || []).map((entry) => [entry.unitId, entry]));
  const explicitMap = new Map((manifestEntry.explicitExceptionSplits || []).map((entry) => [entry.unitId, entry]));
  const sourceLines = stripFrontmatter(markdown).split(/\r?\n/);
  const output = [];

  for (const part of parts) {
    const explicit = explicitMap.get(part.unitId);
    const labelEntry = labelMap.get(part.unitId);
    if (explicit) {
      for (const child of explicit.parts || []) {
        if (!Number.isInteger(child.startLine) || !Number.isInteger(child.endLine) || child.startLine < 1 || child.endLine < child.startLine) {
          throw new Error(`Invalid explicit boundary for ${part.heading}`);
        }
        const index = output.filter((item) => item.unitId === part.unitId).length;
        output.push({
          ...part,
          heading: child.heading || part.heading,
          unitKind: "exception-child",
          specialIndex: "",
          manifestLabel: child.label || labelEntry?.generatedLabels?.[index] || "",
          lines: sourceLines.slice(child.startLine - 1, child.endLine),
        });
      }
      continue;
    }

    if (labelEntry?.generatedLabels?.length > 1) {
      throw new Error(`Exception split requires explicit boundaries for ${part.heading}`);
    }
    output.push({
      ...part,
      manifestLabel: labelEntry?.generatedLabels?.[0] || "",
    });
  }

  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wikiRoot = path.resolve(args.wiki);
  const sourcePath = path.resolve(args.source);
  const rawDir = path.join(wikiRoot, "raw", args.type);
  assertInside(wikiRoot, rawDir);
  const markdown = await fs.readFile(sourcePath, "utf8");
  const manifestEntry = await loadManifestEntry(args.manifest, sourcePath);
  const parts = applyManifest(buildSplitPartsFromMarkdown(markdown, { level: args.level }), manifestEntry, markdown);
  if (parts.length === 0) throw new Error(`No heading level ${args.level} sections found`);

  const sourceFileName = sanitize(args.sourceFileName);
  let regular = 1;
  const reserved = new Set();
  const sourceForFrontmatter = sourcePath.replaceAll("\\", "/");
  const files = [];
  for (const part of parts) {
    const partLabel = part.manifestLabel || part.specialIndex || String(regular++).padStart(2, "0");
    const baseName = `${args.date}_${sourceFileName}_${partLabel}_${sanitizeSectionHeading(part.heading)}.md`;
    const filename = await uniqueFilename(rawDir, baseName, reserved);
    const relPath = path.posix.join("raw", args.type, filename);
    const body =
      buildFrontmatter({
        title: args.title,
        source: sourceForFrontmatter,
        type: args.type,
        sourceFileName,
        part,
        total: parts.length,
        level: args.level,
        indexLabel: partLabel,
      }) + `${part.lines.join("\n").trim()}\n`;
    files.push({ relPath, body, heading: part.heading, parent: part.parent || null, unitKind: part.unitKind || "target-heading" });
  }

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        count: files.length,
        source_file_name: sourceFileName,
        files: files.map(({ relPath, heading, parent, unitKind }) => ({ relPath, heading, parent, unitKind })),
      },
      null,
      2
    )
  );
  if (!args.apply) return;
  await fs.mkdir(rawDir, { recursive: true });
  for (const file of files) {
    const output = path.join(wikiRoot, file.relPath);
    assertInside(wikiRoot, output);
    await fs.writeFile(output, file.body, "utf8");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
