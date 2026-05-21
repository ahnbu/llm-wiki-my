---
title: LLM Wiki source_file_name 기반 eBook split 파일명 정규화 구현계획
created: 2026-05-21 15:22
tags:
  - llm-wiki
  - implementation-plan
  - ebook-split
session_id: codex:019e492d-1e63-7080-875e-95195de2114e
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/21/rollout-2026-05-21T15-15-56-019e492d-1e63-7080-875e-95195de2114e.jsonl
ai: codex
---

# LLM Wiki source_file_name 기반 eBook split 파일명 정규화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** eBook/local Markdown split 파일명이 내부 `collection` slug나 `sourceKey`가 아니라 원본 파일명에서 파생한 `source_file_name`으로 생성되고, 기존 영어 slug raw 파일도 참조를 보존한 채 정규화된다.

**Architecture:** `scripts/split-markdown-source.mjs`와 `scripts/recommend-markdown-split.mjs`가 같은 `source_file_name` 파생 규칙을 사용한다. 새 repair script는 기존 `.wiki/raw` 산출물을 dry-run/apply로 rename하고 frontmatter, index, wiki/output 참조를 함께 갱신한다. `claude-plugin/`가 source of truth이고 `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/`는 sync script로 재생성한다.

**Tech Stack:** Node.js `.mjs`, deterministic Markdown/frontmatter parsing, existing split unit module, fixture-style Node tests, Bash plugin validation, Codex/OpenCode sync scripts.

---

## 체크 결과

| 확인 항목 | 결과 | 판정 |
|---|---|---|
| 실제 레포 | `D:/vibe-coding/llm-wiki-my` | ✅ 확인 |
| 캐시 경로 | `C:/Users/ahnbu/.codex/plugins/cache/llm-wiki-my`는 git repo 아님 | ✅ 정정 |
| 생성 스크립트 | `scripts/split-markdown-source.mjs` 존재 | ✅ 확인 |
| 현재 canonical 옵션 | `--source-key`; 내부 변수/manifest는 `sourceKey` | ⚠️ 교체 필요 |
| 현재 파일명 생성 | `${date}_${sourceKey}_${partLabel}_${section}.md` | ⚠️ 입력값 의미 부정확 |
| 현재 frontmatter | `book_title`, `split_source`는 있으나 `source_file_name` 없음 | ❌ 보강 필요 |
| 기준 테스트 | `test-split`, `test-recommend`, `test-markdown-split-units` 모두 PASS | ✅ baseline 확인 |

실행 확인:

```powershell
node tests/test-split-markdown-source.mjs
node tests/test-recommend-markdown-split.mjs
node tests/test-markdown-split-units.mjs
```

기대 출력:

```markdown
PASS: split markdown source
PASS: recommend markdown split
PASS: markdown split units
```

## 범위

| 구분 | 포함 여부 | 이유 |
|---|---|---|
| 새 split/recommend 입력 계약 `source_file_name` | ✅ 포함 | 신규 산출물 재발 방지 |
| 기존 `sourceKey`/`--source-key` 문서 제거 | ✅ 포함 | 사용자-facing 용어 정정 |
| legacy alias `--source-key` 임시 수용 | ⚠️ 조건부 | 기존 자동화 파손 방지. 문서 기본값으로는 노출하지 않음 |
| 기존 `.wiki/raw/articles` 영어 slug 파일 repair | ✅ 포함 | 이미 잘못 생성된 파일 101개 처리 필요 |
| `collection` slug 제거 또는 변경 | ❌ 제외 | 내부 dedupe/provenance ID로 유지 |
| `ebook-md-maker` 수정 | ❌ 제외 | split/ingest 책임은 `llm-wiki-my`에 있음 |
| 실제 운영 wiki apply | ⚠️ 승인 게이트 포함 | dry-run mapping 검토 후 사용자 명시 승인 시에만 apply |

## 핵심 결정

| 결정 | 값 | 근거 |
|---|---|---|
| frontmatter 필드 | `source_file_name` | YAML/frontmatter와 사용자 설명에 맞는 사람용 원본 파일명 식별자 |
| CLI 옵션 | `--source-file-name` | `--source-key`보다 의미가 정확함 |
| JSON manifest 필드 | `source_file_name` | 출력 계약에서 `key` 용어 제거 |
| JS 내부 변수 | `sourceFileName` | 코드 컨벤션상 camelCase 허용. 외부 계약은 snake_case |
| 기본 파생값 | `path.basename(source, ext)`에서 작업 suffix 제거 | `프로덕트개발_2024_정리본.md` → `프로덕트개발_2024` |
| 제거 suffix | `_정리본`, `_최종본`, `_최종`, `_arranged` | 현재 eBook 산출물의 작업용 suffix만 최소 처리 |
| repair 기준 | `adapter: local-markdown-split` 또는 `tags`에 `ebook` 포함 + `source` 존재 | 일반 raw 파일 오탐 방지 |

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `scripts/lib/source-file-name.mjs` | Create | `source` 경로에서 `source_file_name` 파생·sanitize |
| `scripts/split-markdown-source.mjs` | Modify | `--source-file-name` 입력, frontmatter 저장, 파일명 prefix 적용 |
| `scripts/recommend-markdown-split.mjs` | Modify | manifest의 `sourceKey`를 `source_file_name`으로 교체 |
| `scripts/repair-ebook-split-filenames.mjs` | Create | 기존 영어 slug child split raw 파일 dry-run/apply repair |
| `tests/test-source-file-name.mjs` | Create | suffix 제거와 sanitize 규칙 검증 |
| `tests/test-split-markdown-source.mjs` | Modify | 파일명/frontmatter가 `source_file_name`을 쓰는지 검증 |
| `tests/test-recommend-markdown-split.mjs` | Modify | manifest field가 `source_file_name`인지 검증 |
| `tests/test-repair-ebook-split-filenames.mjs` | Create | rename, frontmatter, 참조 rewrite 검증 |
| `claude-plugin/commands/ingest.md` | Modify | `--source-file-name` 기준 문서화 |
| `claude-plugin/skills/wiki-manager/references/ingestion.md` | Modify | split workflow와 `source_file_name` 계약 문서화 |
| `claude-plugin/skills/wiki-manager/references/wiki-structure.md` | Modify | optional provenance field에 `source_file_name` 추가 |
| `tests/test-plugin-validate.sh` | Modify | `source_file_name` 문서화 및 `source-key` 기본 노출 방지 검증 |
| `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/` | Generated | sync script로 재생성 |

