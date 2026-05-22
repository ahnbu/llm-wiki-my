---
title: eBook Markdown split 및 LLM Wiki raw ingest 기준 SPEC
created: 2026-05-21 11:17

session_id: codex:019e482e-1b1f-7b01-b187-ff0bdb2d07fa
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/21/rollout-2026-05-21T10-37-21-019e482e-1b1f-7b01-b187-ff0bdb2d07fa.jsonl
updated_sessions:
  - codex:019e482e-1b1f-7b01-b187-ff0bdb2d07fa

ai: codex
---

# eBook Markdown split 및 LLM Wiki raw ingest 기준 SPEC

## 목적
긴 eBook Markdown 원문을 LLM Wiki raw source로 ingest하기 전에, 사람이 이해하기 쉽고 재현 가능한 split 기준을 정한다.

현재 논의의 핵심 문제는 다음이다.

- 장 단위로만 나누면 일부 책의 raw chunk가 너무 커진다.
- 하위 목차를 무조건 쓰면 파일 수가 늘고 파일명 규칙이 복잡해진다.
- Markdown heading 구조가 책마다 다르며, 특히 `H2=부`, `H3=장` 구조에서는 단순 heading count가 실제 split 단위를 왜곡한다.
- 메인 변경 대상은 `llm-wiki-my`다. split 판단에 필요한 통계와 recommendation은 항상 `llm-wiki-my`가 입력 Markdown을 직접 분석해 생성한다. `ebook-md-maker` 수정은 별도 세션 `019e4861-45b0-7613-bdac-476122bb3b0b`에서 다루며, 이 SPEC 범위에서는 제외한다.

트레이드오프: chunk 크기를 엄격히 줄이면 검색·요약 안정성은 좋아지지만 raw 파일 수와 제목 복잡도가 늘어난다. 이 SPEC은 "평균 기준으로 기본 레벨을 정하고, 소수의 대형 챕터만 예외 분할"하는 운영안을 채택한다.

## 요구사항
- R1. eBook Markdown split 기준은 책별로 설명 가능해야 하며, 사용자가 보고서만 보고 왜 해당 목차 레벨을 선택했는지 이해할 수 있어야 한다.
- R2. split 기준은 줄 수가 아니라 한글 글자수 기준으로 판단해야 한다. OCR 줄바꿈과 원본 편집 폭이 문서마다 달라 줄 수는 주 기준으로 쓰지 않는다.
- R3. 기본 split level은 해당 목차 레벨의 평균 글자수를 기준으로 정한다.
- R4. 기본 split level에서 튀는 대형 chunk가 1~2개뿐이면 책 전체 레벨을 낮추지 않고 해당 챕터만 예외 분할을 권장한다.
- R5. `H3` 기준 분할 시 `H3` 자식이 없는 `H2`는 effective split unit에 포함해야 한다.
- R6. 부모 heading은 leaf chunk의 맥락으로 보존되어야 한다. 예: `split_parent_heading`.
- R7. 사용자 보고에는 각 책의 레벨별 목차 수, 평균 글자수, 최대 글자수, 초과 chunk 수, 권장 split 기준을 표로 제시해야 한다.
- R8. raw split 파일명은 진행 중인 NN 제거 정책을 반영해 `YYYYMMDD_sourcekey_part_제목.md` 형태를 기본으로 해야 한다.
- R9. `ebook-md-maker` 수정은 별도 세션 `019e4861-45b0-7613-bdac-476122bb3b0b`에서 처리하며, 이 SPEC 범위에서는 제외한다.
- R10. 실제 ingest 전에 `split-markdown-source.mjs`가 leaf-preserving split을 지원하는지 검증해야 한다.
- R11. 메인 구현은 `llm-wiki-my`의 split recommendation, manifest, raw split 생성 로직에 둔다.

## 성공 기준
- 5개 eBook 후보 각각에 대해 `H2`, `H3`의 목차 수, 평균 글자수, 최대 글자수, 20K/30K 초과 개수가 산출된다.
- 보고 표에는 "raw heading count"와 "effective split unit" 차이가 필요한 책이 표시된다.
- `아이디어불패_2020f`처럼 `H2=부`, `H3=장` 구조인 문서에서 `H3` 없는 `H2` leaf가 누락되지 않는다.
- default split level과 예외 분할 챕터가 분리되어 제시된다.
- 예외 분할은 전체 규칙을 흔들지 않고, 1~2개 대형 챕터에만 적용된다.
- split 통계, effective unit, recommendation이 `llm-wiki-my`의 동일 코드 경로에서 재현 가능하게 생성된다.

