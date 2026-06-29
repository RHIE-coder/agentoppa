<p align="center">
  <img src="docs/logo.png" alt="AgentOppa" width="170">
</p>

<h1 align="center">AgentOppa</h1>

<p align="center">
  Claude Code와 Codex 양쪽에서, 어느 운영체제에서든 똑같이 도는 —<br>
  <b>나만의 하네스 프레임워크를 만들어 주는</b> 플러그인.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code_+_Codex-plugin-138A7B" alt="Claude Code + Codex">
  <img src="https://img.shields.io/badge/Windows_·_macOS_·_Linux-supported-1AAE9C" alt="Cross-OS">
  <img src="https://img.shields.io/badge/version-0.2.0-DFA436" alt="version 0.2.0">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
</p>

<p align="center">
  <b>한국어</b> | <a href="README.md">English</a>
</p>

> **하네스(harness)** = AI 에이전트가 일을 *제대로, 끝까지* 해내도록 잡아 주는 작업 틀.
> **하네스 프레임워크** = 그런 작업 틀을 여러 프로젝트에서 재사용하도록 묶어 둔 것.

---

## 한눈에

AgentOppa는 **안 돌립니다 — 만듭니다.** 워크플로우를 직접 실행하는 도구가 아니라, *돌아갈 워크플로우(하네스)를 만들어 주는* 도구입니다. 컴파일러나 `create-react-app` 같은 **메이커(Maker)** 예요 — React 같은 런타임 프레임워크가 아닙니다.

> 당신의 의도를 **한 번에 한 질문씩** 캐물어, Claude Code·Codex 양쪽에서 어느 OS에서든 똑같이 도는 **당신만의 하네스 프레임워크**를 조립해 줍니다. 자체 콘텐츠는 싣지 않습니다 — 당신이 자기 하네스를 만들어 씁니다.

---

## 푸는 문제

하네스 프레임워크를 직접 만들려고 하면 세 가지가 발목을 잡습니다.

| | 문제 | AgentOppa |
|---|---|---|
| **표준** | 하네스를 이루는 요소(스킬·훅·메모리·에이전트)마다 지킬 규칙이 많다 | 규칙을 기본으로 지켜 조립 |
| **도구** | Claude Code용·Codex용을 각각 만들고 맞춰야 한다 | 한 번에 양쪽으로 |
| **운영체제** | Windows·macOS·Linux마다 손이 다시 간다 | 어디서나 같은 결과 |

---

## 무엇을 만드나 — 두 층

AgentOppa(Maker)는 **아무것도 안 싣습니다.** 당신이 Maker로 *재사용 프레임워크*(Core)를 만들고, 여러 프로젝트가 그걸 **가리켜서** 씁니다.

```text
유저 프로젝트/
├── .agentoppa/        ← Core 층 = 재사용 프레임워크 (당신이 만들고 소유 · 이식 가능)
│                         단계 흐름·게이트 + 공용 스킬·훅 + 빈자리(프로젝트마다 갈릴 자리)
├── .harness/          ← Project 층 = 이 프로젝트의 구현·바인딩
│                         config.yaml(어떤 Core + 빈자리→구현) + 구현 모듈
├── CLAUDE.md·AGENTS.md ← Core 규칙을 import (플러그인 없이 떠도 행동 가드 생존)
└── .claude/·.codex/   ← 얇은 포인터 (Core를 가리켜 적재 · 사본 아님)
```

| 층 | 무엇 | 어디에 |
|---|---|---|
| **Maker** | AgentOppa 자신. 하네스를 *만들어 주는 공장* | 이 플러그인 |
| **Core** | 내가 만든 *재사용 프레임워크*. 프로젝트 값을 안 박아서 어디든 옮겨 씀 | `.agentoppa/` |
| **Project** | *이* 프로젝트의 구현. Core의 빈자리를 이 프로젝트 것으로 채움 | `.harness/` |