---

## Task 1: 기준 상태 고정

**Files:**
- Read: `D:/vibe-coding/llm-wiki-my/CLAUDE.md`
- Read: `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
- Read: `D:/vibe-coding/llm-wiki-my/scripts/recommend-markdown-split.mjs`
- Read: `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`

- [x] **Step 1: 레포 루트와 생성 스크립트 위치가 확인된다**

Run:

```powershell
git -C D:/vibe-coding/llm-wiki-my rev-parse --show-toplevel
rg -n "sourceKey|source-key|source_file_name|split_source|book_title" D:/vibe-coding/llm-wiki-my/scripts D:/vibe-coding/llm-wiki-my/tests D:/vibe-coding/llm-wiki-my/claude-plugin
```

Expected:

```markdown
D:/vibe-coding/llm-wiki-my
scripts/split-markdown-source.mjs has --source-key and sourceKey
scripts/recommend-markdown-split.mjs has sourceKey
source_file_name has no implementation matches
```

- [x] **Step 2: 현재 baseline 테스트가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-markdown-split-units.mjs
```

Expected:

```markdown
PASS: split markdown source
PASS: recommend markdown split
PASS: markdown split units
```

---

## Task 2: source_file_name 파생 모듈과 실패 테스트 추가

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/scripts/lib/source-file-name.mjs`
- Create: `D:/vibe-coding/llm-wiki-my/tests/test-source-file-name.mjs`

- [ ] **Step 1: 테스트를 먼저 작성한다**

Create `tests/test-source-file-name.mjs`:

```javascript
import assert from "node:assert/strict";
import { deriveSourceFileName, sanitizeSourceFileName } from "../scripts/lib/source-file-name.mjs";

assert.equal(
  deriveSourceFileName("C:/Users/ahnbu/cowork/06_연구/= e북 제작/프로덕트개발_2024_정리본.md"),
  "프로덕트개발_2024"
);
assert.equal(
  deriveSourceFileName("C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/아이디어불패_2020f_정리본.md"),
  "아이디어불패_2020f"
);
assert.equal(
  deriveSourceFileName("C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/프롬프트텔링_2025f_최종본.md"),
  "프롬프트텔링_2025f"
);
assert.equal(sanitizeSourceFileName(" 프로덕트 개발 2024 "), "프로덕트-개발-2024");
assert.equal(sanitizeSourceFileName("ebook-product-dev-2024"), "ebook-product-dev-2024");

console.log("PASS: source file name");
```

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-source-file-name.mjs
```

Expected before implementation:

```markdown
Cannot find module '../scripts/lib/source-file-name.mjs'
```

- [ ] **Step 2: 파생 모듈을 구현한다**

Create `scripts/lib/source-file-name.mjs`:

```javascript
import path from "node:path";

const WORK_SUFFIXES = [
  /_정리본$/u,
  /_최종본$/u,
  /_최종$/u,
  /_arranged$/iu,
];

export function sanitizeSourceFileName(input, fallback = "source") {
  const value = String(input ?? "")
    .normalize("NFC")
    .replace(/[^\p{Script=Hangul}A-Za-z0-9_.\-\s]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return (value || fallback).slice(0, 80);
}

export function deriveSourceFileName(sourcePath, explicit = "") {
  if (explicit) return sanitizeSourceFileName(explicit);
  const normalizedPath = String(sourcePath ?? "").replaceAll("\\", "/");
  const base = path.posix.basename(normalizedPath, path.posix.extname(normalizedPath));
  const withoutWorkSuffix = WORK_SUFFIXES.reduce((value, suffix) => value.replace(suffix, ""), base);
  return sanitizeSourceFileName(withoutWorkSuffix);
}
```

- [ ] **Step 3: 테스트가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-source-file-name.mjs
```

Expected:

```markdown
PASS: source file name
```

---

## Task 3: split script를 source_file_name 계약으로 변경

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`

- [ ] **Step 1: split test expected를 먼저 바꾼다**

In `tests/test-split-markdown-source.mjs`, create the source fixture with a Korean source filename:

```javascript
const source = path.join(root, "프로덕트개발_2024_정리본.md");
```

Run the script without `--source-file-name`:

```javascript
const dryRun = execFileSync(
  "node",
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--split-heading", "3", "--date", "20260520", "--dry-run"],
  { encoding: "utf8" }
);
assert.match(dryRun, /20260520_프로덕트개발_2024_00_프롤로그\.md/);
```

Add frontmatter assertions:

```javascript
assert.match(firstSection, /source_file_name: "프로덕트개발_2024"/);
assert.match(firstSection, /book_title: "테스트 책"/);
assert.doesNotMatch(firstSection, /source_key:/);
```

Expected before implementation: filename still uses `book.md` or the old `--source-key` path.

- [ ] **Step 2: CLI argument를 변경한다**

In `parseArgs()`:

```javascript
else if (arg === "--source-file-name") args.sourceFileName = argv[++i];
else if (arg === "--source-key") args.sourceFileName = argv[++i];
```

Usage string becomes:

