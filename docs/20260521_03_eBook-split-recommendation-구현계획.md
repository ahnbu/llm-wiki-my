---
title: eBook split recommendation 및 leaf-preserving split 구현계획
created: 2026-05-21 11:55
tags:
  - llm-wiki
  - implementation-plan
  - ebook-split
session_id: codex:019e482e-1b1f-7b01-b187-ff0bdb2d07fa
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/21/rollout-2026-05-21T10-37-21-019e482e-1b1f-7b01-b187-ff0bdb2d07fa.jsonl
spec: docs/specs/20260521_01_eBook-split-및-LLM-Wiki-ingest-기준.md
ai: codex
---

# eBook split recommendation 및 leaf-preserving split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `llm-wiki-my`가 eBook Markdown을 직접 분석해 level별 글자수 통계, effective split unit, split recommendation, manifest를 생성하고, `split-markdown-source.mjs`가 같은 기준으로 leaf-preserving split을 수행하게 한다.

**Architecture:** split 판단과 split 실행이 같은 effective unit 계산기를 공유한다. 새 공용 모듈은 Markdown heading tree를 파싱하고, 추천 스크립트와 raw split 스크립트가 이를 함께 사용한다. `ebook-md-maker`는 이번 범위에서 수정하지 않는다.

**Tech Stack:** Node.js `.mjs`, Markdown parsing by deterministic line scanner, existing `scripts/split-markdown-source.mjs`, fixture-style Node tests, Bash plugin validation, Codex/OpenCode sync scripts.

---

## 범위

| 구분 | 포함 여부 | 기준 |
|---|---|---|
| `llm-wiki-my` split 통계·추천 | ✅ 포함 | SPEC R1~R7, R11 |
| `split-markdown-source.mjs` leaf-preserving 개선 | ✅ 포함 | SPEC R5, R6, R10 |
| split manifest 최소 필드 | ✅ 포함 | SPEC D7 |
| 5개 eBook 실제 ingest | ❌ 제외 | 이번 계획은 분석·추천·split 도구 구현까지 |
| `ebook-md-maker` 수정 | ❌ 제외 | 별도 세션 `019e4861-45b0-7613-bdac-476122bb3b0b` |

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `D:/vibe-coding/llm-wiki-my/scripts/lib/markdown-split-units.mjs` | 생성 | heading tree, char stats, effective unit, recommendation 계산 |
| `D:/vibe-coding/llm-wiki-my/scripts/recommend-markdown-split.mjs` | 생성 | 파일 1개 이상을 분석해 JSON/Markdown report와 manifest 출력 |
| `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs` | 수정 | 공용 effective unit 계산기를 사용해 leaf-preserving split 수행 |
| `D:/vibe-coding/llm-wiki-my/tests/test-markdown-split-units.mjs` | 생성 | H3 없는 H2 leaf, parent intro, 평균/초과 통계 검증 |
| `D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs` | 생성 | recommendation CLI, manifest 최소 필드, multi-source report 검증 |
| `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs` | 수정 | split 실행이 leaf-preserving unit을 누락하지 않음을 검증 |
| `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh` | 수정 | 새 recommendation workflow가 문서화됐는지 검증 |
| `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md` | 수정 | ingest 전 recommendation dry-run 절차 추가 |
| `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md` | 수정 | split 기준 표준 workflow와 manifest 필드 설명 추가 |
| `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/` | 생성물 갱신 | Codex mirror |
| `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/` | 생성물 갱신 | OpenCode mirror |

## 결정된 구현 정책

