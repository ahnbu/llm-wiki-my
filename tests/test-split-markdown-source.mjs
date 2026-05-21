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
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-file-name", "테스트책", "--split-heading", "3", "--date", "20260520", "--dry-run"],
  { encoding: "utf8" }
);
assert.match(dryRun, /"mode": "dry-run"/);
assert.match(dryRun, /20260520_테스트책_00_프롤로그\.md/);
await assert.rejects(fs.access(path.join(wiki, "raw", "notes", "20260520_테스트책_00_프롤로그.md")));

execFileSync(
  "node",
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-file-name", "테스트책", "--split-heading", "3", "--date", "20260520", "--apply"],
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
assert.match(firstSection, /source_file_name: "테스트책"/);
assert.match(firstSection, /### 01 첫 하위 목차/);
assert.match(firstSection, /첫 본문/);

execFileSync(
  "node",
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-file-name", "테스트책", "--split-heading", "3", "--date", "20260520", "--apply"],
  { encoding: "utf8" }
);

const filesAfterSecondRun = await fs.readdir(path.join(wiki, "raw", "notes"));
assert.ok(filesAfterSecondRun.includes("20260520_테스트책_00_프롤로그_02.md"));
assert.ok(filesAfterSecondRun.includes("20260520_테스트책_01_첫-하위-목차_02.md"));

const leafRoot = path.join(os.tmpdir(), `llm-wiki-split-leaf-${Date.now()}-${process.pid}`);
const leafWiki = path.join(leafRoot, ".wiki");
const leafSource = path.join(leafRoot, "leaf-book.md");
await fs.mkdir(path.join(leafWiki, "raw", "notes"), { recursive: true });
await fs.writeFile(
  leafSource,
  `## 추천 서문
서문 본문

## Part 1. 본문
개관 직하 본문

### 01 첫 장
첫 장 본문
`,
  "utf8"
);

execFileSync(
  "node",
  [script, "--wiki", leafWiki, "--source", leafSource, "--title", "테스트 책", "--source-file-name", "테스트책", "--split-heading", "3", "--date", "20260520", "--apply"],
  { encoding: "utf8" }
);

const leafFiles = await fs.readdir(path.join(leafWiki, "raw", "notes"));
assert.deepEqual(leafFiles.sort(), [
  "20260520_테스트책_01_추천-서문.md",
  "20260520_테스트책_02_Part-1-본문-도입부.md",
  "20260520_테스트책_03_첫-장.md",
]);

const leafIntro = await fs.readFile(path.join(leafWiki, "raw", "notes", "20260520_테스트책_02_Part-1-본문-도입부.md"), "utf8");
assert.match(leafIntro, /split_unit_kind: parent-intro/);
assert.match(leafIntro, /개관 직하 본문/);
assert.doesNotMatch(leafIntro, /첫 장 본문/);

const exceptionRoot = path.join(os.tmpdir(), `llm-wiki-split-exception-${Date.now()}-${process.pid}`);
const exceptionWiki = path.join(exceptionRoot, ".wiki");
const exceptionSource = path.join(exceptionRoot, "exception-book.md");
const exceptionManifest = path.join(exceptionRoot, "manifest.json");
await fs.mkdir(path.join(exceptionWiki, "raw", "notes"), { recursive: true });
await fs.writeFile(
  exceptionSource,
  `## Chapter 13. 큰 장

첫 번째 예외 본문

두 번째 예외 본문
`,
  "utf8"
);
await fs.writeFile(
  exceptionManifest,
  JSON.stringify(
    {
      sources: [
        {
          sourcePath: exceptionSource.replaceAll("\\", "/"),
          generatedPartLabels: [
            {
              unitId: "h1",
              heading: "Chapter 13. 큰 장",
              defaultLabel: "13",
              generatedLabels: ["13-1", "13-2"],
            },
          ],
          explicitExceptionSplits: [
            {
              unitId: "h1",
              parts: [
                { heading: "큰 장 첫 번째", startLine: 1, endLine: 3 },
                { heading: "큰 장 두 번째", startLine: 5, endLine: 5 },
              ],
            },
          ],
        },
      ],
    },
    null,
    2
  ),
  "utf8"
);

execFileSync(
  "node",
  [
    script,
    "--wiki",
    exceptionWiki,
    "--source",
    exceptionSource,
    "--title",
    "테스트 책",
    "--source-file-name",
    "테스트책",
    "--split-heading",
    "2",
    "--manifest",
    exceptionManifest,
    "--date",
    "20260520",
    "--apply",
  ],
  { encoding: "utf8" }
);

const exceptionFiles = await fs.readdir(path.join(exceptionWiki, "raw", "notes"));
assert.deepEqual(exceptionFiles.sort(), [
  "20260520_테스트책_13-1_큰-장-첫-번째.md",
  "20260520_테스트책_13-2_큰-장-두-번째.md",
]);

const exceptionFirst = await fs.readFile(path.join(exceptionWiki, "raw", "notes", "20260520_테스트책_13-1_큰-장-첫-번째.md"), "utf8");
assert.match(exceptionFirst, /split_part_label: "13-1"/);
assert.match(exceptionFirst, /split_unit_kind: exception-child/);

console.log("PASS: split markdown source");