```markdown
Usage: node scripts/split-markdown-source.mjs --wiki <wiki-root> --source <file.md> --title <title> --split-heading <1-6> [--source-file-name <source_file_name>] [--type notes] [--manifest <manifest.json>] [--date YYYYMMDD] [--dry-run|--apply]
```

Completion criteria:

- `--source-file-name` is canonical.
- `--source-key` remains a legacy alias only in code, not in new docs.
- No output field named `source_key` is produced.

- [ ] **Step 3: filename prefix와 frontmatter를 바꾼다**

Import helper:

```javascript
import { deriveSourceFileName } from "./lib/source-file-name.mjs";
```

Replace:

```javascript
args.sourceKey ||= path.basename(args.source, path.extname(args.source));
...
const sourceKey = sanitize(args.sourceKey);
...
const baseName = `${args.date}_${sourceKey}_${partLabel}_${sanitizeSectionHeading(part.heading)}.md`;
```

With:

```javascript
args.sourceFileName = deriveSourceFileName(args.source, args.sourceFileName);
...
const sourceFileName = sanitize(args.sourceFileName);
...
const baseName = `${args.date}_${sourceFileName}_${partLabel}_${sanitizeSectionHeading(part.heading)}.md`;
```

Add to `buildFrontmatter()`:

```yaml
source_file_name: "${yamlEscape(sourceFileName)}"
```

Pass `sourceFileName` into `buildFrontmatter()`.

- [ ] **Step 4: split test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
```

Expected:

```markdown
PASS: split markdown source
```

---

## Task 4: recommendation manifest를 source_file_name으로 변경

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/recommend-markdown-split.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs`

- [ ] **Step 1: manifest test를 먼저 바꾼다**

In `tests/test-recommend-markdown-split.mjs`, replace required field `sourceKey` with `source_file_name`:

```javascript
for (const key of [
  "sourcePath",
  "source_file_name",
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
assert.ok(!("sourceKey" in json.sources[0]));
```

Expected before implementation: fails because manifest still has `sourceKey`.

- [ ] **Step 2: recommend script를 변경한다**

Import helper:

```javascript
import { deriveSourceFileName } from "./lib/source-file-name.mjs";
```

Replace:

```javascript
function sourceKeyFrom(sourcePath) {
  return path.basename(sourcePath, path.extname(sourcePath));
}
...
sourceKey: sourceKeyFrom(sourcePath),
...
"source key",
```

With:

```javascript
source_file_name: deriveSourceFileName(sourcePath),
...
"source_file_name",
```

- [ ] **Step 3: recommendation test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs
```

Expected:

```markdown
PASS: recommend markdown split
```

---

## Task 5: 기존 eBook split raw repair script 추가

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/scripts/repair-ebook-split-filenames.mjs`
- Create: `D:/vibe-coding/llm-wiki-my/tests/test-repair-ebook-split-filenames.mjs`

- [ ] **Step 1: repair test를 먼저 작성한다**

Create `tests/test-repair-ebook-split-filenames.mjs` with this fixture shape:

```javascript
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const root = path.join(os.tmpdir(), `llm-wiki-ebook-repair-${Date.now()}-${process.pid}`);
const wiki = path.join(root, ".wiki");
const rawArticles = path.join(wiki, "raw", "articles");
const rawFile = path.join(rawArticles, "20260521_product-dev-2024_17_글을-마치며.md");

await fs.mkdir(rawArticles, { recursive: true });
await fs.mkdir(path.join(wiki, "wiki", "topics"), { recursive: true });
await fs.writeFile(rawFile, `---
title: "프로덕트 개발의 모든 것 - 글을 마치며"
source: "C:/books/프로덕트개발_2024_정리본.md"
type: articles
ingested: 2026-05-21
tags:
  - collection
  - ebook
  - article
summary: "split raw"
collection: "ebook-product-dev-2024"
adapter: "local-markdown-split"
upstream_id: "ebook-product-dev-2024:017"
---

# 본문
`, "utf8");
await fs.writeFile(path.join(rawArticles, "_index.md"), "[raw](20260521_product-dev-2024_17_글을-마치며.md)\n", "utf8");
await fs.writeFile(path.join(wiki, "raw", "_index.md"), "[raw](articles/20260521_product-dev-2024_17_글을-마치며.md)\n", "utf8");
await fs.writeFile(path.join(wiki, "wiki", "topics", "sample.md"), "sources:\n  - raw/articles/20260521_product-dev-2024_17_글을-마치며.md\n", "utf8");
await fs.writeFile(path.join(wiki, "log.md"), "# Log\n", "utf8");

const script = path.join(projectRoot, "scripts", "repair-ebook-split-filenames.mjs");
const dryRun = execFileSync("node", [script, "--wiki", wiki, "--dry-run"], { encoding: "utf8" });
assert.match(dryRun, /20260521_프로덕트개발_2024_17_글을-마치며\.md/);
await fs.access(rawFile);

execFileSync("node", [script, "--wiki", wiki, "--apply"], { encoding: "utf8" });
const repaired = path.join(rawArticles, "20260521_프로덕트개발_2024_17_글을-마치며.md");
await fs.access(repaired);
await assert.rejects(fs.access(rawFile));

const repairedText = await fs.readFile(repaired, "utf8");
assert.match(repairedText, /source_file_name: "프로덕트개발_2024"/);

const topicText = await fs.readFile(path.join(wiki, "wiki", "topics", "sample.md"), "utf8");
assert.match(topicText, /raw\/articles\/20260521_프로덕트개발_2024_17_글을-마치며\.md/);

console.log("PASS: repair ebook split filenames");
```

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-repair-ebook-split-filenames.mjs
```

Expected before implementation:

```markdown
Cannot find module or script not found
```

- [ ] **Step 2: repair script를 구현한다**

Behavior:

```markdown
Usage:
node scripts/repair-ebook-split-filenames.mjs --wiki <wiki-root> [--dry-run|--apply]
```

Required logic:

- Scan child source directories only: `raw/articles` and `raw/notes`.
- Select files whose frontmatter has `adapter: "local-markdown-split"` or tag `ebook`.
- Skip files tagged `collection-manifest` and skip `type: repos`; collection manifests keep their internal collection slug filename unless a separate manifest policy is approved.
- Require a non-empty `source` field.
- Derive `source_file_name` from `source`.
- Parse current filename as `YYYYMMDD_<old-prefix>_<part-label>_<section>.md`; if the filename does not match this child split pattern, report it as skipped instead of guessing.
- Write target filename as `YYYYMMDD_<source_file_name>_<part-label>_<section>.md`.
- Add frontmatter line `source_file_name: "<value>"` if missing.
- Rewrite old raw paths in `.wiki/**/*.md`.
- Append log entry only on apply.
- Default mode is dry-run.
- Abort apply on duplicate target collisions.

Minimal implementation helpers:

```javascript
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : "";
}

