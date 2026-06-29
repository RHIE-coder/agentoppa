# AgentOppa

**Claude Code와 Codex 양쪽에서, 어느 운영체제에서든 똑같이 도는 — 나만의 하네스 프레임워크를 만들어 주는 플러그인.**

`Claude Code · Codex`  ·  `Windows · macOS · Linux`  ·  어디서나 같은 품질

> **하네스(harness)** = AI 에이전트가 일을 *제대로, 끝까지* 해내도록 잡아 주는 작업 틀.
> **하네스 프레임워크** = 그런 작업 틀을 여러 프로젝트에서 재사용할 수 있게 묶어 둔 것.

---

## AgentOppa가 푸는 문제

하네스 프레임워크를 직접 만들려고 하면 세 가지가 발목을 잡습니다.

1. **지킬 표준이 많다** — 하네스를 이루는 요소(스킬·훅·메모리·에이전트)마다 따라야 할 규칙이 많아, 처음부터 제대로 만들기 어렵습니다.
2. **도구마다 따로** — Claude Code용과 Codex용을 각각 만들고 맞춰야 합니다.
3. **운영체제마다 또** — Windows·macOS·Linux마다 손이 다시 가고, 같은 결과를 보장하기 어렵습니다.

**AgentOppa는 이 셋을 기본으로 해결합니다.** 그리고 당신의 의도를 한 번에 한 질문씩 캐물어, **당신만의 하네스 프레임워크**를 만들어 줍니다.

---

## 준비물

