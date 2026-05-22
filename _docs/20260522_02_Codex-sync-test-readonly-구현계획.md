---
title: Codex sync 테스트 읽기전용화 구현계획
created: 2026-05-22 12:33
tags:
  - llm-wiki
  - codex
  - test
  - plan
session_id: codex:019e4d92-4b93-7473-9a69-50f88ea3fd8b
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/22/rollout-2026-05-22T11-44-58-019e4d92-4b93-7473-9a69-50f88ea3fd8b.jsonl


ai: codex
---

# Codex sync 테스트 읽기전용화 구현계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** `test-codex-sync.sh`가 실제 `plugins/llm-wiki/`를 수정하지 않고, 임시 생성 결과와 현재 Codex mirror를 비교하는 읽기 전용 검증이 되도록 바꾼다.

**Architecture:** `scripts/sync-codex-plugin.sh`는 기본 동작을 유지하되 출력 대상 override를 지원한다. `tests/test-codex-sync.sh`는 override로 임시 위치에 Codex mirror를 생성하고, 그 결과를 현재 `plugins/llm-wiki/`와 비교만 한다. `CLAUDE.md`는 self-healing 테스트라는 설명을 제거하고, sync와 check의 역할 분리를 문서화한다.

**Tech Stack:** Bash, rsync, diff, Git, Markdown.

---

## 발단: 사용자 요청

현재 `tests/test-codex-sync.sh`는 테스트 실행 중 `scripts/sync-codex-plugin.sh`를 호출해 실제 `plugins/llm-wiki/`를 재생성한다. 그 뒤 `HEAD`와 비교하므로 커밋 전에는 정상적인 작업 상태도 실패처럼 보이고, 테스트가 작업트리를 오염시킨다.

사용자 결정:

- 정본 방향을 당장 뒤집지는 않는다.
- `sync-codex-plugin.sh`는 실제 mirror 생성 도구로 유지한다.
- `test-codex-sync.sh`는 임시 폴더에 생성하고 비교만 하는 읽기 전용 검증으로 바꾼다.
- `CLAUDE.md`의 self-healing 설명도 함께 수정한다.

## 범위

포함:

- `scripts/sync-codex-plugin.sh` 출력 대상 override 추가
- `tests/test-codex-sync.sh` 읽기 전용 비교로 변경
- `CLAUDE.md`의 테스트 설명과 sync workflow 문구 수정
- 검증 명령과 기대 결과 확인

제외:

- `plugins/llm-wiki/`를 정본으로 승격하는 구조 변경
- `claude-plugin/` 제거 또는 legacy화
- `tests/test-opencode-sync.sh` 변경
- Codex runtime smoke test 구조 변경

## 대상 파일

