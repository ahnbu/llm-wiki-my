---
title: LLM Wiki raw 파일명 NN 제거 구현계획
created: 2026-05-21 10:24
tags:
  - llm-wiki
  - implementation-plan
session_id: codex:019e4497-2a07-7402-9a99-e8ca3c0db960
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/20/rollout-2026-05-20T17-53-37-019e4497-2a07-7402-9a99-e8ca3c0db960.jsonl
ai: codex
---

# LLM Wiki raw 파일명 NN 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `llm-wiki-my`의 raw filename 기본 규칙에서 일일 순번 `NN`을 제거하고, 충돌 시에만 suffix를 붙이며, 책 split 파일명은 `YYYYMMDD_sourcekey_part_제목.md` 형태로 단순화한다.

**Architecture:** `claude-plugin/`가 source of truth이고 `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/`는 sync script로 재생성한다. `NN`은 일일 누적 순번으로 쓰지 않고, 일반 raw는 `YYYYMMDD_제목.md`, split raw는 `YYYYMMDD_sourcekey_00_프롤로그.md`처럼 part index만 유지한다. 기존 `YYYYMMDD_NN_...` 파일은 migration script가 명시 요청 시 `YYYYMMDD_...`로 바꾸고 wiki/output/index/log 참조를 함께 갱신한다.

**Tech Stack:** Node.js `.mjs` scripts, Markdown command/reference docs, Bash validation tests, Codex/OpenCode plugin sync scripts.

---

## 구현 원칙

- `YYYYMMDD_NN_...`는 더 이상 새 raw 파일명의 기본 규칙이 아니다.
- 일반 raw filename 기본형은 `YYYYMMDD_한국어-요약명.md`이다.
- 책/긴 Markdown split filename 기본형은 `YYYYMMDD_sourcekey_00_프롤로그.md`, `YYYYMMDD_sourcekey_01_하위-목차.md`이다.
- `00`, `01`, `02`, `99`는 split part label이다. 일일 ingest 순번이 아니다.
- 동일 파일명이 이미 있으면 base filename 뒤에 `_02`, `_03` suffix를 붙인다.
  - 예: `20260521_기존-노트.md` 충돌 시 `20260521_기존-노트_02.md`
  - 예: `20260521_도그냥PO_01_우물-안-일잘러.md` 충돌 시 `20260521_도그냥PO_01_우물-안-일잘러_02.md`
- 기존 raw 파일은 일반 ingest/lint/compile/query 중 자동 rename하지 않는다.
- 기존 `YYYYMMDD_NN_...`와 `YYYY-MM-DD-...` 파일은 사용자가 migration을 명시 요청했을 때만 `migrate-raw-filenames.mjs --apply`로 rename한다.
- `book`, `books`, `raw/books/` raw type은 계속 만들지 않는다.
- 커밋은 필요 시 `cp` 스킬로만 수행한다.

## 파일 구조

**수정할 원본 파일**

- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
  - filename rule을 `YYYYMMDD_한국어-요약명.md`로 교체한다.
  - split filename 예시를 `YYYYMMDD_sourcekey_part_...`로 교체한다.
  - 충돌 시 suffix 규칙을 문서화한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
  - `Filename Generation`과 `Book and Long Markdown Split` 섹션에서 `YYYYMMDD_NN`을 제거한다.
  - raw filename migration 설명을 `YYYYMMDD_NN_...` 제거 migration까지 포함하도록 수정한다.
  - 도그냥PO 예시 filename을 새 규칙으로 수정한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`
  - raw source naming policy를 `YYYYMMDD_...`로 수정한다.
  - Source Reference fallback에서 `YYYYMMDD_NN_`와 `YYYYMMDD_` prefix 모두 처리한다고 설명한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
  - legacy filename 예시에 `YYYYMMDD_NN_...`도 포함한다.

**수정할 script**

- `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
  - `nextSequence()` 기반 일일 순번을 제거한다.
  - `uniqueFilename(rawDir, baseName)` helper를 추가해 충돌 시 suffix만 붙인다.
  - split filename을 `${date}_${sourceKey}_${partLabel}_${section}.md`로 생성한다.
- `D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs`
  - canonical 판단을 `YYYYMMDD_...`로 바꾼다.
  - 기존 `YYYYMMDD_NN_...` 파일도 migration 대상으로 인식한다.
  - 새 이름 생성 시 일일 순번 대신 충돌 suffix를 사용한다.
  - log 문구를 `YYYYMMDD` 또는 `YYYYMMDD_date-title` 정책으로 바꾼다.

**수정할 tests**

- `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`
  - expected filenames를 `20260520_테스트책_00_프롤로그.md` 등으로 교체한다.
  - 충돌 시 `_02` suffix가 붙는 테스트를 추가한다.
- `D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs`
  - legacy dashed filename migration 결과를 `20260520_기존-노트.md`로 교체한다.
  - 기존 `20260520_01_기존-노트.md`가 `20260520_기존-노트.md`로 migration되는 케이스를 추가한다.
  - 충돌 시 `20260520_기존-노트_02.md`가 생성되는 케이스를 추가한다.