| 정책 | 값 | 이유 |
|---|---|---|
| 기본 후보 level | H2부터 평가 | 책 목차의 기본 장 단위에 가장 가까움 |
| soft limit | 20K chars | SPEC 확정값 |
| hard warning | 30K chars | SPEC 확정값 |
| 하위 level 전환 | 평균이 20K 초과일 때 검토 | level 혼합 최소화 |
| 예외 분할 | hard warning chunk가 1~2개일 때만 우선 권장 | 전체 heading level 하향을 피함 |
| H3 없는 H2 | effective unit으로 포함 | `아이디어불패` 구조 누락 방지 |
| parent direct body | 별도 intro unit으로 보존 | `개관` 같은 직하 본문 누락 방지 |
| split filename | `YYYYMMDD_sourcekey_part_제목.md` | NN 제거 정책 반영 |
| exception split 실행 | manifest 기반 explicit split만 허용 | 무표시 소제목 자동 추정은 오탐 위험이 커서 자동 분할하지 않음 |
| exception part label | `13-1`, `13-2`처럼 부모 part 보존 | SPEC의 예외 분할 제목 규칙 반영 |

## Task 1: 기준 상태 확인

**Files:**
- Read: `D:/vibe-coding/llm-wiki-my/docs/specs/20260521_01_eBook-split-및-LLM-Wiki-ingest-기준.md`
- Read: `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
- Read: `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`
- Read: `D:/vibe-coding/llm-wiki-my/CLAUDE.md`

- [ ] **Step 1: 레포 루트와 변경 상태가 확인된다**

Run:

```powershell
git -C D:/vibe-coding/llm-wiki-my rev-parse --show-toplevel
git -C D:/vibe-coding/llm-wiki-my status --short
```

Expected:

```markdown
D:/vibe-coding/llm-wiki-my
```

`status --short`에는 이 SPEC/plan 문서 변경이 보일 수 있다. 구현 시 명시된 파일 외 변경은 섞지 않는다.

- [ ] **Step 2: 현재 split 한계가 재현된다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
```

Expected:

```markdown
PASS: split markdown source
```

현재 테스트는 통과하지만, H3 없는 H2 leaf를 검증하지 않는다. 이 공백을 Task 2에서 실패 테스트로 추가한다.

## Task 2: effective unit 실패 테스트 추가

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/tests/test-markdown-split-units.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`

- [ ] **Step 1: 공용 모듈 테스트가 먼저 실패한다**

Create `tests/test-markdown-split-units.mjs` with these cases:

```javascript
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

console.log("PASS: markdown split units");
```

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-markdown-split-units.mjs
```

Expected:

```markdown
Cannot find module '../scripts/lib/markdown-split-units.mjs'
```

- [ ] **Step 2: 기존 split script 테스트에 leaf-preserving fixture가 추가된다**

Add a second fixture in `tests/test-split-markdown-source.mjs` that runs `--split-heading 3` against a Markdown containing:

```markdown
## 추천 서문
서문 본문

## Part 1. 본문
개관 직하 본문

### 01 첫 장
첫 장 본문
```

Expected after implementation:

```markdown
20260520_테스트책_01_추천-서문.md
20260520_테스트책_02_Part-1-본문-도입부.md
20260520_테스트책_03_첫-장.md
```

Before implementation, this test must fail because `추천 서문` is not emitted as an H3 split part.