- Modify: `D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh`
  - 기본 출력은 기존처럼 `plugins/llm-wiki/`
  - `CODEX_PLUGIN_OUT=<path>`가 있으면 해당 경로에 Codex mirror 생성
  - 임시 출력에서도 `.codex-plugin/plugin.json`이 생성되도록 기본 manifest를 복사
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-codex-sync.sh`
  - 실제 mirror를 재생성하지 않음
  - 임시 출력과 현재 `plugins/llm-wiki/` 비교
  - 실패 메시지를 `SYNC NEEDED` 중심으로 변경
- Modify: `D:/vibe-coding/llm-wiki-my/CLAUDE.md`
  - `test-codex-sync.sh` 설명을 읽기 전용 검증으로 변경
  - self-healing 문구 제거
  - `claude-plugin/skills/wiki-manager/` 수정 시 sync script를 명시 실행하라는 절차로 변경

## 설계 결정

결정:

- `sync-codex-plugin.sh`에 환경변수 override를 추가한다.
- 테스트는 `CODEX_PLUGIN_OUT`로 임시 mirror를 만들고 현재 mirror와 비교한다.
- 비교 기준은 `HEAD`가 아니라 현재 작업트리의 `plugins/llm-wiki/`이다.
- 출력 대상 override는 destructive write가 가능한 경로이므로 빈 값, repo root, source skill 하위 경로를 거부한다.

근거:

- 커밋 전에도 “현재 정본에서 생성한 결과와 현재 mirror가 같은지” 검증할 수 있다.
- 테스트가 실제 파일을 수정하지 않아 작업트리 오염이 사라진다.
- 기존 sync script의 변환 규칙을 재사용하므로 별도 비교 로직을 새로 만들지 않는다.

트레이드오프:

- 테스트가 더 이상 자동으로 mirror를 고쳐주지 않는다.
- mirror가 다르면 사용자가 `./scripts/sync-codex-plugin.sh`를 명시적으로 실행해야 한다.
- `OpenCode` sync 테스트는 이번 범위에서 그대로 남아 비대칭이 생긴다. 필요하면 후속 작업으로 같은 패턴을 적용한다.

## plan-check-lite 검토 반영

| 점검 항목 | 반영 내용 |
|---|---|
| 안전 가드 | `CODEX_PLUGIN_OUT`가 잘못된 경로를 가리킬 때 repo root나 source를 덮어쓰지 않도록 Task 1에 경로 거부 조건을 추가했다. |
| 임시 파일 처리 | `test-codex-sync.sh`의 임시 폴더 생성·정리 조건을 Task 2에 명시하고, 정리 전 prefix guard를 두도록 보강했다. |
| 실패 진단 | stale mirror 실패 시 diff 일부를 보여주도록 Task 2에 `head` 기반 진단 출력을 추가했다. |
| 환경 근거 | 현재 Git Bash의 `diff`가 `--strip-trailing-cr`를 지원함을 확인했고, 리스크 문구를 fallback 중심으로 조정했다. |

## 구현 계획

### Task 1: `sync-codex-plugin.sh` 출력 대상 override

**Files:**

- Modify: `D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh`

- [x] **Step 0: 출력 대상 safety guard를 추가한다**

`CODEX_PLUGIN_OUT`는 sync 결과를 쓰는 경로이므로, 비어 있거나 repo root/source 하위로 잘못 해석되면 즉시 중단한다.

변경 방향:

```bash
DEFAULT_TARGET_PLUGIN="$ROOT/plugins/llm-wiki"
if [ "${CODEX_PLUGIN_OUT+x}" = "x" ] && [ -z "$CODEX_PLUGIN_OUT" ]; then
  echo "Refusing unsafe Codex plugin output path: empty CODEX_PLUGIN_OUT" >&2
  exit 1
fi

TARGET_PLUGIN="${CODEX_PLUGIN_OUT:-$DEFAULT_TARGET_PLUGIN}"
TARGET_PLUGIN="$(python3 - "$TARGET_PLUGIN" <<'PY'
import sys
from pathlib import Path
print(Path(sys.argv[1]).expanduser().resolve())
PY
)"

