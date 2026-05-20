# CHANGELOG (local)
<!-- upstream CHANGELOG.md는 건드리지 않는다. 커스텀 변경 이력만 여기에 기록. -->

| 변경시점 | 구분 | 범위 | 상세내역 | 변경사유/목적 |
|---------|------|------|---------|-------------|
| 2026-05-20 17:27 | fix | tests | Codex SKILL name 검증을 공백/줄바꿈에 강한 패턴으로 수정 | sync 직후 검증이 환경별 줄바꿈 처리에 흔들리지 않게 보정 |
| 2026-05-20 17:22 | fix | sync | Codex/OpenCode mirror sync 생성물 LF 정규화 및 Codex sync 검증 범위 수정 | Windows/WSL 환경에서 줄바꿈 차이로 sync 테스트가 실패하지 않게 안정화 |
| 2026-05-20 17:14 | feat | wiki | 한국어 기본값과 `.wiki` Git 포함 정책 적용 | 다우기술 강의 준비용 raw distillation 기본 운영 안정화 |