- **Node.js** — [설치하기](https://nodejs.org/ko/download)

---

## 설치 — 다른 프로젝트에서 쓰기

**마켓플레이스**(= 플러그인 목록을 담은 저장소)를 등록하고, 거기서 플러그인을 고른 뒤 적용합니다. AgentOppa는 두 도구용 목록을 저장소에 함께 싣습니다.

> 다른 사람이 설치하려면 저장소가 **공개(public)** 여야 합니다. 명령은 `rhie-coder/agentoppa` 형식을 씁니다.

### Claude Code

```bash
# 1) 마켓플레이스 등록
/plugin marketplace add rhie-coder/agentoppa

# 2) 플러그인 설치 (형식: 플러그인이름@마켓이름)
/plugin install agentoppa@agentoppa

# 3) 적용 (설치 직후 "Run /reload-plugins to apply" 안내가 뜹니다)
/reload-plugins
```

- **쓰는 법:** 원하는 걸 그냥 설명하면 해당 스킬이 자동으로 켜집니다. 직접 부르려면 `agentoppa:<스킬이름>` 형식 — 예: `/agentoppa:agent-engineer`. (`agentoppa:` 접두어는 Claude Code의 플러그인 네임스페이스라 생략 불가.)
- 업데이트: `/plugin marketplace update agentoppa` → `/plugin install agentoppa@agentoppa` → `/reload-plugins`
- 제거: `/plugin uninstall agentoppa@agentoppa`

### Codex

```bash
# 마켓플레이스 등록
codex plugin marketplace add rhie-coder/agentoppa

# 목록 확인 · 업데이트 · 제거
codex plugin marketplace list
codex plugin marketplace upgrade
codex plugin marketplace remove rhie-coder/agentoppa
```

- 등록한 뒤, 세션의 플러그인 목록에서 **AgentOppa를 켭니다**. (기본은 설치만 되고 꺼져 있습니다.)
- Codex엔 `/reload-plugins` 같은 핫리로드 명령이 없습니다 — 켜거나 업데이트한 뒤 **Codex를 다시 시작**하면 반영됩니다.

---

## 이 저장소에서 직접 실행하기

AgentOppa 저장소 자체를 손볼 때는, 플러그인(`./plugins/agentoppa`)을 직접 물려 `/self-harden` 같은 자체 기능을 씁니다. (저장소 루트에서 실행.)

### Claude Code

```bash
# 일반 (권한을 물어봄)
claude --plugin-dir ./plugins/agentoppa

# 권한 묻지 않음 (격리된 환경에서만 권장)
claude --dangerously-skip-permissions --plugin-dir ./plugins/agentoppa
```

- 플러그인 파일을 고친 뒤 세션 안에서 `/reload-plugins` 로 반영합니다. (재시작 불필요.)

### Codex

```bash
# 일반 — 저장소 루트의 마켓 목록을 자동으로 찾습니다.
codex

# 권한·샌드박스 건너뜀 (격리된 환경에서만 권장)
codex --dangerously-bypass-approvals-and-sandbox   # 별칭: codex --yolo
```

- Codex에는 `--plugin-dir`가 없어, 저장소 루트의 마켓 목록을 자동으로 감지합니다. 플러그인을 고친 뒤에는 Codex를 다시 켜야 반영됩니다.

---

## 핵심 개념

- **AgentOppa는 "만드는 도구"입니다.** 워크플로우를 직접 돌리는 게 아니라, *돌아갈 워크플로우(하네스)를 만들어 줍니다.* 자체 콘텐츠는 싣지 않습니다 — 당신이 자기 하네스를 만들어 씁니다.

- **만드는 것은 두 층입니다.**
  - **Core (재사용 프레임워크)** — `.agentoppa/` 에 삽니다. 단계 흐름 + 공용 스킬·훅 + *빈자리*(프로젝트마다 갈릴 자리). **프로젝트 값을 박지 않아서** 다른 프로젝트로 그대로 옮겨 씁니다.
  - **Project (이 프로젝트의 구현)** — `.harness/` 에 삽니다. `config.yaml` 로 *어떤 Core를 쓸지* 가리키고, 빈자리를 *이 프로젝트의 구현*으로 채웁니다. 프로젝트마다 다른 건 전부 여기에만 모입니다.

- **불러오는 방식 = "가리키기".** 도구가 읽는 `.claude` / `.codex` 는 Core의 *사본이 아니라 얇은 포인터*입니다. 그래서 한 Core를 여러 프로젝트가 *가리켜* 씁니다 (복사 0). Core를 한 번 고치면 가리키는 모든 프로젝트에 반영됩니다.

- 전체 그림(왜·무엇)은 **[ARCHITECTURE.md](ARCHITECTURE.md)** 에 있습니다.

---

## 재사용 Core 만들고 쓰기

핵심 흐름은 **Core를 한 번 만들고, 여러 프로젝트가 그걸 가리켜 쓰는 것**입니다. 세 걸음.

### 1. Core 만들기

재사용할 *단계 흐름*(예: spec → tdd → review)과 *빈자리*(프로젝트마다 갈릴 자리, 예: 테스트 도구)를 정합니다. 면담은 `agent-engineer`가 진행하고(그 안에서 `intent-interview`가 자동으로 돕습니다), 다 정해지면 Core 묶음을 빌드합니다.

```bash
node ./plugins/agentoppa/bin/build-skills.mjs <core-authoring-project>
# → .harness/ 를 읽어 .agentoppa/ 에 재사용 Core 한 벌로 컴파일합니다.
```

빌드 결과 — `.agentoppa/` 에 재사용 가능한 Core 한 벌이 만들어집니다:

```text
.agentoppa/
├── .claude-plugin/  .agents/              # 두 도구 마켓
└── plugins/my-harness-workflow/
    ├── skills/{spec,tdd,review}/SKILL.md  # 단계 = 워크플로우
    └── always-on.md
```

### 2. 도구에 물리기 (가리키기)

빌드된 `.agentoppa/` 묶음을 도구가 *가리켜* 읽게 합니다. 사본은 만들지 않습니다.

```bash
# Claude (그때그때):  Core 묶음의 플러그인을 직접 물림
claude --plugin-dir <project>/.agentoppa/plugins/<core>

# Claude (항상·팀 공유): <project>/.claude/settings.json 에 그 마켓/플러그인을 등록
# Codex:  <project>/.agentoppa/ 의 마켓 목록을 자동 감지 → 목록에서 켜기
```

### 3. 다른 프로젝트가 Core를 가리켜 쓰기 — 자동으로 깔립니다

새 프로젝트는 **단계를 복사하지 않습니다.** Core가 든 `setup` 스킬이 `.harness/config.yaml` 을 *스스로 깔아 줍니다* — **AgentOppa 없이.**

```bash
# 1) Core(플러그인)를 가져온다 — 도구 기본 기능 (AgentOppa 아님)
/plugin install my-harness-workflow@...     # 또는: claude --plugin-dir <Core 경로>

# 2) 설치된 Core 의 setup 이 .harness/config.yaml 을 깐다
#    ("이 하네스 붙여줘" 라고만 해도 자동, 또는 직접:)
node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scaffold.mjs"
```

깔리는 `config.yaml` — `core:` 로 Core를 가리키고, 채울 **능력 빈자리(`bindings`)** 만 남습니다:

```yaml
core:     my-harness-workflow   # 가리킬 Core (단계: spec → tdd → review)
phases:   [spec, tdd, review]   # Core가 가진 단계들 (정의는 Core에서 가리켜 옴)
bindings: { test-runner: "npx playwright test" }   # 이 프로젝트의 테스트 도구 (setup 이 빈자리로 깔면 채운다)
```

> 같은 Core를 가리키는 프로젝트는 `bindings` 한 줄만 다릅니다. Core를 한 번 고치면 가리키는 **모든 프로젝트에 반영**되고, `setup` 을 다시 돌리면 새로 생긴 빈자리를 알려 줍니다(전파).
>
> *(AgentOppa 를 가졌다면 `agent-engineer` 면담이 같은 config 를 써 주고, `node build-skills.mjs <project>` + `.harness/core/validate.mjs` 로 빌드·검사할 수도 있습니다 — 저작·모노레포 시.)*
>
> `core:` 를 생략하면 **단독 하네스**가 됩니다 — Core 없이 `.harness/` 가 자기 단계를 직접 듭니다.

---

## 구성 요소 (Skills)

AgentOppa는 두 묶음으로 되어 있습니다.

**① 흐름을 진행하는 도구**

| 도구 | 역할 |
|---|---|
| `agent-engineer` | 면담부터 조립·포장·검증까지, 하네스를 만드는 전 과정을 진행합니다. 아래 부품들을 안에서 불러 씁니다. |
| `intent-interview` | 무엇을 만들지 한 번에 한 질문씩 캐물어 의도를 또렷이 정리합니다. agent-engineer의 첫 단계로 자동 포함되고, 단독으로도 씁니다. |
| `self-harden` | 한 번 바로잡은 실수를 다시는 못 하게 영구 가드(자동 검사·훅·규칙)로 굳혀, 같은 실수의 재발을 막습니다. |

**② 부품을 만드는 도구 — `ccc-*`** (`ccc` = create-claude-codex, 두 도구 양쪽용 부품을 만든다는 뜻)

| 도구 | 만드는 것 |
|---|---|
| `ccc-skills` | **스킬** — 특정 작업의 절차를 담은 설명서. 관련 요청이 오면 자동으로 불려와 그대로 작업합니다. (모든 `ccc-*`의 토대.) |
| `ccc-memory` | **메모리** — 에이전트가 모든 세션에서 늘 따르는 규칙·지침(예: `AGENTS.md`). 양쪽 도구가 같은 규칙을 읽도록 정리합니다. |
| `ccc-agents` | **서브에이전트** — 특정 역할을 전담하는 별도 에이전트(예: 코드 리뷰 전담). 본체가 그 역할을 위임합니다. |
| `ccc-hooks` | **훅** — 정해진 시점(예: 파일 편집 직후, 작업 종료 전)에 자동으로 실행되는 명령. |
| `ccc-plugin` | **플러그인** — 위 부품들을 하나로 묶어 Claude·Codex 양쪽 마켓에 함께 싣습니다. AgentOppa 자신이 그 산물입니다. |

각 도구는 두 도구의 공통 부분을 한 벌로 두고, **갈리는 지점만 도구별로 나눕니다.** 모든 `ccc-*`는 그 자체가 `ccc-skills`로 만든 스킬입니다(작성 규칙·≤500줄·점진 로딩은 `ccc-skills`를 따름).

상세 규격은 각 도구 폴더의 `SKILL.md`와 `references/` 에 있습니다. 전체 개념 모델은 **[ARCHITECTURE.md](ARCHITECTURE.md)**.
