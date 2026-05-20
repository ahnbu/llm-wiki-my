---
title: LLM Wiki ingest 파일명 규칙 및 책 분할 기능 구현계획
created: 2026-05-20 19:21
tags:
  - llm-wiki
  - implementation-plan
session_id: codex:019e4497-2a07-7402-9a99-e8ca3c0db960
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/20/rollout-2026-05-20T17-53-37-019e4497-2a07-7402-9a99-e8ca3c0db960.jsonl
ai: codex
---

# LLM Wiki ingest 파일명 규칙 및 책 분할 기능 구현계획 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `llm-wiki-my`의 raw ingest 파일명을 `YYYYMMDD_NN_한국어-요약명.md`로 고정하고, 긴 책/문서 Markdown을 사용자가 지정한 heading level 기준으로 여러 raw note source로 분할 저장하며, 이미 ingest된 raw 파일도 wiki 참조를 보존한 채 같은 파일명 포맷으로 마이그레이션할 수 있게 한다.

**Architecture:** `claude-plugin/`가 source of truth이고 `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/`는 sync script로 재생성한다. `book` 또는 `books` raw type은 추가하지 않는다. 책 분할은 agent가 수작업으로 파일을 나누는 방식이 아니라 `scripts/split-markdown-source.mjs`가 deterministic하게 수행하고, `ingest` protocol은 그 스크립트를 호출한 뒤 결과를 보완 점검하도록 지시한다. 기존 raw filename migration도 agent 수작업 rename이 아니라 deterministic dry-run/apply script로 수행하며, compiled `wiki/`, `output/`, index, log의 raw path 참조를 함께 갱신한다.

**Tech Stack:** Markdown command specs, wiki-manager reference docs, Node.js migration script/test, Bash grep validation, Codex/OpenCode plugin sync scripts.

---

## 구현 원칙

- 새 raw type `book`, `books` 또는 `raw/books/`를 만들지 않는다.
- 일반 ingest, lint, compile, query 중에는 날짜 없는 기존 raw 파일과 legacy filename을 rename하지 않는다.
- 단, 사용자가 마이그레이션을 명시 요청한 wiki에서는 dry-run mapping 확인 후 legacy raw filename을 새 포맷으로 rename할 수 있다.
- 파일명 날짜는 KST 기준 `YYYYMMDD`를 쓴다.
- frontmatter 날짜와 log 날짜는 기존 schema 호환을 위해 `YYYY-MM-DD`를 유지한다.
- `NN`은 대상 `raw/{type}/` 디렉터리 안에서 같은 날짜의 기존 파일명을 스캔해 다음 2자리 순번으로 생성한다.
- 책 split MVP는 Markdown heading이 있는 `.md`만 대상으로 한다. EPUB/PDF 자동 목차 추정은 이번 범위가 아니다.
- split 결과 생성은 반드시 `scripts/split-markdown-source.mjs`로 수행한다. agent가 직접 여러 raw 파일을 수작업 생성하지 않는다.
- split script는 원문을 요약·재작성하지 않고 heading별 원문 조각을 보존한다. agent는 생성 후 frontmatter summary/tag 보완과 index/log 확인만 수행한다.
- 기존 raw filename migration은 반드시 dry-run을 먼저 실행하고, 충돌·누락 참조·ambiguous reference가 있으면 apply를 중단한다.
- 커밋이 필요하면 직접 `git add/commit`을 하지 않고 `cp` 스킬을 사용한다.

## 파일 구조

**수정할 원본 파일**

- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
  - `argument-hint`에 `--split-heading <level>`을 추가한다.
  - raw filename 규칙을 `YYYYMMDD_NN_한국어-요약명.md`로 교체한다.
  - heading split 절차와 저장 규칙을 command protocol에 추가한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
  - Source Types에서 책 chapter는 `notes`로 처리한다고 명시한다.
  - Slug Generation을 Filename Generation으로 교체한다.
  - Markdown book split 프로토콜을 추가한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`
  - raw source filename 규칙을 `YYYYMMDD_NN_...`로 교체한다.
  - split chapter optional provenance fields를 설명한다.
  - source reference fallback에서 기존 `YYYY-MM-DD-` prefix만 가정하지 않도록 조정한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
  - legacy raw filename 발견 시 migration script dry-run을 제안하도록 lint guidance를 추가한다.

**생성할 migration script**

- `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
  - Markdown 파일과 heading level을 입력받아 `raw/{type}/YYYYMMDD_NN_...md` 파일들을 생성한다.
  - 파일명에는 짧은 source key를 사용하고, 전체 책 제목은 frontmatter `book_title`에 보존한다.
  - frontmatter, parent heading, part index, source path, split metadata를 결정적으로 기록한다.
  - 기본은 `--dry-run`이며, `--apply`가 있을 때만 raw files를 생성한다.
- `D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs`
  - wiki root를 입력받아 기존 raw filename을 `YYYYMMDD_NN_...`으로 바꾸는 mapping을 생성한다.
  - 기본은 `--dry-run`이며, `--apply`가 있을 때만 rename과 reference rewrite를 수행한다.
  - raw file rename, raw index rebuild/rewrite, master index rewrite, `wiki/**/*.md` sources/link rewrite, `output/**/*.md` reference rewrite, `log.md` append를 담당한다.

**생성할 migration test**

- `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`
  - 임시 Markdown 책 fixture를 만들고 `--split-heading 3` 결과 파일명, frontmatter, 본문 보존을 검증한다.
- `D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs`
  - 임시 wiki fixture를 만들고 dry-run/apply 동작을 검증한다.

**수정할 테스트 파일**

- `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`
  - filename 정책이 `YYYYMMDD_NN`임을 검증한다.
  - `YYYY-MM-DD-한국어-요약명.md` 회귀를 막는다.
  - `--split-heading`, split script, `raw/notes/` book chapter 정책을 검증한다.
  - `raw/books/`, `type: book`, `type: books`가 추가되지 않았음을 검증한다.
- `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`
  - split script가 dry-run 기본값, apply 생성, parent heading metadata, 프롤로그/에필로그 예외를 만족하는지 검증한다.
- `D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs`
  - migration script가 dry-run 기본값, apply rewrite, 충돌 중단을 만족하는지 검증한다.

**자동 갱신될 생성물**

- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

---

