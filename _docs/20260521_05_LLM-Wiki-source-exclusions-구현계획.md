---
title: LLM Wiki source exclusions 구현계획
created: 2026-05-21 18:51
tags:
  - plan
session_id: codex:019e49db-5101-7812-ab3a-b7bb88b5f724
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/21/rollout-2026-05-21T18-26-15-019e49db-5101-7812-ab3a-b7bb88b5f724.jsonl
ai: codex
---

# LLM Wiki Source Exclusions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `raw/`에 보존해야 하지만 일반 compile/query/coverage 대상에서는 제외해야 하는 source를 `_source-exclusions.json`으로 명시 관리한다.

**Architecture:** 물리적으로 raw 파일을 옮기지 않고, wiki root 기준 `raw/_source-exclusions.json`을 source-of-truth registry로 둔다. 결정적 helper(`scripts/llm-wiki`)가 registry를 읽어 lint coverage와 source provenance에 반영하고, agentic command 문서는 compile/query가 excluded source를 기본 제외하도록 지시한다.

**Tech Stack:** Python stdlib deterministic lint helper, Markdown command/reference docs, Bash test harness, generated Codex/OpenCode plugin mirrors.

---

## Scope Boundary

이번 계획에서 구현한다:

- `raw/_source-exclusions.json` 파일을 공식 wiki-managed metadata로 인정한다.
- uncompiled source coverage report의 정식 위치를 `raw/_uncompiled-source-coverage.md`로 옮긴다.
- excluded source는 uncompiled coverage backlog 생성 대상에서 제외한다.
- compiled article이 excluded source를 계속 cite하면 lint warning으로 드러낸다.
- compile/query 문서에 excluded source 기본 제외와 명시적 포함 규칙을 추가한다.
- sync script로 Codex/OpenCode plugin mirror를 갱신한다.

이번 계획에서 하지 않는다:

- 기존 raw source 파일을 `raw/excluded/`로 이동하지 않는다.
- 현재 다우기술 프로젝트 `.wiki/`의 특정 epilogue/감사의말/용어해설 파일을 실제 제외 처리하지 않는다.
- `/wiki:retract`의 삭제 semantics를 바꾸지 않는다.
- SQLite나 장기 상태 DB를 새로 도입하지 않는다.

## Registry Contract

파일 위치:

```markdown
raw/_source-exclusions.json
```

형식:

```json
{
  "version": 1,
  "sources": {
    "raw/articles/2026-05-21-example-appendix.md": {
      "reason": "appendix",
      "note": "에필로그성 자료라 일반 compile 대상에서 제외한다.",
      "excluded_at": "2026-05-21",
      "excluded_by": "manual"
    }
  }
}
```

검증 규칙:

- `version`은 `1`이어야 한다.
- `sources`는 object여야 한다.
- key는 wiki root 기준 `raw/.../*.md` 상대 경로여야 한다.
- key는 실제 파일로 resolve되어야 한다.
- key는 `raw/_index.md`나 `raw/_source-exclusions.json`이면 안 된다.
- `reason`은 다음 중 하나여야 한다: `appendix`, `acknowledgements`, `glossary`, `front-matter`, `back-matter`, `non-substantive`, `duplicate`, `other`.
- `excluded_at`은 `YYYY-MM-DD` 형식이어야 한다.

## Existing Compiled Reference Policy

이미 compiled article에 반영된 source를 excluded로 등록할 때는 raw만 제외하고 끝내지 않는다. active wiki에 남아 있는 provenance를 별도로 점검한다.

옵션:

| 옵션 | 처리 | 판단 |
|---|---|---|
| 보존만 하고 warning | raw는 excluded 등록, 기존 compiled article은 그대로 둔다 | ❌ 무의미 자료가 active wiki evidence로 계속 남는다 |
| 참조 제거 + 재컴파일 권장 | 여러 source 중 일부가 excluded이면 `sources:`와 Sources section에서 제거하고 남은 source 기준으로 재검토한다 | ✅ 기본 권장안 |
| 단독 source article cleanup 후보 | 모든 source가 excluded이면 active knowledge 근거가 없으므로 삭제/보류/재작성 후보로 보고한다 | ✅ 단독-source article 권장안 |

권장 정책:

- 여러 source 중 일부가 무의미 자료이면 참조 제거 후 남은 source 기준으로 재검토한다.
- 무의미 자료 하나만으로 만들어진 article은 active wiki 제거 후보로 분류한다.
- compiled article 삭제, 본문 수정, provenance 제거는 자동 처리하지 않는다.
- lint는 blast-radius 보고만 수행하고, 실제 cleanup은 사용자 명시 승인 후 별도 실행한다.

## Data Migration And Compatibility

- 기존 `wiki/references/uncompiled-source-coverage.md`는 legacy 위치로 본다.
- `lint --fix`는 legacy 파일이 있고 새 파일이 없을 때만 `raw/_uncompiled-source-coverage.md`로 이동한다.
- 이동 후 `wiki/references/_index.md`에 남은 legacy row/link는 제거하거나 index를 재생성한다.
- legacy 파일과 새 파일이 동시에 있으면 자동 병합하지 않고 warning만 낸다.
- existing compiled reference cleanup은 report-only다. compiled article 삭제, 본문 수정, provenance 제거는 별도 승인 없이는 수행하지 않는다.
- 현재 프로젝트 `.wiki/`에 이미 존재하는 backlog 파일은 기능 배포 후 `lint --fix` 실행으로 migration 검증 대상이다.

