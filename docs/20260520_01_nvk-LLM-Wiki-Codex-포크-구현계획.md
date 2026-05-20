---
title: nvk LLM Wiki Codex 포크 구현계획
created: 2026-05-20 16:46
session_id: codex:019e442b-eb95-76e2-a5a4-377e91658b2e
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/20/rollout-2026-05-20T15-56-29-019e442b-eb95-76e2-a5a4-377e91658b2e.jsonl
ai: codex
---

# nvk LLM Wiki Codex 포크 구현계획 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ahnbu/llm-wiki-my`를 Codex에서 사용할 한국어 기본값 LLM Wiki plugin으로 만든다.

**Architecture:** 이 레포는 `claude-plugin/`가 사람이 수정하는 source of truth이고, `plugins/llm-wiki/`는 Codex 설치용 생성물이다. 실제 설치 대상은 Codex지만, 구현은 `claude-plugin/`를 수정한 뒤 sync script로 Codex mirror를 재생성한다.

**Tech Stack:** Markdown command specs, Codex plugin mirror, Bash test suite, GitHub fork `ahnbu/llm-wiki-my`.

---

## 구현 원칙

- 실제 설치 대상은 Codex다.
- 직접 수정 대상은 `D:/vibe-coding/llm-wiki-my/claude-plugin/`다.
- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`는 직접 수정하지 않는다.
- `plugins/llm-wiki/`는 `scripts/sync-codex-plugin.sh`로 재생성한다.
- `plugins/llm-wiki-opencode/`도 sync 검증 대상이므로 함께 재생성한다.
- 이번 구현은 한국어 기본값, `.wiki` Git 포함, 기존 기능 보존만 다룬다.
- 새 `ingest preview`, 새 cleanup 기능, CRUD/RUD UI, 강의 산출물 생성 기능은 만들지 않는다.
- 커밋이 필요하면 직접 `git add/commit`을 하지 않고 `cp` 스킬을 사용한다.
- upstream `nvk/llm-wiki`에는 `CHANGELOG.md` 또는 `CHANGE*` 파일이 없음을 확인했다. 따라서 fork 변경 이력은 `CHANGELOG.local.md`로 분리하지 않고 `CHANGELOG.md` 하나로 일원화한다.

## 파일 구조

**수정할 원본 파일**

- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/wiki.md`
  - local `.wiki` 생성 시 `.gitignore`에 `.wiki/`를 추가하라는 지시를 제거하고, `.wiki` Git 포함 기본값을 명시한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
  - 새 raw source 파일명 기본값을 한국어 파일명 규칙으로 바꾼다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/compile.md`
  - wiki article 제목, 본문, 섹션명, 파일명을 한국어 기본값으로 생성하도록 지시한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/query.md`
  - query 응답 기본 언어를 한국어로 둔다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/output.md`
  - 기존 `/wiki:output` 기능은 보존하되, 생성 artifact의 제목, 파일명, frontmatter, 본문 언어를 한국어 기본값으로 둔다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
  - lint report 기본 언어를 한국어로 둔다. check code보다 사람이 읽는 설명을 먼저 쓰는 기존 원칙은 유지한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`
  - local wiki Git 정책, 파일명 규칙, raw/wiki/output format 설명을 한국어 기본값과 맞춘다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/compilation.md`
  - compile protocol의 article 작성 규칙에 한국어 기본값을 반영한다.
- `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/linting.md`
  - lint report format을 한국어 기본 출력 기준으로 조정한다.
- `D:/vibe-coding/llm-wiki-my/AGENTS.md`
  - portable protocol의 Local Wiki 설명에서 `.wiki/`를 `.gitignore`에 추가하라는 문장을 fork 정책과 맞춘다.

**수정할 테스트 파일**

- `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`
  - fork 정책이 command/reference 문서에 남아 있는지 grep 기반 회귀 테스트를 추가한다.

**자동 갱신될 생성물**

- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

---

### Task 1: 기준 상태 확인

**Files:**
- Read: `D:/vibe-coding/llm-wiki-my/CLAUDE.md`
- Read: `D:/vibe-coding/llm-wiki-my/AGENTS.md`
- Read: `C:/Users/ahnbu/cowork/60_옵시디언_노션/20260518_카파시_LLM_Wiki도입/spec/20260520_01_nvk-LLM-Wiki-플러그인-포크.md`

- [ ] **Step 1: 레포 루트와 상태를 확인한다**

Run:

```powershell
git -C D:/vibe-coding/llm-wiki-my rev-parse --show-toplevel
git -C D:/vibe-coding/llm-wiki-my status --short
```

Expected:

```markdown
D:/vibe-coding/llm-wiki-my
```

`status --short`는 작업 시작 전 변경 파일이 없거나, 이미 있는 변경이 이번 작업과 무관함을 구분할 수 있어야 한다.

- [ ] **Step 2: source of truth 원칙을 재확인한다**

Run:

```powershell
Select-String -LiteralPath D:/vibe-coding/llm-wiki-my/CLAUDE.md -Pattern 'source of truth|generated Codex packaging mirror|Do NOT hand-edit'
```

Expected: 다음 의미의 줄이 나온다.

```markdown
claude-plugin/ is source of truth
plugins/llm-wiki/ is generated Codex packaging mirror
do not hand-edit generated mirror
```

- [ ] **Step 3: 기존 구조 테스트를 먼저 실행한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-codex-sync.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-opencode-sync.sh
```

