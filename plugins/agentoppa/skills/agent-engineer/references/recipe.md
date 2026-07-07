# recipe.md — Config (어떤 phase를 어떤 순서·강도로)

Config = **진실원천.** 고른 phase·순서·강도를 `.harness/<하네스>/config.yaml`에 적어 git 커밋한다(`<하네스>` = 이 하네스 이름 폴더 — 여러 하네스가 `.harness/<이름>/` 로 공존해도 실행되는 건 루트 `.harness-main`(gitignore·이름 1개) 또는 `HARNESS_MAIN` 이 고른 1개다). AgentOppa(Maker)이 이걸 읽어 phase 스킬들로 컴파일한다. phase 양식은 `phases.md`, 잇는 규칙은 `contract.md`.

> **config는 두 경우로 생긴다:** ⓐ *Core를 짓는·단독* 프로젝트 — `agent-engineer` 면담이 이 config를 쓴다(저작). ⓑ *남의 Core를 설치해 쓰는* 소비 프로젝트 — 그 Core가 든 `setup` 스킬이 자기 `interface.json`(빈자리 명세)을 읽어 config 골격을 *깔아 준다*(AgentOppa 없이). 소비자는 능력 빈자리(`bindings`)만 이 프로젝트 구현으로 채운다. (build-skills가 모든 Core에 `setup`·`interface.json`을 주입한다.)

## config.yaml 양식

```yaml
harness:  dev-flow            # 이 하네스(=빌드 산출 플러그인) 이름
core:     my-dev-core         # (재사용 모드) 가리키는 Core 이름 = .agentoppa/plugins/<core>/.
                              #   생략 = 이 .harness가 자기 phase를 직접 든 단독 하네스(그대로 유효).
feature:  login-oauth         # 작업 스코프 (역할→경로의 <작업폴더>); 생략 시 git 브랜치
sync:     medium              # loose | medium | strict (전역 기본)
routing:  balanced            # budget | balanced | premium (모델)
phases:                       # 순서 = 흐름. 각 이름 → 워크플로우의 phase
  - spec
  - tdd
  - review
values:                       # (선택) 값-빈자리 채움. requires의 값-빈자리 / {프로젝트값} → 단계 스킬이 실행 시점에 읽음(박지 않음)
  test_command: "npm test"
bindings:                     # (선택) 능력-빈자리 채움. 'requires의 능력 이름: 이 프로젝트가 쓸 구현'. 런타임에 읽힘
  e2e-runner:       playwright                    #   impl 키를 가리킴(아래 impl:) — 여러 단계 공유·재사용일 때
  migration-runner: "npx prisma migrate deploy"   #   또는 명령 문자열 직접(인라인) — 한 줄이면 충분
impl:                         # (선택) 구현 키의 알맹이. 한 줄 명령이면 여기, 절차/여러줄이면 모듈 경로
  playwright:       "npx playwright test"
```

- `phases`의 **순서**가 각 phase 본문의 `{next}`를 채운다 (phase는 자기 다음을 모름).
- 단독 하네스면 이름은 `.harness/<하네스>/project/phases/<name>.md`로 푼다 — 없으면 `phases.md` 양식대로 그 자리에 둔다. `core:`를 가리키면 그 Core 묶음의 phase를 쓴다.
- 세 칸의 역할이 또렷이 갈린다 (`requires` 빈자리 두 종류 + 구현 알맹이 — 자세히는 `phases.md`):
  - **`values`** = 리터럴 스칼라. *무엇을* 쓸지 그 자리에서 끝. 컴파일 때 본문 `{이름}`에 박힘. (`needs`도 여기로 — 옛 이름.)
  - **`bindings`** = *어느 구현을* 쓸지(`e2e-runner → playwright`). 런타임에 본문 `{cap:이름}`이 읽음. 능력 이름과 구현을 분리해 "같은 Core, 다른 구현 주입"(go test ↔ npm test)이 config 한 줄 교체로 된다 = 재사용 비결.
  - **`impl`** = 구현 키의 실제 알맹이(명령 문자열 또는 모듈 경로). `bindings` 우변이 *단일 토큰*(예 `playwright`)이면 `impl`에서 그 키를 찾고, 우변이 *명령·경로*면 그게 곧 알맹이(인라인). **간단하면 `impl` 생략** — 우회는 여러 phase가 같은 구현을 공유할 때만.
- `core:`는 스칼라라 그냥 받아 둔다 — "재사용 모드 vs 단독 하네스" 적재 배선은 빌드 단계에서 확정(이 스키마 범위 밖).

## 활성 하네스 선택 (`.harness-main`) — 여럿 공존, 실행은 하나

한 프로젝트에 여러 하네스가 `.harness/<이름>/` 로 공존할 수 있다. 그중 **실행되는 건 항상 1개** — 루트 `.harness-main` 파일(gitignore 대상)에 적힌 이름 하나가 활성 하네스다. `HARNESS_MAIN` 환경변수가 있으면 그게 `.harness-main` 보다 우선한다.