## Task 3: 공용 split unit 계산기 구현

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/scripts/lib/markdown-split-units.mjs`

- [ ] **Step 1: public API가 구현된다**

Create the module with these exported functions and return contracts:

| Export | Input | Output contract |
|---|---|---|
| `stripFrontmatter` | `markdown: string` | `string` without leading YAML frontmatter |
| `parseHeadingBlocks` | `markdown: string` | `{ level, heading, headingLine, parentHeadings, directBodyLines, subtreeLines, startLine, endLine }[]` |
| `buildEffectiveUnits` | `blocks, targetLevel` | `{ heading, level, unitKind, parentHeadings, lines, charCount }[]` |
| `summarizeUnits` | `units, { softLimit, hardLimit }` | `{ count, averageCharCount, maxCharCount, overSoftCount, overHardCount, overHardUnits }` |
| `recommendSplitLevel` | `levelSummaries, { softLimit, hardLimit }` | `{ defaultLevel, reason, exceptionSplitTargets }` |
| `analyzeMarkdownSplit` | `markdown, options` | `{ levels, recommendation, manifest }` |
| `generatePartLabels` | `effectiveUnits, exceptionSplitTargets` | `{ unitId, defaultLabel, generatedLabels, heading }[]` |
| `buildSplitPartsFromMarkdown` | `markdown, { level }` | current split writer-compatible parts array |

Completion criteria:

- `stripFrontmatter()` removes only leading YAML frontmatter.
- `parseHeadingBlocks()` preserves heading level, heading text, original heading line, parent heading chain, direct body lines, subtree lines.
- `buildEffectiveUnits(blocks, 3)` returns:
  - all H3 sections
  - H2 sections with no H3 descendants as `unitKind: "ancestor-leaf"`
  - direct body under an H2 that has H3 descendants as `unitKind: "parent-intro"` with heading `${parent} - 도입부`
- `summarizeUnits()` returns count, average, max, overSoftCount, overHardCount.
- `recommendSplitLevel()` applies SPEC D1:
  - average <= soft limit: default level candidate
  - average > soft limit: lower level candidate
  - 1~2 hard-warning units: exception targets
- `generatePartLabels()` keeps special labels `00` and `99`, assigns normal labels as `01`, `02`, and assigns exception child labels as `${parentLabel}-1`, `${parentLabel}-2` only when explicit exception child boundaries are provided.
- `analyzeMarkdownSplit()` returns `levels`, `recommendation`, and `manifest`.

- [ ] **Step 2: unit test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-markdown-split-units.mjs
```

Expected:

```markdown
PASS: markdown split units
```

## Task 4: recommendation CLI 구현

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/scripts/recommend-markdown-split.mjs`
- Create: `D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs`

- [ ] **Step 1: CLI 실패 테스트가 작성된다**

Create `tests/test-recommend-markdown-split.mjs` with a temp directory and two Markdown sources:

```javascript
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
const manifest = path.join(root, "manifest.json");

await fs.writeFile(sourceA, "# A\n\n## 장1\n\n짧은 본문\n\n## 장2\n\n짧은 본문\n", "utf8");
await fs.writeFile(sourceB, "# B\n\n## 부\n\n도입\n\n### 장1\n\n본문\n\n## 부록\n\n부록 본문\n", "utf8");

const script = path.join(projectRoot, "scripts", "recommend-markdown-split.mjs");
const out = execFileSync("node", [
  script,
  "--source", sourceA,
  "--source", sourceB,
  "--levels", "2,3",
  "--soft-limit", "20000",
  "--hard-limit", "30000",
  "--manifest", manifest,
], { encoding: "utf8" });

assert.match(out, /book-a\.md/);
assert.match(out, /book-b\.md/);
assert.match(out, /권장 기준/);

const json = JSON.parse(await fs.readFile(manifest, "utf8"));
assert.equal(json.sources.length, 2);
assert.ok(json.sources[0].sourcePath.endsWith("book-a.md"));
assert.ok(json.sources[0].recommendation.defaultLevel >= 2);
assert.ok(Array.isArray(json.sources[1].levels));
assert.ok(json.sources[1].manifestFields.includes("effective split unit stats"));

console.log("PASS: recommend markdown split");
```

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs
```

Expected: `Cannot find module` or `ENOENT` for the new CLI.

- [ ] **Step 2: CLI가 구현된다**

`scripts/recommend-markdown-split.mjs` behavior:

```markdown
Usage:
node scripts/recommend-markdown-split.mjs --source <file.md> [--source <file2.md>] [--levels 2,3] [--soft-limit 20000] [--hard-limit 30000] [--manifest <manifest.json>]
```

Output requirements:

- stdout prints a compact Markdown table:
  - file
  - H2 raw count / effective count / avg / max / over 20K / over 30K
  - H3 raw count / effective count / avg / max / over 20K / over 30K
  - 권장 기준