> **재사용의 비결 = "값을 안 박는 것".** Core는 `테스트 도구` 같은 프로젝트 값을 굳히지 않고 **빈자리**로 비워 둡니다. 그 값은 실행 시점에 `.harness/`에서 읽습니다. 그래서 한 Core를 web·mobile·go 어디서나 그대로 씁니다.

---

## 핵심 특징

| 특징 | 뜻 |
|---|---|
| **크로스툴** | Claude Code·Codex 양쪽에서 같은 품질 |
| **크로스OS** | Windows·macOS·Linux 모두 같은 결과 (헬퍼는 Node 기본기능만, 외부 의존 0) |
| **재사용** | Core를 한 번 만들면 여러 프로젝트가 가리켜 씀. 고치면 전부 반영 |
| **런타임 엔진 없음** | 단계 사이 상태 = *커밋된 문서*. 상주 실행기가 없어 resume(이어하기)·병렬·크로스툴이 공짜 |
| **self-harden** | 한 번 바로잡은 실수를 영구 가드로 굳혀, 쓸수록 단단해짐 |
| **자급** | 설치만 하면 Core가 스스로 셋업 (AgentOppa 없이도 동작) |

---

## 설치

준비물: **Node.js** 하나. ([설치하기](https://nodejs.org/ko/download))

### Claude Code

```bash
# 1) 마켓플레이스(플러그인 목록 저장소) 등록
/plugin marketplace add rhie-coder/agentoppa

# 2) 플러그인 설치 (형식: 플러그인이름@마켓이름)
/plugin install agentoppa@agentoppa

# 3) 적용
/reload-plugins
```

- **업데이트:** `/plugin marketplace update agentoppa` → `/plugin install agentoppa@agentoppa` → `/reload-plugins`
- **제거:** `/plugin uninstall agentoppa@agentoppa`

### Codex

```bash
# 마켓 등록 후 플러그인 설치 (기본 = User Scope)
codex plugin marketplace add rhie-coder/agentoppa
codex plugin add agentoppa@agentoppa

# 목록 확인 · 업데이트 · 제거
codex plugin marketplace list
codex plugin marketplace upgrade
codex plugin marketplace remove rhie-coder/agentoppa
```

- `marketplace add`는 *마켓 등록*만이라, `codex plugin add`로 **플러그인까지 설치**해야 합니다(`plugin list`에 `not installed`로 보임). Codex엔 핫리로드가 없어, 설치·업데이트 뒤 **다시 시작**하면 반영됩니다.
- **Codex는 설치 범위 선택(User/Project/Local)이 없어 전역(`~/.codex`)에 설치됩니다** — 프로젝트 한정 설치는 codex가 아직 깔끔히 지원하지 않습니다.

---

## 쓰는 법

원하는 걸 **그냥 설명하면** 해당 스킬이 자동으로 켜집니다. 직접 부르려면 `agentoppa:<스킬>` 형식 — 예: `/agentoppa:agent-engineer`.

```text
> 여러 프로젝트에서 재사용할 개발 워크플로우 만들어줘
  → agent-engineer 가 켜져, 한 번에 한 질문씩 의도를 캐물어
    스킬·에이전트·훅을 양쪽 도구용으로 조립합니다.
```

전체 흐름은 다섯 단계입니다.

| 단계 | 하는 일 |
|---|---|
| 1. 면담 | 무엇을 만들지 한 번에 한 질문씩 캐물어 의도를 정리 (`intent-interview`) |
| 2. 설계 | 단계·순서·빈자리를 `config.yaml`로 합의 |
| 3. 조립 | 각 단계를 스킬·에이전트·훅으로 조립 (`ccc-*`) |
| 4. 포장 | Claude·Codex 양쪽 마켓으로 묶음 (`ccc-plugin`) |
| 5. 검증 | 산출물 연결·빈자리 누락을 기계로 점검 |

---

## 구성 요소

**① 흐름을 진행하는 도구**

| 도구 | 역할 |
|---|---|
| `agent-engineer` | 면담부터 조립·포장·검증까지, 하네스를 만드는 전 과정을 진행 |
| `intent-interview` | 무엇을 만들지 한 번에 한 질문씩 캐물어 의도를 또렷이 정리 |
| `self-harden` | 한 번 바로잡은 실수를 영구 가드(검사기·훅·규칙)로 굳혀 재발을 막음 |

**② 부품을 만드는 도구 — `ccc-*`** (`ccc` = create-claude-codex, 양쪽 도구용 부품을 만든다는 뜻)

| 도구 | 만드는 것 |
|---|---|
| `ccc-skills` | **스킬** — 특정 작업의 절차를 담은 설명서. 관련 요청이 오면 자동으로 불려옴 (모든 `ccc-*`의 토대) |
| `ccc-memory` | **메모리** — 모든 세션에서 늘 따르는 규칙·지침(예: `AGENTS.md`) |
| `ccc-agents` | **서브에이전트** — 특정 역할을 전담하는 별도 에이전트(예: 코드 리뷰 전담) |
| `ccc-hooks` | **훅** — 정해진 시점(편집 직후·작업 종료 전 등)에 자동 실행되는 명령 |
| `ccc-plugin` | **플러그인** — 위 부품들을 하나로 묶어 Claude·Codex 양쪽 마켓에 함께 실음 |

---

## 재사용 Core 만들고 쓰기

핵심 흐름은 **Core를 한 번 만들고, 여러 프로젝트가 그걸 가리켜 쓰는 것**입니다.

### 1. Core 만들기

재사용할 *단계 흐름*(예: spec → tdd → review)과 *빈자리*(프로젝트마다 갈릴 자리, 예: 테스트 도구)를 정합니다. 면담은 `agent-engineer`가 진행하고(그 안에서 `intent-interview`가 돕습니다), 다 정해지면 빌드합니다.

```bash
node ./plugins/agentoppa/bin/build-skills.mjs <core-authoring-project>
# → .harness/ 를 읽어 .agentoppa/ 에 재사용 Core 한 벌로 컴파일합니다.
```

### 2. 도구에 물리기 (가리키기)

빌드된 `.agentoppa/` 묶음을 도구가 *가리켜* 읽게 합니다 (사본 없음).

```bash
claude --plugin-dir <project>/.agentoppa/plugins/<core>   # Claude (그때그때)
# Codex: <project>/.agentoppa/ 의 마켓 목록을 자동 감지 → 목록에서 켜기
```

### 3. 다른 프로젝트가 가져다 쓰기 — 자동으로 깔립니다

새 프로젝트는 단계를 **복사하지 않습니다.** Core가 든 `setup` 스킬이 `.harness/config.yaml`을 *스스로 깔아 줍니다* — **AgentOppa 없이.**

```yaml
core:     my-harness-workflow   # 가리킬 Core (단계: spec → tdd → review)
phases:   [spec, tdd, review]   # Core가 가진 단계들
bindings: { test-runner: "npx playwright test" }   # 이 프로젝트의 테스트 도구 (빈자리 채움)
```

> 같은 Core를 가리키는 프로젝트는 `bindings` 한 줄만 다릅니다. Core를 한 번 고치면 가리키는 **모든 프로젝트에 반영**됩니다.

---

## 이 저장소에서 직접 실행

AgentOppa 저장소 자체를 손볼 때는 플러그인을 직접 물려 `/self-harden` 같은 자체 기능을 씁니다.

```bash
# Claude Code (저장소 루트에서)
claude --plugin-dir ./plugins/agentoppa
#  → 파일을 고친 뒤 세션 안에서 /reload-plugins 로 반영 (재시작 불필요)

# Codex — 루트의 마켓 목록을 자동 감지
codex
#  → 고친 뒤 Codex 를 다시 켜면 반영
```

---

## 더 보기

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — 전체 개념 모델(왜·무엇)
- 상세 규격은 각 도구 폴더의 `SKILL.md`와 `references/`

## License

[MIT](LICENSE) © 2026 MinHyung RHIE