## 제약 조건
- 이 SPEC 작성 시점에는 실제 ingest를 수행하지 않는다.
- 이 SPEC 작성 시점에는 코드, 스킬, raw 파일을 수정하지 않는다.
- `llm-wiki-my`의 source of truth는 `claude-plugin/`이며, `plugins/llm-wiki/`, `plugins/llm-wiki-opencode/`는 generated mirror다.
- `.pptx` 관련 작업이 아니므로 Presentations 플러그인은 사용하지 않는다.
- 모든 시간 표시는 KST 기준이다.
- 커밋이 필요해지면 `cp` 스킬을 사용해야 한다. 이 SPEC 작성은 커밋을 포함하지 않는다.

## 경계선
- [OK] 글자수 기준으로 split level을 판단한다.
- [OK] 20K chars는 soft limit으로 사용한다.
- [OK] 30K chars 초과 chunk는 hard warning으로 사용한다.
- [OK] 기본 레벨은 평균 글자수로 결정한다.
- [OK] 튀는 대형 chunk가 1~2개뿐이면 해당 챕터만 예외 분할을 권장한다.
- [OK] `H3` 기준 분할 시 `H3` 없는 `H2` leaf를 effective split unit에 포함한다.
- [OK] 보고 표에는 level별 통계와 effective unit 보정 여부를 함께 표시한다.
- [OK] 예외 분할 part label은 `13-1`, `13-2`처럼 부모 챕터 번호를 보존한다.
- [OK] LLM Wiki split recommendation은 `llm-wiki-my` 쪽 책임으로 둔다.
- [OK] `llm-wiki-my`는 항상 입력 Markdown을 직접 분석해 heading 통계와 split recommendation을 생성한다.
- [NO] `ebook-md-maker`는 이번 SPEC 범위에서 수정하지 않는다. 관련 수정은 별도 세션 `019e4861-45b0-7613-bdac-476122bb3b0b`에서 다룬다.
- [NO] `ebook-md-maker` 산출물을 split 판단의 source of truth로 삼지 않는다.
- [NO] 줄 수를 primary split 기준으로 쓰지 않는다.
- [NO] 한 책 안에서 무분별하게 여러 heading level을 섞지 않는다.
- [NO] `YYYYMMDD_NN_...` 일일 순번 파일명 규칙을 새 raw split 기본값으로 쓰지 않는다.
- [NO] `H3` 없는 `H2` leaf를 프롤로그로 뭉개거나 누락하지 않는다.

## 결정안
### D1. Split 판단 규칙

1. 각 책에서 후보 heading level별 section 글자수를 계산한다.
2. 기본 후보는 `H2`다.
3. 해당 레벨의 평균 글자수가 20K 이하이면 그 레벨을 default split level로 둔다.
4. 평균 글자수가 20K를 초과하면 하위 레벨을 default split level로 검토한다.
5. 평균은 20K 이하이지만 30K 초과 chunk가 1~2개뿐이면 전체 레벨을 낮추지 않고 해당 챕터만 예외 분할 권장으로 둔다.
6. 30K 초과 chunk가 여러 개이거나 평균도 20K를 초과하면 책 전체 default level을 하위 레벨로 낮춘다.
7. 선택된 level에서 자식 heading이 없는 상위 heading은 effective leaf chunk로 포함한다.

### D2. 글자수 기준

- 목표 구간: 10K~15K chars
- soft limit: 20K chars
- hard warning: 30K chars
- 5K 미만: 서문, 감사의 말, 용어 해설, 에필로그 등 leaf 부속이면 단독 허용

### D3. 5개 eBook 샘플 검증 기준