### Task 1: 기준 상태 확인

**Files:**
- Read: `D:/vibe-coding/llm-wiki-my/AGENTS.md`
- Read: `D:/vibe-coding/llm-wiki-my/CLAUDE.md`
- Read: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Read: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Read: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

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

`status --short`에는 기존 사용자/다른 작업 변경이 있을 수 있다. 이번 구현은 이 계획의 Files에 적힌 파일만 의도적으로 수정한다.

- [ ] **Step 2: source of truth 원칙이 확인된다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/CLAUDE.md -Pattern 'source of truth|generated Codex packaging mirror|Do NOT hand-edit'
```

Expected: `claude-plugin/`가 source of truth이고 `plugins/llm-wiki/` mirror를 직접 수정하지 않는다는 의미의 줄이 나온다.

- [ ] **Step 3: 현재 파일명 규칙과 split 부재가 확인된다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md,D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md,D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md -Pattern 'YYYY-MM-DD-한국어|YYYY-MM-DD-|--split-heading|raw/books|type: book'
```

Expected:

```markdown
YYYY-MM-DD filename examples are present
--split-heading is absent
raw/books and type: book are absent
```

- [ ] **Step 4: 기존 구조 테스트가 먼저 실행된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-structure.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh
```

Expected:

```markdown
test-plugin-validate.sh: 0 failed
test-structure.sh: 0 failed
test-local-cli-lint.sh: 0 failed
```

---

### Task 2: 회귀 테스트 추가

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`

- [ ] **Step 1: grep helper가 dash-prefixed pattern을 처리한다**

Replace the two `grep -Eq "$pattern" "$file"` calls in `assert_contains` and `assert_not_contains` with:

```bash
grep -Eq -- "$pattern" "$file"
```

Expected: patterns such as `--split-heading <level>` are treated as search patterns, not grep options.

- [ ] **Step 2: filename 정책 검증이 추가된다**

In `--- ahnbu fork policy checks ---`, replace the existing ingest/wiki-structure filename checks with stricter checks:

```bash
assert_contains "$PLUGIN_DIR/commands/ingest.md" "YYYYMMDD_NN_한국어-요약명\\.md|YYYYMMDD_NN" "ingest command documents YYYYMMDD_NN raw filename defaults"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "YYYYMMDD_NN_한국어-요약명\\.md|YYYYMMDD_NN" "ingestion protocol documents YYYYMMDD_NN filename defaults"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "YYYYMMDD_NN_한국어-요약명\\.md|YYYYMMDD_NN" "wiki structure documents YYYYMMDD_NN filename policy"
assert_not_contains "$PLUGIN_DIR/commands/ingest.md" "Generate filename: .*YYYY-MM-DD-한국어-요약명\\.md" "ingest command no longer uses dashed date raw filenames"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "Prepend today's date: `YYYY-MM-DD-`" "ingestion protocol no longer uses dashed date slug generation"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "Raw sources.*YYYY-MM-DD-한국어-요약명\\.md" "wiki structure no longer uses dashed date raw filename policy"
```

- [ ] **Step 3: book split 정책 검증이 추가된다**

In the same section, add:

```bash
assert_contains "$PLUGIN_DIR/commands/ingest.md" "--split-heading <level>" "ingest command exposes heading split option"
assert_contains "$PLUGIN_DIR/commands/ingest.md" "split-markdown-source\\.mjs" "ingest command uses deterministic markdown split script"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "split-markdown-source\\.mjs" "ingestion protocol documents deterministic markdown split script"
assert_contains "$PLUGIN_DIR/commands/ingest.md" "raw/notes/|type: notes" "ingest command routes book chapters to notes"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "Book and Long Markdown Split|book chapter|책" "ingestion protocol documents book/chapter split"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "split_heading_level|split_part_index|split_part_total" "ingestion protocol preserves split provenance"
assert_not_contains "$PLUGIN_DIR/commands/ingest.md" "\\[--type [^]]*book" "ingest argument hint does not expose book raw type"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "type: articles\\|papers\\|repos\\|notes\\|data\\|book" "wiki structure raw type enum does not include book"
```

- [ ] **Step 4: 테스트가 실패하는지 확인된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: 아직 문서가 수정되지 않았으므로 새 filename 또는 split checks 중 1개 이상이 `FAIL`이다.

---

### Task 3: raw filename 규칙 수정

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

- [ ] **Step 1: `ingest.md` filename 규칙이 교체된다**

Replace:

```markdown
1. Generate filename: `YYYY-MM-DD-한국어-요약명.md` by default. Korean filename policy: use Korean for human-facing filenames when the source title or user context is Korean. Allowed characters are Korean letters, ASCII letters and digits, `_`, `-`, and `.`. Use `_` for structural separation, `-` for word separation, remove forbidden characters, and add a short numeric suffix on collisions. Preserve existing raw filenames; this rule applies to new ingests.
```

With:

```markdown
1. Generate filename: `YYYYMMDD_NN_한국어-요약명.md` by default. Use the KST date for `YYYYMMDD`. Generate `NN` by scanning the target `raw/{type}/` directory for existing files that start with the same date and taking the next 2-digit sequence. Use Korean for human-facing filenames when the source title or user context is Korean. Allowed characters are Korean letters, ASCII letters and digits, `_`, `-`, and `.`. Use `_` for structural separation such as date, sequence, book title, and part number; use `-` only inside the human title when useful. Remove forbidden characters and increment `NN` on collisions. Preserve existing raw filenames; this rule applies to new ingests only.
```

- [ ] **Step 2: `ingestion.md` Slug Generation 섹션이 교체된다**

Replace `## Slug Generation` section with:

```markdown
## Filename Generation

1. Generate raw source filenames as `YYYYMMDD_NN_한국어-요약명.md` by default.
2. Use the KST date for `YYYYMMDD`.
3. Generate `NN` from the target `raw/{type}/` directory:
   - scan existing files matching `^YYYYMMDD_[0-9][0-9]_.*\.md$`
   - take the highest sequence for that date
   - use the next number, zero-padded to 2 digits
4. For batch or split ingestion, reserve consecutive `NN` values in processing order.
5. Keep the human title concise enough that the full filename remains readable.
6. Allowed characters are Korean letters, ASCII letters and digits, `_`, `-`, and `.`.
7. Use `_` for structural separation such as date, sequence, source title, and part number. Use `-` only inside the human title when useful.
8. Example: "Attention Is All You Need" ingested on 2026-05-20 as the first paper of the day becomes `20260520_01_Attention-Is-All-You-Need.md`.
9. Example: "LLM 위키 설계 메모" ingested as the second note of the day becomes `20260520_02_LLM-위키-설계-메모.md`.
10. This canonicalization applies to new ingests. If a legacy or imported raw file already exists with spaces, title case, or an older `YYYY-MM-DD-` prefix, do not rename it during later maintenance; provenance workflows resolve exact paths and slug fallbacks per `wiki-structure.md` Source Reference Resolution.
```

