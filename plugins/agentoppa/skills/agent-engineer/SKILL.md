---
name: agent-engineer
description: 사용자 맞춤 AI 작업 흐름(하네스)을 면담으로 설계·생성할 때 사용. 여러 단계(기획·개발·리뷰·UI 등)를 묶은 워크플로우를 Claude·Codex 양쪽에서 도는 스킬·에이전트·훅으로 조립해준다. "내 워크플로우/파이프라인 만들어줘", "기획부터 개발까지 흐름 세팅", "이 프로젝트용 하네스", "리뷰·QA 자동 흐름", "재사용할 워크플로우 프레임워크 만들기", "그 프레임워크를 이 프로젝트에 붙이기" 같은 요청에 적용. 단일 스킬/에이전트/훅 하나만 만드는 일은 해당 ccc-* 스킬로 — 여긴 *여러 개를 흐름으로 엮을* 때.
---

# agent-engineer — 하네스 생성기 (Maker)

ccc-* 메이커가 *부품*(스킬·에이전트·훅·메모리)을 만든다면, agent-engineer는 그 부품으로 **사용자 맞춤 작업 흐름(하네스)을 면담→설계→조립**한다. 전체 개념 모델은 repo `ARCHITECTURE.md`.

> 작성 메타(SKILL 형식·≤500줄·점진 로딩)는 [`ccc-skills`](../ccc-skills/SKILL.md). agent-engineer 자체가 ccc-skills로 만든 스킬이다.

## ⛔ 시작 전 게이트 — 구현 직행 금지 (열 때마다 통과)

이 스킬을 열면 *무엇을 만들기 전에* 아래 셋을 먼저 통과한다. **"기존 걸 정리·다듬자"류 요청일수록** 면담·층분리를 건너뛰고 곧장 손대기 쉬운 함정 — 그래도 건너뛰지 않는다. 통과 못 하면 아래 5단계 루프에 들어가지 않는다.