function frontmatterValue(fm, key) {
  const match = fm.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, "m"));
  return match?.[1]?.trim() || "";
}

function isRepairCandidate(text) {
  const fm = parseFrontmatter(text);
  return /adapter:\s*"?local-markdown-split"?/m.test(fm) || /^\s+-\s+ebook\s*$/m.test(fm);
}
```

Completion criteria:

- Files already using the derived `source_file_name` are skipped.
- Files without `source` are reported as skipped, not guessed.
- Script does not read or rewrite outside the provided wiki root.

- [ ] **Step 3: repair test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-repair-ebook-split-filenames.mjs
```

Expected:

```markdown
PASS: repair ebook split filenames
```

---

## Task 6: command/reference 문서와 validation 갱신

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`

- [ ] **Step 1: ingest command가 canonical 옵션을 문서화한다**

Replace `--source-key <short-key>` in `argument-hint` and examples with:

```markdown
--source-file-name <source_file_name>
```

Add:

```markdown
For eBook or local Markdown split ingestion, derive `source_file_name` from the original source filename by removing extension and work suffixes such as `_정리본` or `_최종본`. Example: `프로덕트개발_2024_정리본.md` becomes `source_file_name: "프로덕트개발_2024"` and split files use `YYYYMMDD_프로덕트개발_2024_17_글을-마치며.md`.
```

- [ ] **Step 2: ingestion reference가 repair workflow를 문서화한다**

Add:

```markdown
Existing eBook split raw files that used an internal collection slug in the filename can be repaired with:

`node scripts/repair-ebook-split-filenames.mjs --wiki <wiki-root> --dry-run`

Apply requires explicit user approval:

`node scripts/repair-ebook-split-filenames.mjs --wiki <wiki-root> --apply`
```

- [ ] **Step 3: wiki structure optional provenance를 갱신한다**

Add under collection/split provenance fields:

```yaml
source_file_name: "프로덕트개발_2024"
```

Clarify:

```markdown
`source_file_name` is a human-facing source filename stem derived from `source`; it is not a deduplication key. Keep `collection` and `upstream_id` for internal provenance.
```

- [ ] **Step 4: plugin validation을 추가한다**

Add assertions:

```bash
assert_contains "$PLUGIN_DIR/commands/ingest.md" "--source-file-name <source_file_name>" "ingest command exposes source_file_name option"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "source_file_name" "ingestion reference documents source_file_name"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "source_file_name" "wiki structure documents source_file_name provenance"
assert_not_contains "$PLUGIN_DIR/commands/ingest.md" "--source-key <short-key>" "ingest command no longer documents source-key as canonical"
```

- [ ] **Step 5: validation이 통과한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected:

```markdown
0 failed
```

---

## Task 7: 실제 운영 wiki repair dry-run

**Files:**
- External target: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`
- No source edits in `llm-wiki-my` expected

- [ ] **Step 1: 대상 범위가 집계된다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
$files = rg --files "$wiki/raw" | Where-Object { $_ -match '\.md$' -and $_ -notmatch '[\\/]_index\.md$' }
$englishSlug = $files | Where-Object { $_ -match '[\\/]\d{8}_[a-z0-9-]+_\d{2,3}[-_]' }
[pscustomobject]@{
  raw_md=($files|Measure-Object).Count
  english_slug_candidates=($englishSlug|Measure-Object).Count
} | ConvertTo-Json
```

Expected:

```json
{
  "english_slug_candidates": 101
}
```

If the count differs, record the actual count and inspect 3 samples before apply.

- [ ] **Step 2: dry-run mapping이 생성된다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/scripts/repair-ebook-split-filenames.mjs --wiki "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki" --dry-run
```

Expected:

```markdown
"mode": "dry-run"
"count": 101
newRel values include:
raw/articles/20260521_프로덕트개발_2024_17_글을-마치며.md
raw/articles/20260521_프로덕트매니저_2025_...
raw/articles/20260521_아이디어불패_2020f_...
raw/articles/20260521_프롬프트텔링_2025f_...
raw/articles/20260521_도그냥PO_20251125_...
```

- [ ] **Step 3: dry-run 결과에 내부 slug가 남지 않는다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/scripts/repair-ebook-split-filenames.mjs --wiki "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki" --dry-run |
  Select-String -Pattern 'product-dev-2024|product-manager-2025|dogpo-20251125|prompttelling-2025|idea-bulletsproof-2020'
```

Expected:

```markdown
Only oldRel contains the internal slugs.
newRel does not contain the internal slugs.
```

Apply는 이 단계에서 실행하지 않는다. 실제 운영 wiki 수정은 Task 8에서 사용자 명시 승인 후 진행한다.

---

## Task 8: 사용자 승인 후 운영 wiki repair apply

**Files:**
- External data target: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`
- Rename/update under: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/articles/`
- Rewrite references under: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/**/*.md`