Expected:

```markdown
0 failed
OK: Codex plugin mirror is in sync.
OK: OpenCode plugin mirror is in sync.
```

---

### Task 2: 회귀 테스트 추가

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`

- [ ] **Step 1: fork 정책 검증 함수를 추가한다**

`test-plugin-validate.sh`의 `log_pass`, `log_fail` 함수 아래에 추가한다.

```bash
assert_contains() {
  file="$1"
  pattern="$2"
  message="$3"
  if grep -Eq "$pattern" "$file"; then
    log_pass "$message"
  else
    log_fail "$message" "missing pattern '$pattern' in $file"
  fi
}

assert_not_contains() {
  file="$1"
  pattern="$2"
  message="$3"
  if grep -Eq "$pattern" "$file"; then
    log_fail "$message" "unexpected pattern '$pattern' in $file"
  else
    log_pass "$message"
  fi
}
```

- [ ] **Step 2: 한국어 기본값과 Git 포함 정책 검증 섹션을 추가한다**

`echo "--- Project files ---"` 섹션 뒤, Codex mirror validation 전에 추가한다.

```bash
echo ""
echo "--- ahnbu fork policy checks ---"
assert_contains "$PLUGIN_DIR/commands/compile.md" "Korean by default|한국어" "compile command documents Korean article defaults"
assert_contains "$PLUGIN_DIR/commands/query.md" "Korean by default|한국어" "query command documents Korean response defaults"
assert_contains "$PLUGIN_DIR/commands/output.md" "Korean by default|한국어" "output command documents Korean artifact defaults"
assert_contains "$PLUGIN_DIR/commands/ingest.md" "Korean filename|한국어 파일명|한글" "ingest command documents Korean filename defaults"
assert_contains "$PLUGIN_DIR/commands/wiki.md" "keep .*\\.wiki.*Git|Git.*\\.wiki|Do not append .*\\.wiki" "wiki init documents .wiki Git inclusion"
assert_not_contains "$PLUGIN_DIR/commands/wiki.md" "append .*\\.wiki/.*\\.gitignore" "wiki init no longer tells local users to ignore .wiki"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "Korean filename|한국어 파일명|한글" "wiki structure documents Korean filename policy"
assert_contains "$PROJECT_ROOT/AGENTS.md" "keep .*\\.wiki.*Git|Git.*\\.wiki|Do not append .*\\.wiki" "portable protocol documents .wiki Git inclusion"
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: 아직 원본 문서가 수정되지 않았으므로 fork policy checks 중 1개 이상이 FAIL이다.

---

