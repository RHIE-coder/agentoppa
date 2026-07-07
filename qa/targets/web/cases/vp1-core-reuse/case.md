---
id: vp1-core-reuse
axis: vision
seed: core-reuse
agent_steps: []
judge: [core_reuse, unbound_errors]
projects: [web-playwright, api-node]
unbound: unbound
tools: [claude, codex]
---
# vp1-core-reuse — 한 재사용 Core를 여러 프로젝트가 *가리켜* 재사용 (비전 증명)

**검증(모델의 핵심 주장):** 재사용 Core 묶음 *하나*(워크플로우 = `spec → e2e`, `.agentoppa/plugins/demo-core/`)를 두 프로젝트가 `core: demo-core` 로 **가리켜** 쓴다. 각자 `config.yaml` 의 값·바인딩만 다르고 **phase 사본은 안 든다**(복사 0). **"복사 말고 가리켜 재사용 = 워크플로우 한 벌, 구현만 다름"** 을 기계로 떨어뜨린다.
- 프로젝트 A(`web-playwright`): `test_command="npm test"` · `e2e-runner→playwright`.
- 프로젝트 B(`api-node`): `test_command="node --test"` · `e2e-runner→node-driver`.
- 둘 다 `.harness/<하네스>/project/phases/` 가 **없다** — phase 정의는 공유 Core 묶음 `phases/{spec,e2e}.md` *한 벌*에만 산다.

**fail:** 어느 프로젝트가 phase 를 복사해 듦(가리키기 아님) / Core phase 소스가 두 곳 이상(단일소스 깨짐) / 한쪽이라도 agent-engineer validator red / 미바인딩(`unbound`)이 green 으로 샘.

**판정(둘 다 기계):**
- `core_reuse` = (1) 두 프로젝트 모두 `project/phases/` 복사본 없음 + (2) Core phase 소스가 공유 묶음 한 곳뿐(단일소스) + (3) 둘 다 validator green(spawn). → Core 그 한 phase 를 고치면 둘에 반영됨(단일성).
- `unbound_errors` = 능력 미바인딩 프로젝트(`unbound`)가 같은 Core 를 가리키되 `e2e-runner` 를 안 채워 validator error(exit≠0) 로 막히는지.

## 절차 (라이브 agent 불필요 · 자족형)
1. `node qa/run.mjs setup vp1-core-reuse`  (seed 그대로 — 면담·생성 없음)
2. `node qa/run.mjs judge vp1-core-reuse`

> 다른 케이스와 달리 *셋업 직후 바로 judge* — 시드 자체가 완성된 공유 Core 한 벌 + 두 바인딩(복사 0) + 음성 하나라, 메커니즘이 아니라 *모델 주장*(가리켜 재사용)을 증명한다.
