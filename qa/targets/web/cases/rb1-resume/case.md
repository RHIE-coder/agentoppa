---
id: rb1-resume
axis: robustness
seed: brownfield-bare
agent_steps: [baseline-run, generate, run, kill-mid-phase, resume]
judge: [resume_equivalent, contract]
tools: [claude]
---
# rb1-resume — 중단 후 재개 (핵심 베팅의 라이브 증명)

**검증:** phase 중간에 죽이고 재시작하면 **커밋된 문서에서 이어가는가.** "런타임 엔진 없음 → resume 공짜(상태=커밋 문서)" 베팅을 라이브로 친다.
**fail:** 재개가 안 되거나, 무중단 결과와 다른 산출.
**판정:** `contract`=기계 · `resume_equivalent`=기계(중단본 vs 무중단본의 역할 집합·인계 순서·유효 헤더 구조 동등 — `checks/lib/resume.mjs`, red/green 검증). 라이브 2-run *수집*(두 산출 뜨기)만 세션이 몲.

## 절차
1. `setup` → 2. 무중단 1회 완주(기준본을 `.harness/<하네스>/artifacts-baseline/` 로) → 3. generate → 4. run 도중 프로세스 종료 → 5. 재시작(이어서 → `.harness/<하네스>/artifacts/`) → 6. `judge`(두 산출이 구조 동등한지 = resume_equivalent).

> QA 시드가 "임의의 커밋된-문서 체크포인트"인 것과 같은 메커니즘 — 이 케이스가 그 베팅의 직접 시험.