### Task 3: local wiki Git 정책 수정

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/wiki.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`
- Modify: `D:/vibe-coding/llm-wiki-my/AGENTS.md`

- [ ] **Step 1: `wiki.md`의 local `.gitignore` 지시를 교체한다**

Replace:

```markdown
- For local wikis (`--local`): append `.wiki/` to the project's `.gitignore`.
```

With:

```markdown
- For local wikis (`--local`): keep `.wiki/` Git-trackable by default. Do not append `.wiki/` to the project's `.gitignore`. The raw, wiki, output, config, index, and log files are the reproducible wiki state; exclude only secrets, large binaries, caches, or scratch files when a concrete problem is found.
```

- [ ] **Step 2: `wiki-structure.md`의 Local Wiki 설명을 보강한다**

Under `## Local Wiki (--local flag)`, after the first sentence, add:

```markdown
For this fork, local `.wiki/` directories are Git-trackable by default. The wiki state includes `raw/`, `wiki/`, `output/`, `config.md`, `_index.md`, and `log.md`. Do not add `.wiki/` to `.gitignore` during init. Exclusions are handled later only for concrete risks such as secrets, large binaries, cache files, or scratch files.
```

- [ ] **Step 3: `AGENTS.md`의 Local Wiki 문장을 교체한다**

Replace:

```markdown
Same structure as a topic wiki but at `<project>/.wiki/`. Add `.wiki/` to `.gitignore`.
```

With:

```markdown
Same structure as a topic wiki but at `<project>/.wiki/`. For this fork, keep `.wiki/` Git-trackable by default; do not append `.wiki/` to `.gitignore` during init.
```

- [ ] **Step 4: 관련 테스트만 실행한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: `.wiki` Git inclusion 관련 checks가 PASS로 바뀐다. 한국어 기본값 checks는 아직 FAIL일 수 있다.

---

### Task 4: 파일명 규칙과 ingest 기본값 수정

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/ingest.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

- [ ] **Step 1: `ingest.md`의 raw filename 규칙을 교체한다**

Replace:

```markdown
1. Generate slug: `YYYY-MM-DD-descriptive-slug.md`
```

With:

```markdown
1. Generate filename: `YYYY-MM-DD-한국어-요약명.md` by default. Use Korean for human-facing filenames when the source title or user context is Korean. Allowed characters are Korean letters, ASCII letters and digits, `_`, `-`, and `.`. Use `_` for structural separation, `-` for word separation, remove forbidden characters, and add a short numeric suffix on collisions. Preserve existing raw filenames; this rule applies to new ingests.
```

- [ ] **Step 2: `ingest.md` raw frontmatter 설명에 한국어 기본값을 추가한다**

Do not add a new required frontmatter field. After the raw frontmatter example, add:

```markdown
For Korean workspaces, write `title` and `summary` in Korean by default unless the source title is a fixed proper noun or the user explicitly asks for another language.
```

- [ ] **Step 3: `wiki-structure.md` File Naming 섹션을 fork 정책으로 교체한다**

Replace the five filename bullets and the lowercase rule with:

```markdown
- **Raw sources**: `YYYY-MM-DD-한국어-요약명.md` by default for Korean workspaces.
- **Wiki articles**: `한국어_문서명.md` or `한국어-문서명.md` without a date prefix; these are living documents.
- **Inventory records**: keep the existing durable-record naming style unless a Korean workspace explicitly creates Korean tracking records.
- **Dataset manifests**: keep `datasets/descriptive-slug/MANIFEST.md` for dataset compatibility.
- **Output artifacts**: `{type}-한국어-주제명-YYYY-MM-DD.md` by default when generated from Korean wiki content.
- **Allowed filename characters for Korean wiki outputs**: Korean letters, ASCII letters and digits, `_`, `-`, and `.`. Use `_` for structural separation, `-` for word separation, remove forbidden characters, and add a short numeric suffix on collisions.
- Preserve existing raw paths and legacy filenames. The Korean filename rule applies to newly generated files.
```

- [ ] **Step 4: 테스트를 실행한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: ingest filename and wiki-structure filename checks pass.

---

### Task 5: compile 한국어 기본값 수정

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/compile.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/compilation.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