- `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`
  - `YYYYMMDD_NN` 요구 검증을 제거하고 `YYYYMMDD_한국어-요약명.md` 검증으로 교체한다.
  - 새 raw filename policy 문서에 `YYYYMMDD_NN`이 기본 규칙으로 남지 않음을 검증한다.
  - split 예시가 `YYYYMMDD_sourcekey_part` 형태임을 검증한다.

**자동 갱신할 generated mirror**

- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

---

### Task 1: 기준 상태 확인

**Files:**
- Read: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Read: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Read: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`
- Read: `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
- Read: `D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs`

- [ ] **Step 1: working tree가 확인된다**

Run:

```powershell
git -C D:/vibe-coding/llm-wiki-my status --short
```

Expected:

```markdown
docs/20260521_01_LLM-Wiki-raw-파일명-NN-제거-구현계획.md
```

또는 사용자의 병행 변경이 있을 수 있다. 구현 시 이번 계획 파일과 아래 Files에 명시된 대상만 수정한다.

- [ ] **Step 2: 현재 `NN` 사용 지점이 확인된다**

Run:

```powershell
rg -n "YYYYMMDD_NN|\\d\\{8\\}_\\d\\{2\\}|nextSequence|Raw filenames normalized to YYYYMMDD_NN|20260520_01_" D:/vibe-coding/llm-wiki-my/claude-plugin D:/vibe-coding/llm-wiki-my/scripts D:/vibe-coding/llm-wiki-my/tests
```

Expected: `ingest`, `ingestion`, `wiki-structure`, `split-markdown-source.mjs`, `migrate-raw-filenames.mjs`, 관련 tests에서 현재 `NN` 규칙이 확인된다.

- [ ] **Step 3: 기준 테스트가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected:

```markdown
PASS: split markdown source
PASS: raw filename migration
103 passed, 0 failed
```

---

### Task 2: 테스트를 새 filename 정책으로 먼저 변경

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`

- [ ] **Step 1: split test expected filename이 `NN` 없는 형태가 된다**

In `tests/test-split-markdown-source.mjs`, replace expected matches and file list with:

```javascript
assert.match(dryRun, /20260520_테스트책_00_프롤로그\.md/);
await assert.rejects(fs.access(path.join(wiki, "raw", "notes", "20260520_테스트책_00_프롤로그.md")));

const files = await fs.readdir(path.join(wiki, "raw", "notes"));
assert.deepEqual(files.sort(), [
  "20260520_테스트책_00_프롤로그.md",
  "20260520_테스트책_01_첫-하위-목차.md",
  "20260520_테스트책_02_둘째-하위-목차.md",
  "20260520_테스트책_99_에필로그.md",
]);

