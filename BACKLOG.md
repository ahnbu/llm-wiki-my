# BACKLOG — 후속 작업 후보

> **BACKLOG — 미래 시제.** 미확정 후보와, 확정됐지만 계획을 아직 안 쓴 일(`[확정]`)의 평가장.
> 계획을 쓰기 시작하면 여기서 뺀다 → _docs/. 운영 규칙 정본은 [문서_작성기준](file:///C:/Users/ahnbu/cowork/05_AI/global-rule-improve/문서_작성기준.md) §4·§5.

현재 작업 범위 밖이지만 나중에 가치 있는 작업을 기록합니다. 새 항목은 표 최하단에 추가합니다.


## 공용 템플릿

| ID | 날짜 | 항목 | 위치 | 실행 용이성 | 기대효과 | 메모 |
|----|------|------|------|------------|---------|------|
| BL-0521-01 | 2026-05-21 | 이미지 포함 ingest의 raw 자산 저장 경로 표준화 | `claude-plugin/commands/ingest.md`, `claude-plugin/skills/wiki-manager/references/ingestion.md`, ingest 구현 스크립트 | `████░░` | `██████` | 현재 lint schema는 `raw/_images/`를 허용하지만, 향후 이미지 포함 ingest가 자동으로 이 경로에 저장하도록 ingest 단계까지 보강 필요. 상세 작업 기준은 아래 섹션 참조 |

> **컬럼 기준** — `실행 용이성`: `██████` 쉬움 / `████░░` 보통 / `██░░░░` 어려움 | `기대효과`: `██████` 높음 / `████░░` 보통 / `██░░░░` 낮음. 두 값의 합이 클수록 우선순위 높음. AI 초안이므로 실행 전 재평가 권장.

## BL-0521-01 상세

### 배경

2026-05-21 세션에서 다우기술 강의 wiki의 `raw/articles/_resources` 경고를 조사했다. 해당 폴더는 실제 원문 3개가 참조하는 이미지 10개를 담고 있었고, 기존 lint schema에서는 `raw/articles/` 아래의 비-md 폴더라 warning으로 잡혔다.

### 완료된 선행 작업

- `raw/_images/`를 LLM Wiki의 source-adjacent 이미지 자산 폴더로 허용했다.
- `scripts/llm-wiki`의 raw allowlist에 `_images`를 추가했다.
- `claude-plugin/skills/wiki-manager/references/linting.md`와 `wiki-structure.md`에 `raw/_images/` 구조를 문서화했다.
- Codex mirror `plugins/llm-wiki/skills/wiki/references/*`를 동기화했다.
- `tests/test-local-cli-lint.sh`에 `raw/_images/articles/sample.png` 허용 테스트를 추가했다.

### 추적 정보

- 세션 ID: `codex:019e49b1-db89-72b0-8408-05432b16c036`
- 플러그인 커밋: `a06fb5f fix(lint): raw 이미지 자산 폴더 허용 — wiki schema 정리`
- 운영 wiki 적용 커밋: `19c1e39 fix(wiki): raw 이미지 자산 위치 정리 — _images 구조 적용`
- 사례 wiki: `C:/Users/ahnbu/cowork/02_강의/202606_다우기술_신입_7H/.wiki`

### 해야 할 일

1. 이미지 포함 ingest 경로 정책을 명확히 한다.
   - 권장 경로: `raw/_images/<raw-type>/`
   - 예: article 원문 이미지 → `raw/_images/articles/`
   - 예: note 원문 이미지 → `raw/_images/notes/`
2. ingest 문서와 명령 설명을 업데이트한다.
   - `claude-plugin/commands/ingest.md`
   - `claude-plugin/skills/wiki-manager/references/ingestion.md`
   - 필요 시 `AGENTS.md`의 portable protocol
3. 실제 ingest 구현 또는 보조 스크립트가 이미지 자산을 `_resources`나 원문 하위 폴더에 두지 않도록 수정한다.
   - 이미지 파일 복사/다운로드 시 `raw/_images/<raw-type>/`를 목적지로 사용
   - 원문 markdown embed 경로도 새 위치로 재작성
4. Codex/OpenCode mirror를 동기화한다.
   - `bash ./scripts/sync-codex-plugin.sh`
   - `bash ./scripts/sync-opencode-plugin.sh`
5. 회귀 테스트를 추가한다.
   - 이미지 포함 ingest fixture 또는 local lint fixture
   - 기대: 생성된 raw markdown이 `raw/_images/<raw-type>/...`를 참조하고, lint가 warning 없이 통과

### 완료 기준

- 새 이미지 포함 ingest가 `raw/_images/<raw-type>/`에 자산을 저장한다.
- raw markdown의 이미지 embed가 `raw/_images/<raw-type>/...`를 가리킨다.
- `raw/articles/_resources` 같은 임시 자산 폴더가 새 ingest 결과에 생기지 않는다.
- `bash ./tests/test-plugin-validate.sh`가 통과한다.
- `bash ./tests/test-structure.sh`가 통과한다.
- `bash ./tests/test-local-cli-lint.sh`가 통과한다.
- `bash ./tests/test-codex-sync.sh`가 통과한다.
- `bash ./tests/test-opencode-sync.sh`가 통과한다.

### 주의 사항

- 기존 wiki의 `raw/articles/_resources`를 무조건 삭제하거나 이동하지 말 것. 먼저 실제 참조 여부를 확인해야 한다.
- `.gitignore`가 `*.jpg`, `*.png`, `*.webp`를 무시할 수 있으므로, wiki 원문 재현에 필요한 이미지는 명시적으로 추적 정책을 정해야 한다.
- lint schema 허용은 이미 끝났지만 ingest 생성 규칙은 아직 보강되지 않았다. 이 백로그의 핵심은 schema가 아니라 ingest 경로 생성 로직이다.