- [ ] **Step 1: `compile.md`에 한국어 기본값 지시를 추가한다**

After:

```markdown
Read the compilation protocol at `skills/wiki-manager/references/compilation.md` and the indexing protocol at `skills/wiki-manager/references/indexing.md`. Then compile raw sources into wiki articles.
```

Add:

```markdown
Korean by default: For this fork, generated wiki articles use Korean for human-facing titles, filenames, section headings, summaries, and body text unless the user explicitly asks for another language. The article must still be source-backed and synthesized, not a translated duplicate export.
```

- [ ] **Step 2: `compile.md`의 write/update 단계에 파일명 규칙을 추가한다**

Under `5. **Write/Update Articles**`, add this bullet after the new article bullet:

```markdown
   - New article filenames: use the Korean filename policy from `references/wiki-structure.md`. Do not create a separate Korean export copy; the file under `wiki/` is the canonical article.
```

- [ ] **Step 3: self-validation에 한국어 title 확인을 추가한다**

In step `5.5. **Self-validation pass**`, add:

```markdown
   - `title:` is a human-readable Korean title for Korean workspaces, unless the user explicitly requested another language.
```

- [ ] **Step 4: `compilation.md`에 같은 기준을 반영한다**

Under `### Step 5: Write/Update Articles`, before `**For new articles:**`, add:

```markdown
Korean by default: In Korean workspaces, compiled articles are written directly in Korean. The canonical `wiki/` article uses a Korean title, Korean filename, Korean section headings, Korean summary, and Korean body text unless the user explicitly asks for another language. Do not create a separate Korean export copy.
```

- [ ] **Step 5: `wiki-structure.md`의 Wiki Article Format 설명을 한국어 기본값으로 보강한다**

Do not add a new required frontmatter field. After the Wiki Article Format frontmatter example, add:

```markdown
For Korean workspaces, `title`, `summary`, section headings, and body text are Korean by default unless the user explicitly asks for another language. Existing provenance fields such as `sources`, `confidence`, `volatility`, and `verified` remain unchanged.
```

- [ ] **Step 6: 테스트를 실행한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: compile Korean defaults check passes.

---

### Task 6: query, lint, output 한국어 기본값 수정

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/query.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/output.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/linting.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/wiki-structure.md`

- [ ] **Step 1: `query.md`에 한국어 응답 기본값을 추가한다**

After:

```markdown
Answer the question in $ARGUMENTS using ONLY the knowledge in the wiki. Follow the Q&A protocol below.
```

Add:

```markdown
Korean by default: Answer in Korean unless the user explicitly asks for another language. Keep citations and file paths unchanged. If the wiki lacks evidence, say that in Korean and suggest what source to ingest.
```

- [ ] **Step 2: `lint.md` report 지시를 한국어 기본값으로 조정한다**

In `### Report`, replace the first paragraph with:

```markdown
Present the lint report in Korean by default, using the format specified in `references/linting.md`, including the **Projects**, **Project Candidates**, **Inventory**, **Datasets**, and **File Placement & Schema** sections. Lead every user-visible line with a plain-language Korean description of what happened; never lead with a check code (C1, C8c, etc.). Check codes are internal identifiers for developers.
```

- [ ] **Step 3: `linting.md` report format 지시를 한국어 기본값으로 조정한다**

Replace:

```markdown
**User-facing output must lead with plain-English descriptions, not check codes.**
```

With:

```markdown
**User-facing output must lead with plain-language Korean descriptions by default, not check codes.** If the user explicitly requests another language, use that language while keeping check codes out of the leading text.
```

- [ ] **Step 4: `output.md`에 기존 기능 보존과 한국어 artifact 규칙을 추가한다**

After:

```markdown
Generate an output artifact from wiki content based on $ARGUMENTS.
```

Add:

```markdown
Korean by default: Preserve the existing output feature and output types. Do not add new lecture-template, PPT, PDF, worksheet, or storyline generators for this fork. When an artifact is generated from Korean wiki content, use Korean for the artifact title, frontmatter title, section headings, filename topic portion, and body text unless the user explicitly asks for another language.
```

