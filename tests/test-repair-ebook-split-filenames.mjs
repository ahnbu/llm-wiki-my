import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const root = path.join(os.tmpdir(), `llm-wiki-repair-${Date.now()}-${process.pid}`);
const wiki = path.join(root, ".wiki");
const oldName = "20260520_product-dev-2024_01_intro.md";
const newName = "20260520_프로덕트개발_2024_01_intro.md";
const oldRel = `raw/notes/${oldName}`;
const newRel = `raw/notes/${newName}`;

await fs.mkdir(path.join(wiki, "raw", "notes"), { recursive: true });
await fs.mkdir(path.join(wiki, "raw", "articles"), { recursive: true });
await fs.mkdir(path.join(wiki, "raw", "repos"), { recursive: true });
await fs.mkdir(path.join(wiki, "wiki", "concepts"), { recursive: true });
await fs.writeFile(
  path.join(wiki, oldRel),
  `---
title: "프로덕트 개발 - 01 intro"
source: "C:/Users/ahnbu/cowork/06_연구/= e북 제작/프로덕트개발_2024_정리본.md"
type: notes
ingested: 2026-05-20
tags: [book, ebook, chapter]
summary: "테스트"
adapter: local-markdown-split
split_part_label: "01"
---

# Intro
`,
  "utf8"
);
await fs.writeFile(path.join(wiki, "raw", "notes", "_index.md"), `# Notes\n\n- [old](${oldName})\n`, "utf8");
await fs.writeFile(path.join(wiki, "wiki", "concepts", "article.md"), `---\nsources:\n  - ${oldRel}\n---\n\n[raw]../../${oldRel}\n`, "utf8");
await fs.writeFile(
  path.join(wiki, "raw", "repos", "20260520_product-dev-2024.md"),
  `---\ntitle: "Manifest"\nsource: "MANUAL"\ntype: repos\ntags: [collection-manifest]\ncollection: "product-dev-2024"\n---\n`,
  "utf8"
);

const script = path.join(projectRoot, "scripts", "repair-ebook-split-filenames.mjs");
const dryRun = execFileSync("node", [script, "--wiki", wiki, "--dry-run"], { encoding: "utf8" });
const dryRunJson = JSON.parse(dryRun);
assert.equal(dryRunJson.mode, "dry-run");
assert.equal(dryRunJson.count, 1);
assert.equal(dryRunJson.changes[0].from, oldRel);
assert.equal(dryRunJson.changes[0].to, newRel);
await fs.access(path.join(wiki, oldRel));

const apply = execFileSync("node", [script, "--wiki", wiki, "--apply"], { encoding: "utf8" });
const applyJson = JSON.parse(apply);
assert.equal(applyJson.mode, "apply");
assert.equal(applyJson.count, 1);
await assert.rejects(fs.access(path.join(wiki, oldRel)));
await fs.access(path.join(wiki, newRel));

const repaired = await fs.readFile(path.join(wiki, newRel), "utf8");
assert.match(repaired, /source_file_name: "프로덕트개발_2024"/);
assert.match(repaired, /adapter: local-markdown-split/);

const index = await fs.readFile(path.join(wiki, "raw", "notes", "_index.md"), "utf8");
assert.doesNotMatch(index, new RegExp(oldName));
assert.match(index, new RegExp(newName));

const article = await fs.readFile(path.join(wiki, "wiki", "concepts", "article.md"), "utf8");
assert.doesNotMatch(article, new RegExp(oldRel));
assert.match(article, new RegExp(newRel));

const log = await fs.readFile(path.join(wiki, "log.md"), "utf8");
assert.match(log, /source_file_name repair/);
assert.match(log, /1 file/);

const reposFiles = await fs.readdir(path.join(wiki, "raw", "repos"));
assert.deepEqual(reposFiles, ["20260520_product-dev-2024.md"]);

console.log("PASS: repair ebook split filenames");
