---
title: "LLM Wiki lint 공용화 구현계획"
created: 2026-05-21
session_id: "codex:019e48c0-99e2-7222-b823-592976851649"
session_path: "C:/Users/ahnbu/.codex/sessions/2026/05/21/rollout-2026-05-21T13-17-22-019e48c0-99e2-7222-b823-592976851649.jsonl"
ai: codex
---

# LLM Wiki Lint 공용화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트 로컬 `_tools/wiki-lint.mjs`에서 확인된 재발 방지 포인트를 공용 `scripts/llm-wiki lint`에 흡수하되, 다우기술 강의 전용 규칙은 공용 lint에 섞지 않는다.

**Architecture:** 기존 Python CLI helper인 `scripts/llm-wiki`를 공용 실행 경로로 유지한다. 프로젝트 특화 검사(`90자료수집 28/28 coverage`, 강의 편향 탐지)는 로컬 도구나 향후 설정 파일에 남기고, 공용 helper에는 모든 topic wiki에 적용 가능한 구조·출처·링크·기록 신뢰성 규칙만 반영한다.

**Tech Stack:** Python stdlib, Bash test harness, Markdown reference docs, generated Codex/OpenCode plugin mirrors.

---

## Scope Boundary

이번 계획에서 공용화하는 것:

- `scripts/llm-wiki lint --fix`가 최종 pass일 때만 `log.md`에 lint 기록을 남긴다.
- 실패한 lint와 성공한 lint가 exit code, JSON status, log 기록에서 서로 구분된다.
- 공용 문서에 “프로젝트 특화 lint는 공용 helper에 직접 넣지 않는다”는 기준을 명시한다.

이번 계획에서 공용화하지 않는 것:

- `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/_tools/wiki-lint.mjs` 파일 자체
- `90자료수집 28/28 coverage`
- 다우기술 강의용 편향 문구 검사
- ebook child source 84개 같은 특정 wiki backlog 판단

## File Structure

- Modify: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`
  - 공용 lint 실행 흐름과 log append 조건을 조정한다.
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh`
  - 실패한 `--fix` 실행은 log를 남기지 않고, 성공한 `--fix` 실행만 log를 남기는 회귀 테스트를 추가한다.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/linting.md`
  - 공용 lint와 프로젝트 로컬 lint extension의 경계를 문서화한다.
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/skills/wiki/references/linting.md`
  - sync script로 갱신되는 Codex plugin mirror다.
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/skills/wiki-manager/references/linting.md`
  - sync script로 갱신되는 OpenCode plugin mirror다.

### Task 1: 실패한 lint가 log를 남기지 않는 회귀 테스트 추가

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-local-cli-lint.sh`

- [ ] **Step 1: 실패 케이스 테스트 fixture를 추가한다**

`coverage_repair` 테스트 뒤, `hub_scope` 생성 전 위치에 아래 테스트를 추가한다.

```bash
failed_fix_log="$tmpdir/failed-fix-log"
mkdir "$failed_fix_log"
cp -R "$SCRIPT_DIR/fixtures/defects/bad-frontmatter/." "$failed_fix_log/"
before_log="$(cat "$failed_fix_log/log.md")"
set +e
failed_fix_output="$("$CLI" lint --fix "$failed_fix_log" 2>&1)"
failed_fix_rc=$?
set -e
after_log="$(cat "$failed_fix_log/log.md")"
if [ "$failed_fix_rc" -ne 0 ] \
  && grep -q "Result: FAIL" <<<"$failed_fix_output" \
  && [ "$before_log" = "$after_log" ]; then
  log_pass "failed --fix lint does not append success log"
else
  log_fail "failed --fix lint does not append success log" "$failed_fix_output"
fi
```

완료 기준:

- 깨진 fixture에서 `lint --fix`가 실패한다.
- 실패한 실행 뒤 `log.md` 내용이 실행 전과 동일하다.

검증 방법:

Run: `bash tests/test-local-cli-lint.sh`

Expected: 이 단계만 적용한 상태에서는 새 테스트가 실패할 수 있다. 실패 메시지는 `failed --fix lint does not append success log`를 포함한다.

- [ ] **Step 2: 성공 케이스 테스트를 명시한다**

같은 위치의 실패 케이스 바로 뒤에 아래 테스트를 추가한다.