| 책 | H2 목차 수 | H2 평균 | H2 최대 | H3 목차 수 | H3 평균 | H3 최대 | 권장 기준 |
|---|---:|---:|---:|---:|---:|---:|---|
| 프로덕트개발_2024 | 17 | 10K | 21K | 92 | 1.8K | 4.2K | H2 |
| 프로덕트매니저_2025 | 14 | 16K | 45K | 67 | 3.2K | 12K | H2 + 13장 예외 |
| 아이디어불패_2020f | 10 | 22K | 94K | 11 | 18K | 59K | effective H3 + 5장 예외 |
| 프롬프트텔링_2025f | 4 | 37K | 62K | 14 | 11K | 19K | H3 |
| 도그냥PO_20251125 | 6 | 26K | 81K | 24 | 6.1K | 9K | H3 |

이 표는 구현 후 산출물이 재현해야 할 샘플 검증 기준이다. 실제 ingest 실행값은 `llm-wiki-my`가 입력 Markdown을 다시 분석해 생성한 통계와 recommendation을 기준으로 한다.

### D4. 아이디어불패 특수 처리

`아이디어불패_2020f`는 `H2`가 본문 장이 아니라 부/앞뒤 부속 역할을 한다. `H3`가 본문 장에 가깝다. 따라서 단순 `H3 count=11`만 보고 판단하면 안 된다.

effective H3 split unit에는 다음이 포함되어야 한다.

- 실제 H3 본문 장 11개
- H3 자식이 없는 H2 leaf: `추천 서문`, `이 책을 먼저 읽고 찬사를 보낸 분들`, `일러두기`, `저자 서문`, `감사의 말`, `용어 해설`
- `개관`처럼 H3 자식이 있으면서 직하 본문이 있는 H2는 parent intro 처리 정책이 필요하다.

5장 `프리토타이핑 도구`는 H3 기준으로도 약 59K chars라 내부 무표시 소제목 기준 예외 분할이 필요하다.

### D5. `ebook-md-maker` 관련 결정

`ebook-md-maker`는 이번 SPEC 범위의 수정 대상이 아니다. 관련 문제는 별도 세션 `019e4861-45b0-7613-bdac-476122bb3b0b`에서 다룬다.

이유:

- LLM Wiki split은 실제 ingest할 Markdown을 기준으로 항상 같은 방식으로 재계산되어야 한다.
- split 통계와 split 결과가 같은 코드 경로에서 나와야 디버깅과 재현성이 좋다.
- downstream 정책을 upstream eBook 정리 스킬에 넣으면 책임 범위가 오염된다.

사용 방식:

- 기존 `ebook-md-maker` 산출물이 있으면 사람이 참고할 수는 있다.
- `llm-wiki-my` 구현은 `ebook-md-maker` 산출물 유무와 무관하게 동작해야 한다.

향후 `ebook-md-maker` 자체의 heading 통계 기능을 개선해야 한다면, 이 SPEC에 끼워 넣지 않고 별도 SPEC/plan으로 분리한다.

### D6. LLM Wiki split script 수정 필요성

현재 `scripts/split-markdown-source.mjs`는 지정한 `--split-heading` level heading만 실제 part로 만든다. 상위 heading은 parent context로만 취급한다. 따라서 `H3` 자식이 없는 `H2`를 effective H3 part로 만드는 로직은 아직 충분하지 않다.

이 항목은 사용자 의사결정이 아니라 구현 plan에서 정할 내부 구현 선택지다. 사용자에게 보장해야 하는 결과는 동일하다. 즉, `llm-wiki-my`가 leaf-preserving effective split unit을 계산하고, recommendation과 raw split 결과가 같은 기준을 사용해야 한다.

- `split-markdown-source.mjs`에 leaf-preserving split mode를 추가한다.
- `llm-wiki-my` 내부에 split recommendation/manifest 생성 스크립트를 추가한다.
- 단기적으로는 split 전 전처리로 leaf H2를 target level heading으로 승격한 임시 Markdown을 생성한다.

권장 구현 방향은 첫 번째와 두 번째를 결합하는 것이다. recommendation/manifest 생성 로직을 먼저 만들고, raw split script는 같은 effective unit 계산기를 재사용하게 한다. 세 번째 전처리 방식은 임시 우회로만 허용한다.

### D7. Split manifest 최소 필드

split recommendation/manifest에는 최소한 다음 필드가 포함되어야 한다.

- source path
- source key
- analyzed heading levels
- raw heading stats
- effective split unit stats
- default split level
- exception split targets
- generated part labels
- parent heading context
- soft/hard limit 초과 여부

