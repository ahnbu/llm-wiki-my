---
title: LLM Wiki query output contract 구현계획
created: 2026-05-22 11:35
tags:
  - plan
  - llm-wiki
  - query
session_id: codex:019e4d63-95b9-7be2-890a-8f6ce2d40dad
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/22/rollout-2026-05-22T10-53-57-019e4d63-95b9-7be2-890a-8f6ce2d40dad.jsonl
ai: codex
---

# LLM Wiki Query Output Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** query 답변의 근거 문서, raw source, knowledge gap 표시 규칙을 `claude-plugin/skills/wiki-manager/` 계층의 공통 계약으로 올려 Claude, Codex, OpenCode가 같은 query 출력 규칙을 보게 한다.

**Architecture:** `references/querying.md`를 query retrieval/output contract의 정본으로 만든다. `SKILL.md`와 `commands/query.md`는 같은 규칙을 중복 보유하지 않고 이 reference를 읽도록 연결한다. sync script 실행 후 Codex mirror와 OpenCode mirror가 같은 reference를 보는지 구조 테스트와 behavioral eval로 확인한다.

**Tech Stack:** Markdown skill/reference docs, Bash validation scripts, Promptfoo behavioral evals, generated Codex/OpenCode plugin mirrors.

---

## Execution Results

실행일: 2026-05-22 KST

상태: 미완료. 구조 구현과 mirror 생성은 완료했지만, 모델 기반 `promptfoo` behavioral eval은 `ANTHROPIC_API_KEY` 부재로 실행 차단됐고, sync guard는 커밋 전 generated mirror 변경 때문에 아직 `OK` 판정을 받을 수 없다.

수행 내용:

- `claude-plugin/skills/wiki-manager/references/querying.md`를 새로 만들고 query retrieval/output contract의 정본으로 선언했다.
- `claude-plugin/skills/wiki-manager/SKILL.md`의 `### Query`가 `references/querying.md`를 읽도록 연결했다.
- `claude-plugin/commands/query.md`는 Claude slash command의 argument parsing과 wiki resolution만 유지하고, 공통 query 계약은 `references/querying.md`로 위임하도록 정리했다.
- `commands/query.md`의 기존 "reference files 읽기 금지" 문구를 `querying.md` 읽기와 충돌하지 않도록 수정했다.
- `scripts/sync-codex-plugin.sh`의 Codex 전용 `Workflows` 치환 문구도 `query → references/querying.md`로 수정했다. 원본 `SKILL.md`에는 별도 `Workflows` 목록이 없고, Codex mirror의 해당 목록은 sync script가 생성한다.
- `tests/test-plugin-validate.sh`에 `querying.md` 존재, SKILL/command 참조, Codex mirror 보존 검사를 추가했다.
- `tests/promptfooconfig.yaml`에 `Sources used`, `Knowledge gaps`, no-evidence behavior 검증 eval을 추가했다.
- `scripts/sync-codex-plugin.sh`와 `scripts/sync-opencode-plugin.sh`를 실행해 Codex/OpenCode mirror를 재생성했다.

검증 결과:

| 검증 | 결과 | 근거 |
|---|---|---|
| TDD RED 확인 | ✅ 완료 | 구현 전 `bash tests/test-plugin-validate.sh`가 `115 passed, 8 failed`로 실패했다. 실패 원인은 `querying.md`와 mirror 참조 부재였다. |
| reference 내용 확인 | ✅ 완료 | `source of truth`, `Sources used`, `Knowledge gaps`, `List Mode`, `Resume Mode`, `No Evidence Behavior`가 모두 매칭됐다. |
| Codex mirror 확인 | ✅ 완료 | `plugins/llm-wiki/skills/wiki/SKILL.md`가 `references/querying.md`를 참조하고, mirror reference에 `Sources used`, `Knowledge gaps`가 보존됐다. |
| OpenCode reference reachability | ✅ 완료 | `plugins/llm-wiki-opencode/skills/wiki-manager/references/querying.md` 접근 확인. |
| 구조 검증 | ✅ 완료 | `bash ./tests/test-plugin-validate.sh` 결과 `123 passed, 0 failed`. |
| Codex sync guard | ⚠️ 커밋 전 expected fail | `bash ./tests/test-codex-sync.sh`는 generated mirror가 `HEAD`와 다르기 때문에 실패한다. sync script 자체는 실행되어 mirror를 재생성했다. 커밋 후 재실행해야 `OK`가 가능하다. |
| OpenCode sync guard | ⚠️ 커밋 전 expected fail | `bash ./tests/test-opencode-sync.sh`도 같은 이유로 실패한다. generated mirror 변경이 커밋에 포함되면 통과 가능하다. |
| promptfoo query eval | ⚠️ 차단 | `C:/Users/ahnbu/.env`에 `ANTHROPIC_API_KEY`가 없어 Anthropic provider 기반 eval을 실행하지 못했다. |
| 변경 범위 확인 | ⚠️ 확인됨 | query 계약, command/skill 연결, sync script, validation/eval, generated mirror가 변경됐다. 기존 untracked `BACKLOG.md`는 이번 작업과 무관하여 건드리지 않았다. |