```bash
successful_fix_log="$tmpdir/successful-fix-log"
mkdir "$successful_fix_log"
cp -R "$SCRIPT_DIR/fixtures/defects/missing-index/." "$successful_fix_log/"
set +e
successful_fix_output="$("$CLI" lint --fix "$successful_fix_log" 2>&1)"
successful_fix_rc=$?
set -e
if [ "$successful_fix_rc" -eq 0 ] \
  && grep -q "Result: PASS" <<<"$successful_fix_output" \
  && grep -q "lint | local command: 0 critical, 0 warnings, 0 suggestions" "$successful_fix_log/log.md"; then
  log_pass "successful --fix lint appends success log"
else
  log_fail "successful --fix lint appends success log" "$successful_fix_output"
fi
```

완료 기준:

- `--fix`로 완전히 복구된 wiki만 lint 성공 기록을 남긴다.
- 성공 기록은 `0 critical, 0 warnings, 0 suggestions`를 포함한다.

검증 방법:

Run: `bash tests/test-local-cli-lint.sh`

Expected after implementation: `24 passed`, `0 failed`, `24 total`.

### Task 2: `scripts/llm-wiki`의 log append 조건을 최종 pass 이후로 이동

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`

- [ ] **Step 1: lint 실패 판정 helper를 추가한다**

`append_lint_log` 함수 위에 아래 helper를 추가한다.

```python
def lint_failed(ctx: LintContext) -> bool:
    counts = ctx.counts()
    return bool(counts["critical"] or counts["warning"] or counts["suggestion"])
```

완료 기준:

- 실패 판정 로직이 `run_lint`, JSON report, text report와 같은 기준을 사용한다.

검증 방법:

Run: `python -m py_compile scripts/llm-wiki`

Expected: 출력 없이 exit `0`.

- [ ] **Step 2: hub lint 경로에서 성공 시에만 log를 append한다**

`run_lint`의 hub branch를 아래 구조로 바꾼다.

```python
    if hub_root:
        failed = lint_failed(ctx)
        if not failed:
            append_lint_log(ctx)
        if args.json:
            print_json_report(ctx)
        else:
            print_text_report(ctx)
        return 1 if failed else 0
```

완료 기준:

- hub lint도 실패한 `--fix` 실행에서는 log를 쓰지 않는다.
- 기존 `--json` 출력 순서는 유지된다.

검증 방법:

Run: `python scripts/llm-wiki lint tests/fixtures/golden-wiki --json`

Expected: JSON에 `"status": "pass"`가 포함되고 exit `0`.

- [ ] **Step 3: topic wiki lint 경로에서 성공 시에만 log를 append한다**

`run_lint`의 topic wiki branch 끝부분을 아래 구조로 바꾼다.

```python
    failed = lint_failed(ctx)
    if not failed:
        append_lint_log(ctx)

    if args.json:
        print_json_report(ctx)
    else:
        print_text_report(ctx)

    return 1 if failed else 0
```

완료 기준:

- `append_lint_log(ctx)` 호출은 최종 실패 판정 뒤 성공 경로에서만 발생한다.
- `append_lint_log` 자체의 `ctx.fix` guard는 유지된다.

검증 방법:

Run: `python scripts/llm-wiki lint tests/fixtures/defects/missing-index --json`

Expected: JSON에 `"status": "fail"`이 포함되고 exit `1`.

### Task 3: 공용 lint와 프로젝트 로컬 lint extension의 경계를 문서화

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/linting.md`
- Generated after sync: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/skills/wiki/references/linting.md`
- Generated after sync: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/skills/wiki-manager/references/linting.md`

- [ ] **Step 1: source reference 문서에 project-local extension 기준을 추가한다**

`## Development Note — Lint is the Migration` 섹션 뒤에 아래 문단을 추가한다.

```markdown
## Project-Local Lint Extensions

The shared `llm-wiki lint` helper should only contain checks that apply to any
topic wiki: structure, frontmatter, placement, local links, source provenance,
coverage bookkeeping, archive lifecycle, inventory, and dataset structure.

Project-specific checks belong in project-local tools or a future explicit
configuration layer. Examples include a named source batch such as
`90자료수집 28/28`, audience-specific bias checks, course-specific vocabulary
guards, and one wiki's temporary backlog categories. Do not promote those rules
into the shared helper unless at least two independent wikis need the same
behavior and the rule can be expressed without hard-coded project paths,
filenames, or business context.

Lint logs and `Last lint` metadata are success records, not attempt records.
Append them only after the deterministic lint command exits successfully.
Failed attempts should be visible in the command output and exit code, not
recorded as completed lint runs.
```

완료 기준:

- 공용 lint에 넣을 규칙과 로컬에 남길 규칙의 경계가 문서화된다.
- “성공 기록”과 “실행 시도”를 분리하는 기준이 명시된다.

검증 방법:

Run: `Select-String -Path claude-plugin/skills/wiki-manager/references/linting.md -Pattern "Project-Local Lint Extensions|success records"`

