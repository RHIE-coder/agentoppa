# phases.md — phase 데이터 모델 (스키마)

phase 한 장이 *어떻게 생겼는지*만 정의한다(스키마 — 도메인 무관·고정). **구체 phase(spec·review…)는 여기 없다** → 그것들은 재사용 워크플로우(=Core)에 사는 콘텐츠다. 단독 하네스(standalone)면 그 phase 파일이 `.harness/project/phases/<name>.md`에 있고, Core를 가리키는 모드면 Core 묶음 안에 있다. 어떻게 이어지는지는 `contract.md`, 어떤 순서·옵션·`core:` 배선인지는 `recipe.md`.

## phase = frontmatter(구조) + 본문(산문)

기계가 읽는 구조는 **frontmatter**(`---` 사이), 사람·AI가 읽는 지시는 **본문**. (생성될 스킬도 같은 모양이라, 컴파일이 곧 슬롯 채운 frontmatter 변환.)

```yaml
---
name:     spec                # 소문자-하이픈. id → /spec 스킬
desc:     "요구를 검증가능한 명세로 굳힐 때. 인수조건·범위가 박힌 spec 반환."  # 언제 쓰나(트리거) front-load
when:     "<조건>"            # (선택) 이때만 실행. 없으면 항상. → 본문 맨 위 self-gate로 컴파일
consumes: [requirements?]     # 입력 산출물(의존). ?=선택. [] = 시작 단계
produces: spec                # 출력 산출물 role. 없거나 ~ = 문서 안 남김(코드/상태만)
gate:     "spec.md status=ready · 인수조건 ≥1"   # done 조건(좋은 산출물의 정의). sync로 강제
requires: [test_command, e2e-runner:capability?]  # (선택) 프로젝트 빈자리. 값-빈자리 | :capability 능력-빈자리(?=선택). needs=옛 이름
tier:     standard            # (선택) cheap|standard|strong. recipe.routing과 곱해 모델 결정
workers:                      # (선택) 부릴 보조 에이전트 + 선택 규칙. 없으면 블록째 생략
  select: dynamic             #   all | none | dynamic
  options:
    <agent-name>: "<언제 띄울지>"
---
입력 {역할}을 읽는다.
1. <명령형 지시>
산출 {역할} (헤더 phase: <name>). → {next}
```

## 필드 (무엇 → 컴파일되면)

| 키 | 뜻 | 컴파일되면 |
|---|---|---|
| `name` | id | `/name` 스킬 |
| `desc` | *언제 쓰나*(트리거)를 앞세워 적기(front-load = 핵심을 맨 앞에) (절차 요약 ❌) | 스킬 `description` (에이전트가 호출 판단) |
| `when` | (선택) 실행 조건 | **본문 맨 위 self-gate** (불충족 → `{next}`로 건너뜀) |
| `consumes` | 받는 산출물 role (`?`=선택) | 본문 입력 `{역할}` |
| `produces` | 남기는 산출물 role (`~`=없음) | 산출물 문서(헤더) |
| `gate` | done 조건 | `sync=strict`면 게이트 훅 |
| `requires` | (선택) 프로젝트 빈자리. 항목 = 값-빈자리 \| `:capability` 능력-빈자리 (`?`=선택) | 값-빈자리 → 본문 `{이름}`이 런타임에 `config.values`에서 읽음 · 능력-빈자리 → 본문 `{cap:이름}`이 런타임에 `config.bindings`에서 읽음; validate가 미채움·미바인딩을 error |
| ~~`needs`~~ | `requires`의 옛 이름(값-빈자리만) — 하위호환 별칭 | (위와 동일, 값-빈자리 케이스) |
| `tier` | (선택) 모델 성능 등급(horsepower = 얼마나 센 모델을 쓸지) | `routing`과 곱해 모델/effort → ccc-agents |
| `workers` | (선택) 보조 에이전트 + 조건 | 서브에이전트 스폰 (정의는 `agents/<name>.md`) |

> `consumes`/`produces`는 **문서 바통만** 적는다 — 코드는 산출물이 아니라 작업 트리(본문에서 `git diff` 등으로 직접 읽음). role이 *어떤 파일로* 풀리는지는 `contract.md`.

