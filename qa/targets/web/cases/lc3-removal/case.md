---
id: lc3-removal
axis: lifecycle
seed: brownfield-oppa
agent_steps: [remove-harness]
judge: [project_unchanged]
tools: [claude]
---
# lc3-removal — 하네스 제거 깨끗함 (역-피팅)

**검증:** 하네스를 떼어내면 프로젝트 원본이 무손상인가. ("`qa/` 빼도 프레임워크 멀쩡"의 *타깃판* — 하네스 빼도 프로젝트 멀쩡.)
**fail:** 하네스 경로 외 파일이 변하거나 깨진 참조가 남음.
**판정:** `project_unchanged` = 기계.

## 절차
1. `setup`(하네스 포함 baseline) → 2. 하네스 경로(.harness/.claude/.codex) 제거 → 3. `judge`.

> 제거 후 status 는 *삭제된 하네스 경로*만 보여야 하고 프로젝트 원본은 clean. (현재 판정은 하네스 외 변경 0을 본다.)
