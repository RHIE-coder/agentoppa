---
id: case3a-foreign
axis: adoption
seed: brownfield-foreign
agent_steps: [interview, generate]
judge: [project_unchanged, harness_present, foreign_harness_preserved]
tools: [claude]
---
# case3a-foreign — 외래(비-AgentOppa) 하네스 위에서 공존·비손상

**검증:** 이미 *다른* 하네스(수제/타도구)가 있는 프로젝트에서, AgentOppa가 그걸 감지하고 **덮어쓰지 않고 공존**하며 원본도 안 건드리는가.
**fail:** 외래 하네스 파일 변형/삭제 / 프로젝트 원본 `git diff`≠∅.
**판정:** `project_unchanged`·`foreign_harness_preserved` = 기계(foreign: 시드가 심은 마커 `.qa-foreign-paths`(줄당 외래경로)의 경로들 git status=∅).

## 시드 (아직 없음)
`brownfield-foreign` = `brownfield-bare` + **손으로 만든 비-AgentOppa 하네스**(예: 단순 `.harness/` 흉내나 다른 도구 설정) + **`.qa-foreign-paths`**(외래 하네스 경로 목록 — `foreign_harness_preserved` 가 이 마커로 보호 대상을 식별). 케이스 착수 시 파생해 커밋한다.