- [ ] **Step 1: 사용자 승인 상태가 확인된다**

Required condition:

```markdown
사용자가 dry-run mapping을 확인한 뒤 apply를 명시 승인했다.
```

If approval is not present, stop here. Do not run apply.

- [ ] **Step 2: 운영 wiki의 git 또는 백업 상태가 확보된다**

Run:

```powershell
$project='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H'
git -C "$project" rev-parse --show-toplevel
git -C "$project" status --short -- .wiki
```

Expected:

```markdown
git root is printed
status output is recorded before apply
```

If `.wiki` is not tracked or has unrelated changes that make rollback unclear, create a timestamped backup before apply:

```powershell
$project='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = "$project/.wiki_backup_before_source_file_name_repair_$stamp"
Copy-Item -LiteralPath "$project/.wiki" -Destination $backup -Recurse
$backup
```

Expected: backup path is printed and later recorded in the 수행 결과 section.

- [ ] **Step 3: apply가 실행된다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/scripts/repair-ebook-split-filenames.mjs --wiki "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki" --apply
```

Expected:

```markdown
"mode": "apply"
"count": 101
```

- [ ] **Step 4: 영어 slug filename이 남지 않는다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
$files = rg --files "$wiki/raw" | Where-Object { $_ -match '\.md$' -and $_ -notmatch '[\\/]_index\.md$' }
$englishSlug = $files | Where-Object { $_ -match '[\\/]\d{8}_(product-dev-2024|product-manager-2025|dogpo-20251125|prompttelling-2025|idea-bulletsproof-2020)_' }
$sourceFileNameMissing = $files | Where-Object { $_ -match '[\\/]\d{8}_(프로덕트개발_2024|프로덕트매니저_2025|도그냥PO_20251125|프롬프트텔링_2025f|아이디어불패_2020f)_' } | Where-Object { -not (Select-String -LiteralPath $_ -Pattern '^source_file_name:' -Quiet) }
[pscustomobject]@{
  english_slug_files=($englishSlug|Measure-Object).Count
  repaired_files_missing_source_file_name=($sourceFileNameMissing|Measure-Object).Count
} | ConvertTo-Json
```

Expected:

```json
{
  "english_slug_files": 0,
  "repaired_files_missing_source_file_name": 0
}
```

- [ ] **Step 5: legacy raw path 참조가 남지 않는다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
rg -n "raw/(articles|notes)/20260521_(product-dev-2024|product-manager-2025|dogpo-20251125|prompttelling-2025|idea-bulletsproof-2020)_" "$wiki" -g "*.md"
rg -n "\]\((20260521_(product-dev-2024|product-manager-2025|dogpo-20251125|prompttelling-2025|idea-bulletsproof-2020)_)" "$wiki/raw" -g "_index.md"
```

Expected:

```markdown
no matches
```

- [ ] **Step 6: repair log가 남는다**

Run:

```powershell
Select-String -LiteralPath "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/log.md" -Pattern "source_file_name"
```

Expected:

```markdown
repair log entry includes source_file_name repair and repaired file count
```

---

## Task 9: mirror sync 및 전체 검증

**Files:**
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

- [ ] **Step 1: mirror가 재생성된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh
bash D:/vibe-coding/llm-wiki-my/scripts/sync-opencode-plugin.sh
```

Expected:

```markdown
both commands exit with code 0
```

- [ ] **Step 2: 전체 테스트가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-source-file-name.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-markdown-split-units.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-recommend-markdown-split.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-repair-ebook-split-filenames.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-structure.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh
```

Expected:

```markdown
PASS: source file name
PASS: markdown split units
PASS: recommend markdown split
PASS: split markdown source
PASS: repair ebook split filenames
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

---

## Task 10: 수행 결과 문서 업데이트

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/docs/20260521_04_LLM-Wiki-source_file_name-eBook-split-파일명-정규화-구현계획.md`

- [ ] **Step 1: 수행 결과 섹션이 추가된다**

Append:

```markdown
## 수행 결과

작성 시점: 2026-05-21 KST

### 구현 완료

- `source_file_name` 파생 모듈을 추가했다.
- split/recommend script가 `source_file_name`을 파일명과 manifest/frontmatter에 사용한다.
- `--source-file-name`을 canonical 옵션으로 문서화했다.
- 기존 eBook split raw 파일 repair script를 추가했다.
- Codex/OpenCode mirror를 재생성했다.

### 검증 결과

| 검증 | 결과 | 판정 |
|---|---:|---|
| source file name test | `PASS` | ✅ 통과 |
| split test | `PASS` | ✅ 통과 |
| recommend test | `PASS` | ✅ 통과 |
| repair test | `PASS` | ✅ 통과 |
| plugin validate | `0 failed` | ✅ 통과 |
| structure/local lint | `0 failed` | ✅ 통과 |
| 운영 wiki repair dry-run | `101 candidates` | ✅ 확인 |
```

- [ ] **Step 2: 현재 문제 원인 정정이 기록된다**

Add:

```markdown
이전 판단 정정: 생성 스크립트는 없던 것이 아니라 실제 레포 `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`에 있었다. 문제는 생성기 부재가 아니라 기존 계약명이 `sourceKey`이고, 원본 파일명 기반 `source_file_name`을 frontmatter/manifest/파일명 계약으로 보존하지 않은 것이다.
```

- [ ] **Step 3: 문서 검증이 통과한다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/docs/20260521_04_LLM-Wiki-source_file_name-eBook-split-파일명-정규화-구현계획.md -Pattern '## 수행 결과|source_file_name|repair-ebook-split-filenames|이전 판단 정정'
```

Expected:

```markdown
all patterns are present
```

---

## 수행 결과

작성 시점: 2026-05-21 15:42 KST

### 구현 완료

