# core-reuse — "복사 말고 *가리켜* 재사용 = 워크플로우 한 벌, 구현만 다름" 비전 증명 시드

이 시드 하나가 **재사용 Core 모델의 핵심 주장**을 기계로 떨어뜨린다: *재사용 Core 묶음 하나를 여러 프로젝트가 `core:` 로 가리켜 쓰되(phase 복사 0), 각자 다른 구현으로 바인딩해도 둘 다 통과한다.*

```
core-reuse/
├── .agentoppa/                          공유 재사용 Core 묶음 *한 벌* (AgentOppa 자신과 동형: 마켓 2개 + plugins/<core>/).
│   └── plugins/demo-core/
│       ├── phases/{spec,e2e}.md           ← phase 소스 단일본. 프로젝트들이 이 한 벌을 *가리킨다*(복사 안 함).
│       │                                    e2e.md 가 능력-빈자리 e2e-runner 선언.
│       └── skills/<phase>/SKILL.md         ← 저작 빌드가 낸 컴파일 산출(참고용).
└── projects/
    ├── web-playwright/.harness/demo-core/config.yaml   프로젝트 A: core: demo-core · test_command="npm test"  · e2e-runner→playwright
    ├── api-node/.harness/demo-core/config.yaml          프로젝트 B: core: demo-core · test_command="node --test" · e2e-runner→node-driver
    └── unbound/.harness/demo-core/config.yaml           음성: core: demo-core 인데 e2e-runner 미바인딩 → validator error 여야
```

세 프로젝트 중 *어느 것도* `.harness/demo-core/project/phases/` 를 안 든다 — phase 정의는 공유 묶음 `phases/` 한 곳에만 산다. 빌드·validator 는 `core: demo-core` 를 보고 그 공유 묶음의 phase 소스를 *가리켜* 해석한다(상위로 탐색).

## 무엇을 증명하나

- **복사 0 (가리키기):** 프로젝트는 phase 사본을 안 든다. 차이는 오직 `config.yaml` 의 `values`·`bindings`·`impl` 뿐. 프로젝트가 `project/phases/` 를 들면 "가리켜 재사용"이 아니라 복사 → 판정 fail.
- **단일소스:** Core phase 소스가 공유 묶음 한 곳(`.agentoppa/plugins/demo-core/phases/`)뿐이다. 그래서 그 한 파일을 고치면 N개 프로젝트에 반영된다(여러 곳이면 복붙 = 단일소스 깨짐 → fail).
- **구현만 다름, 둘 다 통과:** Core 단계가 선언한 능력-빈자리 `e2e-runner` 를 A 는 playwright, B 는 node-driver 로 채운다 — 단계 본문은 일반명 `{cap:e2e-runner}` 로만 참조하고 구현을 런타임에 `.harness/demo-core/config.yaml` 에서 읽는다. 그래서 둘 다 agent-engineer validator green.
- **빈자리는 침묵으로 새지 않음(음성):** `unbound` 는 같은 Core 를 가리키되 `e2e-runner` 를 안 채워서 validator 가 error(exit≠0) 로 막는다(공유 묶음 소스를 읽어 빈자리를 본다는 증거이기도 하다).

## 왜 유효한가 (반증 가능)

판정 본체 = **agent-engineer validator**(Core 가 쓰는 바로 그 검사기). 사람 느낌이 아니라 exit code 로 떨어진다:
- A·B 가 green = "다른 구현이어도 같은 Core(가리킨 한 벌)가 돈다"의 사실. 한쪽이라도 red 면 주장 붕괴 → 판정 fail.
- 어느 프로젝트가 phase 를 복사했거나 Core 소스가 두 곳 이상이면 "가리켜 재사용·단일소스" 전제가 깨진 것 → 판정 fail.
- unbound 가 green 으로 새면 빈자리 게이트가 무의미 → 판정 fail.

> 라이브 agent 단계가 필요 없다(면담·생성·실행 없음) — 시드 자체가 공유 Core 한 벌 + 두 바인딩이라 셋업 직후 바로 judge. 자족형 증명.