이 필드는 사용자 보고, raw 파일 생성, ingest 전 검증이 같은 기준을 참조하도록 하기 위한 최소 계약이다.

## 사실 확인
- `sage-wiki`는 문서 분할 기준으로 `split_threshold: 15000 chars`를 문서화·구현하고, search chunk는 기본 `800 tokens`로 둔다.
  - 근거: `xoai/sage-wiki/internal/config/config.go`, `docs/guides/search-quality.md`, `docs/guides/large-vault-performance.md`
- `atomicstrata/llm-wiki-compiler`는 ingest source를 `100,000 chars` 초과 시 truncate하고, retrieval chunk는 `800 chars` target, `1,400 chars` max로 둔다.
  - 근거: `atomicstrata/llm-wiki-compiler/src/utils/constants.ts`, `src/utils/retrieval.ts`
- `nvk/llm-wiki`는 source chunk size보다 agent write 안정성 관점에서 한 번의 Write를 약 200 lines 이하로 제한한다.
  - 근거: `nvk/llm-wiki/claude-plugin/skills/wiki-manager/SKILL.md`
- `SamurAIGPT/llm-wiki-agent`는 source 전체를 prompt에 넣는 방식이며 별도 source split 로직이 약하다.
  - 근거: `SamurAIGPT/llm-wiki-agent/tools/ingest.py`
- 현재 `llm-wiki-my/scripts/split-markdown-source.mjs`는 지정 level heading만 part로 만들고, 하위 heading 없는 상위 heading leaf를 target level unit으로 승격하지 않는다.
- `ebook-md-maker` 지침은 leaf TOC heading 중심 품질 검사를 명시한다. 이는 LLM Wiki split 로직이 참고할 수 있는 개념이지만, `ebook-md-maker`에 LLM Wiki 전용 책임을 추가하는 근거는 아니다.

## 의사결정 로그
| 시점 | 결정 내용 | 근거 | 검토한 대안 |
|------|-----------|------|-------------|
| chunk 기준 논의 | 글자수 기준을 primary split 기준으로 채택 | 줄 수는 OCR 줄바꿈과 원본 폭에 따라 흔들림 | 전체 줄 수, 본문 있는 줄 수 |
| 외부 후보 확인 | `sage-wiki`의 15K chars 기준을 가장 직접적인 참고값으로 채택 | 후보 레포 코드에서 source split에 가장 가까운 기준이 확인됨 | `atomicstrata` retrieval chunk 800 chars, `nvk` 200 lines write rule |
| split 운영 규칙 | 평균 글자수로 default level을 정하고, 1~2개 대형 챕터만 예외 분할 | heading level 혼합을 줄이면서 대형 chunk 리스크를 제어 | 모든 20K 초과 chunk를 개별 예외 분할, 책 전체를 무조건 하위 level로 전환 |
| 아이디어불패 검토 | effective H3 split unit 개념을 도입 | `H2=부`, `H3=장` 구조라 raw heading count가 실제 split 단위를 왜곡 | H2/H3 raw count만 보고 판단 |
| ASK 1 확정 | 예외 분할 part label은 `13-1`, `13-2`처럼 부모 챕터 번호를 보존 | raw 파일명만 봐도 원서 목차와 예외 분할 관계가 드러남 | 단순 연속 번호 `14`, `15` |
| ASK 2 재정정 | `ebook-md-maker`는 이번 SPEC 범위에서 제외하고 별도 세션 `019e4861-45b0-7613-bdac-476122bb3b0b`에서 처리 | 현재 SPEC의 메인 작업은 `llm-wiki-my` split/ingest 기준 구현이기 때문 | 이 SPEC에 `ebook-md-maker` 수정 포함 |
| 범위 재확정 | split 통계와 recommendation은 항상 `llm-wiki-my`가 직접 계산 | split 실행 도구가 판단 근거를 직접 만들 때 재현성과 디버깅이 가장 좋음 | `ebook-md-maker` 통계에 의존 |
| `ebook-md-maker` 별도 세션 검토 | `ebook-md-maker`에는 큰 기능 문제가 없고, 필요 시 회귀 테스트 보강만 권장 | 현재 코드가 level 무관 leaf heading, `directChars`, `subtreeChars`를 이미 계산함 | `ebook-md-maker` 로직 수정 |