## `requires` — 프로젝트 빈자리 (값 + 능력 한 곳에)

워크플로우(=Core, phase의 흐름·게이트)는 재사용된다 → **프로젝트 값을 안 박는다.** 단계가 필요로 하는 것을 `requires:` 한 줄로 *빈자리*만 선언하고, 무엇이 그 자리를 채우는지는 프로젝트의 `config.yaml`에서 정한다. 빈자리는 두 종류지만 **선언은 한 곳(`requires`)**이고, *무엇이 채우나*만 config 쪽에서 갈린다(`values` vs `bindings`). `consumes`/`needs`와 **같은 리스트 문법**(한 줄 인라인 리스트, `?`=선택)을 그대로 쓴다. 한 항목 = `<이름>`(값-빈자리) 또는 `<이름>:capability`(능력-빈자리), 뒤에 선택이면 `?`.

```yaml
requires: [test_command, e2e-runner:capability, migration-runner:capability?]
#          └값-빈자리      └능력-빈자리              └선택 능력-빈자리(? = 없어도 error 아님)
```

- **값-빈자리(literal)** — 접미사 없는 항목. `config.values[이름]`이 채우고, 본문 `{이름}` 슬롯은 **런타임-읽기 산문으로 펼쳐진다**(예: `{test_command}` → `` `test_command`(값) `` + "config.yaml 의 values 에서 읽어라" 안내 — 값을 박지 않아 소비 프로젝트가 재빌드 없이 바꾼다). 옛 `needs`와 100% 동치.
- **능력-빈자리(interface slot)** — `:capability` 접미사. `config.bindings[이름]`이 *어떤 구현을 쓸지* 채우고, 값은 **런타임에** 본문이 직접 읽는다(컴파일 때 안 박음 → 같은 Core를 다른 구현으로 재사용). 이름은 kebab-case(= 소문자에 하이픈으로 단어 잇기) 능력 일반명 — 도구명 금지(`playwright` ✗, `e2e-runner` ✓).
- `requires`는 **프로젝트 능력·값**, `consumes`/`produces`는 **산출물 바통(role)**. 다른 것 — 섞지 않는다. 능력은 `bindings`가, 산출물은 앞 단계 `produces`가 채운다.

### 능력-빈자리는 본문이 런타임에 푼다 — `{cap:<이름>}`

값-빈자리도 능력-빈자리도 **박지 않는다** — 둘 다 런타임-읽기 산문으로 펼쳐진다(값-빈자리 `{이름}`은 `config.values`를, 능력-빈자리는 `config.bindings`→`impl`을 읽는다). 능력은 본문에 별도 표기 `{cap:<이름>}`(예 `{cap:e2e-runner}`)를 쓰면, 컴파일러는 결과를 박는 대신 "런타임에 `config.yaml`을 읽어 실행하라"는 **결정적 산문**으로 펼친다. 그 스킬을 읽는 에이전트가 그 자리에서 `config.yaml`을 Read해 스스로 푼다 — 외부 오케스트레이터가 주입하는 게 아니다(`when`·loop self-gate가 이미 쓰는 검증된 패턴과 동형 → Claude·Codex 양쪽 추가 배관 없이 동작). 값 슬롯 `{이름}`과 네임스페이스가 안 겹치게 `{cap:}`로 분리한다.

SOURCE phase 본문(저자가 쓰는 것):

```markdown
---
name: e2e
desc: 변경을 실제로 띄워 검증할 때.
consumes: [spec]
requires: [test_command, e2e-runner:capability]
---
{spec} 기준 시나리오를 만든다. {test_command} 로 단위부터 통과시킨다.
그다음 {cap:e2e-runner} 로 실제 흐름을 돌려 통과를 확인한다.
산출 {e2e} (헤더 phase: e2e). → {next}
```

컴파일된 SKILL.md 본문(role·next는 박히고, 값·능력은 런타임-읽기 산문으로):