- `--manifest` writes JSON with at least:
  - `sourcePath`
  - `sourceKey`
  - `analyzedHeadingLevels`
  - `rawHeadingStats`
  - `effectiveSplitUnitStats`
  - `defaultSplitLevel`
  - `exceptionSplitTargets`
  - `generatedPartLabels`
  - `parentHeadingContext`
  - `limitFlags`
- The CLI creates the manifest parent directory when it does not exist.
- `generatedPartLabels` contains default labels for all effective units and exception child labels only for explicit exception boundaries. It must not invent child splits from unmarked prose.

- [ ] **Step 3: recommendation CLI test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs
```

Expected:

```markdown
PASS: recommend markdown split
```

## Task 5: split-markdown-source가 공용 계산기를 재사용한다

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`

- [ ] **Step 1: script 내부 split 로직이 제거된다**

Replace local `stripFrontmatter()`, `pushNonEmpty()`, and `splitMarkdown()` with imports:

```javascript
import { buildSplitPartsFromMarkdown } from "./lib/markdown-split-units.mjs";
```

The imported helper must return parts compatible with current writer:

```javascript
{
  heading: "추천 서문",
  parent: "",
  parentHeadings: [],
  unitKind: "ancestor-leaf",
  partLabel: "01",
  lines: ["## 추천 서문", "", "서문 본문"]
}
```

- [ ] **Step 2: frontmatter가 effective unit metadata를 보존한다**

Add fields:

```yaml
split_unit_kind: ancestor-leaf|parent-intro|target-heading|special
split_effective_heading_level: 2|3
```

Keep existing fields:

```yaml
split_heading_level
split_part_index
split_part_total
split_heading
split_parent_heading
```

- [ ] **Step 3: explicit manifest labels가 split 실행에 반영된다**

Add optional argument:

```markdown
--manifest <manifest.json>
```

Behavior:

- Without `--manifest`, current deterministic label behavior remains.
- With `--manifest`, find the source entry by normalized `sourcePath`.
- Use manifest `generatedPartLabels` for the matching source and selected split level.
- If a manifest asks for exception child labels but does not provide explicit child boundaries, fail before writing with:

```markdown
Exception split requires explicit boundaries for <unit heading>
```

Completion criteria:

- `13-1`, `13-2` labels are supported when explicit exception child parts are provided in the manifest.
- The script never guesses invisible subheadings automatically.
- Existing `00` prologue and `99` epilogue behavior remains unchanged.

- [ ] **Step 4: split source test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
```

Expected:

```markdown
PASS: split markdown source
```

## Task 6: command/reference 문서 업데이트

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`

- [ ] **Step 1: ingest command에 recommendation dry-run이 추가된다**

Add before split apply guidance:

```markdown
Before applying a split for long Markdown/eBook sources, run:

`node scripts/recommend-markdown-split.mjs --source <file.md> --levels 2,3 --soft-limit 20000 --hard-limit 30000 --manifest <manifest.json>`

Use the recommendation report to pick the default `--split-heading` level. If only 1-2 chunks exceed the hard warning threshold, keep the default level and split those chunks as exceptions rather than lowering the whole book level.
```

- [ ] **Step 2: ingestion reference에 effective unit 정책이 추가된다**

Document:

```markdown
When splitting at H3, H2 sections with no H3 descendants are effective split units. Parent headings with direct body before child headings create a parent-intro unit so no source text is lost. The same effective unit calculation must be used by recommendation and split generation.
```

- [ ] **Step 3: plugin validation에 새 workflow 검증이 추가된다**

Add assertions:

```bash
assert_contains "$PLUGIN_DIR/commands/ingest.md" "recommend-markdown-split\\.mjs" "ingest command recommends split analysis before apply"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "effective split unit|parent-intro|ancestor-leaf" "ingestion reference documents leaf-preserving effective units"
```

- [ ] **Step 4: plugin validation이 통과한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected:

```markdown
0 failed
```

## Task 7: 5개 eBook 샘플 검증 리허설