## 부록: 보고서 표준 형식

사용자에게 split 계획을 보고할 때는 다음 순서를 따른다.

1. 레벨별 통계 표
2. effective unit 보정 필요 여부
3. default split level
4. 예외 분할 권장 챕터
5. 예상 raw 파일 수
6. 파일명 규칙

표에는 최소한 다음 열을 포함한다.

| 책 | H2 의미 | H2 수 | H2 평균 | H2 최대 | H3 의미 | H3 수 | H3 평균 | H3 최대 | 권장 기준 |
|---|---|---:|---:|---:|---|---:|---:|---:|---|

## 부록: 파일명 규칙

새 raw split 파일명은 다음 규칙을 따른다.

```markdown
YYYYMMDD_sourcekey_part_제목.md
```

- `YYYYMMDD`: KST 기준 ingest 날짜
- `sourcekey`: 책 단위 짧은 key
- `part`: split part label. 책 순서 보존용이며 일일 ingest 순번이 아니다.
- `제목`: 해당 split unit의 사람이 읽는 제목
- 동일 파일명이 있으면 `_02`, `_03` suffix를 붙인다.

`YYYYMMDD_NN_제목.md` 형식의 `NN` 일일 순번은 새 raw split 기본값으로 쓰지 않는다.

## 부록: `ebook-md-maker` 별도 포크 세션 검토 결과

검토 세션: `019e4861-45b0-7613-bdac-476122bb3b0b`

이 섹션은 현재 SPEC 진행 중에 포크된 별도 세션에서 `ebook-md-maker` 상태를 확인한 결과를 기록한 참고 부록이다. 현재 SPEC 범위에 `ebook-md-maker` 수정 작업을 추가한다는 의미가 아니며, 별도 세션의 판단을 추적 가능하게 남기기 위한 것이다.

초기 우려는 다음이었다.

| 초기 우려 | 왜 문제로 봤는가 | 실제 검토 결과 |
|---|---|---|
| `H3` 기준 통계에서 `H3` 없는 `H2`가 빠질 수 있음 | 서문, 감사의 말, 용어 해설 같은 leaf 섹션이 누락될 수 있음 | 현재 `ebook-md-maker`는 자식 heading이 없으면 level과 무관하게 `leaf = true`로 계산함 |
| 부모/자식 본문 구분이 약할 수 있음 | `H2=부`, `H3=장` 구조에서 평균 글자수가 왜곡될 수 있음 | 현재 `directChars`와 `subtreeChars`가 이미 분리 계산됨 |
| 스킬 로직 수정이 필요할 수 있음 | LLM Wiki split 기준과 충돌할 가능성이 있었음 | 큰 기능 수정은 불필요하고, 필요 시 회귀 테스트 1~2개 보강 정도가 적절함 |

확인 근거:

- `C:/Users/ahnbu/.agents/skills/ebook-md-maker/lib/md-heading-stats.mjs`
  - `descendants.length === 0`이면 `leaf = true`로 계산한다.
  - 각 heading에 `directChars`, `subtreeChars`, `underMinChars`를 계산한다.
- `C:/Users/ahnbu/.agents/skills/ebook-md-maker/lib/quality-check.mjs`
  - TOC가 없으면 Markdown heading 중 `leaf`만 검사한다.
  - TOC가 있으면 다음 TOC entry level을 기준으로 leaf TOC entry를 판정한다.
- 테스트 실행 결과: `58 pass / 0 fail`

결론:

- `ebook-md-maker`는 현재 SPEC 범위에서 수정하지 않는다.
- `ebook-md-maker`의 현재 heading 통계 로직은 이 SPEC의 핵심 우려를 이미 처리하고 있다.
- 다만 `H2` 단독 leaf 사례를 명시적으로 고정하는 회귀 테스트는 별도 세션에서 보강할 가치가 있다.
- `llm-wiki-my`의 문제는 별개다. `scripts/split-markdown-source.mjs`는 아직 target heading level만 part로 만들기 때문에, `H3` 기준 split에서 `H3` 없는 `H2`를 effective split unit으로 포함하는 로직은 `llm-wiki-my`에서 구현해야 한다.