```markdown
---
name: e2e
description: 변경을 실제로 띄워 검증할 때.
---
.harness/artifacts/login-oauth/spec.md 기준 시나리오를 만든다. `test_command`(값) 로 단위부터 통과시킨다.
  └ 이 값의 알맹이는 `.harness/config.yaml` 의 `values: test_command:` 가 담은 값이다.
    지금 그 값을 읽어 그대로 쓰라(예: values 가 "npm test" → 그 명령 실행).
    못 찾으면 멈추고 "값 없음: test_command" 라 알린다(값을 추측하지 않는다).
그다음 **e2e-runner** 능력으로 실제 흐름을 돌려 통과를 확인한다.
  └ 이 능력의 구현은 `.harness/config.yaml` 의 `bindings: e2e-runner:` 가 가리키는 값이고,
    그 값이 단일 토큰이면 같은 파일 `impl:` 아래의 그 키가, 명령·경로면 그 자체가 알맹이다.
    지금 그 값을 읽어 그대로 실행하라. 못 찾으면 멈추고 "바인딩 없음: e2e-runner" 라 알린다(값을 추측하지 않는다).
    (예: bindings 가 playwright → impl.playwright = "npx playwright test" → 그 명령으로 실행.)
산출 .harness/artifacts/login-oauth/e2e.md (헤더 phase: e2e, status: ready, inputs: [spec]). → (종착)
```

config는 git-committed·툴중립이라 resume·병렬·크로스툴이 공짜다. config 양식(`core:`/`bindings:`/`impl:`)은 `recipe.md`, 미바인딩 검사는 `contract.md §4`.

## "조건"이 3종류 — 헷갈리지 말 것

| 무엇 | 언제 판단 |
|---|---|
| `when` | 이 phase를 **돌릴까?** (입구 — self-gate) |
| `gate` | 이 phase가 **끝났나?** (출구 — sync가 강제) |
| `workers.options` | phase 안에서 **어떤 보조를 띄울까?** (실행 중) |

## 본문 슬롯 (컴파일러가 처리 — role·next 는 박고, 값·능력은 런타임-읽기 산문으로)

| 슬롯 | 채워지는 값 | 해석 주체 |
|---|---|---|
| `{역할}` (예 `{spec}`) | 산출물 경로 `.harness/artifacts/{feature}/spec.md` | contract |
| `{next}` | 다음 phase (`/tdd` 등) | recipe (순서 — phase는 자기 다음을 모름) |
| `{프로젝트값}` (예 `{테스트 명령}`) | (박지 않음) "런타임에 `config.yaml`의 `values`에서 읽어 쓰라" 산문 (= 값-빈자리) | **스킬 본문이 실행 시** (values) |
| `{cap:<이름>}` (예 `{cap:e2e-runner}`) | (박지 않음) "런타임에 `config.yaml`의 `bindings`/`impl`에서 읽어 실행" 산문 | **스킬 본문이 실행 시** (bindings → impl) |

## self-gate — `when`이 런타임 엔진 없이 도는 법

`when:`을 외부 오케스트레이터가 판단하면 = 우리가 안 만드는 런타임 엔진. 대신 컴파일 때 **스킬 본문 맨 위**에 자가 점검으로 박힌다:

```text
이 단계는 <when 조건>일 때만 한다. 아니면 아무것도 하지 말고 바로 → {next}.
( 본 지시 … )
```

→ 그 스킬이 불릴 때 *스스로* 조건을 보고 건너뛴다. 로직이 스킬 안에 = 베팅(엔진 없음) 유지. (`when` 없으면 = 항상 실행.)

## phase가 컴포넌트로 펼쳐지는 규칙

| phase에 …가 있으면 | 만들어지는 것 | 메이커 |
|---|---|---|
| 항상 | phase 스킬 | ccc-skills |
| `workers` | 서브에이전트 (`agents/<name>.md` → `.md`/`.toml`) | ccc-agents |
| `gate` + `sync=strict` | 게이트 훅 | ccc-hooks |
| `produces` | 산출물 문서(헤더 포함) | ccc-memory |

---

*실제 phase 모음(워크플로우)은 유저가 만든 재사용 Core의 콘텐츠다 — 단독 하네스면 `.harness/project/phases/`에 둔다. 빈 골격은 `../template.md`, 견본은 `examples/sample.md`. (AgentOppa는 phase를 샘플로 싣지 않는다 — 콘텐츠는 유저 Core에서 온다.)*