## File Structure

- Modify: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`
  - `_source-exclusions.json` 로딩, 검증, lint/coverage/source-reference 반영, coverage report 위치 변경, legacy coverage index cleanup, compiled reference cleanup 후보 보고.
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh`
  - registry 유효성, coverage 제외, raw coverage backlog 생성, excluded source citation warning, only-excluded cleanup 후보 회귀 테스트.
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-structure.sh`
  - golden fixture에 registry 파일이 생길 경우 구조 테스트가 이를 허용하도록 조정.
- Modify: `D:/vibe-coding/llm-wiki-my/tests/fixtures/golden-wiki/raw/_source-exclusions.json`
  - 빈 registry 또는 최소 excluded fixture를 추가한다.
- Modify: `D:/vibe-coding/llm-wiki-my/tests/generate-defect-fixtures.sh`
  - golden fixture 복제 기반 defect 생성이 새 registry를 보존하도록 확인한다.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/compile.md`
  - compile가 excluded source를 기본 제외하고, 명시 포함 시에만 읽도록 지시한다.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/query.md`
  - raw/deep query가 excluded source를 기본 제외하도록 지시한다.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
  - lint가 registry 검증과 excluded coverage semantics를 수행한다고 명시한다.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/retract.md`
  - excluded source cleanup은 자동 삭제가 아니라 blast-radius 보고 후 명시 승인 대상임을 맞춘다.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/linting.md`
  - C11/C12/C4b/C6 coverage 규칙에 `_source-exclusions.json` semantics를 문서화한다.
- Modify: `D:/vibe-coding/llm-wiki-my/AGENTS.md`
  - portable protocol에 source exclusions registry를 추가한다.
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/**`
  - `scripts/sync-codex-plugin.sh`로 갱신한다.
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/**`
  - `scripts/sync-opencode-plugin.sh`로 갱신한다.

### Task 1: deterministic helper에 source exclusion registry 모델 추가

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`
- Test: `D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh`

- [ ] **Step 1: failing test를 추가한다**

`tests/test-local-cli-lint.sh`의 coverage repair 테스트 뒤에 아래 테스트를 추가한다.

```bash
excluded_coverage="$tmpdir/excluded-coverage"
mkdir "$excluded_coverage"
cp -R "$GOLDEN/." "$excluded_coverage/"
cat > "$excluded_coverage/raw/articles/2026-01-05-appendix.md" <<'EOF'
---
title: "Appendix Fixture"
source: https://example.com/appendix
type: articles
ingested: 2026-01-05
tags: [appendix]
summary: "Appendix-like raw source fixture that should be excluded from coverage backlog."
---

# Appendix Fixture

Non-substantive back matter.
EOF
cat > "$excluded_coverage/raw/_source-exclusions.json" <<'EOF'
{
  "version": 1,
  "sources": {
    "raw/articles/2026-01-05-appendix.md": {
      "reason": "appendix",
      "note": "coverage backlog exclusion fixture",
      "excluded_at": "2026-01-05",
      "excluded_by": "test"
    }
  }
}
EOF
set +e
excluded_output="$("$CLI" lint --fix "$excluded_coverage" 2>&1)"
excluded_rc=$?
set -e
if [ "$excluded_rc" -eq 0 ] \
  && grep -q "Result: PASS" <<<"$excluded_output" \
  && { [ ! -f "$excluded_coverage/raw/_uncompiled-source-coverage.md" ] \
    || ! grep -q "raw/articles/2026-01-05-appendix.md" "$excluded_coverage/raw/_uncompiled-source-coverage.md"; }; then
  log_pass "excluded raw source is omitted from coverage backlog"
else
  log_fail "excluded raw source is omitted from coverage backlog" "$excluded_output"
fi
```

완료 기준:

- registry에 있는 raw source가 `uncompiled-source-coverage.md`에 추가되지 않는다.
- registry가 있어도 lint는 PASS다.

검증 방법:

Run: `bash tests/test-local-cli-lint.sh`

Expected before implementation: 새 테스트가 실패하거나 excluded source가 coverage page에 들어간다.

- [ ] **Step 2: registry 상수와 parser를 추가한다**

`scripts/llm-wiki`의 상수 영역에 추가한다.

```python
SOURCE_EXCLUSIONS_FILE = Path("raw/_source-exclusions.json")
SOURCE_EXCLUSION_REASONS = {
    "appendix",
    "acknowledgements",
    "glossary",
    "front-matter",
    "back-matter",
    "non-substantive",
    "duplicate",
    "other",
}
```

`LintContext.__init__`에 상태를 추가한다.

```python
self.excluded_sources: set[Path] = set()
```

아래 helper를 `load_documents` 앞에 추가한다.

```python
def load_source_exclusions(ctx: LintContext) -> None:
    registry_path = ctx.root / SOURCE_EXCLUSIONS_FILE
    ctx.excluded_sources = set()
    if not registry_path.exists():
        return
    try:
        data = json.loads(registry_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        ctx.issue("critical", f"Source exclusions registry is invalid JSON: {exc}", registry_path)
        return
    except OSError as exc:
        ctx.issue("critical", f"Could not read source exclusions registry: {exc}", registry_path)
        return

    if data.get("version") != 1:
        ctx.issue("critical", "Source exclusions registry version must be 1.", registry_path)
        return
    sources = data.get("sources")
    if not isinstance(sources, dict):
        ctx.issue("critical", "Source exclusions registry must contain object field: sources.", registry_path)
        return

    for rel_path, meta in sources.items():
        if not isinstance(rel_path, str) or not rel_path.startswith("raw/") or not rel_path.endswith(".md"):
            ctx.issue("critical", f"Excluded source path must be a raw markdown path: {rel_path}", registry_path)
            continue
        if rel_path in {"raw/_index.md", str(SOURCE_EXCLUSIONS_FILE), "raw/_uncompiled-source-coverage.md"}:
            ctx.issue("critical", f"Excluded source path cannot target registry/index files: {rel_path}", registry_path)
            continue
        if not isinstance(meta, dict):
            ctx.issue("critical", f"Excluded source metadata must be an object: {rel_path}", registry_path)
            continue
        reason = meta.get("reason")
        if reason not in SOURCE_EXCLUSION_REASONS:
            expected = ", ".join(sorted(SOURCE_EXCLUSION_REASONS))
            ctx.issue("critical", f"Invalid source exclusion reason for {rel_path}: {reason!r}; expected one of {expected}.", registry_path)
        excluded_at = str(meta.get("excluded_at", ""))
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", excluded_at):
            ctx.issue("critical", f"Excluded source must have excluded_at as YYYY-MM-DD: {rel_path}", registry_path)

        resolved = (ctx.root / rel_path).resolve()
        try:
            resolved.relative_to(ctx.root)
        except ValueError:
            ctx.issue("critical", f"Excluded source escapes wiki root: {rel_path}", registry_path)
            continue
        if not resolved.exists() or not resolved.is_file():
            ctx.issue("critical", f"Excluded source does not exist: {rel_path}", registry_path)
            continue
        ctx.excluded_sources.add(resolved)
```

완료 기준:

- registry가 없으면 기존 동작과 동일하다.
- registry가 있으면 `ctx.excluded_sources`에 canonical absolute path set이 채워진다.
- invalid registry는 critical issue를 만든다.

- [ ] **Step 3: lint 실행 흐름에서 registry를 먼저 로드한다**

`run_lint` 또는 `load_documents(ctx)` 호출 직전에 아래 호출을 넣는다.

```python
load_source_exclusions(ctx)
```

완료 기준:

- frontmatter/schema/coverage 검사 전에 exclusion 상태가 준비된다.

검증 방법:

Run: `python scripts/llm-wiki lint tests/fixtures/golden-wiki`

Expected: `Result: PASS`

### Task 2: raw metadata 파일을 구조적으로 허용한다

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-structure.sh`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/fixtures/golden-wiki/raw/_source-exclusions.json`

- [ ] **Step 1: raw allowlist에 registry와 coverage report를 추가한다**

`scripts/llm-wiki`의 `RAW_ALLOWED`에 `_source-exclusions.json`과 `_uncompiled-source-coverage.md`를 추가한다.

```python
RAW_ALLOWED = {
    "_index.md",
    "_source-exclusions.json",
    "_uncompiled-source-coverage.md",
    "articles",
    "papers",
    "repos",
    "notes",
    "data",
}
```

완료 기준:

- `raw/_source-exclusions.json`이 C12 unknown file로 잡히지 않는다.
- `raw/_uncompiled-source-coverage.md`가 C12 unknown file로 잡히지 않는다.

- [ ] **Step 2: raw metadata md가 raw source로 검사되지 않게 제외한다**

`content_markdown_files` 또는 `is_schema_checked_path`에서 `raw/_uncompiled-source-coverage.md`를 raw source 검사 대상에서 제외한다.

권장 구현:

```python
RAW_METADATA_FILES = {"_index.md", "_uncompiled-source-coverage.md"}


def content_markdown_files(root: Path) -> list[Path]:
    return [
        path
        for path in markdown_files(root)
        if path.name != "_index.md"
        and path.name != "config.md"
        and not (path.parent.name == "raw" and path.name in RAW_METADATA_FILES)
    ]
```

완료 기준:

- `raw/_uncompiled-source-coverage.md`는 `title/source/type/ingested/tags/summary`를 요구받지 않는다.
- `raw/_uncompiled-source-coverage.md` 자체가 coverage backlog의 raw source로 다시 잡히지 않는다.

- [ ] **Step 3: structure test allowlist도 맞춘다**

`tests/test-structure.sh`에서 raw root 허용 파일을 검사하는 위치가 있으면 `_source-exclusions.json`과 `_uncompiled-source-coverage.md`를 허용한다. `raw/*.md`만 검사하는 로직이면 `raw/_uncompiled-source-coverage.md`가 raw source frontmatter 필수값 검사에서 제외되도록 조정한다.

완료 기준:

- golden fixture에 registry가 있어도 structure test가 실패하지 않는다.
- golden fixture 또는 lint 생성 결과에 coverage report가 있어도 structure test가 실패하지 않는다.

- [ ] **Step 4: golden fixture에 빈 registry를 추가한다**

파일을 생성한다.

```json
{
  "version": 1,
  "sources": {}
}
```

완료 기준:

- 모든 기본 fixture가 registry 파일 존재 상태에서도 통과한다.

검증 방법:

Run: `bash tests/test-structure.sh`

Expected: 기존 pass count가 유지되고 failure가 없다.

### Task 3: coverage report 위치를 `raw/_uncompiled-source-coverage.md`로 옮긴다

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/linting.md`

- [ ] **Step 1: coverage repair 테스트의 기대 위치를 바꾼다**

`tests/test-local-cli-lint.sh`의 기존 coverage repair 테스트에서 기대 경로를 아래처럼 바꾼다.

```bash
&& [ -f "$coverage_repair/raw/_uncompiled-source-coverage.md" ] \
&& grep -q "raw/articles/2026-01-05-uncompiled-source.md" "$coverage_repair/raw/_uncompiled-source-coverage.md"
```

기존 기대값에서 제거한다.

```bash
[ -f "$coverage_repair/wiki/references/uncompiled-source-coverage.md" ]
grep -q "Uncompiled Source Coverage" "$coverage_repair/wiki/references/_index.md"
```

완료 기준:

- coverage backlog는 compiled article 영역인 `wiki/references/`에 생성되지 않는다.
- coverage backlog는 raw 처리 상태 파일인 `raw/_uncompiled-source-coverage.md`에 생성된다.

- [ ] **Step 2: helper 생성 위치를 바꾼다**

`create_or_update_coverage_reference`의 `coverage_path`를 변경한다.

```python
coverage_path = ctx.root / "raw" / "_uncompiled-source-coverage.md"
```

기존 `wiki/references/_index.md` 갱신 로직이 있으면 제거한다. 이 파일은 compiled wiki reference가 아니므로 `wiki/references/_index.md`에 등록하지 않는다.

완료 기준:

- `lint --fix`는 `raw/_uncompiled-source-coverage.md`를 생성/갱신한다.
- `wiki/references/uncompiled-source-coverage.md`를 새로 만들지 않는다.

- [ ] **Step 3: 기존 위치 파일을 migration 대상으로 처리한다**

`lint --fix` 실행 시 기존 `wiki/references/uncompiled-source-coverage.md`가 있고 새 위치가 없으면 `raw/_uncompiled-source-coverage.md`로 이동한다. 새 위치가 이미 있으면 기존 파일은 자동 병합하지 말고 warning을 낸다.

권장 helper:

```python
def migrate_legacy_coverage_reference(ctx: LintContext) -> None:
    legacy = ctx.root / "wiki" / "references" / "uncompiled-source-coverage.md"
    target = ctx.root / "raw" / "_uncompiled-source-coverage.md"
    if not legacy.exists():
        return
    if not ctx.fix:
        ctx.issue(
            "warning",
            "Legacy coverage backlog belongs at raw/_uncompiled-source-coverage.md.",
            legacy,
            fixable=True,
        )
        return
    if target.exists():
        ctx.issue(
            "warning",
            "Legacy coverage backlog exists but target already exists; merge manually.",
            legacy,
        )
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(legacy), str(target))
    remove_legacy_coverage_index_entry(ctx, legacy)
    ctx.fixed("Moved legacy coverage backlog to raw/_uncompiled-source-coverage.md.")
```

완료 기준:

- 기존 위치의 coverage backlog가 새 위치로 수렴한다.
- `wiki/references/_index.md`에 `uncompiled-source-coverage.md` legacy row/link가 남지 않는다.
- 충돌 시 자동 병합하지 않는다.

검증 방법:

Run: `bash tests/test-local-cli-lint.sh`

Expected: coverage repair 테스트가 새 위치 기준으로 PASS하고, legacy migration fixture의 `wiki/references/_index.md`에는 `uncompiled-source-coverage.md`가 없다.

### Task 4: existing compiled references cleanup 후보를 보고한다

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`
- Test: `D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh`

- [ ] **Step 1: coverage 검사에서 excluded source를 제외한다**

`check_coverage`의 raw loop 초반에 추가한다.

```python
        if raw_file.resolve() in ctx.excluded_sources:
            continue
```

완료 기준:

- excluded source는 orphan-source suggestion을 만들지 않는다.
- `--fix` coverage backlog에도 excluded source가 들어가지 않는다.

검증 방법:

Run: `bash tests/test-local-cli-lint.sh`

Expected: `excluded raw source is omitted from coverage backlog` PASS.

- [ ] **Step 2: compiled article별 resolved/excluded source 목록을 수집한다**

`check_source_provenance`에서 article별 resolved source 목록과 excluded source 목록을 수집한다. 이 단계에서는 user-facing warning을 만들지 않는다. warning은 Step 3/4에서 다중-source와 only-excluded case로 분류해 한 번만 낸다.

```python
                resolved_sources: list[Path] = []
                excluded_refs: list[str] = []
```

완료 기준:

- excluded source는 존재하므로 dangling source warning은 아니다.
- active compiled article의 provenance에 남은 excluded source가 article 단위로 분류된다.
- 동일 article에 대해 generic warning과 cleanup policy warning이 중복 출력되지 않는다.

- [ ] **Step 3: 다중-source article은 참조 제거 + 재검토 후보로 보고한다**

각 source resolve 후 resolved source와 excluded source를 모은다.

권장 동작:

```python
                        source_text = str(source)
                        resolved_sources.append(resolved.resolve())
                        if resolved.resolve() in ctx.excluded_sources:
                            excluded_refs.append(source_text)
```

article source loop가 끝난 뒤, 일부 source만 excluded이면 아래 warning을 낸다.

```python
                if excluded_refs and len(excluded_refs) < len(resolved_sources):
                    ctx.issue(
                        "warning",
                        "Compiled article cites excluded source(s); remove those references and re-review against remaining sources.",
                        doc.path,
                    )
```

완료 기준:

- 여러 source 중 일부가 excluded인 article이 cleanup 후보로 표시된다.
- 자동으로 `sources:`를 수정하지 않는다.
- 자동으로 Sources section이나 본문을 수정하지 않는다.

- [ ] **Step 4: excluded source만으로 만들어진 compiled article을 active cleanup 후보로 분리한다**

`check_source_provenance`에서 article별 resolved source 목록을 모아, 모든 resolved source가 excluded source이면 더 강한 warning을 낸다.

article source loop가 끝난 뒤:

```python
                if resolved_sources and all(path in ctx.excluded_sources for path in resolved_sources):
                    ctx.issue(
                        "warning",
                        "Compiled article is backed only by excluded sources; classify as cleanup candidate before keeping it active.",
                        doc.path,
                    )
```

완료 기준:

- 모든 source가 excluded인 article은 active wiki 제거/보류/재작성 후보로 분리된다.
- 자동 삭제나 자동 본문 수정은 하지 않는다.

- [ ] **Step 5: citation warning 회귀 테스트를 추가한다**

`tests/test-local-cli-lint.sh`에 아래 테스트를 추가한다.

```bash
excluded_cited="$tmpdir/excluded-cited"
mkdir "$excluded_cited"
cp -R "$GOLDEN/." "$excluded_cited/"
cat > "$excluded_cited/raw/_source-exclusions.json" <<'EOF'
{
  "version": 1,
  "sources": {
    "raw/articles/2026-01-01-sample-article.md": {
      "reason": "duplicate",
      "note": "fixture for excluded source citation warning",
      "excluded_at": "2026-01-05",
      "excluded_by": "test"
    }
  }
}
EOF
set +e
excluded_cited_output="$("$CLI" lint "$excluded_cited" 2>&1)"
excluded_cited_rc=$?
set -e
if [ "$excluded_cited_rc" -ne 0 ] \
  && grep -q "remove those references and re-review" <<<"$excluded_cited_output"; then
  log_pass "compiled article citing excluded source warns"
else
  log_fail "compiled article citing excluded source warns" "$excluded_cited_output"
fi
```

완료 기준:

- source가 존재해도 excluded registry에 있으면 classified warning으로 surfaced된다.
- 다중-source fixture는 참조 제거 + 재검토 문구를 확인한다.

검증 방법:

Run: `bash tests/test-local-cli-lint.sh`

Expected: 해당 테스트 PASS.

- [ ] **Step 6: only-excluded article cleanup 후보 테스트를 추가한다**

`tests/test-local-cli-lint.sh`에 `wiki/references/sample-reference.md`의 단독 source인 `raw/articles/2026-01-02-second-article.md`를 excluded로 등록하는 fixture를 만들고, 아래 메시지가 출력되는지 확인한다.

```bash
grep -q "backed only by excluded sources" <<<"$only_excluded_output"
```

완료 기준:

- 이미 compile된 무의미 source 기반 article이 자동 삭제되지 않고 cleanup 후보로 표시된다.
- 테스트 이름 `only-excluded article cleanup candidate warns`가 PASS로 출력된다.

- [ ] **Step 7: cleanup 보고 문구를 문서와 맞춘다**

lint output 문구는 다음 정책을 구분해야 한다.

```markdown
Compiled article cites excluded source(s); remove those references and re-review against remaining sources.
Compiled article is backed only by excluded sources; classify as cleanup candidate before keeping it active.
```

완료 기준:

- 다중-source article은 참조 제거 + 재검토 후보로 보고된다.
- 단독-source article은 active wiki cleanup 후보로 보고된다.
- 어느 경우에도 자동 삭제, 자동 본문 수정, 자동 provenance 제거를 하지 않는다.

### Task 5: invalid registry 테스트를 추가한다

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh`

- [ ] **Step 1: malformed JSON 테스트를 추가한다**

```bash
bad_exclusions_json="$tmpdir/bad-exclusions-json"
mkdir "$bad_exclusions_json"
cp -R "$GOLDEN/." "$bad_exclusions_json/"
cat > "$bad_exclusions_json/raw/_source-exclusions.json" <<'EOF'
{ "version": 1, "sources":
EOF
set +e
bad_exclusions_output="$("$CLI" lint "$bad_exclusions_json" 2>&1)"
bad_exclusions_rc=$?
set -e
if [ "$bad_exclusions_rc" -ne 0 ] \
  && grep -q "Source exclusions registry is invalid JSON" <<<"$bad_exclusions_output"; then
  log_pass "invalid source exclusions JSON fails lint"
else
  log_fail "invalid source exclusions JSON fails lint" "$bad_exclusions_output"
fi
```

완료 기준:

- malformed registry가 critical issue로 실패한다.

- [ ] **Step 2: missing source path 테스트를 추가한다**

```bash
missing_excluded_source="$tmpdir/missing-excluded-source"
mkdir "$missing_excluded_source"
cp -R "$GOLDEN/." "$missing_excluded_source/"
cat > "$missing_excluded_source/raw/_source-exclusions.json" <<'EOF'
{
  "version": 1,
  "sources": {
    "raw/articles/no-such-source.md": {
      "reason": "appendix",
      "note": "missing path fixture",
      "excluded_at": "2026-01-05",
      "excluded_by": "test"
    }
  }
}
EOF
set +e
missing_excluded_output="$("$CLI" lint "$missing_excluded_source" 2>&1)"
missing_excluded_rc=$?
set -e
if [ "$missing_excluded_rc" -ne 0 ] \
  && grep -q "Excluded source does not exist" <<<"$missing_excluded_output"; then
  log_pass "missing excluded source fails lint"
else
  log_fail "missing excluded source fails lint" "$missing_excluded_output"
fi
```

완료 기준:

- registry가 dead entry를 품으면 lint가 실패한다.

검증 방법:

Run: `bash tests/test-local-cli-lint.sh`

Expected after implementation: 모든 신규 테스트 PASS.

### Task 6: command/reference 문서에 기본 제외 동작과 coverage 위치를 명시한다

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/compile.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/query.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/lint.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/retract.md`
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/linting.md`
- Modify: `D:/vibe-coding/llm-wiki-my/AGENTS.md`

- [ ] **Step 1: compile command에 `--include-excluded`를 추가한다**

`argument-hint`에 `--include-excluded`를 추가하고, 옵션 설명을 넣는다.

```markdown
- **--include-excluded**: Explicitly allow sources listed in `raw/_source-exclusions.json`. Without this flag, compile must skip excluded sources even when they are uncompiled by date.
```

Compilation Process의 Survey/Read sources 단계에 다음 규칙을 추가한다.

```markdown
Source exclusion awareness: read `raw/_source-exclusions.json` if present. Excluded sources are preserved assets, not compile inputs. Skip them in incremental and full compile unless `--include-excluded` is explicitly present. If `--source <path>` targets an excluded source without `--include-excluded`, stop and report that the source is excluded.
```

완료 기준:

- 일반 compile, full compile, source-target compile의 excluded 처리 규칙이 모두 명시된다.

- [ ] **Step 2: query command에 raw/deep 제외 규칙을 추가한다**

`query.md`의 `--raw`/`--deep` 설명 근처에 추가한다.

```markdown
Source exclusion awareness: raw/deep search skips sources listed in `raw/_source-exclusions.json` by default. Include them only when the user explicitly asks for excluded sources or passes `--include-excluded`; label any such citation as excluded.
```

완료 기준:

- excluded source가 기본 답변 근거로 쓰이지 않는다.

- [ ] **Step 3: lint reference에 C4b/C6/C11/C12 반영을 추가한다**

`linting.md`에 다음 내용을 반영한다.

```markdown
`raw/_source-exclusions.json` is a wiki-managed metadata file, not a raw source. `raw/_uncompiled-source-coverage.md` is a raw-source processing backlog, not a compiled wiki article. C12 allows both under `raw/`. C11 never moves them. C6 writes uncompiled coverage to `raw/_uncompiled-source-coverage.md` and ignores sources listed in `_source-exclusions.json`. C4b still resolves excluded source paths, but active compiled articles citing them receive a warning because excluded sources should not remain active evidence without review. If every resolved source for an article is excluded, report it as an active-wiki cleanup candidate; do not auto-delete it.
```

완료 기준:

- schema evolution checklist와 allowlist 문맥이 registry와 coverage report 위치를 포함한다.

- [ ] **Step 4: retract command에 cleanup 정책을 명시한다**

`retract.md`에는 excluded source cleanup이 raw 삭제와 다르다는 점을 명시한다. excluded source는 보존 자산이므로, cleanup은 먼저 blast-radius를 보고하고 사용자가 승인한 뒤 article 참조 제거/재컴파일/제거 후보 처리를 수행한다.

추가 문구:

```markdown
Source exclusion cleanup is not retraction. When a source is listed in `raw/_source-exclusions.json`, preserve the raw file. First report compiled articles that cite it. If the article has remaining non-excluded sources, recommend removing the excluded source from `sources:` and the Sources section, then re-reviewing/recompiling against the remaining sources. If every source is excluded, report the article as an active-wiki cleanup candidate. Do not delete or rewrite compiled articles automatically without explicit user approval.
```

완료 기준:

- retract와 exclude cleanup의 차이가 문서상 분명하다.
- 이미 compile된 무의미 source는 자동 삭제가 아니라 blast-radius 보고 후 승인 대상으로 남는다.

- [ ] **Step 5: portable protocol에도 registry를 추가한다**

`AGENTS.md`의 Raw Source 또는 Core Principles 근처에 source exclusions section을 추가한다.

```markdown
### Source Exclusions

`raw/_source-exclusions.json` records raw source files that are preserved but excluded from normal compile/query/coverage workflows. Do not move excluded sources by default; exact `sources:` paths must remain stable. Compile/query skip excluded sources unless the user explicitly includes them. Lint validates the registry and warns when active compiled articles still cite excluded sources.

`raw/_uncompiled-source-coverage.md` is the generated backlog for raw sources that still need compilation review. It belongs under `raw/`, not `wiki/references/`, because it is source processing state rather than compiled knowledge.
```

완료 기준:

- Claude/Codex/OpenCode 외의 에이전트가 AGENTS.md만 읽어도 같은 규칙을 따른다.

검증 방법:

Run: `rg -n "_source-exclusions|_uncompiled-source-coverage|include-excluded|excluded source" claude-plugin AGENTS.md`

Expected: compile/query/linting/AGENTS 문서에서 모두 검색된다.

### Task 7: generated plugin mirror를 갱신한다

**Files:**
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/**`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/**`

- [ ] **Step 1: Codex plugin mirror를 재생성한다**

Run:

```bash
bash scripts/sync-codex-plugin.sh
```

Expected:

- `plugins/llm-wiki/skills/wiki/SKILL.md` 또는 references가 source와 동기화된다.
- 실패 시 출력이 수정 지점을 설명한다.

- [ ] **Step 2: OpenCode plugin mirror를 재생성한다**

Run:

```bash
bash scripts/sync-opencode-plugin.sh
```

Expected:

- `plugins/llm-wiki-opencode/` mirror가 source와 동기화된다.

완료 기준:

- source-of-truth인 `claude-plugin/`과 generated plugin mirror가 sync test를 통과한다.

### Task 8: 전체 검증을 실행한다

**Files:**
- No additional file changes.

- [ ] **Step 1: deterministic local lint tests를 실행한다**

Run:

```bash
bash tests/test-local-cli-lint.sh
```

Expected:

- 실패 없음.
- 신규 테스트 이름이 PASS로 출력된다:
  - `excluded raw source is omitted from coverage backlog`
  - `compiled article citing excluded source warns`
  - `only-excluded article cleanup candidate warns`
  - `invalid source exclusions JSON fails lint`
  - `missing excluded source fails lint`

- [ ] **Step 2: structural tests를 실행한다**

Run:

```bash
bash tests/test-structure.sh
```

Expected:

- 실패 없음.
- golden fixture와 defect fixture 검사가 모두 통과한다.

- [ ] **Step 3: plugin validation과 sync tests를 실행한다**

Run:

```bash
bash tests/test-plugin-validate.sh
bash tests/test-codex-sync.sh
bash tests/test-opencode-sync.sh
```

Expected:

- 세 명령 모두 실패 없음.
- sync test가 실패하면 generated mirror를 다시 생성한 뒤 재실행한다.

## Commit Guidance

커밋은 직접 `git add`/`git commit` 하지 말고 `cp` 스킬을 사용한다.

권장 커밋 단위:

1. `feat(lint): source exclusions registry 추가 — raw 보존 자산을 compile coverage에서 제외`
2. `docs(wiki): source exclusions workflow 문서화 — compile/query 기본 제외 규칙 명시`
3. `chore(plugin): source exclusions 문서 mirror 동기화 — Codex/OpenCode 패키지 갱신`

## Self-Review

- Spec coverage: registry 파일명, compile 제외, query 제외, lint coverage 제외, active citation warning, generated mirror sync가 모두 task에 포함됐다.
- Placeholder scan: 실행자가 채워야 하는 `TBD`/`TODO` 항목은 없다.
- Type consistency: registry 파일명은 문서 전체에서 `_source-exclusions.json`으로 통일했다.
- Scope control: 현재 `.wiki/` 자산 이동과 실제 exclusion 적용은 구현 계획 밖으로 분리했다.

## Execution Result

실행 시각: 2026-05-21 19:19 KST

완료한 변경:

- `scripts/llm-wiki`에 `raw/_source-exclusions.json` registry 로딩·검증을 추가했다.
- `raw/_uncompiled-source-coverage.md`를 raw-source processing backlog의 정식 위치로 구현했다.
- legacy `wiki/references/uncompiled-source-coverage.md`는 `lint --fix`에서 raw 위치로 이동하고, `wiki/references/_index.md` legacy link를 제거하도록 했다.
- excluded raw source는 coverage backlog에서 제외된다.
- compiled article이 excluded source를 cite하면 mixed-source와 only-excluded case를 구분해 warning을 낸다.
- 자동 삭제, 자동 본문 수정, 자동 provenance 제거는 하지 않는다.
- compile/query/lint/retract command 문서와 linting reference, portable `AGENTS.md`를 업데이트했다.
- Codex/OpenCode plugin mirror를 sync script로 재생성했다.
- golden fixture에 빈 `raw/_source-exclusions.json`을 추가했고 defect fixture 생성 스크립트를 CRLF-safe하게 보정했다.

검증 결과:

| 명령 | 결과 | 확인 |
|---|---|---|
| `bash tests/generate-defect-fixtures.sh` | ✅ 통과 | defect fixture 17개 재생성 |
| `bash tests/test-local-cli-lint.sh` | ✅ 통과 | 30 passed, 0 failed |
| `bash tests/test-structure.sh` | ✅ 통과 | 170 passed, 0 failed |
| `bash tests/test-plugin-validate.sh` | ✅ 통과 | 115 passed, 0 failed |
| `bash tests/test-opencode-sync.sh` | ✅ 통과 | OpenCode mirror in sync |
| `bash tests/test-codex-sync.sh` | ⚠️ 커밋 전 예상 실패 | sync script는 실행됐고 `plugins/llm-wiki/`를 재생성했으나, 이 테스트는 `plugins/llm-wiki/` diff를 `HEAD`와 비교하므로 generated mirror 변경이 커밋되기 전에는 실패한다. |

잔여 사항:

- Codex sync 검증은 변경사항을 커밋한 뒤 재실행하면 통과 여부를 최종 확인할 수 있다.
- 현재 다우기술 프로젝트 `.wiki/`의 실제 epilogue/감사의말/용어해설 source 등록은 이번 구현 범위 밖이다.

## Done Check Lite Result

검수 시각: 2026-05-21 19:23 KST

최종 판정:

| 항목 | 판정 | 근거 |
|---|---|---|
| 전체 상태 | ⚠️ 승인 필요 | 구현·문서·주요 검증은 완료됐지만, 계획의 `test-codex-sync.sh` clean 확인은 generated mirror 변경 커밋 전에는 구조적으로 통과하지 않는다. |

요구사항 대조:

| 원래 요구사항 | 상태 | 구현 근거 | 검증 근거 | 비고 |
|---|---|---|---|---|
| 계획대로 source exclusion registry 구현 | ✅ 완료 | `scripts/llm-wiki`, `tests/fixtures/golden-wiki/raw/_source-exclusions.json` | `bash tests/test-local-cli-lint.sh` 30 passed | 없음 |
| coverage backlog를 `raw/_uncompiled-source-coverage.md`로 이동 | ✅ 완료 | `scripts/llm-wiki`, `tests/test-local-cli-lint.sh` | coverage repair, legacy migration 테스트 PASS | 없음 |
| excluded source를 coverage에서 제외 | ✅ 완료 | `check_coverage`, `load_source_exclusions` | `excluded raw source is omitted from coverage backlog` PASS | 없음 |
| existing compiled references cleanup 후보 보고 | ✅ 완료 | `check_source_provenance` | mixed-source, only-excluded warning 테스트 PASS | 자동 수정/삭제는 의도적으로 금지 |
| command/reference/protocol 문서 반영 | ✅ 완료 | `compile.md`, `query.md`, `lint.md`, `retract.md`, `linting.md`, `AGENTS.md` | `rg -n "_source-exclusions|_uncompiled-source-coverage|include-excluded|excluded source"` 확인 | 없음 |
| generated plugin mirror 갱신 | ✅ 완료 | `plugins/llm-wiki/**`, `plugins/llm-wiki-opencode/**` | `test-plugin-validate.sh` 115 passed, `test-opencode-sync.sh` 통과 | Codex sync clean은 커밋 후 재확인 필요 |
| 계획문서 수행결과 업데이트 | ✅ 완료 | 이 문서의 `Execution Result`, `Done Check Lite Result` | 문서 확인 | 없음 |
| 전체 검증 clean 상태 | ⚠️ 승인 필요 | `test-codex-sync.sh`가 generated mirror diff를 HEAD와 비교 | `test-codex-sync.sh`는 커밋 전 예상 실패 | 커밋 승인 후 재실행 필요 |

미완료·승인 필요 항목:

| 항목 | 문제 | 필요한 다음 작업 |
|---|---|---|
| Codex sync clean 확인 | `test-codex-sync.sh`는 generated mirror 변경이 `HEAD`에 반영되기 전에는 실패한다. | 사용자가 커밋을 승인하면 `cp` 스킬로 커밋한 뒤 `bash tests/test-codex-sync.sh`를 재실행한다. |

검증 근거:

| 구분 | 근거 |
|---|---|
| 실행한 검증 | `generate-defect-fixtures.sh` 17 fixtures, `test-local-cli-lint.sh` 30 passed, `test-structure.sh` 170 passed, `test-plugin-validate.sh` 115 passed, `test-opencode-sync.sh` 통과 |
| 확인한 파일 | `scripts/llm-wiki`, `tests/test-local-cli-lint.sh`, `tests/test-structure.sh`, `claude-plugin/commands/*.md`, `claude-plugin/skills/wiki-manager/references/linting.md`, `AGENTS.md` |
| 커밋 | 없음 |
