# CHANGELOG

모든 Git 커밋 이력을 최신순으로 기록합니다. 새 커밋은 표 최상단에 추가합니다.

> Note: upstream `nvk/llm-wiki`에는 `CHANGELOG.md` 또는 `CHANGE*` 파일이 없음을 확인했다. 따라서 이 fork(`ahnbu/llm-wiki-my`)의 변경 이력은 `CHANGELOG.local.md`로 분리하지 않고 이 파일로 일원화한다.

| 일시 | 유형 | 범위 | 변경내용 | 변경사유 | 작성AI |
|---|---|---|---|---|---|
| 2026-05-21 14:39 | fix | lint | 공용 lint helper의 성공 log 기록 조건과 URL-encoded link 해석 보강 | - | Codex |
| 2026-05-21 11:57 | feat | split | eBook split recommendation과 leaf 보존 분할 추가 | - | Codex |
| 2026-05-21 11:14 | fix | git-hook | `CHANGELOG.local.md` 추적을 해제하고 root `CHANGELOG.md` 일원화 정책에 맞춰 hook 설정 정리 | upstream에 `CHANGELOG*`가 없는 fork 운영 정책과 커밋 hook 요구 충돌 해소 | Codex |
| 2026-05-21 10:51 | refactor | ingest | raw 파일명 일일 순번 제거와 책 분할·마이그레이션 정책 정비 | - | Codex |
| 2026-05-20 19:46 | feat | ingest | raw 파일명 YYYYMMDD_NN 규칙과 책 분할·마이그레이션 스크립트 추가 | - | Codex |
| 2026-05-20 18:09 | chore | install | 구버전 `llm-wiki` cache를 정리하고 설치 결과 문서를 현재 상태로 갱신 | fork plugin만 남도록 운영 혼동 요소 제거 | Codex |
| 2026-05-20 18:01 | docs | install | Codex fork 플러그인 설치·활성 확인 결과와 changelog 일원화 결정을 문서에 반영 | `llm-wiki-my` 전환 완료 상태와 구버전 cache 잔여 상태를 추적 가능하게 기록 | Codex |
| 2026-05-20 17:27 | fix | tests | Codex SKILL name 검증을 공백/줄바꿈에 강한 패턴으로 수정 | sync 직후 검증이 환경별 줄바꿈 처리에 흔들리지 않게 보정 | Codex |
| 2026-05-20 17:22 | fix | sync | Codex/OpenCode mirror sync 생성물 LF 정규화 및 Codex sync 검증 범위 수정 | Windows/WSL 환경에서 줄바꿈 차이로 sync 테스트가 실패하지 않게 안정화 | Codex |
| 2026-05-20 17:14 | feat | wiki | 한국어 기본값과 `.wiki` Git 포함 정책 적용 | 다우기술 강의 준비용 raw distillation 기본 운영 안정화 | Codex |
| 2026-05-20 16:50 | docs | plan | Codex용 LLM Wiki 포크 구현 전 기준 계획 고정 | - | Codex |
| YYYY-MM-DD HH:MM | feat/fix/refactor/docs/chore | area-or-folder | 변경 요약 | 변경 이유·목적 | Claude/Codex/Gemini |
