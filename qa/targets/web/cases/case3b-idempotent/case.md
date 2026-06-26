---
id: case3b-idempotent
axis: adoption
seed: brownfield-oppa
agent_steps: [generate]
judge: [project_unchanged, compiled_idempotent]
tools: [claude]
---
# case3b-idempotent — 자기 산출 하네스 위에서 재실행(인식·비파괴)

**검증:** AgentOppa가 *자신이 전에 만든* 하네스가 있는 프로젝트에 다시 들어왔을 때, 인식하고 **멱등 재생성**(스퓨리어스 diff 0)·원본 무손상.
**fail:** 재생성이 COMPILED 를 바꿈 / 원본 변형.
**판정:** 둘 다 기계.

## 절차 / 시드 (아직 없음)
`brownfield-oppa` = `brownfield-bare` + **AgentOppa가 생성해 커밋한 하네스**. case2 첫 generate 산출을 정제·커밋해 파생한다.
1. `setup` → baseline(커밋된 하네스 포함) → 2. generate 재실행 → 3. `judge` (`compiled_idempotent`는 baseline 대비 .claude/.codex diff=∅ 검사).
