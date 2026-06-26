---
id: case1-greenfield
axis: adoption
seed: greenfield
agent_steps: [interview, generate, run]
judge: [harness_present, acceptance]
acceptance: "node --test"
tools: [claude]
---
# case1-greenfield — 제로 프로젝트에 하네스 셋업 후 진행

**검증(0→1):** 거의 빈 web에 면담→생성→첫 기능 실행까지 한 바퀴. 메커니즘(L1–3)이 도는가.
**fail:** 하네스 산출(.harness/.claude/.codex) 누락 / 합격테스트 red.
**판정:** `harness_present`·`acceptance` = 기계.

## 절차
1. `node qa/run.mjs setup case1-greenfield`
2. `.work/case1-greenfield` 에서 면담→생성→실행(기능 1개, 예: `/echo` 라우트 + 테스트).
3. `node qa/run.mjs judge case1-greenfield`

> 그린필드는 손상시킬 원본이 없으니 `project_unchanged` 대신 *기능이 실제로 붙고 테스트가 통과*하는지로 본다.
