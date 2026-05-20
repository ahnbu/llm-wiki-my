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
    else if (arg === "--source-key") args.sourceKey = argv[++i];
    else if (arg === "--type") args.type = argv[++i];
    else if (arg === "--split-heading") args.level = Number(argv[++i]);
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
      "Usage: node scripts/split-markdown-source.mjs --wiki <wiki-root> --source <file.md> --title <title> --split-heading <1-6> [--source-key <short-key>] [--type notes] [--date YYYYMMDD] [--dry-run|--apply]"
    );
  }
  if (!Number.isInteger(args.level) || args.level < 1 || args.level > 6) {
    throw new Error("--split-heading must be an integer from 1 to 6");
  }
  if (!VALID_TYPES.includes(args.type)) throw new Error(`Invalid type: ${args.type}`);
  args.date ||= kstYmd();
  args.sourceKey ||= path.basename(args.source, path.extname(args.source));
  if (!/^\d{8}$/.test(args.date)) throw new Error("--date must be YYYYMMDD");
  return args;
}

function assertInside(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes root: ${target}`);
  }
}

function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

function sanitize(input, fallback = "source") {
  const value = input
    .normalize("NFC")
    .replace(/[^\p{Script=Hangul}A-Za-z0-9_.\-\s]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return (value || fallback).slice(0, 80);
}

function sanitizeSectionHeading(input) {
  return sanitize(input.replace(/^\d{1,3}\s+/, ""), "section");
}

async function nextSequence(rawDir, ymd) {
  const entries = await fs.readdir(rawDir, { withFileTypes: true }).catch(() => []);
  let max = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(new RegExp(`^${ymd}_(\\d{2})_`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function pushNonEmpty(parts, part) {
  if (part && part.lines.join("\n").trim()) parts.push(part);
}

function splitMarkdown(markdown, level) {
  const lines = stripFrontmatter(markdown).split(/\r?\n/);
  const headingPattern = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`);
  const parentPattern = level > 1 ? new RegExp(`^#{1,${level - 1}}\\s+(.+?)\\s*$`) : null;
  const parts = [];
  const intro = [];
  let parent = "";
  let current = null;
  let special = null;

  for (const line of lines) {
    const headingMatch = line.match(headingPattern);
    const parentMatch = parentPattern ? line.match(parentPattern) : null;
    const lowerLevelHeading = parentMatch && !headingMatch ? parentMatch[1].trim() : "";

    if (headingMatch) {
      pushNonEmpty(parts, special);
      special = null;
      pushNonEmpty(parts, current);
      current = { heading: headingMatch[1].trim(), parent, lines: [line] };
      continue;
    }

    if (lowerLevelHeading) {
      const specialMatch = lowerLevelHeading.match(/^(프롤로그|에필로그)$/i);
      pushNonEmpty(parts, current);
      current = null;
      pushNonEmpty(parts, special);
      special = null;
      if (specialMatch) {
        special = {
          heading: lowerLevelHeading,
          parent: "",
          specialIndex: specialMatch[1] === "프롤로그" ? "00" : "99",
          lines: [line],
        };
      } else {
        parent = lowerLevelHeading;
      }
      continue;
    }

    if (special) special.lines.push(line);
    else if (current) current.lines.push(line);
    else intro.push(line);
  }

  pushNonEmpty(parts, current);
  pushNonEmpty(parts, special);

  const introText = intro.join("\n").trim();
  const prologue = parts.find((part) => part.specialIndex === "00");
  if (introText && prologue) {
    prologue.lines.unshift("## 원문 서문", "", introText, "");
  } else if (introText) {
    parts.unshift({
      heading: "프롤로그",
      parent: "",
      specialIndex: "00",
      lines: ["## 원문 서문", "", introText],
    });
  }

  return parts;
}

function yamlEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function buildFrontmatter({ title, source, type, part, total, level, indexLabel }) {
  const summary = `${title} 중 '${part.heading}' 원문 조각`;
  const parent = part.parent ? `split_parent_heading: "${yamlEscape(part.parent)}"\n` : "";
  return `---
title: "${yamlEscape(`${title} - ${indexLabel} ${part.heading}`)}"
source: "${yamlEscape(source)}"
type: ${type}
ingested: ${kstIsoDate()}
tags: [book, chapter]
summary: "${yamlEscape(summary)}"
book_title: "${yamlEscape(title)}"
content_format: markdown
split_source: "${yamlEscape(source)}"
split_heading_level: ${level}
split_part_index: ${Number(indexLabel)}
split_part_total: ${total}
split_heading: "${yamlEscape(part.heading)}"
${parent}---

`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wikiRoot = path.resolve(args.wiki);
  const sourcePath = path.resolve(args.source);
  const rawDir = path.join(wikiRoot, "raw", args.type);
  assertInside(wikiRoot, rawDir);
  const markdown = await fs.readFile(sourcePath, "utf8");
  const parts = splitMarkdown(markdown, args.level);
  if (parts.length === 0) throw new Error(`No heading level ${args.level} sections found`);

  const sourceKey = sanitize(args.sourceKey);
  let seq = await nextSequence(rawDir, args.date);
  let regular = 1;
  const sourceForFrontmatter = sourcePath.replaceAll("\\", "/");
  const files = parts.map((part) => {
    const partLabel = part.specialIndex || String(regular++).padStart(2, "0");
    const seqLabel = String(seq++).padStart(2, "0");
    const filename = `${args.date}_${seqLabel}_${sourceKey}_${partLabel}_${sanitizeSectionHeading(part.heading)}.md`;
    const relPath = path.posix.join("raw", args.type, filename);
    const body =
      buildFrontmatter({
        title: args.title,
        source: sourceForFrontmatter,
        type: args.type,
        part,
        total: parts.length,
        level: args.level,
        indexLabel: partLabel,
      }) + `${part.lines.join("\n").trim()}\n`;
    return { relPath, body, heading: part.heading, parent: part.parent || null };
  });

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        count: files.length,
        files: files.map(({ relPath, heading, parent }) => ({ relPath, heading, parent })),
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