case "$TARGET_PLUGIN" in
  ""|"/"|"$ROOT"|"$ROOT/"|"$SOURCE_SKILL"|"$SOURCE_SKILL"/*)
    echo "Refusing unsafe Codex plugin output path: $TARGET_PLUGIN" >&2
    exit 1
    ;;
esac
```

**완료 기준**

- `CODEX_PLUGIN_OUT`가 빈 값, `/`, repo root, source skill 경로로 해석되면 script가 exit 1로 중단한다.
- 기본 출력인 `plugins/llm-wiki/`와 임시 출력 경로는 허용된다.

**검증 방법**

```bash
CODEX_PLUGIN_OUT="$PWD" bash scripts/sync-codex-plugin.sh
```

Expected:

```markdown
exit 1
stderr에 Refusing unsafe Codex plugin output path 포함
```

- [x] **Step 1: 출력 대상 변수를 분리한다**

기존:

```bash
TARGET_PLUGIN="$ROOT/plugins/llm-wiki"
TARGET_SKILL="$TARGET_PLUGIN/skills/wiki"
CLAUDE_MANIFEST="$ROOT/claude-plugin/.claude-plugin/plugin.json"
CODEX_MANIFEST="$TARGET_PLUGIN/.codex-plugin/plugin.json"
```

변경 방향:

```bash
TARGET_SKILL="$TARGET_PLUGIN/skills/wiki"
CLAUDE_MANIFEST="$ROOT/claude-plugin/.claude-plugin/plugin.json"
CODEX_MANIFEST_TEMPLATE="$DEFAULT_TARGET_PLUGIN/.codex-plugin/plugin.json"
CODEX_MANIFEST="$TARGET_PLUGIN/.codex-plugin/plugin.json"
```

**완료 기준**

- `CODEX_PLUGIN_OUT`이 없을 때 기존 경로인 `plugins/llm-wiki/`에 생성된다.
- `CODEX_PLUGIN_OUT`이 있을 때 해당 경로에 생성된다.

**검증 방법**

```bash
bash scripts/sync-codex-plugin.sh
```

Expected:

```markdown
Synced Codex plugin skill from Claude source.
Target: .../plugins/llm-wiki/skills/wiki
```

- [x] **Step 2: 임시 출력에서도 Codex manifest가 존재하도록 만든다**

기존 코드는 `TARGET_PLUGIN/.codex-plugin/plugin.json`이 이미 있어야 한다. 임시 폴더에는 이 파일이 없으므로 기본 mirror의 manifest를 템플릿으로 복사한다.

변경 방향:

```bash
if [ ! -f "$CODEX_MANIFEST_TEMPLATE" ]; then
  echo "Missing Codex manifest template: $CODEX_MANIFEST_TEMPLATE" >&2
  exit 1
fi

mkdir -p "$TARGET_PLUGIN/skills" "$TARGET_PLUGIN/.codex-plugin"
if [ "$CODEX_MANIFEST" != "$CODEX_MANIFEST_TEMPLATE" ]; then
  cp "$CODEX_MANIFEST_TEMPLATE" "$CODEX_MANIFEST"
fi
```

**완료 기준**

- 임시 출력 경로에도 `.codex-plugin/plugin.json`이 생성된다.
- Python manifest update 단계가 기본 출력과 임시 출력 모두에서 동작한다.

**검증 방법**

```bash
tmpdir="$(mktemp -d)"
CODEX_PLUGIN_OUT="$tmpdir/llm-wiki" bash scripts/sync-codex-plugin.sh
test -f "$tmpdir/llm-wiki/.codex-plugin/plugin.json"
test -f "$tmpdir/llm-wiki/skills/wiki/SKILL.md"
test -f "$tmpdir/llm-wiki/skills/wiki/agents/openai.yaml"
```

Expected:

```markdown
세 test 명령이 모두 exit 0
```

### Task 2: `test-codex-sync.sh`를 읽기 전용 검증으로 변경

**Files:**

- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-codex-sync.sh`

- [x] **Step 1: 실제 mirror 재생성 호출을 임시 출력 호출로 바꾼다**

변경 방향:

```bash
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/llm-wiki-codex-sync.XXXXXX")"
EXPECTED_PLUGIN="$TMP_ROOT/llm-wiki"
DIFF_FILE="$TMP_ROOT/codex-sync.diff"
cleanup() {
  case "${TMP_ROOT:-}" in
    "${TMPDIR:-/tmp}"/llm-wiki-codex-sync.*) rm -rf "$TMP_ROOT" ;;
  esac
}
trap cleanup EXIT

CODEX_PLUGIN_OUT="$EXPECTED_PLUGIN" ./scripts/sync-codex-plugin.sh >/dev/null
```

**완료 기준**

- 테스트 실행 중 `plugins/llm-wiki/`가 직접 재생성되지 않는다.
- 임시 경로에만 생성 결과가 생긴다.
- 임시 폴더 정리는 `llm-wiki-codex-sync.*` prefix guard를 통과한 경로에만 수행된다.

**검증 방법**

```bash
before="$(git status --short)"
bash tests/test-codex-sync.sh
after="$(git status --short)"
test "$before" = "$after"
```

Expected:

```markdown
OK: Codex plugin mirror is in sync.
test "$before" = "$after" 통과
```

- [x] **Step 2: 비교 기준을 `HEAD`에서 현재 mirror로 바꾼다**

기존:

```bash
if ! git -c core.autocrlf=true diff --quiet HEAD -- plugins/llm-wiki/; then
```

변경 방향:

```bash
if ! diff -ru --strip-trailing-cr "$EXPECTED_PLUGIN" "$ROOT/plugins/llm-wiki" >"$DIFF_FILE"; then
```

**완료 기준**

- 비교 대상이 `HEAD`가 아니다.
- 비교 대상은 “임시 생성 결과”와 “현재 작업트리의 `plugins/llm-wiki/`”이다.
- 실패해도 실제 `plugins/llm-wiki/`는 수정되지 않는다.
- 실패 시 `DIFF_FILE` 앞부분을 출력해 어느 파일이 stale인지 바로 확인할 수 있다.

**검증 방법**

```bash
tmprepo="$(mktemp -d)"
rsync -a --exclude='.git/' ./ "$tmprepo/"
printf '\n<!-- stale mirror fixture -->\n' >> "$tmprepo/plugins/llm-wiki/skills/wiki/SKILL.md"
(cd "$tmprepo" && bash tests/test-codex-sync.sh)
```

Expected:

```markdown
exit 1
stderr에 SYNC NEEDED 포함
원본 레포의 git status 변화 없음
```

- [x] **Step 3: 실패 메시지를 sync 필요 안내로 바꾼다**

변경 방향:

```bash
cat >&2 <<'MSG'
SYNC NEEDED: Codex plugin mirror is not up to date with claude-plugin/skills/wiki-manager/.

This test is read-only. It generated the expected Codex plugin in a temporary
directory and compared it with plugins/llm-wiki/.

Diff preview:
MSG
head -200 "$DIFF_FILE" >&2
cat >&2 <<'MSG'

To fix:
  1. ./scripts/sync-codex-plugin.sh
  2. git diff -- plugins/llm-wiki/
  3. stage plugins/llm-wiki/ with the related Claude-side change
  4. ./tests/test-codex-sync.sh
MSG
```

**완료 기준**

- `Self-healing` 표현이 `tests/test-codex-sync.sh`에서 사라진다.
- 실패 메시지가 “이미 재생성했다”가 아니라 “명시적으로 sync를 실행하라”로 바뀐다.

**검증 방법**

```bash
rg -n "Self-healing|already regenerated|git diff --quiet HEAD" tests/test-codex-sync.sh
```

Expected:

```markdown
검색 결과 없음
```

### Task 3: `CLAUDE.md` 문서 수정

**Files:**

- Modify: `D:/vibe-coding/llm-wiki-my/CLAUDE.md`

- [x] **Step 1: Structural tests 설명을 갱신한다**

변경 방향:

```markdown
./tests/test-codex-sync.sh         # read-only Codex plugin mirror check
./tests/test-opencode-sync.sh      # OpenCode plugin mirror matches Claude source
```

**완료 기준**

- `test-codex-sync.sh`가 읽기 전용 검증이라는 점이 Structural tests 목록에 드러난다.
- `test-opencode-sync.sh`는 이번 범위에서 기존 설명을 유지한다.

**검증 방법**

```bash
rg -n "test-codex-sync.sh|read-only Codex" CLAUDE.md
```

Expected:

```markdown
test-codex-sync.sh 라인에 read-only Codex 문구 포함
```

- [x] **Step 2: self-healing 문단을 교체한다**

기존 문단:

```markdown
`test-codex-sync.sh` and `test-opencode-sync.sh` are self-healing: if they fail,
the sync script has already regenerated the target directory — stage and commit
the result, then re-run. Read the FAIL message; it tells you exactly what to do.
```

변경 방향:

```markdown
`test-codex-sync.sh` is read-only: it generates the expected Codex plugin in a
temporary directory and compares that output with `plugins/llm-wiki/`. If it
reports `SYNC NEEDED`, run `./scripts/sync-codex-plugin.sh`, review and stage the
generated `plugins/llm-wiki/` changes with the related source edit, then re-run
the test.

`test-opencode-sync.sh` still regenerates its target directory on failure.
```

**완료 기준**

- Codex sync 테스트에 대해 self-healing이라는 설명이 사라진다.
- 실패 시 실행할 명령이 `./scripts/sync-codex-plugin.sh`로 명시된다.
- OpenCode 쪽은 이번 범위에서 변경하지 않는다는 사실이 문서에 남는다.

**검증 방법**

```bash
rg -n "self-healing|SYNC NEEDED|sync-codex-plugin" CLAUDE.md
```

Expected:

```markdown
Codex 문단에는 SYNC NEEDED와 sync-codex-plugin 안내가 있음
self-healing은 OpenCode 설명에만 남거나, Codex 설명에서는 제거됨
```

- [x] **Step 3: `claude-plugin/skills/wiki-manager/` 수정 안내를 갱신한다**

기존 취지:

```markdown
Edited `claude-plugin/skills/wiki-manager/`: both sync tests will fail until you re-run both sync scripts and commit `plugins/`.
```

변경 방향:

```markdown
- **Edited `claude-plugin/skills/wiki-manager/`**: run `./scripts/sync-codex-plugin.sh`
  before committing Codex-visible changes, then run `./tests/test-codex-sync.sh`.
  The Codex sync test is read-only and reports `SYNC NEEDED` when
  `plugins/llm-wiki/` is stale. OpenCode still uses
  `./scripts/sync-opencode-plugin.sh` and `./tests/test-opencode-sync.sh`.
```

**완료 기준**

- sync 실행과 test 실행 순서가 문서에 분리되어 있다.
- Codex sync test가 더 이상 target directory를 고쳐준다고 설명하지 않는다.

**검증 방법**

```bash
rg -n "Edited `claude-plugin/skills/wiki-manager/`|read-only|SYNC NEEDED" CLAUDE.md
```

Expected:

```markdown
해당 bullet에 read-only와 SYNC NEEDED가 포함됨
```

### Task 4: 최종 검증

**Files:**

- Verify only: `D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh`
- Verify only: `D:/vibe-coding/llm-wiki-my/tests/test-codex-sync.sh`
- Verify only: `D:/vibe-coding/llm-wiki-my/CLAUDE.md`

- [x] **Step 1: 읽기 전용 상태 보존 검증이 통과한다**

```bash
before="$(git status --short)"
bash tests/test-codex-sync.sh
after="$(git status --short)"
test "$before" = "$after"
```

Expected:

```markdown
OK: Codex plugin mirror is in sync.
작업트리 상태 문자열 동일
```

- [x] **Step 2: stale mirror 음성 케이스가 실패 메시지만 내고 원본 레포를 바꾸지 않는다**

```bash
tmprepo="$(mktemp -d)"
rsync -a --exclude='.git/' ./ "$tmprepo/"
printf '\n<!-- stale mirror fixture -->\n' >> "$tmprepo/plugins/llm-wiki/skills/wiki/SKILL.md"
(cd "$tmprepo" && bash tests/test-codex-sync.sh)
```

Expected:

```markdown
exit 1
SYNC NEEDED 포함
원본 레포 git status 변화 없음
```

- [x] **Step 3: 기존 구조 검증이 통과한다**

```bash
bash tests/test-plugin-validate.sh
bash tests/test-codex-sync.sh
```

Expected:

```markdown
test-plugin-validate.sh: failed 0
test-codex-sync.sh: OK
```

## 수행 결과

| 항목 | 결과 |
|---|---|
| `scripts/sync-codex-plugin.sh` | `CODEX_PLUGIN_OUT` 출력 override와 unsafe path guard를 구현했다. 기본 출력은 기존 `plugins/llm-wiki/`로 유지된다. |
| `tests/test-codex-sync.sh` | 실제 `plugins/llm-wiki/`를 수정하지 않고 임시 생성 결과와 현재 mirror를 비교하도록 변경했다. 실패 메시지는 `SYNC NEEDED`와 diff preview를 출력한다. |
| `CLAUDE.md` | Codex sync test를 read-only 검증으로 설명하고, `SYNC NEEDED` 발생 시 명시적으로 `sync-codex-plugin.sh`를 실행하도록 문구를 수정했다. |
| 범위 통제 | `test-opencode-sync.sh`와 정본 방향 전환은 변경하지 않았다. |

## done-check-lite 검토 반영

| 점검 항목 | 판정 | 반영 내용 |
|---|---|---|
| 출력 override 빈 값 처리 | ⚠️ 보완 후 완료 | 계획은 명시적 빈 `CODEX_PLUGIN_OUT` 거부를 요구했지만 1차 구현은 기본 경로로 처리했다. `CODEX_PLUGIN_OUT`가 set되어 있고 빈 문자열이면 exit 1로 중단하도록 guard를 추가했다. |
| 원래 요구사항 충족 | ✅ 완료 | 테스트의 실제 mirror 수정 제거, 임시 생성 비교, `CLAUDE.md` 문구 수정, 수행결과 문서 반영이 모두 구현·검증됐다. |
| 범위 축소 여부 | ✅ 완료 | `test-opencode-sync.sh`와 정본 방향 전환 제외는 계획과 사용자 합의 범위에 맞으며, 이번 요구사항을 축소하지 않는다. |

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| 출력 override 빈 값 안전 가드 | `CODEX_PLUGIN_OUT='' bash scripts/sync-codex-plugin.sh` | ✅ 통과 | exit 1, `Refusing unsafe Codex plugin output path: empty CODEX_PLUGIN_OUT` 출력 |
| 출력 override repo root 안전 가드 | `CODEX_PLUGIN_OUT=/mnt/d/vibe-coding/llm-wiki-my bash scripts/sync-codex-plugin.sh` | ✅ 통과 | exit 1, `Refusing unsafe Codex plugin output path` 출력 |
| 출력 override | `CODEX_PLUGIN_OUT="$tmpdir/llm-wiki" bash scripts/sync-codex-plugin.sh` | ✅ 통과 | 임시 경로에 `.codex-plugin/plugin.json`, `SKILL.md`, `agents/openai.yaml` 생성 확인 |
| 기본 sync 보존 | `bash scripts/sync-codex-plugin.sh` 전후 `git status --short` 비교 | ✅ 통과 | 기본 경로 sync 실행 후 작업트리 상태 변화 없음 |
| 읽기 전용 보존 | `bash tests/test-codex-sync.sh` 전후 `git status --short` 비교 | ✅ 통과 | `OK: Codex plugin mirror is in sync.`, 작업트리 상태 변화 없음 |
| stale mirror 감지 | temp repo에서 `plugins/llm-wiki/skills/wiki/SKILL.md`를 오염시킨 뒤 `bash tests/test-codex-sync.sh` | ✅ 통과 | exit 1, `SYNC NEEDED`, `Diff preview`, `stale mirror fixture` 출력 확인 |
| 구조 회귀 | `bash tests/test-plugin-validate.sh` | ✅ 통과 | 123 passed, 0 failed |
| sync 회귀 | `bash tests/test-codex-sync.sh` | ✅ 통과 | `OK: Codex plugin mirror is in sync.` |
| 문서 반영 | `rg -n "SYNC NEEDED|read-only Codex|sync-codex-plugin" CLAUDE.md tests/test-codex-sync.sh` | ✅ 통과 | Codex test 설명이 새 동작과 일치 |
| 계획문서 frontmatter | `post-frontmatter-validate.mjs` validator 직접 호출 | ✅ 통과 | `{"ok":true,"level":"PASS","message":""}` |

## 리스크 및 미해결 이슈

- `diff -ru --strip-trailing-cr` 옵션은 현재 Git Bash에서 확인됐고, `test-codex-sync.sh` 검증도 통과했다. CI 환경 차이가 발생하면 `git diff --no-index --exit-code` 또는 Python 비교 스크립트로 교체한다.
- 현재 `test-opencode-sync.sh`는 여전히 self-healing 방식이다. 이번 범위에서는 의도적으로 제외했지만, 사용자 경험 일관성을 위해 후속 적용 후보가 될 수 있다.
- 작업트리에 기존 hook/frontmatter 정리 변경이 남아 있다. 이번 변경과 커밋 단위가 섞이지 않도록 커밋 시 cp 스킬에서 scope를 분리해야 한다.

## 다음 액션

- 커밋 지시가 있으면 cp 스킬로 이번 변경 파일(`scripts/sync-codex-plugin.sh`, `tests/test-codex-sync.sh`, `CLAUDE.md`, 이 계획문서)을 기존 hook/frontmatter 정리 변경과 분리해 커밋한다.
- 후속으로 같은 사용자 경험 문제가 남은 `test-opencode-sync.sh` 읽기 전용화 여부를 별도 판단한다.

## 참고 자료

| 출처 | 용도 |
|------|------|
| `D:/vibe-coding/llm-wiki-my/tests/test-codex-sync.sh` | 현재 테스트가 실제 mirror를 재생성하고 `HEAD`와 비교하는 구조 확인 |
| `D:/vibe-coding/llm-wiki-my/scripts/sync-codex-plugin.sh` | Codex mirror 생성 규칙과 manifest 생성 흐름 확인 |
| `D:/vibe-coding/llm-wiki-my/CLAUDE.md` | structural test 설명, self-healing 문구, sync workflow 문구 수정 대상 |
| `D:/vibe-coding/llm-wiki-my/tests/ci/plugin-tests.yml` | CI에서 `test-codex-sync.sh`를 실행하는 사실 확인 |
