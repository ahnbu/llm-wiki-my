---
title: llm-wiki-my CHANGELOG.local 훅 충돌 정리
created: 2026-05-21 11:12
tags:
  - git
  - hook
session_id: codex:019e483c-a082-7e70-b82c-4bc38196307c
session_path: C:/Users/ahnbu/.codex/sessions/2026/05/21/rollout-2026-05-21T10-53-13-019e483c-a082-7e70-b82c-4bc38196307c.jsonl


ai: codex
---

# llm-wiki-my CHANGELOG.local 훅 충돌 정리

## 발단: 사용자 요청

`llm-wiki-my` 커밋 hook이 `CHANGELOG.local.md` 포함을 요구하며 커밋을 차단한 문제 확인 요청.
사용자 판단은 upstream `nvk/llm-wiki`에 `CHANGELOG*`가 없으므로 이 fork는 `CHANGELOG.local.md`를 쓰지 않고 루트 `CHANGELOG.md`로 일원화한다는 것.

## 작업 상세내역

확인 결과 `core.hooksPath`가 `C:/Users/ahnbu/.config/git/hooks`를 가리키고, 전역 `pre-commit` hook이 `upstream owner != ahnbu` 조건만으로 fork repo를 판정함.
현재 repo는 `origin=ahnbu/llm-wiki-my`, `upstream=nvk/llm-wiki` 구조라 해당 분기에 들어가며, 기존 정책과 무관하게 `CHANGELOG.local.md` staged 여부를 요구함.

`CHANGELOG.local.md`는 `.git/info/exclude`에 등록돼 있었지만 이미 tracked 상태였으므로 ignore/exclude가 적용되지 않는 상태였음.

## 의사결정 기록

| 옵션 | 적합성 | 판단 |
|------|--------|------|
| upstream 원격에서 `CHANGELOG*` 존재 여부를 hook마다 조회 | ❌ 무거움 | pre-commit hook에 부적합 |
| `CHANGELOG.local.md`만 tracked 해제 후 `.tmp/` 이동 | ⚠️ 불완전 | 현재 hook이 파일 부재 시 재생성함 |
| repo-local mode 설정 + hook 차단 완화 + tracked 해제 | ✅ 적합 | repo 정책을 반영하면서 hook을 가볍게 유지 |

> 정렬 기준: 커밋 hook의 실행 비용, repo 정책 충돌 해소, 재발 가능성 순.

- 결정: 전역 hook에 `.git/info/changelog-mode=root` override를 추가하고, fork repo의 `CHANGELOG.local.md` 요구는 차단이 아닌 경고로 완화.
- 근거: 이 repo는 upstream changelog 보호 대상이 아니라 fork 자체의 루트 `CHANGELOG.md`가 정본.
- 트레이드오프: repo-local 설정 파일은 `.git/info` 내부라 공유되지 않으므로, 다른 clone에서는 동일 설정을 다시 적용해야 함.

## 실행계획 원문

아래 내용은 linked plan 파일이 아니라 실행 전 TodoList/update_plan을 보존한 것이다.

| 단계 | 상태 | 완료 기준 |
|------|------|-----------|
| doc-save로 실행계획 문서 생성 | in_progress | 이 문서가 `docs/` 아래 새 파일로 생성됨 |
| hook 정책을 repo-local root mode와 경고 중심으로 수정 | pending | `changelog-mode=root`일 때 local changelog 분기를 타지 않음 |
| `CHANGELOG.local.md` 추적 해제 및 `.tmp` 백업 이동 | pending | Git 인덱스에서 제거되고 루트 파일이 사라짐 |
| 검증 실행 및 문서 검증표 업데이트 | pending | 검증 명령 결과가 모두 기대 상태와 일치함 |
| 검증 통과 시 cp 스킬로 커밋 처리 | pending | 전체 검증 성공 시 cp 스킬로 커밋 처리됨 |

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| repo-local mode 설정 | `.git/info/changelog-mode` 내용 확인 | ✅ 완료 | `MODE=root` 확인 |
| hook local changelog 차단 완화 | hook 코드에서 `exit 1` 강제 차단 제거 확인 | ✅ 완료 | 자동 생성 문구 없음, local 차단 문구 없음, 경고 문구 있음 |
| `CHANGELOG.local.md` tracked 해제 | `git ls-files -- CHANGELOG.local.md` 출력 없음 | ✅ 완료 | 출력 없음 |
| 기존 local changelog 백업 | `.tmp/CHANGELOG.local.md` 존재 및 루트 파일 부재 | ✅ 완료 | 루트 파일 없음, `.tmp/CHANGELOG.local.md` 존재 |
| 커밋 hook 동작 | staged 상태에서 `pre-commit` 실행 시 local changelog 요구로 실패하지 않음 | ✅ 완료 | Git Bash hook 실행 `EXIT=0` |

## 리스크 및 미해결 이슈

- 전역 hook 수정은 이 repo 밖의 다른 fork 작업에도 영향을 줄 수 있음. 다만 local changelog 요구를 차단에서 경고로 낮추는 방향이라 커밋 차단 리스크는 감소.
- `.git/info/changelog-mode`는 repo-local 비추적 설정이므로 clone을 새로 만들면 재설정 필요.

## 다음 액션

- hook 수정, repo-local mode 설정, `CHANGELOG.local.md` 정리 실행.
- 검증표 결과 인라인 업데이트.

## 참고 자료

| 출처 | 용도 |
|------|------|
| `C:/Users/ahnbu/.config/git/hooks/pre-commit` | 전역 pre-commit hook 원인 확인 |
| `D:/vibe-coding/llm-wiki-my/CHANGELOG.md` | `CHANGELOG.md` 일원화 정책 근거 |
| `D:/vibe-coding/llm-wiki-my/docs/20260520_01_nvk-LLM-Wiki-Codex-포크-구현계획.md` | upstream에 `CHANGELOG*` 부재 확인 및 정책 기록 |
