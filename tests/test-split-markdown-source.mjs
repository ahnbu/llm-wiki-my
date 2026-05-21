import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const root = path.join(os.tmpdir(), `llm-wiki-split-${Date.now()}-${process.pid}`);
const wiki = path.join(root, ".wiki");
const source = path.join(root, "book.md");

await fs.mkdir(path.join(wiki, "raw", "notes"), { recursive: true });
await fs.writeFile(
  source,
  `---
title: Fixture
---

# Book Title

표지 본문

## 프롤로그

프롤로그 본문

## Chapter 01. 첫 장

### 01 첫 하위 목차

첫 본문

### 02 둘째 하위 목차

둘째 본문

## 에필로그

에필로그 본문
`,
  "utf8"
);

const script = path.join(projectRoot, "scripts", "split-markdown-source.mjs");
const dryRun = execFileSync(
  "node",
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-key", "테스트책", "--split-heading", "3", "--date", "20260520", "--dry-run"],
  { encoding: "utf8" }
);
assert.match(dryRun, /"mode": "dry-run"/);
assert.match(dryRun, /20260520_테스트책_00_프롤로그\.md/);
await assert.rejects(fs.access(path.join(wiki, "raw", "notes", "20260520_테스트책_00_프롤로그.md")));

execFileSync(
  "node",
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-key", "테스트책", "--split-heading", "3", "--date", "20260520", "--apply"],
  { encoding: "utf8" }
);
const files = await fs.readdir(path.join(wiki, "raw", "notes"));
assert.deepEqual(files.sort(), [
  "20260520_테스트책_00_프롤로그.md",
  "20260520_테스트책_01_첫-하위-목차.md",
  "20260520_테스트책_02_둘째-하위-목차.md",
  "20260520_테스트책_99_에필로그.md",
]);

const prologue = await fs.readFile(path.join(wiki, "raw", "notes", "20260520_테스트책_00_프롤로그.md"), "utf8");
assert.match(prologue, /표지 본문/);
assert.match(prologue, /프롤로그 본문/);

const firstSection = await fs.readFile(path.join(wiki, "raw", "notes", "20260520_테스트책_01_첫-하위-목차.md"), "utf8");
assert.match(firstSection, /split_parent_heading: "Chapter 01\. 첫 장"/);
assert.match(firstSection, /book_title: "테스트 책"/);
assert.match(firstSection, /### 01 첫 하위 목차/);
assert.match(firstSection, /첫 본문/);

execFileSync(
  "node",
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-key", "테스트책", "--split-heading", "3", "--date", "20260520", "--apply"],
  { encoding: "utf8" }
);

const filesAfterSecondRun = await fs.readdir(path.join(wiki, "raw", "notes"));
assert.ok(filesAfterSecondRun.includes("20260520_테스트책_00_프롤로그_02.md"));
assert.ok(filesAfterSecondRun.includes("20260520_테스트책_01_첫-하위-목차_02.md"));

console.log("PASS: split markdown source");