현재 남은 사항:

- 커밋 시 generated mirror 변경을 함께 포함한 뒤 `test-codex-sync.sh`, `test-opencode-sync.sh`를 재실행해야 한다.
- `ANTHROPIC_API_KEY`가 제공되면 `npx promptfoo@latest eval -c tests/promptfooconfig.yaml --filter "Query:"`로 behavioral eval을 완료할 수 있다.

## Done-check-lite Review

| 항목 | 판정 | 근거 |
|---|---|---|
| 전체 상태 | ❌ 미완료 | 원래 계획은 구조 테스트, sync guard, promptfoo behavioral eval까지 완료하는 것이었으나 promptfoo는 API 키 부재로 차단됐고 sync guard는 커밋 전 generated mirror diff 때문에 아직 실패한다. |

| 원래 요구사항 | 상태 | 구현 근거 | 검증 근거 | 비고 |
|---|---|---|---|---|
| query 출력 계약을 skill/reference 계층으로 승격 | ✅ 완료 | `claude-plugin/skills/wiki-manager/references/querying.md` 생성 | `rg`로 `source of truth`, `Sources used`, `Knowledge gaps`, `No Evidence Behavior` 확인 | 없음 |
| Claude command가 공통 규칙을 중복하지 않고 reference를 따름 | ✅ 완료 | `claude-plugin/commands/query.md`가 `references/querying.md`로 위임 | `test-plugin-validate.sh`에서 command reference 검사 PASS | 없음 |
| Codex mirror가 같은 query 계약을 봄 | ✅ 완료 | `plugins/llm-wiki/skills/wiki/SKILL.md`, `plugins/llm-wiki/skills/wiki/references/querying.md` 생성 | `test-plugin-validate.sh`에서 Codex reference 검사 PASS | sync guard 최종 OK는 커밋 후 확인 필요 |
| OpenCode mirror/reference 접근 가능 | ✅ 완료 | `plugins/llm-wiki-opencode/skills/wiki-manager/SKILL.md` 갱신, reference symlink reachability 확인 | `test-plugin-validate.sh`에서 OpenCode reference 검사 PASS | sync guard 최종 OK는 커밋 후 확인 필요 |
| query output contract 행동 평가 | ❌ 미완료 | `tests/promptfooconfig.yaml`에 eval은 추가됨 | `ANTHROPIC_API_KEY` 부재로 실행하지 못함 | 키 제공 후 실행 필요 |
| 계획 수행 결과 문서 업데이트 | ✅ 완료 | 이 문서의 `Execution Results`, `Done-check-lite Review` 섹션 | 문서 내 실행 결과와 남은 사항 명시 | 없음 |

미완료·승인 필요 항목:

| 항목 | 문제 | 필요한 다음 작업 |
|---|---|---|
| promptfoo behavioral eval | API 키 부재로 query 응답 행동을 실제 모델로 검증하지 못함 | `ANTHROPIC_API_KEY` 설정 후 `npx promptfoo@latest eval -c tests/promptfooconfig.yaml --filter "Query:"` 실행 |
| sync guard 최종 OK | `test-codex-sync.sh`, `test-opencode-sync.sh`는 generated mirror가 `HEAD`와 다른 커밋 전 상태를 실패로 판정함 | 커밋 시 mirror 변경을 포함하고 두 sync guard 재실행 |

검증 근거:

| 구분 | 근거 |
|---|---|
| 실행한 검증 | `bash ./tests/test-plugin-validate.sh` → `123 passed, 0 failed`; `test-codex-sync.sh`와 `test-opencode-sync.sh`는 커밋 전 mirror diff로 실패 |
| 확인한 파일 | `claude-plugin/skills/wiki-manager/references/querying.md`, `claude-plugin/commands/query.md`, `claude-plugin/skills/wiki-manager/SKILL.md`, `plugins/llm-wiki/skills/wiki/SKILL.md`, `tests/promptfooconfig.yaml` |
| 커밋 | 없음 |

