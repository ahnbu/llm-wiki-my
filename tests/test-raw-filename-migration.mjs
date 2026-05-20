import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const runId = `${Date.now()}-${process.pid}`;
const wiki = path.join(os.tmpdir(), `llm-wiki-raw-migration-${runId}`, ".wiki");

await fs.mkdir(path.join(wiki, "raw", "notes"), { recursive: true });
await fs.mkdir(path.join(wiki, "wiki", "concepts"), { recursive: true });
await fs.mkdir(path.join(wiki, "output"), { recursive: true });

await fs.writeFile(
  path.join(wiki, "raw", "notes", "2026-05-20-old-note.md"),
  `---
title: "기존 노트"
source: "MANUAL"
type: notes
ingested: 2026-05-20
tags: [test]
summary: "기존 파일명 마이그레이션 테스트"
---

# 기존 노트
`,
  "utf8"
);

await fs.writeFile(
  path.join(wiki, "wiki", "concepts", "sample.md"),
  `---
title: Sample
sources:
  - raw/notes/2026-05-20-old-note.md
---

- [기존 노트](../../raw/notes/2026-05-20-old-note.md)
`,
  "utf8"
);

await fs.writeFile(
  path.join(wiki, "raw", "notes", "_index.md"),
  `| Source | Summary | Tags | Ingested |
|---|---|---|---|
| [기존 노트](2026-05-20-old-note.md) | 기존 파일명 마이그레이션 테스트 | test | 2026-05-20 |
`,
  "utf8"
);

await fs.writeFile(path.join(wiki, "raw", "_index.md"), "See [notes/_index.md](notes/_index.md)\n", "utf8");
await fs.writeFile(path.join(wiki, "_index.md"), "# Test Wiki\n", "utf8");
await fs.writeFile(path.join(wiki, "log.md"), "# Log\n", "utf8");

const script = path.join(projectRoot, "scripts", "migrate-raw-filenames.mjs");
const dryRun = execFileSync("node", [script, "--wiki", wiki, "--dry-run"], { encoding: "utf8" });
assert.match(dryRun, /"mode": "dry-run"/);
await fs.access(path.join(wiki, "raw", "notes", "2026-05-20-old-note.md"));

execFileSync("node", [script, "--wiki", wiki, "--apply"], { encoding: "utf8" });
await fs.access(path.join(wiki, "raw", "notes", "20260520_01_기존-노트.md"));
await assert.rejects(fs.access(path.join(wiki, "raw", "notes", "2026-05-20-old-note.md")));

const article = await fs.readFile(path.join(wiki, "wiki", "concepts", "sample.md"), "utf8");
assert.match(article, /raw\/notes\/20260520_01_기존-노트\.md/);
assert.match(article, /\.\.\/\.\.\/raw\/notes\/20260520_01_기존-노트\.md/);

const rawIndex = await fs.readFile(path.join(wiki, "raw", "notes", "_index.md"), "utf8");
assert.match(rawIndex, /20260520_01_기존-노트\.md/);

const log = await fs.readFile(path.join(wiki, "log.md"), "utf8");
assert.match(log, /Raw filenames normalized to YYYYMMDD_NN/);

console.log("PASS: raw filename migration");