const prologue = await fs.readFile(path.join(wiki, "raw", "notes", "20260520_테스트책_00_프롤로그.md"), "utf8");
const firstSection = await fs.readFile(path.join(wiki, "raw", "notes", "20260520_테스트책_01_첫-하위-목차.md"), "utf8");
```

- [ ] **Step 2: split collision test가 추가된다**

Append after the existing split assertions:

```javascript
execFileSync(
  "node",
  [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-key", "테스트책", "--split-heading", "3", "--date", "20260520", "--apply"],
  { encoding: "utf8" }
);

const filesAfterSecondRun = await fs.readdir(path.join(wiki, "raw", "notes"));
assert.ok(filesAfterSecondRun.includes("20260520_테스트책_00_프롤로그_02.md"));
assert.ok(filesAfterSecondRun.includes("20260520_테스트책_01_첫-하위-목차_02.md"));
```

Expected: 현재 구현에서는 이 테스트가 실패한다.

- [ ] **Step 3: migration test expected filename이 `NN` 없는 형태가 된다**

In `tests/test-raw-filename-migration.mjs`, replace:

```javascript
await fs.access(path.join(wiki, "raw", "notes", "20260520_01_기존-노트.md"));
const article = await fs.readFile(path.join(wiki, "wiki", "concepts", "sample.md"), "utf8");
assert.match(article, /raw\/notes\/20260520_01_기존-노트\.md/);
assert.match(article, /\.\.\/\.\.\/raw\/notes\/20260520_01_기존-노트\.md/);
const rawIndex = await fs.readFile(path.join(wiki, "raw", "notes", "_index.md"), "utf8");
assert.match(rawIndex, /20260520_01_기존-노트\.md/);
assert.match(log, /Raw filenames normalized to YYYYMMDD_NN/);
```

With:

```javascript
await fs.access(path.join(wiki, "raw", "notes", "20260520_기존-노트.md"));
const article = await fs.readFile(path.join(wiki, "wiki", "concepts", "sample.md"), "utf8");
assert.match(article, /raw\/notes\/20260520_기존-노트\.md/);
assert.match(article, /\.\.\/\.\.\/raw\/notes\/20260520_기존-노트\.md/);
const rawIndex = await fs.readFile(path.join(wiki, "raw", "notes", "_index.md"), "utf8");
assert.match(rawIndex, /20260520_기존-노트\.md/);
const log = await fs.readFile(path.join(wiki, "log.md"), "utf8");
assert.match(log, /Raw filenames normalized to YYYYMMDD/);
```

- [ ] **Step 4: `YYYYMMDD_NN_...` migration fixture가 추가된다**

Add a second legacy raw file before dry-run:

```javascript
await fs.writeFile(
  path.join(wiki, "raw", "notes", "20260520_01_이미-순번-있는-노트.md"),
  `---
title: "이미 순번 있는 노트"
source: "MANUAL"
type: notes
ingested: 2026-05-20
tags: [test]
summary: "기존 YYYYMMDD_NN 파일명 마이그레이션 테스트"
---

# 이미 순번 있는 노트
`,
  "utf8"
);
```

After apply, add:

```javascript
await fs.access(path.join(wiki, "raw", "notes", "20260520_이미-순번-있는-노트.md"));
await assert.rejects(fs.access(path.join(wiki, "raw", "notes", "20260520_01_이미-순번-있는-노트.md")));
```

- [ ] **Step 5: plugin validation checks가 새 정책을 요구한다**

In `tests/test-plugin-validate.sh`, replace `YYYYMMDD_NN` policy assertions with:

```bash
assert_contains "$PLUGIN_DIR/commands/ingest.md" "YYYYMMDD_한국어-요약명\\.md|YYYYMMDD_" "ingest command documents YYYYMMDD raw filename defaults"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "YYYYMMDD_한국어-요약명\\.md|YYYYMMDD_" "ingestion protocol documents YYYYMMDD filename defaults"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "YYYYMMDD_한국어-요약명\\.md|YYYYMMDD_" "wiki structure documents YYYYMMDD filename policy"
assert_not_contains "$PLUGIN_DIR/commands/ingest.md" "Generate filename: .*YYYYMMDD_NN_한국어-요약명\\.md" "ingest command no longer uses daily sequence raw filenames"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "Generate raw source filenames as `YYYYMMDD_NN_한국어-요약명\\.md`" "ingestion protocol no longer uses daily sequence filename defaults"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "Raw sources.*YYYYMMDD_NN_한국어-요약명\\.md" "wiki structure no longer uses daily sequence raw filename policy"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "YYYYMMDD_sourcekey_00_프롤로그\\.md|YYYYMMDD_sourcekey" "ingestion protocol documents split filenames without daily sequence"
```

- [ ] **Step 6: 테스트가 실패하는지 확인된다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: split/migration/plugin validation 중 1개 이상이 실패한다. 실패 이유는 아직 구현과 문서가 `YYYYMMDD_NN`을 사용하기 때문이다.

---

### Task 3: split script에서 일일 순번 제거

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`

- [ ] **Step 1: `nextSequence()`가 제거된다**

Remove:

```javascript
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
```

- [ ] **Step 2: collision suffix helper가 추가된다**

Add after `sanitizeSectionHeading()`:

```javascript
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
```

- [ ] **Step 3: filename generation이 `YYYYMMDD_sourcekey_part`가 된다**

Replace in `main()`:

```javascript
let seq = await nextSequence(rawDir, args.date);
let regular = 1;
```

With:

```javascript
let regular = 1;
const reserved = new Set();
```

Replace the `files = parts.map(...)` block with an async loop:

```javascript
const files = [];
for (const part of parts) {
  const partLabel = part.specialIndex || String(regular++).padStart(2, "0");
  const baseName = `${args.date}_${sourceKey}_${partLabel}_${sanitizeSectionHeading(part.heading)}.md`;
  const filename = await uniqueFilename(rawDir, baseName, reserved);
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
  files.push({ relPath, body, heading: part.heading, parent: part.parent || null });
}
```

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

### Task 4: migration script를 `YYYYMMDD_...` canonical로 변경

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs`

- [ ] **Step 1: filename date parser가 새 canonical과 old NN을 모두 인식한다**

Replace `toIsoDateFromFilename()` with:

```javascript
function toIsoDateFromFilename(name) {
  const dashed = name.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  const ymd = name.match(/^(\d{8})_/);
  if (ymd) return `${ymd[1].slice(0, 4)}-${ymd[1].slice(4, 6)}-${ymd[1].slice(6, 8)}`;
  return null;
}
```

- [ ] **Step 2: canonical 판단 helper가 추가된다**

Add after `sanitizeTitle()`:

```javascript
function isCanonicalRawFilename(name) {
  return /^\d{8}_(?!\d{2}_).+\.md$/.test(name);
}

function titleFromFilename(name) {
  return name
    .replace(/\.md$/, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/^\d{8}_\d{2}_/, "")
    .replace(/^\d{8}_/, "");
}

function uniqueName(baseName, used) {
  const parsed = path.parse(baseName);
  let candidate = baseName;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${parsed.name}_${String(suffix).padStart(2, "0")}${parsed.ext}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}
```

- [ ] **Step 3: `buildMapping()`이 NN 없는 filename을 생성한다**

In `buildMapping()`, remove the `byDateSeq` map block entirely.

Replace:

```javascript
if (/^\d{8}_\d{2}_/.test(entry.name)) continue;
```

With:

```javascript
if (isCanonicalRawFilename(entry.name)) continue;
```

Replace:

```javascript
const next = (byDateSeq.get(ymd) || 0) + 1;
byDateSeq.set(ymd, next);
const title = sanitizeTitle(frontmatterValue(text, "title") || entry.name.replace(/\.md$/, ""));
const newName = `${ymd}_${String(next).padStart(2, "0")}_${title}.md`;
if (used.has(newName)) throw new Error(`Collision: ${path.join(dir, newName)}`);
used.add(newName);
```

With:

```javascript
const title = sanitizeTitle(frontmatterValue(text, "title") || titleFromFilename(entry.name));
const newName = uniqueName(`${ymd}_${title}.md`, used);
```

- [ ] **Step 4: migration log 문구가 바뀐다**

Replace:

```javascript
`\\n## [${kstIsoDate()}] migrate | Raw filenames normalized to YYYYMMDD_NN (${mapping.length} files)\\n`
```

With:

```javascript
`\\n## [${kstIsoDate()}] migrate | Raw filenames normalized to YYYYMMDD (${mapping.length} files)\\n`
```

- [ ] **Step 5: migration test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs
```

Expected:

```markdown
PASS: raw filename migration
```

---

### Task 5: command/reference 문서에서 `NN` 기본 규칙 제거

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

- [ ] **Step 1: ingest command filename rule이 교체된다**

In `claude-plugin/commands/ingest.md`, replace the filename rule with:

```markdown
1. Generate filename: `YYYYMMDD_한국어-요약명.md` by default. Use the KST date for `YYYYMMDD`. Use Korean for human-facing filenames when the source title or user context is Korean. Allowed characters are Korean letters, ASCII letters and digits, `_`, `-`, and `.`. Use `_` for structural separation such as date, source key, and split part number; use `-` only inside the human title when useful. Remove forbidden characters. If the target filename already exists, append `_02`, `_03`, etc. Preserve existing raw filenames; this rule applies to new ingests only.
```

- [ ] **Step 2: ingestion reference filename generation이 교체된다**

In `references/ingestion.md`, replace `## Filename Generation` with:

```markdown
## Filename Generation

1. Generate raw source filenames as `YYYYMMDD_한국어-요약명.md` by default.
2. Use the KST date for `YYYYMMDD`.
3. Keep the human title concise enough that the full filename remains readable.
4. Allowed characters are Korean letters, ASCII letters and digits, `_`, `-`, and `.`.
5. Use `_` for structural separation such as date, source key, and split part number. Use `-` only inside the human title when useful.
6. If the target filename already exists, append `_02`, `_03`, etc. Do not create a daily sequence for every ingest.
7. Example: "Attention Is All You Need" ingested on 2026-05-20 becomes `20260520_Attention-Is-All-You-Need.md`.
8. Example: "LLM 위키 설계 메모" becomes `20260520_LLM-위키-설계-메모.md`.
9. This canonicalization applies to new ingests. If a legacy or imported raw file already exists with spaces, title case, an older `YYYY-MM-DD-` prefix, or this fork's previous `YYYYMMDD_NN_` prefix, do not rename it during later maintenance; provenance workflows resolve exact paths and filename fallbacks per `wiki-structure.md` Source Reference Resolution.
```

- [ ] **Step 3: split 예시가 교체된다**

In `references/ingestion.md`, update examples:

```markdown
raw/notes/20260520_도그냥PO_00_프롤로그.md
raw/notes/20260520_도그냥PO_01_우물-안-일잘러-회사-밖에서도-일잘러를-꿈꾸다.md
raw/notes/20260520_도그냥PO_02_누가-우물-안-일잘러를-만드나.md
raw/notes/20260520_도그냥PO_03_우물-안-일잘러의-위기.md
raw/notes/20260520_도그냥PO_04_우물-탈출을-방해하는-에고와의-싸움.md
raw/notes/20260520_도그냥PO_05_터부시하는-부정적-감정이-성장을-만들어-낼-때.md
raw/notes/20260520_도그냥PO_06_헤드헌터보다-유능한-커피-한-잔_커피챗.md
```

- [ ] **Step 4: wiki structure filename policy가 교체된다**

In `references/wiki-structure.md`, replace raw source bullet with:

```markdown
- **Raw sources**: `YYYYMMDD_한국어-요약명.md` by default for Korean workspaces. `YYYYMMDD` uses the KST date. If the target filename already exists, append `_02`, `_03`, etc. Do not create a daily sequence for every ingest.
```

Replace source reference fallback wording with:

```markdown
Also compare candidate stems after removing a leading `YYYY-MM-DD-` date prefix, this fork's previous `YYYYMMDD_NN_` prefix, or the current `YYYYMMDD_` prefix.
```

- [ ] **Step 5: lint guidance가 old NN을 migration candidate로 다룬다**

In `claude-plugin/commands/lint.md`, change legacy filename guidance to:

```markdown
If legacy raw filenames such as `YYYY-MM-DD-slug.md` or this fork's previous `YYYYMMDD_NN_slug.md` are found, do not rename them during ordinary lint repair. Report them as migration candidates and suggest running `node scripts/migrate-raw-filenames.mjs --wiki <wiki-root> --dry-run`. Apply mode requires explicit user approval because it rewrites raw paths referenced from `wiki/`, `output/`, indexes, and log entries.
```

- [ ] **Step 6: plugin validation이 통과한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected:

```markdown
0 failed
```

---

### Task 6: 실제 운영 wiki raw 파일 마이그레이션

**Files:**
- External data target: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`
- Rename/update under: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/`
- Rewrite references in: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/log.md`
- Rewrite references in: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/_index.md`
- Rewrite references in: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/articles/_index.md`
- Rewrite references in: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/notes/_index.md`
- Rewrite references in wiki articles containing raw source refs

- [ ] **Step 1: 실제 운영 wiki의 migration 전 상태가 기록된다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
$rawMd = rg --files "$wiki/raw" | Where-Object { $_ -match '\.md$' -and $_ -notmatch '[\\/]_index\.md$' }
$legacyDashed = $rawMd | Where-Object { $_ -match '[\\/]\d{4}-\d{2}-\d{2}-[^\\/]+\.md$' }
$yyyyMMddNn = $rawMd | Where-Object { $_ -match '[\\/]\d{8}_\d{2}_[^\\/]+\.md$' }
$yyyyMMddNoNn = $rawMd | Where-Object { $_ -match '[\\/]\d{8}_(?!\d{2}_)[^\\/]+\.md$' }
[pscustomobject]@{
  raw_md=($rawMd|Measure-Object).Count
  legacy_dashed=($legacyDashed|Measure-Object).Count
  yyyyMMdd_NN=($yyyyMMddNn|Measure-Object).Count
  yyyyMMdd_noNN=($yyyyMMddNoNn|Measure-Object).Count
} | ConvertTo-Json
```

Expected:

```json
{
  "raw_md": 31,
  "legacy_dashed": 31,
  "yyyyMMdd_NN": 0,
  "yyyyMMdd_noNN": 0
}
```

- [ ] **Step 2: 운영 wiki의 git/백업 상태가 확인된다**

Run:

```powershell
$project='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H'
git -C "$project" rev-parse --show-toplevel
git -C "$project" status --short -- .wiki
```

Expected:

```markdown
git root is printed
status output is recorded before migration
```

If `.wiki` has unrelated uncommitted changes that are not part of this migration, stop and report them before apply. If the folder is not in a git repo, create a timestamped copy outside `.wiki` before apply:

```powershell
$project='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = "$project/.wiki_backup_before_raw_filename_migration_$stamp"
Copy-Item -LiteralPath "$project/.wiki" -Destination $backup -Recurse
$backup
```

Expected: backup path is printed and recorded in `## 수행 결과`.

- [ ] **Step 3: Obsidian wikilink risk가 확인된다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
rg -n "\[\[(2026-05-20-|raw/)" "$wiki" -g "*.md"
```

Expected:

```markdown
no matches
```

If matches exist, stop and update the migration approach to preserve those wikilinks before applying raw file renames. The migration script rewrites raw path references and markdown basename links; it is not a general Obsidian wikilink rename tool.

- [ ] **Step 4: 새 migration script dry-run이 no-NN mapping을 출력한다**

Run after Task 4 is implemented:

```powershell
node D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs --wiki "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki" --dry-run
```

Expected:

```markdown
"count": 31
newRel values start with raw/articles/20260520_ or raw/notes/20260520_
newRel values do not match raw/.*/20260520_[0-9][0-9]_
duplicate titles use _02, _03 suffix only when needed
```

- [ ] **Step 5: dry-run mapping을 문서에 기록한다**

Add to `## 수행 결과` later:

```markdown
### 운영 wiki migration dry-run

대상: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`

| 항목 | 값 | 판정 |
|---|---:|---|
| raw migration 대상 | 31 | ✅ 확인 |
| articles | 10 | ✅ 확인 |
| notes | 21 | ✅ 확인 |
| `YYYYMMDD_NN` 신규 매핑 | 0 | ✅ 제거 |
| backup/git 상태 | `<git status 또는 backup path>` | ✅ 기록 |
```

- [ ] **Step 6: 실제 운영 wiki에 migration apply가 실행된다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs --wiki "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki" --apply
```

Expected:

```markdown
"mode": "apply"
"count": 31
```

- [ ] **Step 7: migration 후 raw filename 상태가 새 정책과 일치한다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
$rawMd = rg --files "$wiki/raw" | Where-Object { $_ -match '\.md$' -and $_ -notmatch '[\\/]_index\.md$' }
$legacyDashed = $rawMd | Where-Object { $_ -match '[\\/]\d{4}-\d{2}-\d{2}-[^\\/]+\.md$' }
$yyyyMMddNn = $rawMd | Where-Object { $_ -match '[\\/]\d{8}_\d{2}_[^\\/]+\.md$' }
$yyyyMMddNoNn = $rawMd | Where-Object { $_ -match '[\\/]\d{8}_(?!\d{2}_)[^\\/]+\.md$' }
[pscustomobject]@{
  raw_md=($rawMd|Measure-Object).Count
  legacy_dashed=($legacyDashed|Measure-Object).Count
  yyyyMMdd_NN=($yyyyMMddNn|Measure-Object).Count
  yyyyMMdd_noNN=($yyyyMMddNoNn|Measure-Object).Count
} | ConvertTo-Json
```

Expected:

```json
{
  "raw_md": 31,
  "legacy_dashed": 0,
  "yyyyMMdd_NN": 0,
  "yyyyMMdd_noNN": 31
}
```

- [ ] **Step 8: raw path 참조 rewrite가 완료됐음이 확인된다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
rg -n "raw/(articles|notes)/(2026-05-20-|20260520_[0-9][0-9]_)" "$wiki" -g "*.md"
rg -n "\]\((2026-05-20-|20260520_[0-9][0-9]_)" "$wiki/raw" -g "_index.md"
```

Expected:

```markdown
no matches
```

- [ ] **Step 9: 일반 날짜 문자열이 아닌 파일명 패턴만 남지 않았음이 확인된다**

Run:

```powershell
$wiki='C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki'
rg -n "[\\/](2026-05-20-|20260520_[0-9][0-9]_)[^\\/]+\.md|](<?(2026-05-20-|20260520_[0-9][0-9]_)[^>)]+\.md>?\)" "$wiki" -g "*.md"
```

Expected:

```markdown
no matches
```

- [ ] **Step 10: migration log가 남는다**

Run:

```powershell
Select-String -LiteralPath "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/log.md" -Pattern "Raw filenames normalized to YYYYMMDD"
```

Expected:

```markdown
Raw filenames normalized to YYYYMMDD (31 files)
```

---

### Task 7: mirror sync 및 전체 검증

**Files:**
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

- [ ] **Step 1: Codex mirror가 재생성된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh
```

Expected: exit code 0.

- [ ] **Step 2: OpenCode mirror가 재생성된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-opencode-plugin.sh
```

Expected: exit code 0.

- [ ] **Step 3: mirror에 새 규칙이 반영됐음이 확인된다**

Run:

```powershell
rg -n "YYYYMMDD_한국어|YYYYMMDD_sourcekey|YYYYMMDD_NN" D:/vibe-coding/llm-wiki-my/plugins/llm-wiki D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode
```

Expected:

```markdown
YYYYMMDD_한국어 and YYYYMMDD_sourcekey matches exist.
YYYYMMDD_NN appears only as legacy/previous-policy wording, not as the default filename rule.
```

- [ ] **Step 4: 전체 검증이 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-structure.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh
```

Expected:

```markdown
PASS: split markdown source
PASS: raw filename migration
test-plugin-validate.sh: 0 failed
test-structure.sh: 0 failed
test-local-cli-lint.sh: 0 failed
```

- [ ] **Step 5: sync gate는 커밋 상태에 맞게 판정된다**

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

If these tests fail only because generated mirror files are uncommitted, record that explicitly and rerun after commit.

---

### Task 8: 수행 결과 문서 업데이트

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/docs/20260521_01_LLM-Wiki-raw-파일명-NN-제거-구현계획.md`

- [ ] **Step 1: `수행 결과` 섹션이 추가된다**

Append:

```markdown
## 수행 결과

작성 시점: 2026-05-21 KST

### 구현 완료

- raw filename 기본 규칙을 `YYYYMMDD_...`로 변경했다.
- split filename을 `YYYYMMDD_sourcekey_part_...`로 변경했다.
- 기존 `YYYYMMDD_NN_...`는 migration 대상 legacy filename으로 처리한다.
- 충돌 시 `_02`, `_03` suffix를 붙이도록 script/test를 반영했다.
- 실제 운영 wiki `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`의 raw 31개를 새 filename 정책으로 migration했다.

### 검증 결과

| 검증 | 결과 | 판정 |
|---|---:|---|
| split test | `PASS` | ✅ 통과 |
| migration test | `PASS` | ✅ 통과 |
| plugin validate | `0 failed` | ✅ 통과 |
| structure | `0 failed` | ✅ 통과 |
| local CLI lint | `0 failed` | ✅ 통과 |
| 운영 wiki migration | `legacy_dashed=0`, `yyyyMMdd_NN=0`, `yyyyMMdd_noNN=31` | ✅ 통과 |
| 운영 wiki legacy reference scan | `no matches` | ✅ 통과 |
| mirror sync | `OK` 또는 commit gate 사유 기록 | ✅/⚠️ |
```

- [ ] **Step 2: 도그냥PO 예시가 새 filename으로 기록된다**

Add:

```markdown
raw/notes/20260520_도그냥PO_00_프롤로그.md
raw/notes/20260520_도그냥PO_01_우물-안-일잘러-회사-밖에서도-일잘러를-꿈꾸다.md
raw/notes/20260520_도그냥PO_02_누가-우물-안-일잘러를-만드나.md
```

- [ ] **Step 3: 문서 검증이 통과한다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/docs/20260521_01_LLM-Wiki-raw-파일명-NN-제거-구현계획.md -Pattern '## 수행 결과|20260520_도그냥PO_00_프롤로그|YYYYMMDD_sourcekey'
```

Expected: all patterns are present.

---

### Task 9: 커밋 준비

**Files:**
- Changed files from Tasks 2-7

- [ ] **Step 1: 보안 점검은 커밋 흐름 안에서 실행된다**

Do not run `git add` or `git commit` directly. When the user requests a commit, use the `cp` skill. After files are staged by that flow and before commit finalization, run:

```powershell
node C:/Users/ahnbu/.claude/skills/_shared/security-gate.mjs precommit --repo D:/vibe-coding/llm-wiki-my --staged
```

Expected: no secret, credential, suspicious install script, or external transfer risk is reported.

- [ ] **Step 2: 권장 커밋 메시지가 준비된다**

Recommended commit message:

```markdown
refactor(ingest): raw 파일명 일일 순번 제거 — 파일명 의미와 책 분할 가독성 개선
```

Expected: filename policy, split script, migration script/test, docs, generated mirror만 한 커밋에 포함된다.

---

## 수행 결과

작성 시점: 2026-05-21 KST

### 구현 완료

- raw filename 기본 규칙을 `YYYYMMDD_...`로 변경했다.
- split filename을 `YYYYMMDD_sourcekey_part_...`로 변경했다.
- 기존 `YYYY-MM-DD-...`와 `YYYYMMDD_NN_...`는 migration 대상 legacy filename으로 처리하도록 변경했다.
- filename 충돌 시 일일 순번 대신 `_02`, `_03` suffix를 붙이도록 split/migration script와 test를 수정했다.
- 실제 운영 wiki `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`의 raw 31개를 새 filename 정책으로 migration했다.

### 운영 wiki migration 결과

사전 백업:

```markdown
C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki_backup_before_raw_filename_migration_20260521_103855
```

| 확인 항목 | 결과 | 판정 |
|---|---:|---|
| dry-run mapping | 31개 | ✅ 적용 대상 확인 |
| apply mapping | 31개 | ✅ 실제 rename 완료 |
| raw markdown | 31개 | ✅ 유지 |
| `articles` raw | 10개 | ✅ 유지 |
| `notes` raw | 21개 | ✅ 유지 |
| legacy dashed filename | 0개 | ✅ 제거 |
| `YYYYMMDD_NN` filename | 0개 | ✅ 제거 |
| `YYYYMMDD_...` filename | 31개 | ✅ 적용 |
| 재실행 dry-run | 0개 | ✅ 추가 migration 대상 없음 |
| legacy raw path reference scan | no matches | ✅ 참조 rewrite 완료 |
| raw index legacy link scan | no matches | ✅ index link rewrite 완료 |
| migration log | `Raw filenames normalized to YYYYMMDD (31 files)` | ✅ 기록 |

운영 wiki의 실제 filename 예시:

```markdown
raw/articles/20260520_다우기술-신입-입문교육-강사-프로필-커리큘럼-통합본.md
raw/articles/20260520_다우기술-신입-입문교육-강사-프로필-커리큘럼-통합본_02.md
raw/notes/20260520_다우기술-신입-입문교육-고객-원문-기반-요구사항-정리.md
raw/notes/20260520_다우기술-신입-입문교육-요구사항-잠금과-제로베이스-뼈대.md
```

### 책 분할 filename 예시

도그냥PO 문서를 chapter 하위 목차 기준으로 split하면 새 규칙에서는 다음처럼 생성된다.

```markdown
raw/notes/20260520_도그냥PO_00_프롤로그.md
raw/notes/20260520_도그냥PO_01_우물-안-일잘러-회사-밖에서도-일잘러를-꿈꾸다.md
raw/notes/20260520_도그냥PO_02_누가-우물-안-일잘러를-만드나.md
raw/notes/20260520_도그냥PO_03_우물-안-일잘러의-위기.md
raw/notes/20260520_도그냥PO_04_우물-탈출을-방해하는-에고와의-싸움.md
raw/notes/20260520_도그냥PO_05_터부시하는-부정적-감정이-성장을-만들어-낼-때.md
raw/notes/20260520_도그냥PO_06_헤드헌터보다-유능한-커피-한-잔_커피챗.md
```

### 검증 결과

| 검증 | 결과 | 판정 |
|---|---:|---|
| `node tests/test-split-markdown-source.mjs` | `PASS` | ✅ 통과 |
| `node tests/test-raw-filename-migration.mjs` | `PASS` | ✅ 통과 |
| `bash tests/test-plugin-validate.sh` | 107 passed, 0 failed | ✅ 통과 |
| `bash tests/test-structure.sh` | 170 passed, 0 failed | ✅ 통과 |
| `bash tests/test-local-cli-lint.sh` | 21 passed, 0 failed | ✅ 통과 |
| `bash scripts/sync-codex-plugin.sh` | regenerated Codex mirror | ✅ 완료 |
| `bash scripts/sync-opencode-plugin.sh` | regenerated OpenCode mirror | ✅ 완료 |
| `bash tests/test-opencode-sync.sh` | `OK` | ✅ 통과 |
| `bash tests/test-codex-sync.sh` | generated mirror diff remains before commit | ⚠️ 커밋 전 gate |

`test-codex-sync.sh`는 `plugins/llm-wiki/`가 `HEAD`와 다르면 실패하도록 설계된 커밋 전 gate다. 이번 변경에서 Codex mirror가 실제로 갱신되었으므로, 커밋 전에는 실패가 정상이고 같은 커밋에 mirror diff를 포함한 뒤 재실행해야 한다.

### 잔여 한계

- 운영 wiki `.wiki`는 상위 git repo 기준 아직 untracked 상태다. 이번 작업에서는 요청 범위대로 실제 파일 migration과 검증만 수행했고, commit/stage는 하지 않았다.
- 기존 raw frontmatter의 `title` 자체가 긴 파일은 migration 후 filename도 길 수 있다. 이번 작업 범위는 `NN` 제거와 참조 보존이며, 제목 재작성 정책은 별도 설계가 필요하다.
- 공유 출력 경로를 재생성하는 `test-plugin-validate.sh`와 `test-codex-sync.sh`는 병렬 실행 대상이 아니다. 순차 재검증에서 `test-plugin-validate.sh`는 통과했다.

### done-check-lite 검토 반영

| 점검 항목 | 판정 | 반영 내용 |
|---|---|---|
| 운영 wiki 실제 migration | ✅ 완료 | raw 31개가 `YYYYMMDD_...`로 migration됐고 legacy filename/reference가 남지 않음을 재확인했다. |
| 계획 문서 수행 결과 업데이트 | ✅ 완료 | `## 수행 결과`에 백업 경로, migration 수량, 검증 결과, 도그냥PO split 예시를 기록했다. |
| Codex mirror sync gate 표현 | ⚠️ 주의 | `test-codex-sync.sh`는 커밋 전 `HEAD` diff 때문에 실패하는 gate임을 명시했다. 이를 전체 테스트 통과로 오해하지 않도록 검증 결과와 잔여 한계에 분리 표기했다. |
| 커밋 여부 | ⚠️ 범위 외 | 사용자가 이번 턴에 커밋을 요청하지 않았으므로 stage/commit은 수행하지 않았다. 커밋 시 같은 변경 묶음에 Codex mirror diff를 포함하고 sync gate를 재실행해야 한다. |

## Self-Review

- `NN` 제거 요구사항은 Task 2-5에서 tests, scripts, docs 모두에 반영된다.
- split part label `00`, `01`, `99`는 유지되므로 책 분할 순서는 보존된다.
- 충돌 방지는 Task 3-4에서 `_02` suffix로 대체된다.
- 기존 `YYYYMMDD_NN_...` 파일은 자동 rename하지 않고 migration script의 명시적 apply 대상으로 남긴다.
- 실제 운영 wiki `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`의 raw 31개 migration은 Task 6에서 dry-run, apply, post-check까지 검증한다.
- `book` raw type 추가 금지는 변경하지 않는다.
- mirror sync와 검증은 Task 7에서 닫는다.
- 커밋은 직접 git 명령이 아니라 `cp` 스킬 흐름으로 제한했다.

## 계획 반영 근거

| 확인 항목 | 확인 결과 | 계획 반영 |
|---|---:|---|
| 실제 운영 wiki 경로 | `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki` | Task 6에 실제 apply 대상을 명시 |
| 운영 wiki raw markdown | 31개 | migration 완료 기준에 `raw_md=31` 반영 |
| legacy dashed filename | 31개 | 완료 기준에 `legacy_dashed=0` 반영 |
| `YYYYMMDD_NN` filename | 0개 | 새 정책 적용 후에도 `yyyyMMdd_NN=0` 유지 |
| `YYYYMMDD` no-NN filename | 0개 | 완료 기준에 `yyyyMMdd_noNN=31` 반영 |
| raw type 분포 | `articles` 10개, `notes` 21개 | type별 raw rename 검증에 반영 |
| legacy 참조 포함 md 파일 | 9개 | 참조 rewrite 검증 대상에 반영 |
| legacy 참조 hit 수 | 173건 | migration 전후 `rg` hit count 검증에 반영 |
| 기존 script dry-run | 31개를 `YYYYMMDD_NN`으로 매핑 | Task 4에서 script 정책을 먼저 고친 뒤 실제 apply하도록 순서 보정 |

관련 문서:

- `D:/vibe-coding/llm-wiki-my/docs/20260520_02_LLM-Wiki-ingest-파일명-책분할-구현계획.md`
- `D:/vibe-coding/llm-wiki-my/docs/20260521_01_LLM-Wiki-raw-파일명-NN-제거-구현계획.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/log.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/_index.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/articles/_index.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/raw/notes/_index.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/wiki/references/다우기술_원천자료_활용지도.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/wiki/topics/커리큘럼_변천과_정본.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/wiki/topics/다우기술_교육요구사항.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/wiki/concepts/신입_개발자_실습설계.md`
- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki/wiki/concepts/기획우선_AI협업.md`