---

## Scope Boundary

이번 계획에서 구현한다:

- `claude-plugin/skills/wiki-manager/references/querying.md`를 새로 만들고 query 계약의 정본으로 선언한다.
- 일반 query 답변에 `Sources used`와 `Knowledge gaps` 섹션을 항상 포함하도록 명시한다.
- `Knowledge gaps`가 없으면 `없음`으로 허용한다.
- `Raw sources used`는 deep/raw 검색에서 raw source를 실제로 읽었을 때만 포함하도록 한다.
- `--list`와 resume-only briefing은 synthesized answer 출력 계약의 예외로 둔다.
- wiki 근거가 부족할 때 일반 지식으로 보완하지 않고 근거 부족을 명시하게 한다.
- `SKILL.md`와 `commands/query.md`가 `references/querying.md`를 참조하게 한다.
- sync 후 Codex mirror의 실제 문구를 확인한다.
- 구조 테스트와 promptfoo eval로 query 출력 계약이 유지되는지 검증한다.

이번 계획에서 하지 않는다:

- query retrieval 알고리즘을 deterministic code로 새로 구현하지 않는다.
- `scripts/llm-wiki` CLI에 query 실행기를 추가하지 않는다.
- router/init/onboarding, refresh, retract, lessons learned, output, plan, assess의 command parity 문제를 함께 해결하지 않는다.
- 기존 wiki 데이터나 사용자 topic wiki를 migration하지 않는다.

## Feedback 반영 판단

반영한 피드백:

- `references/querying.md`를 정본으로 둔다.
- `commands/query.md`와 `references/querying.md`에 같은 규칙을 중복 작성하지 않는다.
- `sync-codex-plugin.sh`가 SKILL 문구를 생성/치환하므로 sync 후 mirror 문구를 직접 확인한다.
- `Sources used`는 항상 포함한다.
- `Knowledge gaps`는 항상 포함하되, 없으면 `없음`으로 허용한다.
- `Raw sources used`는 raw를 실제로 읽었을 때만 포함한다.
- `--list`, resume-only는 예외로 둔다.
- 테스트는 reference 존재만 보지 않고, SKILL 참조, Codex mirror 복사, OpenCode reference reachability, promptfoo 행동까지 확인한다.

## File Structure

- Create: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/querying.md`
  - query depth, retrieval flow, output contract, citation format, no-evidence behavior의 정본.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/SKILL.md`
  - Query workflow가 `references/querying.md`를 읽도록 연결.
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/query.md`
  - Claude slash command의 옵션/라우팅/argument parsing은 유지하고, 공통 query 계약은 `references/querying.md`를 따르도록 정리.
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`
  - `querying` reference를 필수 reference 목록에 추가하고, SKILL/command/Codex mirror 참조를 검사.
- Modify: `D:/vibe-coding/llm-wiki-my/tests/promptfooconfig.yaml`
  - query 답변이 `Sources used`, `Knowledge gaps`, 근거 부족 시 일반 지식 보완 금지 계약을 따르는지 behavioral eval 추가.
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/skills/wiki/references/querying.md`
  - `scripts/sync-codex-plugin.sh` 실행으로 생성되는 Codex mirror.
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/skills/wiki/SKILL.md`
  - sync 후 query workflow가 `references/querying.md`를 참조해야 한다.
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/skills/wiki-manager/references/querying.md`
  - OpenCode는 reference symlink로 접근한다. sync/validate에서 reachability를 확인한다.

## Query Contract

일반 query 답변의 출력 계약:

```markdown
[Answer in clear prose with markdown formatting]

---
**Sources used:**
- [[article-slug|Article Title]] ([Article Title](wiki/concepts/article-slug.md)) (confidence: high) — what was drawn from it

**Raw sources used:** (only when raw sources were actually read)
- [[raw-source-slug|Raw Source Title]] ([Raw Source Title](raw/articles/raw-source.md)) — what was drawn from it

**Related in other wikis:** (if any, or if deep mode checked siblings)
- [wiki-name]: [[article-slug|Article Title]] ([Article Title](path)) — relevance signal

**Archived matches:** (deep mode only, or if explicitly included)
- [archived-wiki]: [[article-slug|Article Title]] ([Article Title](path)) — archived context, not active evidence

**Knowledge gaps:**
- 없음
```

근거 부족 시 출력 계약:

```markdown
현재 wiki에는 이 질문에 답할 충분한 근거가 없습니다.

---
**Sources used:**
- 없음