- [ ] **Step 3: `wiki-structure.md` File Naming 섹션이 교체된다**

Replace the raw source filename bullet with:

```markdown
- **Raw sources**: `YYYYMMDD_NN_한국어-요약명.md` by default for Korean workspaces. `YYYYMMDD` uses the KST date. `NN` is the next 2-digit sequence in the target `raw/{type}/` directory for that date.
```

Keep the existing wiki article, inventory, dataset, and output bullets unless later requirements explicitly change them.

- [ ] **Step 4: source reference fallback 설명이 호환된다**

In `wiki-structure.md` Source Reference Resolution, replace wording that only mentions `YYYY-MM-DD-` prefix with:

```markdown
For legacy raw filenames, resolution may ignore a leading `YYYY-MM-DD-` prefix. For this fork's Korean raw filenames, resolution may also ignore a leading `YYYYMMDD_NN_` prefix when matching a human title fallback. Exact `sources:` paths remain preferred and must not be rewritten unless the target path is unambiguous.
```

- [ ] **Step 5: filename 관련 테스트가 통과한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: filename policy checks pass. Split checks may still fail.

---

### Task 4: Markdown split 스크립트 추가

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
- Create: `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

- [ ] **Step 1: split script가 생성된다**

Create `scripts/split-markdown-source.mjs` with these required behaviors:

```javascript
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
    throw new Error("Usage: node scripts/split-markdown-source.mjs --wiki <wiki-root> --source <file.md> --title <title> --split-heading <1-6> [--source-key <short-key>] [--type notes] [--date YYYYMMDD] [--dry-run|--apply]");
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