- 폴더 이름 = 하네스 이름(= plugin 이름 = `core:`/`harness:` 값, kebab). 이 폴더명과 config 이름이 어긋나면 빌드가 멈춘다(소유가 모호해지지 않게).
- 훅은 활성 하네스가 자기 이름일 때만 작동한다 — 아니면 조용히 빠진다(동시에 여러 하네스가 커밋을 막지 않는다). `.harness-main` 이 없으면 하네스 훅은 아무것도 막지 않는다. 소유는 `.harness-main` + `.harness/<이름>/config.yaml` 로만 판단한다(다른 폴더를 스캔해 추측하지 않는다).
- 빌드는 `node build-skills.mjs <project-root> <하네스이름>`(없으면 `HARNESS_MAIN`/`.harness-main`)으로 그 하네스만 컴파일한다.
- 활성 하네스로 적힌 이름의 폴더·config가 없으면 "활성 하네스 설정 없음"으로 멈춘다.
- **setup(초기 config 깔기)은 명시 요청일 때만** 돈다 — 일반 구현 요청만으로 하네스 설정을 만들지 않는다.

## 구현 모듈 — 알맹이가 한 줄보다 클 때

`impl:`(또는 `bindings` 우변)은 두 형태를 받는다. 작으면 인라인, 크면 모듈:

1. **인라인 명령(스칼라)** — 한 줄로 끝나면 그대로. **모듈 파일을 만들지 마라(과잉).**
   ```yaml
   bindings:
     e2e-runner: "npx playwright test"   # 우변이 명령 문자열 = 인라인. impl 불필요
   ```
2. **모듈 참조** — playwright 셋업처럼 여러 줄 절차·여러 명령·env가 필요하면, 구현을 `.harness/<하네스>/project/impl/<key>.md`(절차·명령 묶음) 또는 `.harness/<하네스>/project/impl/<key>.mjs`(zero-dep = 외부 의존성 없이 도는 실행 스크립트)에 두고 *경로로* 가리킨다. 경로는 항상 `.harness/<하네스>/` 기준 상대(`./project/impl/...` — 절대경로·원본 프로젝트 경로 박기 금지).
   ```yaml
   bindings:
     e2e-runner:       playwright            # impl 키
     migration-runner: prisma-migrate
   impl:
     playwright:       ./project/impl/playwright.md   # 절차 문서(에이전트가 읽고 따름)
     prisma-migrate:   ./project/impl/migrate.mjs     # zero-dep 실행 스크립트(node로 실행)
   ```
   - `.md` = 사람·AI가 읽는 절차(설치·env·명령 순서). frontmatter(= 파일 맨 위 `---` 사이의 구조화된 설정 블록)에 `provides: <능력명>`을 달면 validate가 능력↔모듈 일치를 점검한다.
   - `.mjs` = 돌고 끝나는 검사·실행기(상주 엔진 금지). Node 빌트인만(zero-dep, 크로스OS). 스킬이 `node ${CLAUDE_PROJECT_DIR}/.harness/<하네스>/project/impl/<key>.mjs` 식으로 부른다.
   - 왜 `.harness/<하네스>/project/impl/`인가: 구현 모듈은 **프로젝트 차이가 사는 곳**이고 Core는 이 폴더를 *모른다*(한 방향 — Project→Core 참조만). 보조 에이전트가 `project/agents/`에 살듯, 구현 모듈은 `project/impl/`에 산다 — 대칭. 단계는 모듈을 *가리키기*만 하고 본문을 복사하지 않는다(통째로 빼도 Core 멀쩡).

## loop — 유일한 비선형 장치

반복(비평↔수정 등)은 `loop` 블록:

```yaml
phases:
  - ui-analyzer
  - loop:
      do:    [ui-critic, ui-implement]   # 이 묶음을
      until: "ui-critic가 '기준 충족' 판정" # 이 조건까지 반복
      max:   5                           # 안전장치
```

`loop` 밖은 전부 일렬. **중첩 loop는 v1 금지**(validate가 막음).

## sync — 게이트 강도 (전역 + phase별 오버라이드)

phase의 `gate`(done 조건)를 얼마나 세게 강제할지:

| 값 | 게이트가… | 만들어지는 것 | 에이전트 |
|---|---|---|---|
| `loose` | 본문 안내만 | 훅 없음 | 자율 진행 |
| `medium` | 위반 시 경고(진행 가능) | validate 소프트 체크 | 경고 보며 진행 |
| `strict` | 미충족이면 다음 진입 **차단** | ccc-hooks가 게이트 훅 | 충족해야 넘어감 |

전역 `sync`가 기본. **phase별로 덮을 수 있다** — `phases` 항목을 맵으로:

```yaml
sync: medium                     # 전역 기본
phases:
  - brainstorm                   # 전역 따름(medium)
  - spec
  - {name: review, sync: strict} # 이 단계만 강하게
```

(`phases` 항목은 **이름 | {name, sync?} | loop** — validate가 셋 다 받음.)

## routing — 모델 (tier × routing)

phase의 `tier`(cheap·standard·strong) × config의 `routing`(budget·balanced·premium)이 **단계마다 모델/effort(= 모델이 얼마나 깊이 생각할지)를 결정**한다:

| tier ＼ routing | budget | balanced | premium |
|---|---|---|---|
| cheap | 최저 | 최저 | 표준 |
| standard | 최저 | 표준 | 강 |
| strong | 표준 | 강 | 최강 |

"최저~최강"의 실제 모델·effort 매핑 + Codex 변환은 **ccc-agents**가 한다. Maker는 *의도(tier)*만 싣는다.

---

(phase 자체(워크플로우)는 유저 Core의 콘텐츠다 — 단독 하네스면 `.harness/<하네스>/project/phases/`. AgentOppa는 샘플/프리셋을 싣지 않는다. 순서·강도·`core:`·바인딩까지가 여기, 컴파일 결과를 양쪽 도구로 묶는 포장은 `ccc-plugin`.)