**Knowledge gaps:**
- [질문에 답하기 위해 부족한 자료]
- Suggested sources to ingest: [구체적인 자료 유형 또는 후보]
```

예외:

- `--list`: ranked matching articles/raw sources만 출력하고 synthesized answer, `Sources used`, `Knowledge gaps`는 생략한다.
- resume-only: briefing만 출력하고 `Sources used`, `Knowledge gaps`는 생략한다.
- `--resume`과 질문이 함께 있으면 briefing 뒤 answer portion에 query 출력 계약을 적용한다.

## Task 1: query reference 정본 추가

**Files:**
- Create: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/references/querying.md`

- [ ] **Step 1: `querying.md`를 작성한다**

새 파일을 아래 내용으로 생성한다.

````markdown
# Querying Reference

This file is the source of truth for query retrieval and output contracts.
`commands/query.md`, Codex, and OpenCode must refer to this file instead of
duplicating the same rules elsewhere.

## Purpose

Answer questions from the target wiki only. Query is not general ChatGPT mode:
do not use training data to fill missing evidence. If the wiki does not contain
enough evidence, say so and suggest what to ingest.

## Resolution

Resolve the active wiki using `references/command-prelude.md` and
`references/hub-resolution.md`. Read the target wiki `_index.md` before reading
article bodies. If no compiled articles exist, stop and ask the user to
initialize, ingest, or compile first.

## Depths

### Quick

Use indexes only. Cite index entries in `Sources used`. If indexes do not
contain enough evidence, say so and suggest rerunning as a standard query.

### Standard

Use this for most questions.

1. Read the master `_index.md`.
2. Read relevant category `_index.md` files.
3. Identify 3-8 relevant compiled articles.
4. Read those articles in full.
5. Follow directly relevant `See Also` links.
6. Grep `wiki/` for key terms that indexes may have missed.
7. Synthesize an answer using only wiki evidence.

### Deep

Use this for cross-topic or high-stakes synthesis.

1. Read all relevant `_index.md` files.
2. Read all relevant articles.
3. Follow relevant `See Also` links.
4. Grep `wiki/` and `raw/` for key terms, synonyms, and related concepts.
5. Skip raw sources listed in `raw/_source-exclusions.json` unless
   `--include-excluded` is present.
6. Peek active sibling wiki indexes from `HUB/wikis.json`.
7. For archived sibling wikis, read only archived `_index.md` files unless
   `--include-archived` is present.

## List Mode

When `--list` is set, return a ranked list of matching articles instead of a
synthesized answer.

Output:

```markdown
## Search Results for "<query>"

Found N results:

### Wiki Articles
1. **[[article-slug|Title]] ([Title](wiki/concepts/article-slug.md))** — summary — tags: tag1, tag2

### Raw Sources
1. **[[raw-source-slug|Title]] ([Title](raw/articles/raw-source.md))** — summary — type: articles
```

If no results are found, suggest alternative search terms or sources to ingest.
Do not include `Sources used` or `Knowledge gaps` in list mode.

## Resume Mode

If `--resume` has no question, output only the resume briefing. Do not include
`Sources used` or `Knowledge gaps`.

If `--resume` has a question, show the briefing first, then answer the question
using the normal query output contract.

## Citation Format

Use dual links for compiled wiki article citations:

```markdown
[[article-slug|Article Title]] ([Article Title](wiki/concepts/article-slug.md))
```

Include article confidence when available:

```markdown
[[article-slug|Article Title]] ([Article Title](wiki/concepts/article-slug.md)) (confidence: high) — what was drawn from it
```

Use dual links for raw sources when raw sources were actually read:

```markdown
[[raw-source-slug|Raw Source Title]] ([Raw Source Title](raw/articles/raw-source.md)) — what was drawn from it
```

Label excluded or archived citations:

```markdown
[[source-slug|Source Title]] ([Source Title](raw/articles/source.md)) (excluded) — why it was used
[[article-slug|Article Title]] ([Article Title](wiki/concepts/article.md)) (archived) — preserved context, not active evidence
```

Inventory records are not factual evidence for factual questions. Cite inventory
only for meta-questions about candidates, backlogs, next actions, or tracking.

## Output Contract

All synthesized query answers must use this format:

```markdown
[Answer in clear prose with markdown formatting]

---
**Sources used:**
- [[article-slug|Article Title]] ([Article Title](wiki/concepts/article-slug.md)) (confidence: high) — what was drawn from it

**Raw sources used:** (only when raw sources were actually read)
- [[raw-source-slug|Raw Source Title]] ([Raw Source Title](raw/articles/raw-source.md)) — what was drawn from it

**Related in other wikis:** (if any, or if deep mode checked siblings)
- [wiki-name]: [[article-slug|Article Title]] ([Article Title](path)) — relevance signal

**Archived matches:** (deep mode only, or if explicitly included)
- [archived-wiki]: [[article-slug|Article Title]] ([Article Title](path)) — archived context, not active evidence

**Knowledge gaps:**
- 없음
```

Rules:

- `Sources used` is always present for synthesized answers.
- `Knowledge gaps` is always present for synthesized answers.
- If there are no gaps, write `- 없음`.
- `Raw sources used` appears only when raw sources were actually read.
- `Related in other wikis` appears when sibling wikis were checked and relevant matches exist, or when deep mode makes the check relevant.
- `Archived matches` appears only in deep mode or when archived content is explicitly included.
- `--list` and resume-only briefing are exceptions and do not use this contract.

## No Evidence Behavior

When the wiki lacks evidence, do not answer from training data. Use this format:

```markdown
현재 wiki에는 이 질문에 답할 충분한 근거가 없습니다.

---
**Sources used:**
- 없음

**Knowledge gaps:**
- [질문에 답하기 위해 부족한 자료]
- Suggested sources to ingest: [구체적인 자료 유형 또는 후보]
```

If relevant articles exist but are weak, answer only the supported part and list
the unsupported part under `Knowledge gaps`.

## Logging

After answering, append to `log.md`:

```markdown
## [YYYY-MM-DD] query | "<question>" → answered from N articles (depth)
```

For no-evidence answers:

```markdown
## [YYYY-MM-DD] query | "<question>" → insufficient wiki evidence
```
````

완료 기준:

- 새 reference가 query 계약의 정본임을 첫 단락에서 선언한다.
- `Sources used`, `Knowledge gaps`, raw/deep, no-evidence behavior, list/resume 예외가 모두 포함된다.
- `Knowledge gaps`가 없을 때 `없음`을 허용한다.

검증 방법:

Run: `rg -n "source of truth|Sources used|Knowledge gaps|No Evidence Behavior|List Mode|Resume Mode" claude-plugin/skills/wiki-manager/references/querying.md`

Expected: 각 검색어가 1개 이상 매칭된다.

## Task 2: SKILL.md가 query reference를 읽도록 연결

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/skills/wiki-manager/SKILL.md`

- [ ] **Step 1: Workflows 목록의 query 항목을 수정한다**

현재 항목:

```markdown
- `query` → read the relevant `_index.md` files first, then only the articles needed to answer
```

수정 후:

```markdown
- `query` → `references/querying.md`
```

완료 기준:

- Workflows 목록에서 query가 `references/querying.md`를 직접 가리킨다.

검증 방법:

Run: `rg -n "\`query\` → \`references/querying.md\`" claude-plugin/skills/wiki-manager/SKILL.md`

Expected: 1개 매칭.

- [ ] **Step 2: Query workflow 요약을 reference 기반으로 수정한다**

현재 `### Query` 단락을 아래로 교체한다.

```markdown
### Query
See [references/querying.md](references/querying.md).
Flow: Resolve wiki → read `_index.md` files → identify relevant articles by summary/tag → read articles → follow See Also links → Grep for additional matches → synthesize answer with the query output contract → note gaps → peek active sibling wikis when relevant. Deep queries may peek archived sibling indexes in a separate Archived Matches section; full archived reads require explicit user intent.
```

완료 기준:

- `### Query`가 `references/querying.md`를 명시한다.
- query 출력 계약을 SKILL 본문에 중복 작성하지 않는다.

검증 방법:

Run: `rg -n "See \\[references/querying.md\\]|query output contract" claude-plugin/skills/wiki-manager/SKILL.md`

Expected: 2개 문구 모두 매칭.

## Task 3: commands/query.md를 reference 위임 구조로 정리

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/claude-plugin/commands/query.md`

- [ ] **Step 0: reference 읽기 금지 문구와 새 위임 구조의 충돌을 제거한다**

현재 문구:

```markdown
**Resolve the wiki.** Do NOT search the filesystem or read reference files — follow these steps:
```

수정 후:

```markdown
**Resolve the wiki.** Read `skills/wiki-manager/references/querying.md` for the shared query contract, then follow these wiki resolution steps. Do not search unrelated filesystem locations or read unrelated reference files.
```

완료 기준:

- `commands/query.md`가 `querying.md`를 읽으라고 하면서 동시에 reference 읽기를 금지하지 않는다.
- filesystem 탐색 금지는 unrelated location에 대한 금지로 유지한다.

검증 방법:

Run: `rg -n "Read \`skills/wiki-manager/references/querying.md\`|Do NOT search the filesystem or read reference files" claude-plugin/commands/query.md`

Expected:

- `Read \`skills/wiki-manager/references/querying.md\``는 매칭된다.
- `Do NOT search the filesystem or read reference files`는 매칭되지 않는다.

