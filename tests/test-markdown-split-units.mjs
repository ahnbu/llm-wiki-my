import assert from "node:assert/strict";
import { analyzeMarkdownSplit } from "../scripts/lib/markdown-split-units.mjs";

const markdown = `# 책

## 추천 서문

서문 본문입니다.

## 개관

개관 직하 본문입니다.

### 1장 문제

문제 본문입니다.

### 2장 해결

해결 본문입니다.

## 용어 해설

용어 본문입니다.
`;

const result = analyzeMarkdownSplit(markdown, { levels: [2, 3], softLimit: 20_000, hardLimit: 30_000 });
const h3 = result.levels.find((level) => level.level === 3);

assert.equal(h3.rawHeadingCount, 2);
assert.equal(h3.effectiveUnitCount, 5);
assert.deepEqual(h3.effectiveUnits.map((unit) => unit.heading), [
  "추천 서문",
  "개관 - 도입부",
  "1장 문제",
  "2장 해결",
  "용어 해설",
]);
assert.equal(h3.effectiveUnits[0].unitKind, "ancestor-leaf");
assert.equal(h3.effectiveUnits[1].unitKind, "parent-intro");
assert.equal(h3.effectiveUnits[2].parentHeadings.at(-1), "개관");
assert.ok(h3.effectiveUnits.every((unit) => Number.isInteger(unit.charCount)));
assert.equal(result.manifest.rawHeadingStats.H3.count, 2);
assert.equal(result.manifest.effectiveSplitUnitStats.H3.count, 5);

console.log("PASS: markdown split units");
