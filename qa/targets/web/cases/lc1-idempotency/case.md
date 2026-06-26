---
id: lc1-idempotency
axis: lifecycle
seed: brownfield-oppa
agent_steps: [generate]
judge: [compiled_idempotent]
tools: [claude]
---
# lc1-idempotency — 멱등 재생성 (영구 거주자라 필수)

**검증:** intent 안 바꾸고 재생성하면 COMPILED 가 그대로인가(스퓨리어스 diff 0). 하네스를 수십 번 재실행할 거라 핵심.
**fail:** 재생성이 `.claude/.codex` 를 바꿈.
**판정:** `compiled_idempotent` = 기계(순수 `git diff`).

## 절차
1. `setup`(커밋된 하네스 = baseline) → 2. generate 재실행 → 3. `judge`.

> case3b와 짝: 3b는 "자기 하네스 *인식*"(도입 축), lc1은 "재생성 *무드리프트*"(생애 축). 시드(`brownfield-oppa`)는 공유.