**Files:**
- No source edits expected
- Read external source Markdown files listed in SPEC D3

- [ ] **Step 1: manifest 출력 폴더가 준비된다**

Run:

```powershell
New-Item -ItemType Directory -Force -Path "D:/vibe-coding/llm-wiki-my/.tmp"
```

Expected: `.tmp` directory exists. This directory is scratch output and must not be treated as source data.

- [ ] **Step 2: 5개 파일 recommendation dry-run이 실행된다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/scripts/recommend-markdown-split.mjs `
  --source "C:/Users/ahnbu/cowork/06_연구/= e북 제작/프로덕트개발_2024_정리본.md" `
  --source "C:/Users/ahnbu/cowork/06_연구/= e북 제작/프로덕트매니저_2025_정리본.md" `
  --source "C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/아이디어불패_2020f_정리본.md" `
  --source "C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/프롬프트텔링_2025f_정리본.md" `
  --source "C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/도그냥PO_20251125_정리본.md" `
  --levels 2,3 `
  --soft-limit 20000 `
  --hard-limit 30000 `
  --manifest "D:/vibe-coding/llm-wiki-my/.tmp/ebook-split-manifest.json"
```

Expected:

```markdown
프로덕트개발_2024: H2
프로덕트매니저_2025: H2 + exception
아이디어불패_2020f: effective H3 + exception
프롬프트텔링_2025f: H3
도그냥PO_20251125: H3
```

숫자는 원문 변경에 따라 소폭 달라질 수 있지만, 권장 기준이 SPEC D3와 다르면 원인을 보고한다. 특히 exception target이 나온 경우 실제 raw split은 manifest에 explicit child boundaries가 있을 때만 실행한다.

- [ ] **Step 3: manifest 최소 필드가 확인된다**

Run:

```powershell
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('D:/vibe-coding/llm-wiki-my/.tmp/ebook-split-manifest.json','utf8')); const required=['sourcePath','sourceKey','analyzedHeadingLevels','rawHeadingStats','effectiveSplitUnitStats','defaultSplitLevel','exceptionSplitTargets','generatedPartLabels','parentHeadingContext','limitFlags']; for (const s of m.sources) for (const k of required) if (!(k in s)) throw new Error(k); console.log('PASS: manifest fields')"
```

Expected:

```markdown
PASS: manifest fields
```

## Task 8: mirror sync 및 전체 검증

**Files:**
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

- [ ] **Step 1: mirror가 재생성된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh
bash D:/vibe-coding/llm-wiki-my/scripts/sync-opencode-plugin.sh
```

Expected: both commands exit with code 0.

- [ ] **Step 2: 전체 테스트가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-markdown-split-units.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-structure.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh
```

Expected:

```markdown
PASS: markdown split units
PASS: recommend markdown split
PASS: split markdown source
PASS: raw filename migration
0 failed
```