function splitMarkdown(markdown, level) {
  const lines = stripFrontmatter(markdown).split(/\r?\n/);
  const headingPattern = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`);
  const parentPattern = level > 1 ? new RegExp(`^#{1,${level - 1}}\\s+(.+?)\\s*$`) : null;
  const parts = [];
  let parent = "";
  let intro = [];
  let current = null;
  let special = null;

  for (const line of lines) {
    const parentMatch = parentPattern ? line.match(parentPattern) : null;
    const headingMatch = line.match(headingPattern);
    const lowerLevelHeading = parentMatch && !headingMatch ? parentMatch[1].trim() : "";
    if (headingMatch) {
      if (special) {
        parts.push(special);
        special = null;
      }
      if (current) {
        parts.push(current);
      }
      current = { heading: headingMatch[1].trim(), parent, lines: [line] };
      continue;
    }
    if (lowerLevelHeading) {
      if (/^프롤로그$/i.test(lowerLevelHeading) || /^에필로그$/i.test(lowerLevelHeading)) {
        if (current) {
          parts.push(current);
          current = null;
        }
        if (special) parts.push(special);
        special = {
          heading: lowerLevelHeading,
          parent: "",
          specialIndex: /^프롤로그$/i.test(lowerLevelHeading) ? "00" : "99",
          lines: [line],
        };
        parent = "";
        continue;
      }
      if (special) {
        parts.push(special);
        special = null;
      }
      if (current) {
        parts.push(current);
        current = null;
      }
      parent = lowerLevelHeading;
      continue;
    }
    if (special) {
      special.lines.push(line);
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  if (current) parts.push(current);
  if (special) parts.push(special);
  const introText = intro.join("\n").trim();
  if (introText && !parts.some((part) => part.specialIndex === "00")) {
    parts.unshift({ heading: "프롤로그", parent: "", specialIndex: "00", lines: ["## 원문 서문", "", introText] });
  }
  return parts.filter((part) => part.lines.join("\n").trim().length > 0);
}

function buildFrontmatter({ title, source, type, part, total, level, indexLabel }) {
  const summary = `${title} 중 '${part.heading}' 원문 조각`;
  const parent = part.parent ? `split_parent_heading: "${part.parent.replaceAll('"', '\\"')}"\n` : "";
  return `---
title: "${title} - ${indexLabel} ${part.heading.replaceAll('"', '\\"')}"
source: "${source.replaceAll('"', '\\"')}"
type: ${type}
ingested: ${kstIsoDate()}
tags: [book, chapter]
summary: "${summary.replaceAll('"', '\\"')}"
book_title: "${title.replaceAll('"', '\\"')}"
content_format: markdown
split_source: "${source.replaceAll('"', '\\"')}"
split_heading_level: ${level}
split_part_index: ${Number(indexLabel)}
split_part_total: ${total}
split_heading: "${part.heading.replaceAll('"', '\\"')}"
${parent}---

`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wikiRoot = path.resolve(args.wiki);
  const sourcePath = path.resolve(args.source);
  const rawDir = path.join(wikiRoot, "raw", args.type);
  const markdown = await fs.readFile(sourcePath, "utf8");
  const parts = splitMarkdown(markdown, args.level);
  if (parts.length === 0) throw new Error(`No heading level ${args.level} sections found`);

  const sourceKey = sanitize(args.sourceKey);
  let seq = await nextSequence(rawDir, args.date);
  const files = parts.map((part, idx) => {
    const partLabel = part.specialIndex || String(idx).padStart(2, "0");
    const seqLabel = String(seq++).padStart(2, "0");
    const filename = `${args.date}_${seqLabel}_${sourceKey}_${partLabel}_${sanitize(part.heading, "section")}.md`;
    const relPath = path.posix.join("raw", args.type, filename);
    const body = buildFrontmatter({
      title: args.title,
      source: sourcePath.replaceAll("\\", "/"),
      type: args.type,
      part,
      total: parts.length,
      level: args.level,
      indexLabel: partLabel,
    }) + part.lines.join("\n").trim() + "\n";
    return { relPath, body, heading: part.heading, parent: part.parent || null };
  });

  console.log(JSON.stringify({ mode: args.apply ? "apply" : "dry-run", count: files.length, files: files.map(({ relPath, heading, parent }) => ({ relPath, heading, parent })) }, null, 2));
  if (!args.apply) return;
  await fs.mkdir(rawDir, { recursive: true });
  for (const file of files) {
    await fs.writeFile(path.join(wikiRoot, file.relPath), file.body, "utf8");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: split script test가 생성된다**

Create `tests/test-split-markdown-source.mjs`:

```javascript
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
await fs.writeFile(source, `---
title: Fixture
---

# Book Title

## 프롤로그

프롤로그 본문

## Chapter 01. 첫 장

### 01 첫 하위 목차

첫 본문

### 02 둘째 하위 목차

둘째 본문

## 에필로그

에필로그 본문
`, "utf8");

const script = path.join(projectRoot, "scripts", "split-markdown-source.mjs");
const dryRun = execFileSync("node", [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-key", "테스트책", "--split-heading", "3", "--date", "20260520", "--dry-run"], { encoding: "utf8" });
assert.match(dryRun, /"mode": "dry-run"/);
assert.match(dryRun, /20260520_01_테스트책_00_프롤로그\.md/);
await assert.rejects(fs.access(path.join(wiki, "raw", "notes", "20260520_01_테스트책_00_프롤로그.md")));

execFileSync("node", [script, "--wiki", wiki, "--source", source, "--title", "테스트 책", "--source-key", "테스트책", "--split-heading", "3", "--date", "20260520", "--apply"], { encoding: "utf8" });
const files = await fs.readdir(path.join(wiki, "raw", "notes"));
assert.deepEqual(files.sort(), [
  "20260520_01_테스트책_00_프롤로그.md",
  "20260520_02_테스트책_01_첫-하위-목차.md",
  "20260520_03_테스트책_02_둘째-하위-목차.md",
  "20260520_04_테스트책_99_에필로그.md",
]);
const firstSection = await fs.readFile(path.join(wiki, "raw", "notes", "20260520_02_테스트책_01_첫-하위-목차.md"), "utf8");
assert.match(firstSection, /split_parent_heading: "Chapter 01\. 첫 장"/);
assert.match(firstSection, /book_title: "테스트 책"/);
assert.match(firstSection, /### 01 첫 하위 목차/);
assert.match(firstSection, /첫 본문/);

console.log("PASS: split markdown source");
```

- [ ] **Step 3: split script test가 통과한다**

Run:

```powershell
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
```

Expected:

```markdown
PASS: split markdown source
```

- [ ] **Step 4: `ingest.md` argument hint에 옵션이 추가된다**

Replace the frontmatter `argument-hint` line with:

```yaml
argument-hint: "<url|filepath|\"text\"> [--type articles|papers|repos|notes|data] [--title \"Title\"] [--split-heading <level>] [--inbox] [--keep] [--wiki <name>] [--local] [--auto-classify] [--new-topic <name>] [--project <slug>] [--include-archived]"
```

- [ ] **Step 5: `ingest.md`에 split script 호출 규칙이 추가된다**

After `### For all sources`, add:

```markdown
### Book and long Markdown split

If `--split-heading <level>` is present, treat the input as one long Markdown source that should be split into multiple immutable raw sources before compilation. Use `scripts/split-markdown-source.mjs`; do not manually create split raw files.

- `level` must be an integer from 1 to 6.
- Use `notes` by default for books and chapters. If the user explicitly passes another valid `--type`, honor that type, but do not create `book`, `books`, or `raw/books/`.
- This option is deterministic for Markdown or text that has Markdown headings. Do not infer a PDF or EPUB table of contents in this workflow.
- First run `node scripts/split-markdown-source.mjs --wiki <wiki-root> --source <path> --title "<title>" --source-key "<short-key>" --type <type> --split-heading <level> --dry-run`.
- Review the generated mapping and stop if the user asked to inspect it before writing.
- Run the same command with `--apply` to create raw files.
- After script output, verify the created files, update/rebuild indexes if needed, append the ingest log entry, and report file paths.
```

- [ ] **Step 6: `ingestion.md` Source Types에 book policy가 추가된다**

After the Source Types table, add:

```markdown
Books and book chapters do not introduce a separate raw type in this fork. Store chapter-like local Markdown or text under `raw/notes/` with `type: notes` unless the user explicitly chooses another existing raw type. Do not create `raw/books/`, `type: book`, or `type: books`.
```

- [ ] **Step 7: `ingestion.md`에 split protocol이 추가된다**

After `## File Ingestion`, add:

````markdown
### Book and Long Markdown Split

Use this only when the user passes `--split-heading <level>`. The split itself is performed by `scripts/split-markdown-source.mjs`; the agent verifies and indexes the result.

1. Run dry-run:

```powershell
node scripts/split-markdown-source.mjs --wiki <wiki-root> --source <file.md> --title "<title>" --source-key "<short-key>" --type notes --split-heading <level> --dry-run
```

2. Confirm the output mapping.
3. Run apply:

```powershell
node scripts/split-markdown-source.mjs --wiki <wiki-root> --source <file.md> --title "<title>" --source-key "<short-key>" --type notes --split-heading <level> --apply
```

4. Verify every generated file exists under `raw/notes/`.
5. Update `raw/notes/_index.md`, `raw/_index.md`, and master `_index.md`.
6. Append one log entry summarizing the split batch, for example `## [YYYY-MM-DD] ingest | Split Book Title into 12 notes (raw/notes/20260520_01_...)`.
7. Use `type: notes` by default. Do not create `book`, `books`, or `raw/books/`.
8. The script adds optional split provenance frontmatter:

```yaml
content_format: markdown
split_source: "original filepath or URL"
split_heading_level: 2
split_part_index: 1
split_part_total: 12
split_heading: "Chapter heading"
```

````

- [ ] **Step 8: `wiki-structure.md`에 optional split fields가 추가된다**

After the Source File Format example, add:

````markdown
Optional split provenance fields for heading-split book or long Markdown ingests:

```yaml
content_format: markdown
split_source: "original filepath or URL"
split_heading_level: 2
split_part_index: 1
split_part_total: 12
split_heading: "Chapter heading"
```

These fields are optional metadata. The required raw source fields remain `title`, `source`, `type`, `ingested`, `tags`, and `summary`.
````

- [ ] **Step 9: split 관련 테스트가 통과한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
```

Expected: filename and split policy checks pass, and `PASS: split markdown source` is printed.

---

### Task 5: 범위 통제와 회귀 스캔

**Files:**
- No source edits expected

- [ ] **Step 1: book raw type이 enum 또는 argument hint에 생기지 않았음이 확인된다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md -Pattern '\[--type [^]]*book'
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md -Pattern 'type: articles\|papers\|repos\|notes\|data\|book'
```

Expected: no matches. Negative guidance such as "do not create raw/books" may exist and is not a failure.

- [ ] **Step 2: 기존 ISO date fields는 유지됐음이 확인된다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md,D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md -Pattern 'ingested: YYYY-MM-DD|## \\[YYYY-MM-DD\\] ingest'
```

Expected: `ingested: YYYY-MM-DD`와 log entry format이 남아 있다.

- [ ] **Step 3: filename 예시는 dashed date에서 undashed date로 바뀌었음이 확인된다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md,D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md,D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md -Pattern 'YYYYMMDD_NN|YYYY-MM-DD-한국어-요약명'
```

Expected: `YYYYMMDD_NN` matches exist and `YYYY-MM-DD-한국어-요약명` does not appear.

---

### Task 6: 실제 책 파일 split 예시 문서화

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`

- [ ] **Step 1: 예시 파일의 heading 구조가 확인된다**

Run:

```powershell
rg -n "^(#{1,6})\\s+" "C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/도그냥PO_20251125_정리본.md"
```

Expected: 다음 구조가 확인된다.

```markdown
# IT 기획자에서 프로덕트 오너로 점프하기
## 프롤로그
## Chapter 01. 일잘러의 세상이 흔들렸다
### 01 우물 안 일잘러, 회사 밖에서도 일잘러를 꿈꾸다
### 02 누가 우물 안 일잘러를 만드나
...
## 에필로그
```

- [ ] **Step 2: 챕터 하위 목차 split 예시가 추가된다**

Add to `references/ingestion.md` under `### Book and Long Markdown Split`:

````markdown
#### Example: split below chapter level

For a book file with this structure:

```markdown
# IT 기획자에서 프로덕트 오너로 점프하기
## 프롤로그
## Chapter 01. 일잘러의 세상이 흔들렸다
### 01 우물 안 일잘러, 회사 밖에서도 일잘러를 꿈꾸다
### 02 누가 우물 안 일잘러를 만드나
## Chapter 02. 메타인지에서 시작한 프로덕트 오너로의 도전
### 06 헤드헌터보다 유능한 커피 한 잔_ 커피챗
```

Use `--split-heading 3` to split by the chapter subheadings (`###`), not by the chapter headings (`##`). Use a short `--source-key` for filenames and preserve the full title in frontmatter:

```powershell
@wiki ingest "C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/도그냥PO_20251125_정리본.md" --type notes --title "IT 기획자에서 프로덕트 오너로 점프하기" --source-key "도그냥PO" --split-heading 3 --local
```

If this is the first notes ingest on 2026-05-20, generated filenames should look like:

```markdown
raw/notes/20260520_01_도그냥PO_00_프롤로그.md
raw/notes/20260520_02_도그냥PO_01_우물-안-일잘러-회사-밖에서도-일잘러를-꿈꾸다.md
raw/notes/20260520_03_도그냥PO_02_누가-우물-안-일잘러를-만드나.md
raw/notes/20260520_04_도그냥PO_03_우물-안-일잘러의-위기.md
raw/notes/20260520_05_도그냥PO_04_우물-탈출을-방해하는-에고와의-싸움.md
raw/notes/20260520_06_도그냥PO_05_터부시하는-부정적-감정이-성장을-만들어-낼-때.md
raw/notes/20260520_07_도그냥PO_06_헤드헌터보다-유능한-커피-한-잔_커피챗.md
```

For `## 프롤로그` and `## 에필로그`, there is no lower-level numbered chapter heading before the content. Preserve them as their own split files with part labels `00_프롤로그` and `99_에필로그` when they contain substantial content. Do not merge them into the first or last numbered section.
````

- [ ] **Step 3: parent chapter context 보존 규칙이 추가된다**

Add to `commands/ingest.md` split guidance:

```markdown
- When splitting below chapter level, preserve the nearest parent heading in frontmatter as `split_parent_heading`, for example `Chapter 01. 일잘러의 세상이 흔들렸다`. Do not include the parent heading text in every split body unless it is needed for readability.
```

Add to `wiki-structure.md` optional split fields:

```yaml
split_parent_heading: "Chapter 01. 일잘러의 세상이 흔들렸다"
```

- [ ] **Step 4: 예시 문서화 검증이 통과한다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md,D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md,D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md -Pattern '도그냥PO|split-heading 3|split_parent_heading|00_프롤로그|99_에필로그'
```

Expected: all patterns are present in the relevant docs.

---

### Task 7: 기존 raw filename 마이그레이션 스크립트 추가

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs`
- Create: `D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

- [ ] **Step 1: migration scope가 문서에 추가된다**

Add to `references/ingestion.md` after `## Filename Generation`:

````markdown
## Raw Filename Migration

Existing raw files may use legacy filenames such as `YYYY-MM-DD-slug.md`. Do not rename them during ordinary ingest, lint, compile, query, or refresh. Rename only when the user explicitly requests migration.

Migration must be deterministic and script-driven:

1. Run `node scripts/migrate-raw-filenames.mjs --wiki <wiki-root> --dry-run`.
2. Review the mapping from old raw paths to new `YYYYMMDD_NN_...` paths.
3. If the dry-run reports collisions, missing files, or ambiguous references, stop and fix those first.
4. Run `node scripts/migrate-raw-filenames.mjs --wiki <wiki-root> --apply` only after dry-run approval.
5. Rewrite exact raw path references in `wiki/`, `output/`, `raw/_index.md`, `raw/{type}/_index.md`, and `_index.md`.
6. Append a migration entry to `log.md`.
````

- [ ] **Step 2: migration script가 dry-run mapping을 만든다**

Create `scripts/migrate-raw-filenames.mjs` with these behaviors:

```javascript
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

function parseArgs(argv) {
  const args = { dryRun: true, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wiki") args.wiki = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.wiki) throw new Error("Usage: node scripts/migrate-raw-filenames.mjs --wiki <wiki-root> [--dry-run|--apply]");
  return args;
}

function toIsoDateFromFilename(name) {
  const dashed = name.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  const undashed = name.match(/^(\d{8})_(\d{2})_/);
  if (undashed) return `${undashed[1].slice(0, 4)}-${undashed[1].slice(4, 6)}-${undashed[1].slice(6, 8)}`;
  return null;
}

function toYmd(isoDate) {
  return isoDate.replaceAll("-", "");
}

function sanitizeTitle(input) {
  return input
    .normalize("NFC")
    .replace(/[^\p{Script=Hangul}A-Za-z0-9_.\-\s]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .slice(0, 80) || "source";
}

function frontmatterValue(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return match ? match[1].trim() : "";
}

function assertInside(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes wiki root: ${target}`);
  }
}

async function listMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listMarkdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

async function buildMapping(wikiRoot) {
  const mapping = [];
  for (const type of VALID_TYPES) {
    const dir = path.join(wikiRoot, "raw", type);
    const files = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const used = new Set(files.filter((f) => f.isFile()).map((f) => f.name));
    const byDateSeq = new Map();
    for (const name of used) {
      const match = name.match(/^(\d{8})_(\d{2})_/);
      if (!match) continue;
      const current = byDateSeq.get(match[1]) || 0;
      byDateSeq.set(match[1], Math.max(current, Number(match[2])));
    }
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "_index.md") continue;
      if (/^\d{8}_\d{2}_/.test(entry.name)) continue;
      const oldAbs = path.join(dir, entry.name);
      const text = await fs.readFile(oldAbs, "utf8");
      const isoDate = frontmatterValue(text, "ingested") || toIsoDateFromFilename(entry.name);
      if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        throw new Error(`Cannot determine ingested date for ${oldAbs}`);
      }
      const ymd = toYmd(isoDate);
      const next = (byDateSeq.get(ymd) || 0) + 1;
      byDateSeq.set(ymd, next);
      const title = sanitizeTitle(frontmatterValue(text, "title") || entry.name.replace(/\.md$/, ""));
      const newName = `${ymd}_${String(next).padStart(2, "0")}_${title}.md`;
      if (used.has(newName)) throw new Error(`Collision: ${path.join(dir, newName)}`);
      used.add(newName);
      mapping.push({
        oldRel: path.relative(wikiRoot, oldAbs).replaceAll("\\", "/"),
        newRel: path.relative(wikiRoot, path.join(dir, newName)).replaceAll("\\", "/"),
      });
    }
  }
  return mapping;
}