- [ ] **Step 1: 공통 계약 위임 문구를 추가한다**

`Answer the question in $ARGUMENTS using ONLY the knowledge in the wiki. Follow the Q&A protocol below.` 문장을 아래로 교체한다.

```markdown
Answer the question in $ARGUMENTS using ONLY the knowledge in the wiki. Read `skills/wiki-manager/references/querying.md` and follow it as the source of truth for query retrieval, citation, output format, no-evidence behavior, and list/resume exceptions. This command file owns Claude slash-command argument parsing and wiki resolution only; it must not duplicate the common query contract.
```

완료 기준:

- command 파일이 query 계약의 정본을 `querying.md`로 위임한다.

검증 방법:

Run: `rg -n "source of truth for query retrieval|must not duplicate the common query contract" claude-plugin/commands/query.md`

Expected: 2개 문구 모두 매칭.

- [ ] **Step 2: 중복된 Q&A protocol 본문을 축소한다**

`### Query Depth Levels`부터 `IMPORTANT: Do NOT use information from your training data. Answer ONLY from wiki content. If the wiki doesn't have the answer, say so honestly.`까지의 상세 protocol을 제거하고, 아래 문단으로 교체한다.

```markdown
### Query Protocol

The shared query protocol lives in `skills/wiki-manager/references/querying.md`.
After parsing flags above, apply that reference exactly:

- quick, standard, deep, list, and resume behavior
- citation format with dual links
- `Sources used` and `Knowledge gaps` output contract
- raw, excluded, archived, and sibling wiki handling
- no-evidence behavior
- query logging
```

완료 기준:

- `commands/query.md`에는 flag parsing과 Claude command entrypoint 역할만 남는다.
- `Sources used`와 `Knowledge gaps`의 상세 예시는 command 파일에 중복으로 남기지 않는다.

검증 방법:

Run: `rg -n "### Query Protocol|skills/wiki-manager/references/querying.md|Output Format \\(all depths" claude-plugin/commands/query.md`

Expected:

- `### Query Protocol` 매칭.
- `skills/wiki-manager/references/querying.md` 매칭.
- `Output Format (all depths`는 매칭되지 않음.

## Task 4: 구조 테스트 보강

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/tests/test-plugin-validate.sh`

- [ ] **Step 1: `REFERENCE_NAMES`에 `querying`을 추가한다**

현재:

```bash
REFERENCE_NAMES="archive audit command-prelude compilation datasets hub-resolution indexing ingestion inventory librarian linting projects research-infrastructure wiki-structure"
```

수정 후:

```bash
REFERENCE_NAMES="archive audit command-prelude compilation datasets hub-resolution indexing ingestion inventory librarian linting projects querying research-infrastructure wiki-structure"
```

완료 기준:

- Claude reference 존재 검사, Codex reference copy 검사, OpenCode symlink/reachability 검사가 `querying.md`를 자동 포함한다.

검증 방법:

Run: `rg -n "projects querying research-infrastructure" tests/test-plugin-validate.sh`

Expected: 1개 매칭.

- [ ] **Step 2: SKILL과 command가 query reference를 참조하는지 검사한다**

기존 `assert_contains "$PLUGIN_DIR/commands/query.md" "Korean by default|한국어" "query command documents Korean response defaults"` 검사 바로 뒤에 아래 검사를 추가한다.

```bash
assert_contains "$PLUGIN_DIR/skills/wiki-manager/SKILL.md" "references/querying\\.md" "skill query workflow references querying contract"
assert_contains "$PLUGIN_DIR/commands/query.md" "references/querying\\.md" "query command delegates shared query contract"
```

완료 기준:

- 정본 skill과 Claude query command가 모두 `references/querying.md`를 참조한다.

검증 방법:

Run: `bash tests/test-plugin-validate.sh`

Expected: `skill query workflow references querying contract`, `query command delegates shared query contract`, `references/querying.md exists`가 PASS로 표시된다.

- [ ] **Step 3: Codex mirror 문구 검사를 추가한다**

Codex references copy 검사 이후에 아래 검사를 추가한다.

```bash
assert_contains "$CODEX_SKILL/SKILL.md" "references/querying\\.md" "Codex skill query workflow references querying contract"
assert_contains "$CODEX_SKILL/references/querying.md" "Sources used" "Codex querying reference preserves Sources used contract"
assert_contains "$CODEX_SKILL/references/querying.md" "Knowledge gaps" "Codex querying reference preserves Knowledge gaps contract"
```

완료 기준:

- sync 후 Codex mirror에서 query reference가 실제로 보존되는지 확인한다.
- `sync-codex-plugin.sh`의 내장 문구 치환이 query reference 연결을 깨지 않는지 테스트로 감지한다.

검증 방법:

Run: `bash tests/test-plugin-validate.sh`

Expected: Codex 관련 3개 assert가 PASS로 표시된다.

## Task 5: promptfoo query 출력 계약 eval 추가

**Files:**
- Modify: `D:/vibe-coding/llm-wiki-my/tests/promptfooconfig.yaml`

- [ ] **Step 1: query 출력 계약 eval을 추가한다**

기존 `"Router: question dispatches to query"` 테스트 바로 뒤에 아래 테스트를 추가한다.

```yaml
  - description: "Query: answer includes sources and knowledge gaps"
    vars:
      prompt: "What testing patterns exist for LLM tools?"
    assert:
      - type: skill-used
        value: wiki
      - type: llm-rubric
        value: "Agent treated this as a query against existing wiki content and the answer includes a Sources used section plus a Knowledge gaps section. If there are no gaps, the Knowledge gaps section explicitly says none."
        threshold: 0.75
      - type: cost
        threshold: 0.50