- [ ] **Step 5: `output.md` save path 문장을 조정한다**

Replace:

```markdown
3. **Save**: Write to `output/{type}-{topic-slug}-{YYYY-MM-DD}.md`.
```

With:

```markdown
3. **Save**: Write to `output/{type}-{한국어-주제명}-{YYYY-MM-DD}.md` by default for Korean content, using the filename policy in `references/wiki-structure.md`.
```

Keep the rest of the paragraph about chunked writes and frontmatter.

- [ ] **Step 6: `wiki-structure.md` Output Artifact Format 설명을 한국어 기본값으로 보강한다**

Do not add a new required frontmatter field. After the Output Artifact Format frontmatter example, add:

```markdown
For Korean wiki content, output artifact `title`, filename topic portion, section headings, and body text are Korean by default unless the user explicitly asks for another language. Existing output fields remain unchanged.
```

- [ ] **Step 7: 테스트를 실행한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
```

Expected: query, lint, output Korean defaults checks pass.

---

### Task 7: 생성 mirror 동기화

**Files:**
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/`

- [ ] **Step 1: Codex mirror를 재생성한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh
```

Expected: command exits with code 0.

- [ ] **Step 2: OpenCode mirror를 재생성한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/sync-opencode-plugin.sh
```

Expected: command exits with code 0.

- [ ] **Step 3: 생성물 diff를 확인한다**

Run:

```powershell
git -C D:/vibe-coding/llm-wiki-my diff --stat -- claude-plugin plugins AGENTS.md tests
```

Expected: `claude-plugin/`와 `plugins/llm-wiki/`가 함께 변경되어 있고, `plugins/llm-wiki/`만 단독 변경된 상태가 아니다.

---

### Task 8: 구조 테스트와 Codex smoke 검증

**Files:**
- No source edits

