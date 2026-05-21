import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const root = path.join(os.tmpdir(), `llm-wiki-recommend-${Date.now()}-${process.pid}`);
await fs.mkdir(root, { recursive: true });
const sourceA = path.join(root, "book-a.md");
const sourceB = path.join(root, "book-b.md");
const manifest = path.join(root, "nested", "manifest.json");

await fs.writeFile(sourceA, "# A\n\n## 장1\n\n짧은 본문\n\n## 장2\n\n짧은 본문\n", "utf8");
await fs.writeFile(sourceB, "# B\n\n## 부\n\n도입\n\n### 장1\n\n본문\n\n## 부록\n\n부록 본문\n", "utf8");

const script = path.join(projectRoot, "scripts", "recommend-markdown-split.mjs");
const out = execFileSync(
  "node",
  [
    script,
    "--source",
    sourceA,
    "--source",
    sourceB,
    "--levels",
    "2,3",
    "--soft-limit",
    "20000",
    "--hard-limit",
    "30000",
    "--manifest",
    manifest,
  ],
  { encoding: "utf8" }
);

assert.match(out, /book-a\.md/);
assert.match(out, /book-b\.md/);
assert.match(out, /권장 기준/);

const json = JSON.parse(await fs.readFile(manifest, "utf8"));
assert.equal(json.sources.length, 2);
assert.ok(json.sources[0].sourcePath.endsWith("book-a.md"));
assert.ok(json.sources[0].recommendation.defaultLevel >= 2);
assert.ok(Array.isArray(json.sources[1].levels));
assert.ok(json.sources[1].manifestFields.includes("effective split unit stats"));
for (const source of json.sources) {
  for (const key of [
    "sourcePath",
    "sourceKey",
    "analyzedHeadingLevels",
    "rawHeadingStats",
    "effectiveSplitUnitStats",
    "defaultSplitLevel",
    "exceptionSplitTargets",
    "generatedPartLabels",
    "parentHeadingContext",
    "limitFlags",
  ]) {
    assert.ok(key in source, key);
  }
}

console.log("PASS: recommend markdown split");