```

완료 기준:

- query 답변에 `Sources used`와 `Knowledge gaps`가 포함되어야 한다는 behavioral contract가 생긴다.

검증 방법:

Run: `npx promptfoo@latest eval -c tests/promptfooconfig.yaml --filter "Query: answer includes sources and knowledge gaps"`

Expected: 해당 eval이 PASS.

- [ ] **Step 2: 근거 부족 시 일반 지식 보완 금지 eval을 추가한다**

위 테스트 바로 뒤에 아래 테스트를 추가한다.

```yaml
  - description: "Query: no evidence does not fall back to general knowledge"
    vars:
      prompt: "According to my wiki, what exact warranty policy applies to the fictional product XJ-991?"
    assert:
      - type: skill-used
        value: wiki
      - type: llm-rubric
        value: "If the wiki lacks evidence for the exact warranty policy, the agent says the wiki has insufficient evidence, does not invent a policy from general knowledge, and suggests concrete source material to ingest."
        threshold: 0.75
      - type: cost
        threshold: 0.50
```

완료 기준:

- 근거 부족 상황에서 일반 지식으로 보완하지 않는 행동을 eval로 확인한다.

검증 방법:

Run: `npx promptfoo@latest eval -c tests/promptfooconfig.yaml --filter "Query: no evidence does not fall back to general knowledge"`

Expected: 해당 eval이 PASS.

## Task 6: sync mirror 및 실제 문구 검증

**Files:**
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/skills/wiki/SKILL.md`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki/skills/wiki/references/querying.md`
- Generated: `D:/vibe-coding/llm-wiki-my/plugins/llm-wiki-opencode/skills/wiki-manager/references/querying.md`

- [ ] **Step 1: Codex mirror를 sync한다**

Run:

```bash
./scripts/sync-codex-plugin.sh
```

Expected:

```markdown
Synced Codex plugin skill from Claude source.
```

완료 기준:

- `plugins/llm-wiki/skills/wiki/references/querying.md`가 존재한다.
- `plugins/llm-wiki/skills/wiki/SKILL.md`가 `references/querying.md`를 참조한다.

검증 방법:

Run:

```bash
test -f plugins/llm-wiki/skills/wiki/references/querying.md
rg -n "references/querying.md|Sources used|Knowledge gaps" plugins/llm-wiki/skills/wiki
```

Expected:

- `test -f` exit code 0.
- `references/querying.md`, `Sources used`, `Knowledge gaps`가 매칭된다.

- [ ] **Step 2: OpenCode mirror를 sync한다**

Run:

```bash
./scripts/sync-opencode-plugin.sh
```

Expected:

```markdown
Synced OpenCode plugin skill from Claude source.
```

완료 기준:

- OpenCode reference symlink 또는 대체 target에서 `querying.md`가 reachable하다.

검증 방법:

Run:

```bash
test -f plugins/llm-wiki-opencode/skills/wiki-manager/references/querying.md
```

Expected: exit code 0.

- [ ] **Step 3: sync script 치환으로 예전 query bullet이 남는지 확인한다**

Run:

```bash
rg -n "`query` → read the relevant `_index.md` files first|### Query|references/querying.md" plugins/llm-wiki/skills/wiki/SKILL.md
```

Expected:

- `references/querying.md`가 매칭된다.
- `` `query` → read the relevant `_index.md` files first ``는 매칭되지 않는다.

만약 예전 query bullet이 남으면 `scripts/sync-codex-plugin.sh`의 SKILL text replacement 목록에 query reference 문구 보존 규칙을 추가한다. 추가 후 `./scripts/sync-codex-plugin.sh`를 다시 실행하고 이 Step의 검증을 재수행한다.

## Task 7: 전체 검증

**Files:**
- No direct edits.

- [ ] **Step 1: 구조 테스트를 실행한다**

Run:

```bash
./tests/test-plugin-validate.sh
./tests/test-codex-sync.sh
./tests/test-opencode-sync.sh
```

Expected:

- 세 명령 모두 exit code 0.
- `querying.md` reference 관련 PASS가 표시된다.
- Codex sync test와 OpenCode sync test가 generated mirror drift를 보고하지 않는다.

- [ ] **Step 2: query 관련 promptfoo eval을 실행한다**

먼저 API 키 전제를 확인한다.

Run:

```bash
test -n "${ANTHROPIC_API_KEY:-}"
```

Expected:

- exit code 0.
- 키가 없으면 이 Step은 완료할 수 없으며, query behavioral eval은 `blocked: missing ANTHROPIC_API_KEY`로 보고한다. 이 경우 구조 테스트 통과만으로 완료 선언하지 않는다.

Run:

```bash
npx promptfoo@latest eval -c tests/promptfooconfig.yaml --filter "Query:"
```

Expected:

- query 관련 eval이 PASS.
- 실패 시 실패 로그에서 다음 중 어떤 계약이 깨졌는지 확인한다: `Sources used`, `Knowledge gaps`, no-evidence behavior.

- [ ] **Step 3: 변경 범위를 확인한다**

Run:

```bash
git status --short
git diff --stat
```

Expected changed paths:

```markdown
claude-plugin/skills/wiki-manager/SKILL.md
claude-plugin/skills/wiki-manager/references/querying.md
claude-plugin/commands/query.md
tests/test-plugin-validate.sh
tests/promptfooconfig.yaml
plugins/llm-wiki/skills/wiki/SKILL.md
plugins/llm-wiki/skills/wiki/references/querying.md
plugins/llm-wiki-opencode/skills/wiki-manager/references/querying.md
```

`plugins/llm-wiki-opencode/skills/wiki-manager/references/querying.md`는 symlink 구조에 따라 직접 file diff가 없을 수 있다. 이 경우 `test -f plugins/llm-wiki-opencode/skills/wiki-manager/references/querying.md`가 통과하면 정상이다.

## Commit Plan

커밋은 `cp` 스킬로 수행한다.

권장 커밋 메시지:

```markdown
docs(query): query 출력 계약을 공통 reference로 승격 — Codex mirror 일관성 확보
```

커밋 범위:

- query reference 추가
- skill/command 연결
- sync mirror 갱신
- validation/promptfoo 테스트 보강

## Self-Review

검수 결과:

- Spec coverage: 사용자 피드백 3개를 모두 반영했다. 정본 위치, sync script 확인, 과도하게 빡빡하지 않은 output contract가 plan에 포함되어 있다.
- Scope control: query 출력 계약만 다루며 router/init/refresh/retract/ll 개선은 제외했다.
- Drift control: `commands/query.md`는 공통 규칙을 중복하지 않고 `references/querying.md`로 위임한다.
- Test coverage: reference 존재, SKILL 참조, Codex mirror 복사, OpenCode reachability는 구조 검증으로 확인했다. promptfoo behavior는 eval을 추가했으나 `ANTHROPIC_API_KEY` 부재로 아직 실행하지 못했다.
- 빈칸 검수: 실행자가 채워 넣어야 하는 빈 항목 없이 파일별 수정 내용과 검증 명령을 명시했다.

## Execution Options

Plan complete and saved to `_docs/20260522_01_LLM-Wiki-query-output-contract-구현계획.md`.

1. **Subagent-Driven**: task별로 fresh worker를 나누어 구현하고 중간 리뷰를 수행한다.
2. **Inline Execution**: 현재 세션에서 순서대로 구현하고 각 검증 지점에서 체크한다.