Expected: 두 패턴 모두 출력된다.

- [ ] **Step 2: plugin mirrors를 동기화한다**

Run:

```bash
bash scripts/sync-codex-plugin.sh
bash scripts/sync-opencode-plugin.sh
```

완료 기준:

- source reference 변경이 Codex/OpenCode plugin mirror에 반영된다.

검증 방법:

Run:

```bash
bash tests/test-codex-sync.sh
bash tests/test-opencode-sync.sh
```

Expected: 두 테스트 모두 exit `0`.

### Task 4: 전체 구조 테스트로 공용화 범위 검증

**Files:**
- Verify only: `D:/vibe-coding/llm-wiki-my/tests/*`
- Verify only: `D:/vibe-coding/llm-wiki-my/scripts/llm-wiki`
- Verify only: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/**`
- Verify only: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/**`

- [ ] **Step 1: 로컬 lint helper 테스트를 실행한다**

Run:

```bash
bash tests/test-local-cli-lint.sh
```

Expected:

```markdown
Results: 24 passed, 0 failed, 24 total
```

완료 기준:

- 새 log gating 테스트 2개가 포함되어 통과한다.
- 기존 archive, hub resolution, source repair 테스트가 회귀하지 않는다.

- [ ] **Step 2: plugin manifest와 command/reference 구조를 검증한다**

Run:

```bash
bash tests/test-plugin-validate.sh
```

Expected:

```markdown
0 failed
```

완료 기준:

- `claude-plugin` reference 변경과 generated plugin mirror가 manifest 검증을 깨지 않는다.

- [ ] **Step 3: structural fixture 테스트를 실행한다**

Run:

```bash
bash tests/test-structure.sh
```

Expected:

```markdown
0 failed
```

완료 기준:

- golden wiki와 defect fixture의 기존 구조 검증이 유지된다.

### Task 5: 실제 다우기술 wiki에는 공용 helper만 read-only smoke test한다

**Files:**
- Verify only: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`
- Verify only: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/_tools/wiki-lint.mjs`

- [ ] **Step 1: 공용 helper가 대상 wiki를 읽고 JSON 결과를 낼 수 있는지만 확인한다**

Run:

```bash
python D:/vibe-coding/llm-wiki-my/scripts/llm-wiki lint "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki" --json
```

Expected:

```json
{
  "root": "C:\\Users\\ahnbu\\cowork\\02_강의\\202606_다우기술_신입_7H\\.wiki",
  "status": "pass or fail",
  "counts": {
    "critical": 0
  }
}
```

완료 기준:

- 공용 helper가 프로젝트 wiki를 대상으로 crash 없이 JSON을 출력한다.
- `critical`이 0이다.
- `warning`이나 `suggestion`이 있으면 공용 구조 결함인지, 프로젝트 특화 로컬 lint와의 기준 차이인지 분리해서 보고한다.
- 이 단계는 `--fix` 없이 실행하므로 `.wiki/log.md`와 wiki 파일을 수정하지 않는다.

- [ ] **Step 2: 프로젝트 특화 lint는 그대로 로컬에 둔다**

Run:

```bash
node "C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/_tools/wiki-lint.mjs"
```

Expected:

```markdown
critical: 0
warnings: 0
```

완료 기준:

- 다우기술 강의 전용 coverage와 편향 검사는 로컬 script에서 계속 확인된다.
- 공용 helper에 `90자료수집`, 특정 강의명, 특정 파일명을 하드코딩하지 않는다.

## Self-Review

- Spec coverage: 사용자가 요청한 “그대로 공용 승격하지 말고 공용 helper 보강 + 프로젝트 특화 규칙 격리” 방향을 반영했다.
- Placeholder scan: 금지된 placeholder 표현 없이 실제 파일·명령·기대 결과를 적었다.
- Type consistency: Python helper명은 `lint_failed(ctx: LintContext) -> bool` 하나로 통일했고, 모든 task에서 같은 이름을 사용했다.
- Scope control: 프로젝트 로컬 `_tools/wiki-lint.mjs`를 공용 파일로 복사하지 않는다고 명시했다.

## Execution Results

실행 시각: 2026-05-21 14:36 KST

| Task | 상태 | 결과 |
|---|---|---|
| Task 1 회귀 테스트 추가 | ✅ 완료 | 실패한 `--fix` lint가 `log.md`를 남기지 않는 테스트, 성공한 `--fix` lint가 log를 남기는 테스트, URL-encoded local link resolution 테스트를 추가했다. |
| Task 2 공용 lint log 조건 수정 | ✅ 완료 | `lint_failed(ctx)` helper를 추가하고, hub/topic lint 모두 최종 pass일 때만 `append_lint_log(ctx)`를 호출하도록 변경했다. URL-encoded local markdown links도 실제 파일 경로로 resolve하도록 보완했다. |
| Task 3 lint 문서와 plugin mirror 동기화 | ✅ 완료 | `claude-plugin/.../linting.md`에 project-local lint extension 경계를 문서화했고, Codex/OpenCode mirror를 sync했다. |
| Task 4 전체 구조 테스트 | ✅ 완료 | 핵심 구조 테스트는 통과했다. `tests/test-codex-sync.sh`는 mirror 변경이 커밋 전이면 실패하도록 설계되어 있어 조건부로 기록한다. |
| Task 5 다우기술 wiki smoke test | ⚠️ 조건부 완료 | 공용 helper는 crash 없이 JSON을 출력했고 `critical: 0`이었다. URL-decoding 보완 후 공용 helper warning은 206건에서 1건으로 줄었다. 프로젝트 로컬 lint는 See Also 역방향 링크 9건을 warning으로 보고했다. |

### Changed Files

| 파일 | 변경 내용 | 비고 |
|---|---|---|
| `scripts/llm-wiki` | lint 성공 판정 후에만 log append, URL-encoded markdown link resolution 보완 | 공용 helper 보강 |
| `tests/test-local-cli-lint.sh` | log gating 회귀 테스트 2개와 URL-encoded link 테스트 1개 추가 | `24 passed` |
| `claude-plugin/skills/wiki-manager/references/linting.md` | project-local lint extension 경계 문서화 | source of truth |
| `plugins/llm-wiki/skills/wiki/references/linting.md` | Codex mirror sync | generated |
| `_docs/20260521_04_LLM-Wiki-lint-공용화-구현계획.md` | 수행결과 업데이트 | 현재 문서 |

### Verification Results

| 검증 | 결과 | 근거 |
|---|---|---|
| `python -m py_compile scripts/llm-wiki` | ✅ 통과 | 출력 없이 exit `0` |
| `python scripts/llm-wiki lint tests/fixtures/golden-wiki --json` | ✅ 통과 | `"status": "pass"` |
| `python scripts/llm-wiki lint tests/fixtures/defects/missing-index --json` | ✅ 통과 | `"status": "fail"`, exit `1` |
| `bash tests/test-local-cli-lint.sh` | ✅ 통과 | `24 passed, 0 failed, 24 total` |
| `bash tests/test-plugin-validate.sh` | ✅ 통과 | `109 passed, 0 failed, 109 total` |
| `bash tests/test-structure.sh` | ✅ 통과 | `170 passed, 0 failed, 170 total` |
| `bash tests/test-opencode-sync.sh` | ✅ 통과 | OpenCode mirror in sync |
| `bash tests/test-codex-sync.sh` | ⚠️ 조건부 | sync script가 mirror를 재생성했고, 커밋 전 diff가 있어 실패하도록 설계됨 |
| 공용 helper 다우기술 wiki smoke test | ⚠️ 조건부 | `critical: 0`, `warning: 1`, `suggestion: 51` |
| 다우기술 로컬 `_tools/wiki-lint.mjs` | ⚠️ 조건부 | `critical: 0`, See Also 역방향 링크 warning 9건 |

### Follow-Up Notes

- 다우기술 wiki는 이번 계획에서 verify-only 대상이므로 수정하지 않았다.
- 공용 helper의 다우기술 wiki warning 206건 중 대부분은 URL-encoded index link가 실제 파일 경로와 매칭되지 않는 항목이었다. 공용 helper의 URL-decoding 보완으로 warning은 1건으로 줄었다.
- 남은 공용 helper warning 1건은 `raw/articles/_resources` 디렉터리 allowlist 문제다. 실제 다우기술 wiki 구조를 바꾸는 작업은 이번 계획의 verify-only 범위 밖이라 수정하지 않았다.
- 다우기술 로컬 lint의 See Also warning 9건은 기존 로컬 wiki 품질 이슈다. 이번 계획은 공용 helper 보강이 목적이므로 자동 수정하지 않았다.
- `tests/test-codex-sync.sh`는 커밋 전 변경 diff를 실패로 취급한다. 커밋 단계에서 mirror 변경을 함께 포함한 뒤 재실행하면 통과 판정이 가능하다.

## Completion State

계획의 repo-side 구현과 검증은 완료됐다. 남은 조건부 항목은 커밋 전 diff를 실패로 취급하는 Codex sync 테스트와, verify-only 대상인 다우기술 wiki 자체 품질 warning이다. Codex sync 테스트를 exit `0`까지 확인하려면 변경사항을 커밋한 뒤 재실행해야 한다.