- `scripts/lib/source-file-name.mjs`를 추가해 원본 파일명 stem에서 `source_file_name`을 파생한다.
- `scripts/split-markdown-source.mjs`가 canonical 옵션 `--source-file-name`을 받고, legacy `--source-key`는 호환 alias로만 수용한다.
- split raw 파일명과 frontmatter에 같은 `source_file_name` 값이 저장된다.
- `scripts/recommend-markdown-split.mjs` manifest가 `sourceKey` 대신 `source_file_name`을 출력한다.
- `scripts/repair-ebook-split-filenames.mjs`를 추가해 기존 eBook split raw 파일을 dry-run/apply 방식으로 rename하고 참조를 갱신할 수 있게 했다.
- `claude-plugin/` 문서와 `plugins/llm-wiki/` Codex mirror references를 새 계약 기준으로 갱신했다.

### 운영 wiki dry-run 결과

대상: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`

| source_file_name | 변경 후보 | 판정 |
|---|---:|---|
| `도그냥PO_20251125` | 26 | ✅ 매핑 확인 |
| `아이디어불패_2020f` | 14 | ✅ 매핑 확인 |
| `프로덕트개발_2024` | 17 | ✅ 매핑 확인 |
| `프로덕트매니저_2025` | 29 | ✅ 매핑 확인 |
| `프롬프트텔링_2025f` | 15 | ✅ 매핑 확인 |
| 합계 | 101 | ⚠️ apply 대기 |

운영 wiki 실제 rename/apply는 이 계획의 승인 게이트에 따라 아직 실행하지 않았다. dry-run 매핑 검토 후 사용자 명시 승인 시 `--apply`를 실행한다.

### 검증 결과

| 검증 | 결과 | 판정 |
|---|---:|---|
| `node tests/test-source-file-name.mjs` | `PASS: source file name` | ✅ 통과 |
| `node tests/test-split-markdown-source.mjs` | `PASS: split markdown source` | ✅ 통과 |
| `node tests/test-recommend-markdown-split.mjs` | `PASS: recommend markdown split` | ✅ 통과 |
| `node tests/test-repair-ebook-split-filenames.mjs` | `PASS: repair ebook split filenames` | ✅ 통과 |
| `node tests/test-markdown-split-units.mjs` | `PASS: markdown split units` | ✅ 통과 |
| `bash tests/test-plugin-validate.sh` | `115 passed, 0 failed` | ✅ 통과 |
| `bash tests/test-structure.sh` | `170 passed, 0 failed` | ✅ 통과 |
| `bash tests/test-local-cli-lint.sh` | `24 passed, 0 failed` | ✅ 통과 |
| `bash tests/test-opencode-sync.sh` | `OK` | ✅ 통과 |
| `bash tests/test-codex-sync.sh` | mirror regenerated, HEAD diff detected | ⚠️ 커밋 필요 |

`test-codex-sync.sh`는 Codex mirror가 `HEAD`와 다르면 실패하는 검증이다. 이번 작업에서 mirror 파일을 갱신했으므로 현재 미커밋 상태에서는 통과 검증으로 사용할 수 없다. 커밋이 요청되면 `cp` 흐름으로 커밋한 뒤 재실행해 `OK: Codex plugin mirror is in sync.`를 확인해야 한다.

### Done-check-lite 보완 판정

작성 시점: 2026-05-21 KST

| 항목 | 상태 | 근거 |
|---|---:|---|
| 코드 구현 | ✅ 완료 | helper, split/recommend, repair script와 테스트 추가 |
| 수행 결과 문서 업데이트 | ✅ 완료 | 이 `## 수행 결과` 섹션에 검증과 dry-run 결과 기록 |
| 운영 wiki 실제 repair apply | ⚠️ 승인 필요 | dry-run 후보 101개 확인, apply는 사용자 명시 승인 전 미실행 |
| Codex sync 최종 통과 검증 | ⚠️ 커밋 필요 | `test-codex-sync.sh`는 미커밋 mirror diff 때문에 현재 통과 판정 불가 |

### 현재 문제 원인 정정

이전 판단 정정: 생성 스크립트는 없던 것이 아니라 실제 레포 `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`에 있었다. 문제는 생성기 부재가 아니라 기존 계약명이 `sourceKey`이고, 원본 파일명 기반 `source_file_name`을 frontmatter/manifest/파일명 계약으로 보존하지 않은 것이다.

---

## 기존 wiki 마이그레이션 계획

작성 시점: 2026-05-21 KST

### 현재 판정

| 항목 | 상태 | 근거 |
|---|---:|---|
| 기존 `.wiki` raw 파일 마이그레이션 | ❌ 미수행 | dry-run만 실행했고 `--apply`는 실행하지 않음 |
| 마이그레이션 후보 | 101개 | `repair-ebook-split-filenames.mjs --dry-run` 결과 |
| 운영 `.wiki` 기존 변경 | ⚠️ 보호 필요 | `.wiki/wiki/concepts/제품_문제정의_MVP.md`, `.wiki/wiki/topics/프로덕트개발_운영루프.md`가 이미 수정 상태 |
| 사용자 승인 | ⚠️ 필요 | raw 파일 rename과 wiki/output 참조 rewrite가 발생함 |

### 크리티컬 이슈 검토 결과