function rewriteText(text, mapping) {
  let out = text;
  for (const { oldRel, newRel } of mapping) {
    const oldBase = oldRel.split("/").pop();
    const newBase = newRel.split("/").pop();
    out = out.split(oldRel).join(newRel);
    out = out.split(oldRel.replace(/^raw\//, "../../raw/")).join(newRel.replace(/^raw\//, "../../raw/"));
    out = out.split(`](${oldBase})`).join(`](${newBase})`);
    out = out.split(`](<${oldBase}>)`).join(`](<${newBase}>)`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wikiRoot = path.resolve(args.wiki);
  assertInside(path.dirname(wikiRoot), wikiRoot);
  const mapping = await buildMapping(wikiRoot);
  console.log(JSON.stringify({ mode: args.apply ? "apply" : "dry-run", wikiRoot, count: mapping.length, mapping }, null, 2));
  if (!args.apply) return;

  for (const item of mapping) {
    const oldPath = path.join(wikiRoot, item.oldRel);
    const newPath = path.join(wikiRoot, item.newRel);
    assertInside(wikiRoot, oldPath);
    assertInside(wikiRoot, newPath);
    await fs.rename(oldPath, newPath);
  }

  const rewriteRoots = ["raw", "wiki", "output"];
  const files = ["_index.md", "log.md"];
  for (const root of rewriteRoots) files.push(...await listMarkdownFiles(path.join(wikiRoot, root)));
  for (const file of files.map((f) => path.isAbsolute(f) ? f : path.join(wikiRoot, f))) {
    const oldText = await fs.readFile(file, "utf8").catch(() => null);
    if (oldText === null) continue;
    const newText = rewriteText(oldText, mapping);
    if (newText !== oldText) await fs.writeFile(file, newText, "utf8");
  }

  const date = kstIsoDate();
  await fs.appendFile(path.join(wikiRoot, "log.md"), `\n## [${date}] migrate | Raw filenames normalized to YYYYMMDD_NN (${mapping.length} files)\n`, "utf8");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

Implementation note: after creating the script, review it against the actual repo style. If the repository already has script helpers for index rebuilding or path walking, reuse those helpers instead of duplicating logic.

- [ ] **Step 3: migration test가 생성된다**

Create `tests/test-raw-filename-migration.mjs`:

```javascript
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

await fs.writeFile(path.join(wiki, "raw", "notes", "2026-05-20-old-note.md"), `---
title: "기존 노트"
source: "MANUAL"
type: notes
ingested: 2026-05-20
tags: [test]
summary: "기존 파일명 마이그레이션 테스트"
---

# 기존 노트
`, "utf8");

await fs.writeFile(path.join(wiki, "wiki", "concepts", "sample.md"), `---
title: Sample
sources:
  - raw/notes/2026-05-20-old-note.md
---

- [기존 노트](../../raw/notes/2026-05-20-old-note.md)
`, "utf8");

await fs.writeFile(path.join(wiki, "raw", "notes", "_index.md"), `| Source | Summary | Tags | Ingested |
|---|---|---|---|
| [기존 노트](2026-05-20-old-note.md) | 기존 파일명 마이그레이션 테스트 | test | 2026-05-20 |
`, "utf8");

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

const log = await fs.readFile(path.join(wiki, "log.md"), "utf8");
assert.match(log, /Raw filenames normalized to YYYYMMDD_NN/);

console.log("PASS: raw filename migration");
```

- [ ] **Step 4: lint guidance가 migration을 제안한다**

Add to `claude-plugin/commands/lint.md` report or repair guidance:

```markdown
If legacy raw filenames such as `YYYY-MM-DD-slug.md` are found, do not rename them during ordinary lint repair. Report them as migration candidates and suggest running `node scripts/migrate-raw-filenames.mjs --wiki <wiki-root> --dry-run`. Apply mode requires explicit user approval because it rewrites raw paths referenced from `wiki/`, `output/`, indexes, and log entries.
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

### Task 8: Codex/OpenCode mirror 동기화

**Files:**
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

- [ ] **Step 1: Codex mirror가 재생성된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh
```

Expected: command exits with code 0.

- [ ] **Step 2: OpenCode mirror가 재생성된다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-opencode-plugin.sh
```

Expected: command exits with code 0.

- [ ] **Step 3: mirror에 새 규칙이 반영됐음이 확인된다**

Run:

```powershell
Select-String -Path D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/skills/wiki/**/*.md,D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/skills/wiki-manager/**/*.md -Pattern 'YYYYMMDD_NN|--split-heading|split_heading_level'
```

Expected: Codex/OpenCode mirror files에서 `YYYYMMDD_NN`, `--split-heading`, `split_heading_level`이 확인된다.

---

### Task 9: 전체 검증

**Files:**
- No source edits expected

- [ ] **Step 1: 구조 테스트 전체가 통과한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-structure.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh
node D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs
node D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs
```

Expected:

```markdown
0 failed
```

- [ ] **Step 2: sync 테스트는 커밋 상태에 맞게 판정된다**

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

If these tests compare against `HEAD` and fail only because the implementation is uncommitted, record that explicitly and rerun after commit.

- [ ] **Step 3: 변경 범위가 계획과 일치한다**

Run:

```powershell
git -C D:/vibe-coding/llm-wiki-my diff --stat -- claude-plugin plugins tests docs
git -C D:/vibe-coding/llm-wiki-my status --short
```

Expected: changed files are limited to this plan's source/test/mirror/doc scope, plus pre-existing unrelated changes that were already present before implementation.

---

### Task 10: 커밋 준비

**Files:**
- Changed files from Tasks 2-8

- [ ] **Step 1: 보안 점검은 커밋 흐름 안에서 실행된다**

Do not run `git add` or `git commit` directly. When the user requests a commit, use the `cp` skill. After files are staged by that flow and before commit finalization, run:

```powershell
node C:/Users/ahnbu/.claude/skills/_shared/security-gate.mjs precommit --repo D:/vibe-coding/llm-wiki-my --staged
```

Expected: no secret, credential, suspicious install script, or external transfer risk is reported.

- [ ] **Step 2: 커밋 관심사는 하나로 유지된다**

Recommended commit message:

```markdown
feat(ingest): raw 파일명 규칙과 책 분할·마이그레이션 절차 추가 — 한국어 LLM Wiki 수집 안정화
```

Expected: filename policy, split protocol, migration script/test, validation test, generated mirror만 한 커밋에 포함된다. 기존 plugin marketplace/bootstrap 관련 변경과 섞지 않는다.

---

## Self-Review

- 파일명 요구사항 `YYYYMMDD_NN`은 Tasks 2-3에서 테스트와 문서 규칙으로 반영된다.
- 책 분할 기능은 Tasks 2, 4에서 `--split-heading <level>` 옵션과 split provenance로 반영된다.
- 챕터 하위 목차 기준 split의 실제 예시는 Task 6에서 `도그냥PO_20251125_정리본.md` 기준으로 반영된다.
- 기존 ingest 문서의 동일 포맷 마이그레이션은 Task 7에서 dry-run/apply script와 test로 반영된다.
- `book` raw type 추가 금지는 Tasks 2, 4, 5에서 검증된다.
- 기존 raw type enum `articles|papers|repos|notes|data`는 유지된다.
- frontmatter/log의 ISO date는 호환성을 위해 유지되며 Task 5에서 검증된다.
- 구현은 `claude-plugin/`만 직접 수정하고 mirror는 Task 8에서 sync한다.
- plan 내 직접 `git add/commit` 지시는 없으며, 커밋은 `cp` 스킬 흐름으로 제한했다.

---

## 수행 결과

작성 시점: 2026-05-20 KST

### 구현 완료

- `YYYYMMDD_NN_한국어-요약명.md` raw filename 정책을 `ingest`, `ingestion`, `wiki-structure` 문서에 반영했다.
- 책/긴 Markdown 문서는 새 raw type 없이 `raw/notes/`, `type: notes`로 처리하도록 유지했다.
- 사용자가 지정한 heading level 기준 분할을 위해 `scripts/split-markdown-source.mjs`를 추가했다.
- 기존 raw filename을 동일 포맷으로 바꾸기 위해 `scripts/migrate-raw-filenames.mjs`를 추가했다.
- split/migration 모두 기본 `--dry-run`, 명시적 `--apply` 구조로 구현했다.
- 일반 lint repair 중 legacy raw filename을 자동 rename하지 않고 migration 후보로 보고하도록 `claude-plugin/commands/lint.md`에 반영했다.
- Codex/OpenCode mirror sync를 실행해 `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/` 생성물에 원본 변경을 반영했다.

### 주요 산출물

- `D:/vibe-coding/llm-wiki-my/scripts/split-markdown-source.mjs`
- `D:/vibe-coding/llm-wiki-my/scripts/migrate-raw-filenames.mjs`
- `D:/vibe-coding/llm-wiki-my/tests/test-split-markdown-source.mjs`
- `D:/vibe-coding/llm-wiki-my/tests/test-raw-filename-migration.mjs`
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/ingestion.md`
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`
- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

### 검증 결과

| 검증 | 결과 | 판정 |
|---|---:|---|
| `node tests/test-split-markdown-source.mjs` | `PASS: split markdown source` | ✅ 통과 |
| `node tests/test-raw-filename-migration.mjs` | `PASS: raw filename migration` | ✅ 통과 |
| `bash tests/test-plugin-validate.sh` | `103 passed, 0 failed` | ✅ 통과 |
| `bash tests/test-structure.sh` | `170 passed, 0 failed` | ✅ 통과 |
| `bash tests/test-local-cli-lint.sh` | `21 passed, 0 failed` | ✅ 통과 |
| frontmatter validation | `PASS 3 / WARN 0 / FAIL 0` | ✅ 통과 |
| mirror pattern check | `YYYYMMDD_NN`, `--split-heading`, `split_heading_level` confirmed in Codex and OpenCode references | ✅ 통과 |
| `bash tests/test-opencode-sync.sh` | `OK: OpenCode plugin mirror is in sync.` | ✅ 통과 |
| `bash tests/test-codex-sync.sh` | `FAIL: Codex plugin mirror is out of sync...` | ⚠️ 커밋 전 gate |

`test-codex-sync.sh` 실패는 원본과 mirror가 실제로 동기화되지 않았다는 의미라기보다, sync script가 `plugins/llm-wiki/`를 재생성한 뒤 `HEAD` 대비 변경이 남아 있으면 실패시키는 commit gate이다. 현재 사용자가 커밋을 요청하지 않았으므로 `git add/commit`은 수행하지 않았다. 커밋 흐름에서 mirror 변경을 함께 포함하면 재검증 대상이다.

### 동작 예시

`도그냥PO_20251125_정리본.md`를 챕터가 아니라 챕터 하위 목차 기준으로 나누는 경우:

```powershell
@wiki ingest "C:/Users/ahnbu/cowork/06_연구/= e북 제작/_최종본_기획제안/txt/도그냥PO_20251125_정리본.md" --type notes --title "IT 기획자에서 프로덕트 오너로 점프하기" --source-key "도그냥PO" --split-heading 3 --local
```

첫 `notes` ingest가 2026-05-20에 실행되면 파일명은 다음 형태가 된다.

```markdown
raw/notes/20260520_01_도그냥PO_00_프롤로그.md
raw/notes/20260520_02_도그냥PO_01_우물-안-일잘러-회사-밖에서도-일잘러를-꿈꾸다.md
raw/notes/20260520_03_도그냥PO_02_누가-우물-안-일잘러를-만드나.md
raw/notes/20260520_04_도그냥PO_03_우물-안-일잘러의-위기.md
raw/notes/20260520_05_도그냥PO_04_우물-탈출을-방해하는-에고와의-싸움.md
raw/notes/20260520_06_도그냥PO_05_터부시하는-부정적-감정이-성장을-만들어-낼-때.md
raw/notes/20260520_07_도그냥PO_06_헤드헌터보다-유능한-커피-한-잔_커피챗.md
```

책 제목 전체는 파일명에 반복하지 않고 frontmatter의 `book_title`에 보존한다. 파일명에는 짧은 `source-key`인 `도그냥PO`만 사용한다.

---

## Done-Check-Lite 검수 결과

작성 시점: 2026-05-20 KST

### 최종 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 전체 상태 | ✅ 완료 | 원래 요구한 계획 실행, 결과 문서 업데이트, 스크립트 기반 split/migration, 검증 재실행이 모두 확인됐다. |

### 요구사항 대조표

| 원래 요구사항 | 상태 | 구현 근거 | 검증 근거 | 비고 |
|---|---|---|---|---|
| raw ingest 파일명을 `YYYYMMDD_NN`으로 변경 | ✅ 완료 | `claude-plugin/commands/ingest.md`, `references/ingestion.md`, `references/wiki-structure.md` | `test-plugin-validate.sh`: `103 passed, 0 failed` | frontmatter/log 날짜는 호환성을 위해 ISO 유지 |
| 책/긴 Markdown을 사용자 지정 목차 레벨로 분할 | ✅ 완료 | `scripts/split-markdown-source.mjs`, `--split-heading <level>` 문서화 | `node tests/test-split-markdown-source.mjs`: `PASS` | 기본 저장 위치는 `raw/notes/` |
| 책 제목이 파일명에 과도하게 반복되지 않도록 짧은 key 사용 | ✅ 완료 | `--source-key <short-key>`, `book_title` frontmatter | split test에서 `book_title`, source key 기반 파일명 확인 | 예시는 `도그냥PO` 사용 |
| `book` raw type을 추가하지 않음 | ✅ 완료 | raw type enum은 `articles|papers|repos|notes|data` 유지 | `test-plugin-validate.sh`의 negative checks 통과 | `raw/books/` 생성 없음 |
| 기존 ingest raw 파일을 같은 포맷으로 마이그레이션 | ✅ 완료 | `scripts/migrate-raw-filenames.mjs`, `references/ingestion.md`, `lint.md` | `node tests/test-raw-filename-migration.mjs`: `PASS` | dry-run 후 apply 구조 |
| wiki/output/index/log 참조 보존 | ✅ 완료 | migration script의 rewrite 로직 | migration test에서 wiki 링크와 log rewrite 확인 | ambiguous reference 전체 검출은 MVP 범위 밖 |
| Codex/OpenCode mirror sync 반영 | ✅ 완료 | `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/` | OpenCode sync 통과, mirror pattern check 통과 | Codex sync는 commit gate라 미커밋 상태에서는 실패 |
| 수행 결과 문서 업데이트 | ✅ 완료 | 본 문서의 `수행 결과`, `Done-Check-Lite 검수 결과` 섹션 | `Select-String`으로 섹션 존재 확인 | 커밋은 요청되지 않아 미수행 |

### 미완료·승인 필요 항목

없음.

| 항목 | 문제 | 필요한 다음 작업 |
|---|---|---|
| 없음 | 없음 | 없음 |

### 검증 근거

| 구분 | 근거 |
|---|---|
| 실행한 검증 | `node tests/test-split-markdown-source.mjs` → `PASS`; `node tests/test-raw-filename-migration.mjs` → `PASS`; `bash tests/test-plugin-validate.sh` → `103 passed, 0 failed`; `bash tests/test-structure.sh` → `170 passed, 0 failed`; `bash tests/test-local-cli-lint.sh` → `21 passed, 0 failed`; `bash tests/test-opencode-sync.sh` → `OK`; `bash tests/test-codex-sync.sh` → commit gate 실패 |
| 확인한 파일 | `claude-plugin/commands/ingest.md`, `claude-plugin/commands/lint.md`, `claude-plugin/skills/wiki-manager/references/ingestion.md`, `claude-plugin/skills/wiki-manager/references/wiki-structure.md`, `scripts/split-markdown-source.mjs`, `scripts/migrate-raw-filenames.mjs`, `tests/test-split-markdown-source.mjs`, `tests/test-raw-filename-migration.mjs`, `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/` |
| 커밋 | 없음 |