- [ ] **Step 3: sync gate가 확인된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-codex-sync.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-opencode-sync.sh
```

Expected:

```markdown
OK: Codex plugin mirror is in sync.
OK: OpenCode plugin mirror is in sync.
```

If Codex sync fails only because generated mirror files differ from `HEAD`, record it as a pre-commit gate and include mirror changes in the same commit.

## Task 9: 커밋 준비

**Files:**
- Changed files from Tasks 2-8

- [ ] **Step 1: 보안 점검은 커밋 흐름 안에서 실행된다**

Do not run `git add` or `git commit` directly. When the user requests a commit, use the `cp` skill. After files are staged by that flow and before commit finalization, run:

```powershell
node C:/Users/ahnbu/.claude/skills/_shared/security-gate.mjs precommit --repo D:/vibe-coding/llm-wiki-my --staged
```

Expected: no secret, credential, suspicious install script, or external transfer risk is reported.

- [ ] **Step 2: 권장 커밋 메시지가 준비된다**

Recommended commit message:

```markdown
feat(split): eBook split recommendation과 leaf 보존 분할 추가 — 긴 Markdown ingest 안정화
```

Expected: recommendation CLI, shared split unit module, split script update, tests, docs, generated mirror가 하나의 관심사로 묶인다.

## Self-Review

| SPEC 요구 | 계획 반영 | 판정 |
|---|---|---|
| R1 보고서만 보고 기준 이해 | Task 4 Markdown table | ✅ |
| R2 글자수 기준 | Task 3 `charCount`, `softLimit`, `hardLimit` | ✅ |
| R3 평균 기준 default level | Task 3 `recommendSplitLevel()` | ✅ |
| R4 1~2개 대형 chunk 예외 | Task 3 exception targets | ✅ |
| R5 H3 없는 H2 포함 | Task 2, Task 3 `ancestor-leaf` | ✅ |
| R6 parent heading 보존 | Task 3, Task 5 `parentHeadings`, `split_parent_heading` | ✅ |
| R7 level별 통계 표 | Task 4 stdout report | ✅ |
| R8 split filename | 기존 script 유지 + Task 5 검증 | ✅ |
| R9 ebook-md-maker 제외 | 범위 표에 제외 명시 | ✅ |
| R10 split script 검증 | Task 5 tests | ✅ |
| R11 llm-wiki-my 구현 | 전체 Files가 `llm-wiki-my` 내부 | ✅ |

## 완료 판정

이 계획은 다음이 모두 충족되면 완료다.

- 새 recommendation CLI가 1개 이상 source를 분석해 Markdown report와 JSON manifest를 생성한다.
- `split-markdown-source.mjs --split-heading 3`이 H3 없는 H2 leaf와 parent intro를 누락하지 않는다.
- exception target은 manifest에 기록되고, explicit child boundaries 없이 자동 분할하지 않는다.
- explicit exception child boundaries가 있을 때 `13-1`, `13-2` 형태 label을 생성할 수 있다.
- 5개 eBook dry-run 결과가 SPEC D3 권장 기준과 일치하거나, 차이 원인이 보고된다.
- Node tests, plugin validation, structure/local lint, mirror sync가 통과하거나 pre-commit gate 사유가 명확히 기록된다.

## Plan-Check-Lite 반영 결과

작성 시점: 2026-05-21 KST

| 점검 항목 | 판정 | 반영 내용 |
|---|---|---|
| exception split 실행 조건 | ❌ 수정 필요 | manifest 기반 explicit boundary가 있을 때만 `13-1`, `13-2` label split을 허용한다고 명시 |
| manifest 출력 경로 | ❌ 수정 필요 | `.tmp` 생성 단계를 Task 7에 추가 |
| 완료 기준 | ⚠️ 보강 필요 | exception target 기록과 explicit boundary split 가능성을 완료 판정에 추가 |
| 범위 통제 | ✅ 통과 | 무표시 소제목 자동 추정은 이번 구현에서 금지해 오탐성 기능 확장을 막음 |

## 수행 결과

작성 시점: 2026-05-21 11:53 KST

### 구현 완료

- `scripts/lib/markdown-split-units.mjs`를 추가해 heading tree, raw/effective unit, 글자수 통계, recommendation, part label 계산을 공용화했다.
- `scripts/recommend-markdown-split.mjs`를 추가해 여러 Markdown source의 split 권장 기준을 Markdown 표와 JSON manifest로 생성하도록 했다.
- `scripts/split-markdown-source.mjs`가 공용 effective unit 계산기를 재사용하도록 변경했다.
- `H3` 기준 split에서 `H3` 없는 `H2` leaf와 parent intro가 누락되지 않도록 했다.
- explicit exception boundary가 제공된 경우 `13-1`, `13-2` 형태의 part label split을 생성하도록 했다.
- split raw frontmatter에 `split_part_label`, `split_unit_kind`, `split_effective_heading_level`을 추가했다.
- ingest command/reference 문서에 recommendation dry-run, effective split unit, exception split boundary 정책을 반영했다.
- Codex/OpenCode mirror sync를 실행했다.

### 5개 eBook dry-run 결과

| 책 | H2 raw/effective | H2 평균 | H2 최대 | H2 >20K/>30K | H3 raw/effective | H3 평균 | H3 최대 | H3 >20K/>30K | 권장 기준 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 프로덕트개발_2024 | 17/18 | 9.5K | 21K | 1/0 | 92/108 | 1.5K | 4.2K | 0/0 | H2 |
| 프로덕트매니저_2025 | 14/14 | 16K | 45K | 4/1 | 67/69 | 3.2K | 12K | 0/0 | H2 + exception |
| 아이디어불패_2020f | 10/11 | 20K | 94K | 3/3 | 11/21 | 10K | 59K | 3/1 | H3 + exception |
| 프롬프트텔링_2025f | 4/5 | 30K | 62K | 4/2 | 14/18 | 8.3K | 19K | 0/0 | H3 |
| 도그냥PO_20251125 | 6/7 | 23K | 81K | 2/2 | 24/30 | 5.2K | 9K | 0/0 | H3 |

판정: 권장 기준은 SPEC D3와 일치한다. `아이디어불패_2020f`는 구현 표기상 `H3 + exception`이며, 의미는 SPEC의 `effective H3 + 5장 예외`와 같다.

### 검증 결과

| 검증 | 결과 | 판정 |
|---|---:|---|
| `node tests/test-markdown-split-units.mjs` | `PASS: markdown split units` | ✅ 통과 |
| `node tests/test-recommend-markdown-split.mjs` | `PASS: recommend markdown split` | ✅ 통과 |
| `node tests/test-split-markdown-source.mjs` | `PASS: split markdown source` | ✅ 통과 |
| `node tests/test-raw-filename-migration.mjs` | `PASS: raw filename migration` | ✅ 통과 |
| `bash tests/test-plugin-validate.sh` | `109 passed, 0 failed` | ✅ 통과 |
| `bash tests/test-structure.sh` | `170 passed, 0 failed` | ✅ 통과 |
| `bash tests/test-local-cli-lint.sh` | `21 passed, 0 failed` | ✅ 통과 |
| `node -e manifest field check` | `PASS: manifest fields` | ✅ 통과 |
| `bash scripts/sync-codex-plugin.sh` | Codex mirror regenerated | ✅ 완료 |
| `bash scripts/sync-opencode-plugin.sh` | OpenCode mirror regenerated | ✅ 완료 |
| `bash tests/test-opencode-sync.sh` | `OK: OpenCode plugin mirror is in sync.` | ✅ 통과 |
| `bash tests/test-codex-sync.sh` | generated mirror diff remains before commit | ⚠️ 커밋 전 gate |

`test-codex-sync.sh` 실패는 `plugins/llm-wiki/`가 재생성되어 `HEAD` 대비 diff가 남아 있기 때문이다. 같은 커밋에 Codex mirror 변경을 포함한 뒤 재실행해야 통과한다.

### 변경 파일

| 구분 | 파일 |
|---|---|
| 신규 script | `scripts/lib/markdown-split-units.mjs`, `scripts/recommend-markdown-split.mjs` |
| 수정 script | `scripts/split-markdown-source.mjs` |
| 신규 test | `tests/test-markdown-split-units.mjs`, `tests/test-recommend-markdown-split.mjs` |
| 수정 test | `tests/test-split-markdown-source.mjs`, `tests/test-plugin-validate.sh` |
| 수정 docs/protocol | `claude-plugin/commands/ingest.md`, `claude-plugin/skills/wiki-manager/references/ingestion.md` |
| generated mirror | `plugins/llm-wiki/skills/wiki/references/ingestion.md` |
| 계획/스펙 문서 | `docs/20260521_03_eBook-split-recommendation-구현계획.md`, `docs/specs/20260521_01_eBook-split-및-LLM-Wiki-ingest-기준.md` |

### 잔여 사항

- 실제 5개 eBook ingest는 수행하지 않았다. 이번 범위는 split recommendation과 raw split 도구 구현까지다.
- `ebook-md-maker`는 수정하지 않았다.
- 커밋은 수행하지 않았다. 커밋 시 `cp` 스킬을 사용하고 Codex mirror diff를 같은 커밋에 포함해야 한다.

## Done-Check-Lite 반영 결과

작성 시점: 2026-05-21 KST

### 최종 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 전체 상태 | ✅ 완료 | 원래 범위인 `llm-wiki-my` split 통계·추천·manifest·leaf-preserving split 구현과 검증이 완료됐다. |

### 요구사항 대조표

| 원래 요구사항 | 상태 | 구현 근거 | 검증 근거 | 비고 |
|---|---|---|---|---|
| eBook Markdown split 기준을 설명 가능한 표로 제시 | ✅ 완료 | `scripts/recommend-markdown-split.mjs` | 5개 eBook dry-run 표 생성 | 실제 ingest는 범위 제외 |
| 줄 수가 아니라 글자수 기준 사용 | ✅ 완료 | `scripts/lib/markdown-split-units.mjs`의 `charCount` | `test-markdown-split-units.mjs`, 5개 eBook dry-run | 공백 포함 본문 길이 기준 |
| 평균 글자수로 default level 결정 | ✅ 완료 | `recommendSplitLevel()` | 5개 eBook 권장 기준이 SPEC D3와 일치 | hard warning 3개 이상이면 하위 level |
| 1~2개 대형 chunk는 예외 분할 권장 | ✅ 완료 | `exceptionSplitTargets`, manifest | `recommend-markdown-split` manifest field check | 자동 분할은 하지 않음 |
| H3 없는 H2 leaf 포함 | ✅ 완료 | `ancestor-leaf` effective unit | `test-markdown-split-units.mjs`, `test-split-markdown-source.mjs` | 누락 방지 확인 |
| parent heading/direct body 보존 | ✅ 완료 | `parent-intro`, `split_parent_heading` | `test-split-markdown-source.mjs` | parent intro 본문 분리 확인 |
| manifest 최소 필드 생성 | ✅ 완료 | `recommend-markdown-split.mjs` | `PASS: manifest fields` | source/path/stats/labels/limits 포함 |
| `13-1`, `13-2` 예외 label 지원 | ✅ 완료 | `--manifest` + `explicitExceptionSplits` 처리 | `test-split-markdown-source.mjs`에 explicit boundary fixture 추가 | done-check-lite 중 보강 |
| `ebook-md-maker` 수정 제외 | ✅ 완료 | 범위 표와 수행 결과에 제외 명시 | 변경 파일에 ebook skill 없음 | 별도 세션 처리 |

### 미완료·승인 필요 항목

없음.

| 항목 | 문제 | 필요한 다음 작업 |
|---|---|---|
| 없음 | 없음 | 없음 |

### 검증 근거

| 구분 | 근거 |
|---|---|
| 실행한 검증 | `node tests/test-markdown-split-units.mjs`; `node tests/test-recommend-markdown-split.mjs`; `node tests/test-split-markdown-source.mjs`; `node tests/test-raw-filename-migration.mjs`; `bash tests/test-plugin-validate.sh`; `bash tests/test-structure.sh`; `bash tests/test-local-cli-lint.sh`; `bash tests/test-opencode-sync.sh`; 5개 eBook dry-run; manifest field check |
| 확인한 파일 | `scripts/lib/markdown-split-units.mjs`, `scripts/recommend-markdown-split.mjs`, `scripts/split-markdown-source.mjs`, `tests/test-markdown-split-units.mjs`, `tests/test-recommend-markdown-split.mjs`, `tests/test-split-markdown-source.mjs`, `claude-plugin/commands/ingest.md`, `claude-plugin/skills/wiki-manager/references/ingestion.md` |
| 커밋 | 없음 |