- [ ] **Step 1: 구조 테스트 전체를 실행한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-structure.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-codex-sync.sh
bash D:/vibe-coding/llm-wiki-my/tests/test-opencode-sync.sh
```

Expected:

```markdown
test-plugin-validate.sh: 0 failed
test-structure.sh: all assertions pass
test-local-cli-lint.sh: pass
test-codex-sync.sh: OK: Codex plugin mirror is in sync.
test-opencode-sync.sh: OK: OpenCode plugin mirror is in sync.
```

- [ ] **Step 2: Codex runtime smoke test를 실행한다**

Run:

```powershell
bash D:/vibe-coding/llm-wiki-my/tests/test-codex-runtime.sh
```

Expected: bootstrap and headless prompt-input check passes. If the test reports that `/plugins` must be opened once for first-time materialization, record that as install-step evidence rather than changing plugin behavior.

- [ ] **Step 3: scope creep scan을 실행한다**

Run:

```powershell
Select-String -Path D:/vibe-coding/llm-wiki-my/claude-plugin/commands/*.md,D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/*.md -Pattern 'ingest preview|mistaken ingest cleanup|CRUD/RUD|lecture template|PPT generator|worksheet generator'
```

Expected: no matches, except intentional negative-scope wording that says these are not implemented.

---

### Task 9: Codex 설치 전환 절차 문서화와 실행 준비

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/README.md`

- [ ] **Step 1: README Codex local install 섹션에 fork 전환 원칙을 추가한다**

Under the Codex local checkout install block, add:

```markdown
For fork testing, keep the upstream `nvk/llm-wiki` marketplace disabled or removed. This fork registers as `llm-wiki-my`, appears as "LLM Wiki My" in `/plugins`, and still exposes the `@wiki` entry point.
```

- [ ] **Step 2: 설치 전환 명령을 문서화한다**

Document these commands as the manual switch procedure. Do not run removal or install commands unless the user explicitly asks to switch the active Codex plugin.

```powershell
bash D:/vibe-coding/llm-wiki-my/scripts/bootstrap-codex-plugin.sh --scope user --verify
```

Expected:

```markdown
upstream llm-wiki is not active
local fork marketplace `llm-wiki-my` is registered
Codex reports "LLM Wiki My" can be enabled from /plugins
```

Before removing any existing marketplace, inspect the current plugin path and report it. If it points to a customized plugin, stop and ask for confirmation.

---

### Task 10: 보안 점검과 커밋 준비

**Files:**
- Changed files from Tasks 2-9

- [ ] **Step 1: 변경 파일 목록을 확인한다**

Run:

```powershell
git -C D:/vibe-coding/llm-wiki-my status --short
```

Expected: changed files are limited to:

```markdown
AGENTS.md
README.md
claude-plugin/commands/*.md
claude-plugin/skills/wiki-manager/references/*.md
plugins/llm-wiki/**
plugins/llm-wiki-opencode/**
tests/test-plugin-validate.sh
```

- [ ] **Step 2: 커밋 요청 시 보안 점검을 cp 스킬 흐름에 포함한다**

Do not run `git add` or `git commit` directly. When the user requests a commit, use the `cp` skill. During that commit flow, run the staged precommit gate after files are staged and before the commit is finalized:

```powershell
node C:/Users/ahnbu/.claude/skills/_shared/security-gate.mjs precommit --repo D:/vibe-coding/llm-wiki-my --staged
```

Expected: no secret, credential, suspicious install script, or external transfer risk is reported. If staged files are not available yet, do not bypass the gate; complete it inside the `cp` commit flow.

- [ ] **Step 3: 커밋은 cp 스킬로 수행한다**

Commit scope:

```markdown
docs/wiki: Codex용 LLM Wiki 포크 한국어 기본값 적용 — 다우기술 강의 준비용 raw distillation 안정화
```

Expected: one concern only. SPEC 문서 변경과 코드 레포 변경을 같은 커밋에 섞지 않는다.

## Self-Review

- SPEC R1-R3은 Tasks 4-6에서 반영된다.
- SPEC R4-R5는 Tasks 5-6의 범위 제한 문구와 scope creep scan에서 검증된다.
- SPEC R6은 Task 3에서 반영된다.
- SPEC R7은 Task 3과 Task 8에서 batch 기능을 새로 만들지 않는 것으로 유지된다.
- SPEC R8은 Task 6에서 `/wiki:output` 제거 금지로 반영된다.
- Codex 설치 대상과 `claude-plugin/` source of truth 혼동은 구현 원칙과 Task 7에 명시했다.
- 새 cleanup 기능, ingest preview, CRUD/RUD UI, 강의 산출물 생성 기능은 계획에 포함하지 않았다.
- 검증은 구조 테스트, sync 테스트, Codex runtime smoke, scope creep scan, security gate로 닫는다.

## 구현 결과

작성 시점: 2026-05-20 KST

### 반영 완료

| 항목 | 결과 | 확인 |
|---|---|---|
| 한국어 기본값 | ✅ 반영 | ingest/compile/query/output/lint 문서에 한국어 제목·본문·파일명 기본값을 반영했다. |
| `.wiki` Git 포함 기본값 | ✅ 반영 | init/구조 문서에서 `.wiki/`를 기본 ignore 처리하지 않도록 수정했다. |
| 기존 기능 유지 | ✅ 반영 | `/wiki:output`은 제거하지 않고, 산출물 언어·파일명 규칙만 한국어 기본값 영향을 받도록 했다. |
| Codex/OpenCode mirror | ✅ 반영 | `claude-plugin/` 변경을 `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/`로 동기화했다. |
| Codex 플러그인 식별자 | ✅ 반영 | fork marketplace를 `llm-wiki-my`, 표시명을 `LLM Wiki My`, enabled key를 `wiki@llm-wiki-my`로 분리했다. |
| 범위 통제 | ✅ 반영 | ingest preview, cleanup CRUD/RUD, PPT/worksheet generator는 구현하지 않았다. |
| 테스트 보강 | ✅ 반영 | fork 정책 검증과 Windows CRLF 대응을 테스트에 추가했다. |
| Changelog 일원화 | ✅ 반영 | upstream에 `CHANGELOG.md` 또는 `CHANGE*` 파일이 없음을 확인하고, fork 변경 이력을 `CHANGELOG.md` 하나로 통합했다. |

### 검증 결과

| 검증 | 결과 | 비고 |
|---|---|---|
| `bash tests/test-plugin-validate.sh` | ✅ 통과 | 91 passed, 0 failed |
| `bash tests/test-structure.sh` | ✅ 통과 | 170 passed, 0 failed |
| `bash tests/test-local-cli-lint.sh` | ✅ 통과 | 21 passed, 0 failed |
| scope creep scan | ✅ 통과 | 금지 범위 문구 매치 없음 |
| `node ... security-gate.mjs install-vet` | ✅ 통과 | local fork 설치 전 보안 점검 통과 |
| native Codex CLI 설치 확인 | ✅ 통과 | 별도 Codex CLI 세션에서 `wiki@llm-wiki-my (installed, enabled)`, skill root `C:/Users/ahnbu/.codex/plugins/cache/llm-wiki-my`, Available plugins `LLM Wiki My` 확인 |
| `bash tests/test-codex-sync.sh` | ⚠️ 보류 | 테스트가 `HEAD` 대비 mirror diff를 검사하므로, 현재 미커밋 구현 상태에서는 실패가 정상이다. 커밋 후 재실행해야 한다. |
| `bash tests/test-opencode-sync.sh` | ⚠️ 보류 | Codex sync와 동일하게 커밋 후 재실행 대상이다. |
| `bash tests/test-codex-runtime.sh` | ⚠️ 환경 이슈 | WSL Bash에서는 Windows Codex 래퍼가 `node`를 못 찾는다. 대신 native Codex CLI 세션에서 실제 설치 상태와 prompt context를 확인했다. |

### Codex 설치 전환 결과

확인 시점: 2026-05-20 KST

| 확인 항목 | 결과 | 근거 |
|---|---|---|
| fork marketplace 등록 | ✅ 완료 | `codex plugin marketplace list` → `llm-wiki-my    \\?\D:\vibe-coding\llm-wiki-my` |
| fork plugin 설치·활성화 | ✅ 완료 | `codex plugin list` → `wiki@llm-wiki-my (installed, enabled)` |
| 현재 세션 skill root | ✅ 완료 | prompt context에 `C:/Users/ahnbu/.codex/plugins/cache/llm-wiki-my` 확인 |
| 현재 세션 plugin 표시명 | ✅ 완료 | Available plugins에 `LLM Wiki My` 확인 |
| 기존 upstream 활성 잔여물 | ✅ 없음 | `wiki@llm-wiki`는 설치/활성 목록에 없음 |
| 구버전 cache 잔여물 | ✅ 제거 | `codex plugin remove wiki@llm-wiki` 후 빈 cache 폴더를 `safe-trash`로 정리했다. 현재 `cache`에는 `llm-wiki-my`만 남아 있다. |

판정: Codex 실행 대상은 fork 버전 `wiki@llm-wiki-my`다. 구버전 `llm-wiki` 설치·활성 항목과 cache 폴더는 남아 있지 않다.

### 커밋 전 남은 일

| 항목 | 상태 | 처리 기준 |
|---|---|---|
| 커밋 | ⚠️ 미수행 | 사용자 요청 시 `cp` 스킬로만 수행한다. |
| sync 테스트 최종 통과 | ⚠️ 커밋 후 가능 | mirror 변경이 `HEAD`에 포함된 뒤 재실행한다. |
| security gate | ⚠️ 커밋 흐름에서 수행 | staged 파일이 생긴 뒤 `precommit --repo D:/vibe-coding/llm-wiki-my --staged`로 실행한다. |
| 실제 Codex 플러그인 전환 | ✅ 완료 | native Codex CLI에서 `llm-wiki-my` marketplace, `wiki@llm-wiki-my (installed, enabled)`, `LLM Wiki My` context 확인 완료. |

## done-check-lite 결과

### 최종 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 전체 상태 | ⚠️ 커밋 전 | 핵심 fork 요구사항과 실제 Codex 설치 전환은 완료됐다. 남은 것은 현재 working tree 변경 커밋과 커밋 후 sync 테스트 재확인이다. |

### 요구사항 대조표

| 원래 요구사항 | 상태 | 구현 근거 | 검증 근거 | 비고 |
|---|---|---|---|---|
| nvk 플러그인을 fork해 바로 쓸 수 있게 핵심 이슈를 개선한다 | ✅ 완료 | `claude-plugin/commands/`, `references/`, `plugins/llm-wiki/` 변경 | `test-plugin-validate.sh`: 91 passed, 0 failed | Codex에서 `wiki@llm-wiki-my` 설치·활성 확인 완료 |
| 산출물 기본값은 한국어로 한다 | ✅ 완료 | ingest/compile/query/output/lint 문서와 구조 문서에 한국어 기본값 반영 | fork policy checks 통과 | 별도 한국어 사본이 아니라 정본 기본값으로 반영 |
| wiki 역할은 raw data distill로 제한한다 | ✅ 완료 | output 문서에서 기존 기능 유지, 강의 산출물 generator 추가 금지 | scope creep scan 매치 없음 | ingest preview/cleanup CRUD/RUD도 추가하지 않음 |
| `.wiki/raw` 포함해 `.wiki`는 일단 Git 포함 기본값으로 둔다 | ✅ 완료 | `wiki.md`, `wiki-structure.md`, `AGENTS.md` 수정 | fork policy checks 통과 | 대용량/secret 예외는 문제 발생 시 별도 처리 |
| 기존 플러그인 삭제/해제 후 fork 설치 프로세스를 계획문서와 README에 포함한다 | ✅ 완료 | README local install 섹션과 계획문서 Task 9 | 문서 확인 및 native Codex CLI 확인 | `llm-wiki-my` 설치·활성 완료, 기존 `wiki@llm-wiki` 활성 잔여 없음 |
| 구현 결과를 계획문서에 업데이트한다 | ✅ 완료 | 본 문서 `구현 결과`, `done-check-lite 결과` 섹션 | 문서 확인 | 현재 상태와 보류 사유 포함 |
| 계획의 검증 게이트를 모두 닫는다 | ⚠️ 커밋 전 | 핵심 로컬 테스트와 native Codex 설치 확인은 통과 | sync 테스트는 커밋 후 재확인 대상 | 커밋 필요 |

### 미완료·승인 필요 항목

| 항목 | 문제 | 필요한 다음 작업 |
|---|---|---|
| sync 최종 검증 | `test-codex-sync.sh`, `test-opencode-sync.sh`는 `HEAD` 기준 diff를 검사하므로 미커밋 상태에서는 실패한다. | 사용자가 커밋을 요청하면 `cp` 스킬로 커밋한 뒤 두 테스트를 재실행한다. |
| Codex runtime 검증 | WSL Bash 자동 테스트는 `node` 경로 문제로 실패한다. | native Codex CLI 세션에서 설치·활성·prompt context 검증을 완료했으므로, 자동 테스트는 환경 이슈로만 남긴다. |
| security gate | 커밋 전 staged 파일이 아직 없으므로 precommit gate를 실행하지 않았다. | 커밋 요청 시 staged 상태에서 `security-gate.mjs precommit --repo D:/vibe-coding/llm-wiki-my --staged` 실행. |

### 검증 근거

| 구분 | 근거 |
|---|---|
| 실행한 검증 | `bash tests/test-plugin-validate.sh` → 91 passed, 0 failed; `bash tests/test-structure.sh` → 170 passed, 0 failed; `bash tests/test-local-cli-lint.sh` → 21 passed, 0 failed; scope creep scan → no matches; native Codex CLI → `wiki@llm-wiki-my (installed, enabled)`; cache 확인 → `llm-wiki-my`만 남음 |
| 확인한 파일 | `AGENTS.md`, `README.md`, `claude-plugin/commands/*.md`, `claude-plugin/skills/wiki-manager/references/*.md`, `plugins/llm-wiki/**`, `plugins/llm-wiki-opencode/**`, `tests/*.sh` |
| 커밋 | 없음. 현재 구현 변경은 working tree에 남아 있다. |
