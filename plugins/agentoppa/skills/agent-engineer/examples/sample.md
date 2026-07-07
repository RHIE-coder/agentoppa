# examples/sample.md — 한 Core, 두 프로젝트 (다른 구현)

재사용의 비결을 한눈에: **같은 Core `dev-flow`(spec→tdd→e2e→review · tdd = 테스트를 먼저 쓰고 그에 맞춰 구현하는 방식, e2e = 처음부터 끝까지 전체 흐름을 돌려보는 테스트)** 를 두 프로젝트가 가리켜 쓰는데, 다른 건 각자 `.harness/dev-flow/config.yaml`의 `bindings` **한두 줄**뿐이다. Core 단계 소스는 양쪽이 **글자 그대로 똑같다** — 값을 안 박았으니까.

## 0. 면담 (요약 — 두 모드)

- **ⓐ Core 짓기:** "웹·서버 여러 프로젝트에서 재사용할 spec→tdd→e2e→review 흐름." → e2e는 프로젝트마다 도구가 갈린다 → **능력 빈자리** `e2e-runner:capability` + 값 빈자리 `test_command`로 비워 둔다. 산출 = `.agentoppa/plugins/dev-flow/` 묶음.
- **ⓑ 바인딩(프로젝트마다):** "이 프로젝트는 그 Core를 쓰되 e2e는 \_\_\_로." → `config.yaml`에 `core: dev-flow` + 그 자리를 *이 프로젝트 구현*으로 채운다.

## 1. Core (재사용 — `.agentoppa/`, 값 안 박음)

```
유저프로젝트/.agentoppa/            # 자체완결 묶음 (AgentOppa 자신과 같은 패키징 → 복붙·github 이식)
├── .claude-plugin/  .agents/      # 두 마켓
└── plugins/dev-flow/
    ├── .claude-plugin/plugin.json  .codex-plugin/plugin.json
    └── skills/{spec,tdd,e2e,review}/SKILL.md   # 단계 = 재사용 워크플로우
```

`e2e` 단계 소스 — **빈자리만 선언, 도구명 없음** (능력 일반명 `e2e-runner` ✓ / `playwright` ✗):

```markdown
---
name: e2e
desc: 변경을 실제로 띄워 검증할 때. 통과한 e2e 리포트 반환.
consumes: [spec]
produces: e2e
requires: [test_command, e2e-runner:capability]
tier: standard
---
{spec} 기준 시나리오를 만든다. {test_command} 로 단위부터 통과시킨다.
그다음 {cap:e2e-runner} 로 실제 흐름을 돌려 통과를 확인한다.
산출 {e2e} (헤더 phase: e2e). → {next}
```

## 2. 두 프로젝트의 `.harness/dev-flow/config.yaml` (여기만 다르다)

### 프로젝트 A — 웹앱

```yaml
harness:  web-app
core:     dev-flow            # 위 Core를 가리킴
feature:  login-oauth
sync:     medium
phases:
  - spec
  - tdd
  - e2e
  - {name: review, sync: strict}    # 보안 중요 → 이 단계만 strict
values:
  test_command: "npm test"
bindings:
  e2e-runner: "npx playwright test"     # 우변이 명령 = 인라인. impl 불필요
```

### 프로젝트 B — Go 서비스

```yaml
harness:  pay-svc
core:     dev-flow            # ← 같은 Core
feature:  settle-batch
sync:     medium
phases:                       # ← 흐름은 같다
  - spec
  - tdd
  - e2e
  - {name: review, sync: strict}
values:
  test_command: "go test ./..."         # ← 다름
bindings:
  e2e-runner: compose-e2e               # ← 다름. impl 키를 가리킴(절차 여러 줄)
impl:
  compose-e2e: ./project/impl/compose-e2e.md   # 띄우고-기다리고-끄는 절차 모듈
```

> **포인트:** Core 한 벌, 바뀐 건 `test_command`(npm↔go)와 `e2e-runner`(playwright↔compose) 바인딩뿐. A는 한 줄이라 인라인, B는 여러 줄 절차라 모듈로(`.harness/dev-flow/project/impl/`). 능력 이름은 같고 *구현만* 주입이 갈린다 = 재사용.

## 3. 같은 단계가 두 결과로 빌드된다 (능력은 안 박음)

`{cap:e2e-runner}`는 결과를 박는 대신 **"런타임에 `config.yaml`을 읽어 실행하라"** 산문으로 펼쳐진다(그래서 한 Core가 두 구현으로). 값 슬롯·역할·next는 박힌다:

**A의 `skills/e2e/SKILL.md` 본문** (`{test_command}`→`npm test`, `{e2e}`→경로):

```markdown
... npm test 로 단위부터 통과시킨다.
그다음 **e2e-runner** 능력으로 실제 흐름을 돌려 통과를 확인한다.
  └ 이 능력의 구현은 `.harness/dev-flow/config.yaml` 의 `bindings: e2e-runner:` 가 가리키는 값이고,
    단일 토큰이면 같은 파일 `impl:` 아래 그 키가, 명령·경로면 그 자체가 알맹이다.
    지금 그 값을 읽어 그대로 실행하라. 못 찾으면 멈추고 "바인딩 없음: e2e-runner" 라 알린다.
산출 .harness/dev-flow/artifacts/login-oauth/e2e.md (헤더 phase: e2e, status: ready, inputs: [spec]). → /review
```

→ A가 읽으면 `bindings`에서 `npx playwright test`를, B가 읽으면 `impl.compose-e2e` 절차 모듈을 푼다. **본문은 똑같다.** (값-빈자리만 다른 경로로 박혔다 — `npm test` ↔ `go test ./...`.)

## 4. 산출물이 흐른다 (바통 — 양쪽 동일)

```
/spec   → spec.md                       (헤더 phase: spec, status: ready, inputs: [])
/tdd    → (spec.md 읽음) → 코드+테스트     (produces: ~, 문서 없음)
/e2e    → (spec.md 읽음 + 능력 실행) → e2e.md
/review → (코드 diff + spec.md + e2e.md) → review.md   (sync=strict)
```

역할→경로의 `{feature}`만 갈린다: A는 `.harness/dev-flow/artifacts/login-oauth/`, B는 `.harness/dev-flow/artifacts/settle-batch/`. git-committed라 어느 도구·세션에서 열어도 같은 바통(resume = 끊긴 작업을 중간부터 다시 잇기).

## 5. 검사 (두 계약 한 번에)

```bash
node .harness/dev-flow/core/validate.mjs
```

- **산출물 계약** — 연결(spec→e2e→review)·신선도(lock)·strict 게이트(review).
- **인터페이스 계약** — 능력-빈자리 `e2e-runner`가 `bindings`로 채워졌나(미바인딩 = error), 구현 키(`compose-e2e`)의 알맹이가 `impl`에 있나.

만약 B에서 `bindings`를 빼면 → `'e2e'의 능력-빈자리 'e2e-runner'가 config.bindings 에 없음 (미바인딩)` error. 그게 "값을 안 박는 Core"를 깨지지 않게 잡아 준다.

---

**핵심:** Core(`.agentoppa/`)는 *흐름·게이트·빈자리*만 들고 값을 안 박는다. Project(`.harness/dev-flow/`)는 그 빈자리를 이 프로젝트 구현으로 채운다. 그래서 **같은 Core를 npm-웹과 go-서비스가 `config.yaml` 한두 줄 차이로** 공유한다. 다른 흐름이 필요하면 Core의 단계를, 다른 도구면 `bindings`를 바꾼다.