1. **모드부터 가른다** — ⓐ Core 짓기인가 ⓑ 프로젝트 바인딩인가([두 모드](#두-모드-먼저-어느-쪽인지-가른다)). 안 갈렸으면 멈추고 가른다.
2. **의도 먼저** — `.harness/intent.md`가 없으면 1단계 면담(intent-interview)부터. 이미 굴러가는 하네스를 "정리"하는 거라도 끝 상태(Core/Project로 옮길지, 도구 설정만 맞출지)를 먼저 못박는다.
3. **층부터 나눈다** — 기존 하네스를 손보는 작업이면 먼저 Core(`.agentoppa/`)와 Project(`.harness/`)로 나눌 자리를 정한다. 한쪽 도구 설정만 베끼는 *얕은 동기화*로 끝내지 않는다.

## 핵심 모델 (먼저 이걸 잡아라)

AgentOppa(= 이 Maker)는 **아무것도 안 싣는다.** 유저가 Maker로 두 층을 만든다 — 그리고 agent-engineer엔 그 두 층에 대응하는 **두 모드**가 있다.

- **Core = 재사용 프레임워크.** 유저 프로젝트의 `.agentoppa/`에 사는 자체완결 묶음(`.agents` + `.claude-plugin` + `plugins/<core>/` — AgentOppa 자신과 같은 패키징). 워크플로우(단계 흐름·게이트) + 범용 스킬·훅 + **인터페이스(빈자리)**. **프로젝트 값을 안 박는다** — 단계가 `requires:[e2e-runner:capability]`(e2e = 처음부터 끝까지 전체 흐름을 돌려보는 테스트)로 빈자리만 선언하고, 그 값은 *실행 시점에* `.harness/`에서 읽는다. 그래서 web·mobile·go 어디든 통째로 옮겨도 돈다.
- **Project = 이 프로젝트의 구현·바인딩.** `.harness/`에 사는 `intent.md` + `config.yaml`(`core:` 어떤 Core · `bindings:` 능력→구현 · `values:`) + 구현 모듈(`project/impl/`)·보조 에이전트(`project/agents/`). 프로젝트 차이는 전부 여기에만.
- **런타임 엔진 없음 (핵심 베팅).** 단계 사이 상태는 **커밋된 산출물 문서**가 든다 — 상주 실행기를 안 만든다. 그래서 resume(= 끊긴 작업을 중간부터 다시 잇기)·병렬·크로스툴이 공짜. (허용: 돌고 끝나는 검사기 `validate.mjs`. 금지: 워크플로우를 상주하며 굴리는 실행기.)
- **인터페이스↔구현이 재사용의 비결.** Core 단계가 능력-빈자리(`requires`)를 선언 → Project `config.bindings`가 *어떤 구현을 쓸지* 채움 → Core 스킬 본문은 능력을 일반명으로 부르고(`{cap:e2e-runner}`) 런타임에 `config.yaml`을 읽어 푼다. 미바인딩 빈자리는 validator가 error.
- **단계 = 작업 한 단계.** frontmatter(= 파일 맨 위 `---` 사이에 적는 구조화된 설정 블록, 구조)+본문(산문). 데이터 모델 → [references/phases.md](references/phases.md). 단계끼리는 문서로 이어진다 → [references/contract.md](references/contract.md). 어떤 단계·순서·강도·`core:`·`bindings`인지는 `config.yaml`이 진실원천 → [references/recipe.md](references/recipe.md).

```text
agent-engineer/
├── references/        # 프레임워크 규격 (도메인 무관·고정)
│   ├── phases.md      #   단계 스키마 (frontmatter + requires 빈자리)
│   ├── contract.md    #   계약 두 층 (산출물 바통 + 인터페이스↔구현)
│   └── recipe.md      #   Config (config.yaml·core·bindings·loop·sync·routing)
├── template.md        # 빈 골격 (config + 단계 + 구현 모듈 + 에이전트)
├── examples/sample.md # 같은 Core를 두 프로젝트가 다른 구현으로 쓰는 견본
└── scripts/validate.mjs
```

## 두 모드 (먼저 어느 쪽인지 가른다)

요청이 "재사용할 흐름을 짓자"인지 "있는 흐름을 이 프로젝트에 붙이자"인지로 갈린다. 한 세션에서 ⓐ→ⓑ 연달아 할 수도 있다(새 Core를 짓고 바로 이 프로젝트에 바인딩).

| 모드 | 무엇을 만드나 | 어디에 | 면담이 캐는 것 |
|---|---|---|---|
| **ⓐ Core 짓기** | 재사용 워크플로우 + 인터페이스(빈자리) + 범용 스킬·훅 | `.agentoppa/plugins/<core>/` 묶음 | 어떤 단계·흐름·게이트, 어떤 *능력 빈자리*(프로젝트마다 갈릴 자리) |
| **ⓑ 프로젝트 바인딩** | 어떤 Core를 쓸지 + 빈자리를 이 프로젝트 구현으로 채움 | `.harness/`(config + 구현 모듈) | 어떤 Core, 각 능력에 *이 프로젝트가 쓸 구현*, 값·스코프 |

- **ⓐ**는 *값을 안 박는 게 일*이다 — 도구명 금지(`playwright` ✗, `e2e-runner` ✓), 단계는 능력을 일반명으로만 부른다. 산출 = `.agentoppa/` 자체완결 묶음(github·복붙으로 이식).
- **ⓑ**는 *그 빈자리를 채우는 게 일*이다 — `config.bindings:{e2e-runner: playwright}` + 필요하면 구현 모듈. 같은 Core라도 프로젝트마다 `bindings` 한 줄만 다르다.
- **`core:` 생략 = 단독 하네스.** Core를 따로 안 두고 `.harness/project/phases/`가 자기 단계를 직접 들 수도 있다(그대로 유효). 작게 시작하다 재사용이 필요해지면 그 단계들을 `.agentoppa/` Core로 추출한다(= ⓐ).
- **소비자 자급(AgentOppa 없이):** build-skills는 모든 Core에 `setup` 스킬 + `interface.json`을 주입한다 → 남이 그 Core만 설치해도 `setup`이 `.harness/config.yaml`을 스스로 깐다(빈자리 노출, `bindings`만 채움). 즉 ⓑ는 *AgentOppa를 쓸 때*의 경로고, 없이 쓰면 Core의 `setup`이 같은 일을 한다.

## When to use
- "워크플로우/파이프라인/하네스 만들어줘", "기획부터 개발까지 흐름", "리뷰·QA 자동화 흐름", "여러 작업 병렬로", "재사용할 워크플로우 프레임워크", "그 프레임워크를 이 프로젝트에 붙여".
- **When NOT:** 단일 부품 *하나만* → [`ccc-skills`](../ccc-skills/SKILL.md)·[`ccc-agents`](../ccc-agents/SKILL.md)·[`ccc-hooks`](../ccc-hooks/SKILL.md)·[`ccc-memory`](../ccc-memory/SKILL.md). 여긴 *여러 개를 흐름으로 엮을* 때.

## 5단계 루프

### 1. 면담 — 의도 → 요구
[intent-interview](../intent-interview/SKILL.md)로 위임 — ~95% 확신까지 `.harness/intent.md`(의도 브리프). **먼저 두 모드 중 어느 쪽인지** 가린다(재사용 Core를 짓나, 있는 Core를 이 프로젝트에 붙이나). 모드에 따라 캐는 게 다르다 — ⓐ면 *능력 빈자리*(프로젝트마다 갈릴 자리), ⓑ면 *각 능력의 이 프로젝트 구현*. 막연하면 발산탐색. 2단계가 그 브리프를 입력으로 받는다.

### 2. Config — 합의 → config.yaml
고른 단계·순서·`sync`·`routing`·`values`·(ⓑ면 `core:`+`bindings:`+`impl:`)를 `.harness/config.yaml`로 적어 보여주고 함께 고친다 ([recipe.md](references/recipe.md) 양식). 능력-빈자리(`requires`의 `:capability`)는 `bindings`로, 값-빈자리는 `values`로 채운다 — 섞지 않는다.

### 3. 생성 — 부품 조립 (스킬-주도)
config의 각 단계 정의를 읽어(ⓐ면 `.agentoppa/` Core 묶음의 단계, 단독이면 `.harness/project/phases/<name>.md` — 없으면 [phases.md](references/phases.md) 양식대로 그 자리에 저작) **부품으로 조립**한다. 펼침:

| 단계에 …가 있으면 | 만들 것 | 메이커 |
|---|---|---|
| (항상) | 단계 스킬 | [ccc-skills](../ccc-skills/SKILL.md) |
| `workers` | 서브에이전트 (`project/agents/`) | [ccc-agents](../ccc-agents/SKILL.md) |
| `gate` + `sync=strict` | 게이트 훅 | [ccc-hooks](../ccc-hooks/SKILL.md) |
| `produces` | 산출물 문서(헤더) | [ccc-memory](../ccc-memory/SKILL.md) |

본문 슬롯 채움: `{역할}`(contract)·`{next}`(recipe 순서). **값-빈자리 `{프로젝트값}`도 능력-빈자리 `{cap:<능력>}`도 박지 않는다** — "런타임에 `config.yaml`의 `values` / `bindings`·`impl`을 읽어 쓰라"는 결정적 산문으로 펼친다(같은 Core를 재빌드 없이 다른 값·구현으로 재사용). `when`은 본문 맨 위 self-gate(= 스킬이 스스로 조건을 보고 건너뛸지 판단하는 자가 점검)로. 빌드 자동화는 `plugins/agentoppa/bin/build-skills.mjs`(슬롯 치환·Codex·게이트훅·loop/dynamic-workers self-gate·멱등).

### 4. 포장 — 양쪽 도구로
조립된 스킬·에이전트·훅을 한 트리(공유 컴포넌트) + 두 매니페스트(= 어떤 플러그인·컴포넌트가 있는지 적어 둔 구성 정보 파일)(+ 루트 마켓 2개)로 싣는다 → [ccc-plugin](../ccc-plugin/SKILL.md) (포인터·마켓 동기화). ⓐ면 `.agentoppa/plugins/<core>/` 묶음으로(이식 가능한 Core), 단독이면 `.harness/`를 읽어 `plugins/<harness>/`로 빌드. 컴포넌트는 한 트리 공유, 도구별로 갈리는 건 매니페스트·마켓뿐. 도구가 읽는 `.claude`/`.codex`는 그 묶음을 **가리키는 얇은 포인터**(사본 아님).

### 5. 검증
`node .harness/core/validate.mjs`로 두 계약(산출물 바통 + 인터페이스↔구현)을 함께 점검 — 연결·누락·신선도·**미바인딩 능력**([contract.md](references/contract.md) §4). 각 부품은 그 메이커의 validate로.

## Gate
- [ ] 시작 전 게이트 통과: 모드(ⓐ/ⓑ) 확정 + `.harness/intent.md` 존재(면담 했음) — 구현 직행 아님
- [ ] `.harness/config.yaml` 유효 + 모든 단계 정의가 Core 묶음(ⓐ) 또는 `project/phases/`(단독)에 있거나 생성됨
- [ ] 산출물 계약 연결됨 (dangling·orphan·중복 역할 없음) — [contract.md](references/contract.md) §4
- [ ] ⓑ면 모든 비선택 능력-빈자리가 `config.bindings`로 채워짐(미바인딩 0) + 구현 알맹이가 `impl`/인라인에 존재
- [ ] 생성 부품이 각 ccc-* validate 통과 + 양쪽 도구에 실림(Core면 `.agentoppa/` 묶음이 이식 가능)
- [ ] `node .harness/core/validate.mjs` 통과

## Resources
- [references/phases.md](references/phases.md) — 단계 데이터 모델 + `requires` 빈자리(값/능력) (점)
- [references/contract.md](references/contract.md) — 계약 두 층: 산출물 바통 + 인터페이스↔구현 (선)
- [references/recipe.md](references/recipe.md) — Config (순서·강도·라우팅·`core:`·`bindings`·`impl`)
- [template.md](template.md) — 빈 골격 · [examples/sample.md](examples/sample.md) — 같은 Core·두 구현 견본
- [../intent-interview/SKILL.md](../intent-interview/SKILL.md) — 1단계 면담 (의도 → `.harness/intent.md`, 두 모드 분기)
- 전체 개념 모델: repo `ARCHITECTURE.md`

## 병렬 (git-workflow) — 고급 🚧 (지금 범위 밖)

`feature = git worktree`(= 한 저장소를 여러 작업 폴더로 펼쳐 브랜치별로 따로 작업) 단위로 N개 동시. 에이전트끼리 **커밋된 문서로** 소통 → 레이스(= 동시에 같은 자원을 건드려 결과가 꼬이는 것) 없음. `decompose → seam-first → fan-out → integrate`. `{feature}` 스코프 + 커밋 문서 구조가 받쳐줌. *본체 위에 얹을 예정.*
