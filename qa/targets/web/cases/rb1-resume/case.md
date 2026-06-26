---
id: rb1-resume
axis: robustness
seed: brownfield-bare
agent_steps: [generate, run, kill-mid-phase, resume]
judge: [resume_equivalent, contract]
tools: [claude]
---
# rb1-resume — 중단 후 재개 (핵심 베팅의 라이브 증명)

**검증:** phase 중간에 죽이고 재시작하면 **커밋된 문서에서 이어가는가.** "런타임 엔진 없음 → resume 공짜(상태=커밋 문서)" 베팅을 라이브로 친다.
**fail:** 재개가 안 되거나, 무중단 결과와 다른 산출.
**판정:** 둘 다 수동(추후 기계화: 중단본 vs 무중단본 산출 문서 동등 비교).

## 절차
1. `setup` → 2. generate → 3. run 도중 프로세스 종료 → 4. 재시작(이어서) → 5. `judge`(산출 문서가 유효·완결인지, 무중단 기준과 동등인지).

> QA 시드가 "임의의 커밋된-문서 체크포인트"인 것과 같은 메커니즘 — 이 케이스가 그 베팅의 직접 시험.