| 이슈 | 판정 | 근거 | 보완 |
|---|---:|---|---|
| target 파일 경로 충돌 | ✅ 현재 없음 | dry-run `to` 경로가 이미 존재하는지 검사했고 결과 0개 | apply 직전 preflight로 재검사 |
| 중복 target 경로 | ✅ 현재 없음 | dry-run `to` 경로 `Group-Object` 중복 검사 결과 0개 | apply 직전 preflight로 재검사 |
| 기존 사용자 변경 덮어쓰기 | ⚠️ 위험 있음 | `.wiki/wiki/concepts/제품_문제정의_MVP.md`, `.wiki/wiki/topics/프로덕트개발_운영루프.md`가 수정 상태 | apply 전 diff snapshot 저장, apply 후 해당 파일 diff 별도 검토 |
| 참조 rewrite 과다 | ⚠️ 위험 있음 | repair script는 `.wiki` 내 `.md`, `.json`, `.canvas`에서 기존 파일명 문자열을 치환함 | rewrite 대상 diff 검토와 local lint를 완료 기준에 추가 |
| 구조·참조 무결성 검증 부족 | ⚠️ 보완 필요 | 기존 계획은 slug 잔여 검색 중심이었음 | `scripts/llm-wiki lint <wiki>`를 apply 후 필수 검증에 추가 |

### 마이그레이션 대상

대상 wiki: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`

| 기존 slug | 목표 source_file_name | 파일 수 | 완료 기준 |
|---|---|---:|---|
| `dogpo-20251125` | `도그냥PO_20251125` | 26 | 기존 slug 파일명 0개 |
| `idea-bulletsproof-2020` | `아이디어불패_2020f` | 14 | 기존 slug 파일명 0개 |
| `product-dev-2024` | `프로덕트개발_2024` | 17 | 기존 slug 파일명 0개 |
| `product-manager-2025` | `프로덕트매니저_2025` | 29 | 기존 slug 파일명 0개 |
| `prompttelling-2025` | `프롬프트텔링_2025f` | 15 | 기존 slug 파일명 0개 |
| 합계 | 5개 source_file_name | 101 | 전체 후보 0개 |

### 실행 전 조건

| 조건 | 확인 방법 | 기대 결과 |
|---|---|---|
| 사용자 승인 확인 | 대화에서 `운영 wiki repair apply 승인` 확인 | 승인 문구 존재 |
| 강의 프로젝트 git 상태 확인 | `git -C C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H status --short -- .wiki` | 기존 변경 2개를 인지한 상태 |
| 백업 생성 | `.wiki_backup_before_source_file_name_repair_<timestamp>` 생성 | 백업 폴더 존재 |
| dry-run 재확인 | `node D:/vibe-coding/llm-wiki-my/scripts/repair-ebook-split-filenames.mjs --wiki "<wiki>" --dry-run` | `count: 101` 또는 최신 후보 수 확인 |
| 충돌 확인 | dry-run `to` 경로가 이미 존재하는지 검사 | 충돌 0개 |
| 중복 target 확인 | dry-run `to` 경로를 group by | 중복 0개 |
| 기존 변경 snapshot | 강의 프로젝트 `.wiki` diff 저장 | apply 전 사용자 변경 기준점 확보 |

Preflight command:

```powershell
$wiki = "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki"
$project = "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H"
$dryRun = node D:/vibe-coding/llm-wiki-my/scripts/repair-ebook-split-filenames.mjs --wiki $wiki --dry-run | ConvertFrom-Json
$targetCollisions = $dryRun.changes | Where-Object { Test-Path -LiteralPath (Join-Path $wiki $_.to) }
$duplicateTargets = $dryRun.changes | Group-Object to | Where-Object Count -gt 1
$statusBefore = git -C $project status --short -- .wiki
$diffBefore = git -C $project diff -- .wiki

[pscustomobject]@{
  dry_run_count = $dryRun.count
  target_collisions = ($targetCollisions | Measure-Object).Count
  duplicate_targets = ($duplicateTargets | Measure-Object).Count
  preexisting_wiki_changes = ($statusBefore | Measure-Object).Count
}
```

Expected:

```json
{
  "dry_run_count": 101,
  "target_collisions": 0,
  "duplicate_targets": 0,
  "preexisting_wiki_changes": 2
}
```

### 실행 절차

| 순서 | 작업 | 명령·확인 | 완료 기준 |
|---:|---|---|---|
| 1 | 승인 확인 | 사용자 명시 승인 확인 | 승인 없으면 중단 |
| 2 | 백업 생성 | PowerShell `Copy-Item`으로 `.wiki` 전체 백업 | 백업 폴더 생성 |
| 3 | preflight 실행 | 위 Preflight command 실행 | collision 0, duplicate 0 |
| 4 | 기존 변경 snapshot 보존 | `git -C <project> diff -- .wiki` 출력 저장 또는 문서에 요약 | 기존 2개 변경을 apply 전 상태로 식별 |
| 5 | apply 실행 | `node .../repair-ebook-split-filenames.mjs --wiki "<wiki>" --apply` | JSON `mode: apply`, `count: 101` |
| 6 | 파일명 잔여 확인 | 기존 slug 패턴 검색 | `dogpo-20251125`, `idea-bulletsproof-2020`, `product-dev-2024`, `product-manager-2025`, `prompttelling-2025` 파일명 0개 |
| 7 | frontmatter 확인 | 새 파일명 패턴 파일에서 `^source_file_name:` 검색 | 마이그레이션된 파일 누락 0개 |
| 8 | 참조 갱신 확인 | `.wiki/wiki`, `.wiki/output`, `.wiki/raw/*/_index.md`에서 기존 slug 검색 | 기존 slug 참조 0개 |
| 9 | local wiki lint | `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki lint "<wiki>"` | critical 0개 |
| 10 | 로그 확인 | `.wiki/log.md`에서 `source_file_name repair` 검색 | repair 로그 1건 이상 |
| 11 | git diff 검토 | 강의 프로젝트 `.wiki` diff 확인 | rename과 참조 rewrite 외 의도치 않은 변경 없음 |
| 12 | 기존 수정 파일 별도 검토 | 기존 수정 2개 파일 diff 확인 | 기존 사용자 변경이 삭제되지 않음 |

### apply 명령

```powershell
node D:/vibe-coding/llm-wiki-my/scripts/repair-ebook-split-filenames.mjs --wiki "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki" --apply
```

### 검증 명령

```powershell
$wiki = "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki"
$patterns = "dogpo-20251125|idea-bulletsproof-2020|product-dev-2024|product-manager-2025|prompttelling-2025"
$legacyFiles = Get-ChildItem -LiteralPath "$wiki/raw/articles","$wiki/raw/notes" -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $patterns }
$legacyRefs = Select-String -LiteralPath (Get-ChildItem -LiteralPath "$wiki/wiki","$wiki/output","$wiki/raw" -Recurse -File -Include *.md -ErrorAction SilentlyContinue).FullName -Pattern $patterns -ErrorAction SilentlyContinue
$missingSourceFileName = Get-ChildItem -LiteralPath "$wiki/raw/articles","$wiki/raw/notes" -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "^\d{8}_(도그냥PO_20251125|아이디어불패_2020f|프로덕트개발_2024|프로덕트매니저_2025|프롬프트텔링_2025f)_" } |
  Where-Object { -not (Select-String -LiteralPath $_.FullName -Pattern "^source_file_name:" -Quiet) }

[pscustomobject]@{
  legacy_files = ($legacyFiles | Measure-Object).Count
  legacy_refs = ($legacyRefs | Measure-Object).Count
  missing_source_file_name = ($missingSourceFileName | Measure-Object).Count
}

D:/vibe-coding/llm-wiki-my/scripts/llm-wiki lint $wiki
```

Expected:

```json
{
  "legacy_files": 0,
  "legacy_refs": 0,
  "missing_source_file_name": 0
}
```

### 롤백 계획

| 상황 | 조치 | 기준 |
|---|---|---|
| apply 중 오류 | 즉시 중단하고 오류 파일 확인 | 부분 rename 여부 확인 |
| 검증 실패 | 백업 `.wiki_backup_before_source_file_name_repair_<timestamp>`와 현재 `.wiki` diff 비교 | 원인 확인 전 추가 작업 금지 |
| 참조 rewrite 과다 | 백업에서 affected 파일 복구 또는 git diff 기반 수동 복구 | 기존 사용자 변경 2개는 보존 |
| 사용자가 롤백 지시 | 백업 기준으로 `.wiki` 복구 | 직접 삭제 대신 안전한 교체 절차 별도 확인 후 진행 |

### 완료 판정

마이그레이션은 다음 4개가 모두 충족되어야 완료로 판정한다.

- 기존 영어 slug 파일명이 `raw/articles`, `raw/notes`에서 0개다.
- 마이그레이션된 101개 파일 모두 `source_file_name` frontmatter를 가진다.
- `.wiki/wiki`, `.wiki/output`, `.wiki/raw/*/_index.md`에 기존 slug 참조가 0개다.
- `scripts/llm-wiki lint "<wiki>"`에서 critical issue가 0개다.
- `.wiki/log.md`에 `source_file_name repair` 실행 로그가 남아 있다.
- apply 전부터 있던 사용자 변경 2개가 삭제되거나 되돌려지지 않았다.

---

## Task 11: 커밋 준비

**Files:**
- Changed files from Tasks 2-10

- [ ] **Step 1: 커밋 전 보안 점검은 cp 흐름에서 실행된다**

Do not run `git add` or `git commit` directly. When the user requests a commit, use the `cp` skill. After files are staged by that flow and before commit finalization, run:

```powershell
node C:/Users/ahnbu/.claude/skills/_shared/security-gate.mjs precommit --repo D:/vibe-coding/llm-wiki-my --staged
```

Expected:

```markdown
no secret, credential, suspicious install script, or external transfer risk
```

- [ ] **Step 2: 권장 커밋 메시지가 준비된다**

Recommended commit message:

```markdown
fix(split): source_file_name 기반 eBook 파일명 생성으로 정규화 — 내부 slug 노출 방지
```

Expected:

```markdown
source_file_name helper, split/recommend changes, repair script/test, docs, generated mirror changes are one concern.
Existing course wiki repair apply is a separate explicit operation unless the user approves it in the same work package.
```

---

## Self-Review

| 요구/문제 | 반영 위치 | 판정 |
|---|---|---|
| `source_key`는 부적절하고 `source_file_name`을 써야 함 | Task 2-6 | ✅ |
| 책 제목이 아니라 원본 파일명 `프로덕트개발_2024`가 파일명에 들어가야 함 | Task 2-4 | ✅ |
| frontmatter에 해당 값이 보존되어야 함 | Task 3, Task 6 | ✅ |
| 새 파일 생성부터 제대로 되어야 함 | Task 3-4 | ✅ |
| 기존 잘못 생성된 영어 slug 파일도 많음 | Task 5, Task 7 | ✅ |
| 생성 스크립트 위치를 코드로 확인해야 함 | 체크 결과, Task 1 | ✅ |
| 규칙 문구 추가보다 스크립트 수정이 핵심 | 전체 Files가 scripts/tests/docs 중심 | ✅ |
| 완료 기준과 검증 방법 필요 | 각 Task Expected output | ✅ |

## 완료 판정

이 계획은 다음이 모두 충족되면 완료다.

- `split-markdown-source.mjs`가 `--source-file-name` 또는 `source` path에서 `source_file_name`을 결정한다.
- split raw frontmatter에 `source_file_name`이 저장된다.
- split 파일명은 `YYYYMMDD_프로덕트개발_2024_17_글을-마치며.md` 형식으로 생성된다.
- `recommend-markdown-split.mjs` manifest에 `source_file_name`이 있고 `sourceKey`가 없다.
- 기존 eBook split raw repair dry-run이 영어 slug 파일을 한국어 `source_file_name` 파일명으로 매핑한다.
- Node tests, plugin validation, structure/local lint, mirror sync가 통과하거나 pre-commit gate 사유가 명확히 기록된다.
