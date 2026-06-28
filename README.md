# AgentOppa

Cross-Agent Harness **Maker** — **Claude Code · Codex**

Cross-OS — **Mac · Linux · Windows**

동일한 품질 보장

# Prerequisite
 - **Requires:** Node.js

# Install — 플러그인으로 쓰기

> 다른 프로젝트에서 AgentOppa를 **설치해서** 쓰는 법. (이 repo 자체를 고치며 쓰는 dogfood(= 자기 도구를 자기 프로젝트에 직접 써 보는 것)는 아래 [Usage](#usage--이-repo-실행-dogfood).)
>
> ⚠️ 아직 GitHub remote 미설정 — 공개되면 `github.com/rhie-coder/agentoppa` 로 간다. 그때 아래 명령이 그대로 동작한다.

플러그인 설치는 **두 걸음** — 마켓플레이스(= 플러그인 목록을 담은 저장소)를 등록하고, 거기서 플러그인을 고른다. AgentOppa는 양쪽 도구용 마켓 매니페스트(= 어떤 플러그인이 있는지 적어 둔 구성 정보 파일)를 repo에 함께 싣는다.

### Claude Code
```bash
# 1) 마켓플레이스 등록 — repo의 .claude-plugin/marketplace.json 을 읽는다
/plugin marketplace add rhie-coder/agentoppa

# 2) 플러그인 설치 — 형식은 플러그인이름@마켓이름 (둘 다 agentoppa)
/plugin install agentoppa@agentoppa
```
 - 업데이트: `/plugin marketplace update agentoppa` → 다시 `/plugin install agentoppa@agentoppa`.
 - 제거: `/plugin uninstall agentoppa@agentoppa`.

### Codex
```bash
# 마켓플레이스 등록 — repo의 .agents/plugins/marketplace.json 을 읽는다
codex plugin marketplace add rhie-coder/agentoppa

# 목록 확인 · 업데이트 · 제거
codex plugin marketplace list
codex plugin marketplace upgrade
codex plugin marketplace remove rhie-coder/agentoppa
```
 - 등록 후 세션 안의 플러그인 목록에서 **AgentOppa를 활성화**한다(정책 = 설치 가능, 기본 비활성).

# Usage — 이 repo 실행 (dogfood)

> 이 repo에서 작업할 때 AgentOppa 플러그인(`./plugins/agentoppa`)을 직접 물려 `/self-harden` 등 자체 컴포넌트를 쓴다. (repo 루트에서 실행.)

### Claude Code
```bash
# 일반 (권한 프롬프트 있음)
claude --plugin-dir ./plugins/agentoppa

# 권한 스킵 (격리 환경에서만 권장)
claude --dangerously-skip-permissions --plugin-dir ./plugins/agentoppa 
```
 - 플러그인 파일을 고친 뒤 세션 안에서 `/reload-plugins` 로 반영(재시작 불필요).

### Codex
```bash
# 일반 — repo 루트의 .agents/plugins/marketplace.json 을 자동 감지.
# repo 루트에서 실행 → 플러그인 목록에서 AgentOppa 활성화.
codex

# 권한·샌드박스 바이패스 (격리 환경에서만 권장)
codex --dangerously-bypass-approvals-and-sandbox
# (별칭) codex --yolo
```
 - Codex엔 `--plugin-dir`가 없다 → repo 마켓(`.agents/plugins/marketplace.json`)을 자동 감지한다. 플러그인 편집 반영은 Codex 재시작.

# Concept
 - **AgentOppa = Maker.** 안 돌린다, 만든다 — Claude·Codex 양쪽에서 도는 하네스(에이전트 작업 골격)를 짓는 공장. *아무것도 안 싣는다* — 유저가 자기 Core를 만들어 쓴다.
 - **만드는 것 = 재사용 Core + 그걸 쓰는 Project, 두 층.**
   - **Core = 재사용 프레임워크** = `.agentoppa/`(워크플로우 단계 흐름·게이트 + 범용 스킬·훅 + *인터페이스 빈자리*). AgentOppa 자신과 같은 패키징(두 마켓 + `plugins/<core>/`)이라 github·복붙으로 이식. **프로젝트 값을 안 박는 게 재사용의 비결.**
   - **Project = 이 프로젝트의 구현·바인딩** = `.harness/`(`intent.md` + `config.yaml`{`core:` 어떤 Core · `bindings:` 능력→구현 · `values:`} + 구현 모듈).
 - **적재 = 가리키기(by-reference).** 도구가 읽는 `.claude`/`.codex`는 Core *사본이 아니라 얇은 포인터*다 — `--plugin-dir`·마켓 install·커밋한 `.claude/settings.json`·Codex 마켓 자동감지. 그래서 한 Core를 여러 프로젝트가 *가리켜* 쓴다(복사 0).
 - ▸ 전체 개념 모델 (Maker · Core/Project · 가리키기 적재 · 런타임 읽기): **[ARCHITECTURE.md](ARCHITECTURE.md)**

# 재사용 Core 만들기·쓰기 (front door)

이 repo로 만드는 핵심 흐름은 **재사용 Core를 한 번 짓고, 여러 프로젝트가 그걸 가리켜 쓰는 것**이다. 세 걸음:

### ⓐ Core 짓기 — 재사용 프레임워크를 만든다
재사용할 *워크플로우*(단계 흐름·게이트)와 *인터페이스 빈자리*(프로젝트마다 갈릴 자리, 예: e2e(= 처음부터 끝까지 전체 흐름을 돌려보는 테스트) 러너)를 정해 Core 묶음을 빌드한다.
```bash
# 1) 의도 면담 (재사용 틀로 짓는다 = 프레임워크 수준)
#    intent-interview 가 'level: framework' 로 분기 → 어떤 단계·흐름, 어떤 능력 빈자리, 겨냥 프로젝트군을 캔다.
# 2) agent-engineer "Core 짓기" 모드 → 단계 저작( .harness/project/phases/ ) + config 의 phases/ 선언
# 3) Core 묶음 빌드 — .harness/ 를 읽어 .agentoppa/ (이식 가능한 Core 한 벌)로 컴파일
node ./plugins/agentoppa/bin/build-skills.mjs <core-authoring-project>
#    → <core-authoring-project>/.agentoppa/plugins/<core>/ 에 skills·hooks·always-on + phases/ (재사용 단일본) 산출.
```

### ⓑ 적재 — Core를 도구에 물린다 (가리키기)
빌드된 `.agentoppa/` 묶음을 도구가 *가리켜* 읽게 한다. 사본을 만들지 않는다.
```bash
# Claude (그때그때):  Core 묶음 안 플러그인을 직접 물린다
claude --plugin-dir <project>/.agentoppa/plugins/<core>
# Claude (커밋해 항상):  <project>/.claude/settings.json 에 그 마켓/플러그인을 등록 → 팀 공유
# Codex:  <project>/.agentoppa/.agents/plugins/marketplace.json 을 자동 감지 → 목록에서 활성화
```

### ⓒ 프로젝트가 Core를 가리켜 재사용 — config만 (프로젝트 수준)
새 프로젝트는 **phase를 복사하지 않는다.** `config.yaml`에 `core:`로 Core를 가리키고, 빈자리만 이 프로젝트 구현으로 채운다.
```yaml
# <new-project>/.harness/config.yaml  — 이것만. project/phases/ 사본 없음.
core:     my-dev-core            # 가리킬 재사용 Core (= .agentoppa/plugins/<core>)
feature:  login-oauth
phases: [spec, e2e]              # Core 가 든 단계 이름들 (정의는 Core 묶음에서 가리켜 옴)
values:   { test_command: "npm test" }      # 값-빈자리 → 컴파일 때 본문에 박힘
bindings: { e2e-runner: playwright }        # 능력-빈자리 → 런타임에 .harness/ 에서 읽힘
impl:     { playwright: "npx playwright test" }
```
```bash
# 빌드·검사 모두 core: 를 보고 Core 묶음의 phase 소스를 *가리켜* 해석한다(복사 0).
node ./plugins/agentoppa/bin/build-skills.mjs <new-project>
node <new-project>/.harness/core/validate.mjs <new-project>/.harness/config.yaml
```
> Core phase 한 장을 고치면 그 *한 벌* 소스가 가리키는 **모든 프로젝트에 반영**된다 — 이게 "복사 말고 가리켜 재사용"의 핵심. (`core:` 생략 = 단독 하네스: `.harness/project/phases/`가 자기 단계를 직접 든다. 작게 시작하다 재사용이 필요해지면 그 단계를 `.agentoppa/` Core로 추출한다 = ⓐ.)

# Skills

AgentOppa(Maker)의 부품 공장은 **`ccc-*` 패밀리**다 — *"에이전트가 X를 **확실히** 하게 만드는 법"* 을 하네스 컴포넌트 한 종류씩 맡는 작성 레퍼런스들. 그 위에서 `agent-engineer`가 조립한다.

- **한 벌 원칙:** 두 도구가 공유하는 교집합(`SKILL.md`·스크립트·`references/`)은 한 벌로, **갈리는 지점만 도구별로 분기**한다. 도구 전용 기능은 코어에서 빼고 `references/`에 *탈출구*로 매핑.
- **자기 호스팅:** 모든 `ccc-*`는 그 자체가 `ccc-skills`로 만든 스킬이다(작성 메타·≤500줄·3층 점진로딩 규칙은 `ccc-skills`를 따름).
- **고르기:** 지시/지식이 생기면 올바른 컴포넌트로 보낸다 — 지속지식 → `ccc-memory`, 절차 → 스킬(`ccc-skills`), 강제 → `ccc-hooks`, 위임 → `ccc-agents`.
- **배포(캐리어):** 위 컴포넌트들을 양쪽 도구에 실어 나르는 패키징은 `ccc-plugin`이 맡는다 — 두 매니페스트(`.claude-plugin`/`.codex-plugin`) + 두 마켓 동기화. AgentOppa 자신이 그 산물.
- **조립(생성기):** `agent-engineer`가 위 메이커들로 *사용자 맞춤 하네스*를 설계·조립한다(면담 → Config → 생성 → 검증). Core 공장 → Project 하네스의 다리. 프레임워크(`references/`)는 고정, 콘텐츠(실제 phase)는 유저의 `.harness/project/`에. 작업 사이는 커밋된 문서로.

| 스킬 | 컴포넌트 | 한 줄 역할 | 상태 |
|---|---|---|---|
| `ccc-skills` | 메타·토대 | 두 도구 공용 `SKILL.md` 작성·점검 레퍼런스 | ✅ |
| `ccc-memory` | 지속 지식 | 메모리 배치 판단 + `AGENTS.md` 단일소스 브리지 | ✅ |
| `ccc-agents` | 위임 역할 | 서브에이전트 작성, `.md`→`.toml` 빌드 브리지 | ✅ |
| `ccc-hooks` | 강제 라이프사이클 | 라이프사이클 훅 작성, 이벤트·계약·이식 | ✅ |
| `ccc-plugin` | 패키징·배포 | 두 매니페스트 + 마켓 동기화 (컴포넌트 캐리어) | ✅ |
| `agent-engineer` | 조립·생성기 | 메이커들로 맞춤 하네스 설계·조립 (면담→생성→검증) | ✅ |
| `intent-interview` | 면담·상담 | 한 번에 한 질문씩 의도를 ~95%까지 좁혀 브리프로 (agent-engineer phase 1) | ✅ |

---

## `ccc-skills` — 공용 스킬 작성 레퍼런스 (토대)

모든 `ccc-*`의 토대. `description` 작성법·본문 ≤500줄·3층 점진로딩 등 작성 규칙의 출처.

```text
ccc-skills/
├── SKILL.md              # (필수) 이 안내 — 작성 규칙의 진입점
├── template.md           # 복사해서 채우는 빈 SKILL.md 골격
├── examples/
│   └── sample.md         # 잘 만든 스킬 1개 (목표 형식 견본)
├── references/
│   ├── frontmatter.md    # 프론트매터 전체 필드 (Claude + Codex)
│   └── cross-tool.md     # 공통 vs 도구별 차이 매트릭스
└── scripts/
    └── validate.mjs      # 검증기 (Node — mac·linux·windows 공통)
```

## `ccc-memory` — 메모리 배치 라우터 + 단일소스 브리지

메모리를 **두 축**으로 통제한다 — **① 이식성:** 머신로컬·user-scope 저장 거부, 지속 메모리는 **project-committed**(`git fetch`로 모든 머신·팀원이 동일 품질·context; 머신로컬 auto-memory는 끈다). **② 길이:** 상시(always-on)는 최소로 두고 나머지는 on-demand로 라우팅(`@import`도 launch에 인라인되어 상주 → 비용 절감이 아니라 정리용). 그 위에서 `AGENTS.md` 단일소스로 양쪽에 브리지하고 예산·배치·충돌을 감사.

```text
ccc-memory/
├── SKILL.md          # thesis=이식성(project-committed·머신로컬 거부) + 길이(상시 최소) + 단일소스 브리지 + 감사
├── template.md       # AGENTS.md 단일소스 골격(root+nested) + CLAUDE.md @AGENTS.md 브리지
├── examples/sample.md# 짧고 specific한 AGENTS.md + 브리지 + 라우팅 before/after
├── references/
│   ├── layers.md     # [이식성 축] 스코프·로드순서·우선순위(지속메모리=project-committed, 머신로컬/user-scope 거부) + 크로스툴 매트릭스 + [탈출구]Claude rules
│   ├── budget.md     # [길이 축] always-on vs on-demand(@import 함정) + 숫자(200줄/32KiB) + 연구 인용 + IN/OUT + Codex 절단
│   └── cross-tool.md # 공통 vs 도구별 분기표 + 단일소스 브리지법
└── scripts/validate.mjs  # 크기(줄/바이트)·@import depth·드리프트·충돌·머신로컬 메모리 의존 감지·(탈출구)rule glob 점검
```

## `ccc-agents` — 공용 서브에이전트 작성 레퍼런스

위임 경계·호출모델(자동 vs 명시) 판단. 두 도구가 함께 읽는 공유 파일이 없어(`.md` ≠ `.toml`) **단일소스 `.md` → 빌드로 Codex `.toml` 생성**.

```text
ccc-agents/
├── SKILL.md              # (필수) 이 안내 — 서브에이전트 결정 절차의 진입점
├── template.md           # 복사용 빈 .md 서브에이전트 골격 (= 단일 소스)
├── examples/
│   └── sample.md         # 잘 만든 서브에이전트 견본 + 생성된 .toml
├── references/
│   ├── frontmatter.md    # 양쪽 전체 필드 + 교집합 매핑·생성 규칙
│   └── cross-tool.md     # md↔toml·디렉토리·호출·패키징 차이 + 빌드 브리지
└── scripts/
    └── validate.mjs      # .md 점검 (Node). 생성기는 플러그인 bin/build-agents.mjs로 승격
```

## `ccc-hooks` — 공용 hook 작성 레퍼런스

이벤트 선택·exit코드/JSON 계약·크로스툴 이식의 함정 셋을 막음. 공통 10이벤트 + `command` + stdin 안에 머물면 `hooks.json` 한 벌로 양쪽 동작.

```text
ccc-hooks/
├── SKILL.md              # (필수) 이 안내 — hook 결정 절차의 진입점
├── template.md           # 복사용 빈 hooks.json + command-hook 스크립트 골격
├── examples/
│   └── sample.md         # 잘 만든 hook (AgentOppa Stop 훅 — 목표 형식)
├── references/
│   ├── events.md         # 이벤트 매트릭스 (Claude ~30 / Codex 10, 공통 vs 전용, 고르기 가이드)
│   ├── io-contract.md    # exit코드 + hookSpecificOutput 이벤트별 계약
│   └── cross-tool.md     # 설정위치·matcher·경로변수·notify·패키징 차이
└── scripts/
    └── validate.mjs      # hooks.json 검증기 (Node — mac·linux·windows 공통)
```

## `ccc-plugin` — 크로스툴 패키징 (컴포넌트 캐리어)

위 컴포넌트들을 **한 플러그인 트리에 모아 양쪽 도구에 배포**한다. 컴포넌트는 공유, 매니페스트·마켓만 도구별 어댑터. 핵심 함정: Claude는 컴포넌트 **자동발견**(매니페스트=메타), Codex는 **포인터 필수** → Codex 매니페스트에 `skills`/`hooks`/`mcpServers` 포인터를 빠뜨리면 한쪽만 실린다. 두 `plugin.json` + 두 `marketplace.json`의 드리프트를 검증으로 막는다. 그리고 **추출**(특정 프로젝트에서 떼어내 범용화)도 1급으로 — `tsc`/`eslint` 같은 구현·경로·구조 결합을 능력(계약)으로 떼어낸다.

```text
ccc-plugin/
├── SKILL.md          # 발견모델 차이 + 두 매니페스트 동기화 + 마켓 + 검증
├── template.md       # 두 plugin.json + 두 marketplace.json 골격
├── examples/sample.md# AgentOppa 자체 = dual-target 견본
├── references/
│   ├── manifest.md   # plugin.json + marketplace.json 전체 필드(양쪽) + 발견모델 + 교집합/전용 매핑
│   ├── cross-tool.md # 분기표 + 단일소스 동기화 + 경로변수 + 패키징 철학
│   └── portability.md# 추출·탈동조화 — 능력(계약) 의존, 호스트 결합 제거
└── scripts/validate.mjs  # 두 매니페스트·드리프트·포인터·마켓 + 결합 lint 점검
```

## `agent-engineer` — 하네스 생성기 ✅

ccc-* 메이커가 *부품*을 만든다면, 얘는 그 부품으로 **두 모드**로 조립한다 — **ⓐ Core 짓기**(재사용 프레임워크 `.agentoppa/` 묶음 빌드) · **ⓑ 프로젝트 바인딩**(`.harness/`의 `config.yaml`로 어떤 Core를 가리키고 빈자리를 채움). 면담 → Config → 생성(컴파일) → 포장(ccc-plugin) → 검증. **Core 묶음은 `.agentoppa/`로 빌드되고, 도구는 그걸 *가리켜* 적재한다**(`.claude`/`.codex`는 사본 아닌 얇은 포인터). 능력 빈자리 값은 **런타임에 `.harness/`에서 읽는다**(컴파일 때 안 박음 → 같은 Core를 다른 구현으로 재사용). 프레임워크(`references/`)는 고정, 실제 phase(콘텐츠)는 *유저의* Core(또는 단독이면 `.harness/project/`)에 — AgentOppa는 샘플 콘텐츠를 안 싣는다. 작업 사이는 *커밋된 문서*로(엔진 없음 = resume·병렬 공짜). 전체 개념 → `ARCHITECTURE.md`.

```text
agent-engineer/
├── SKILL.md              # 역할·5단계 루프·펼침 매핑
├── references/           # 프레임워크 (도메인 무관·고정)
│   ├── phases.md         #   phase 스키마 (frontmatter)
│   ├── contract.md       #   산출물 계약(역할→경로·헤더·신선도·연결)
│   └── recipe.md         #   Config (config.yaml·loop·sync·routing)
├── template.md           # 빈 골격 (config + phase + agent)
├── examples/sample.md    # 생성된 .harness/ 견본 (dev-flow)
└── scripts/validate.mjs  # config·phase 점검 (연결·신선도)
```

> 병렬(git-workflow)은 고급으로 계획됨 🚧: `decompose→seam-first→fan-out→integrate`. `{feature}` 스코프 + (앞 단계가 남긴 문서를 다음이 받는 구조)가 받쳐줌.

## `intent-interview` — 면담 엔진 (상담사) ✅

agent-engineer가 *부품을 조립*하기 전에, 무엇을 지을지부터 못박는다. 사용자가 *말한 것*과 *원하는 것*의 갭을 **한 번에 한 질문씩** 좁혀 ~95% 확신까지. 막연하면 발산탐색(대조 옵션·스트로맨·예시)으로 원하는 지점을 *발견*하게 한다 — 공사 전 요구를 뽑는 인테리어 상담사. 산출 `.harness/intent.md`(의도 브리프)를 agent-engineer phase 1이 받는다. (어떤 하네스를 지을지의 *설계 의도*만 — 그 하네스가 돌며 만들 개별 산출물과는 층위가 다르다.)

```text
intent-interview/
├── SKILL.md              # 면담 루프·확신 판정·핸드오프
├── references/
│   ├── method.md         #   기법: 확신 사다리·질문 분류·NARROW/DIVERGE·발산탐색·안티패턴
│   └── handoff.md        #   산출 계약: intent 브리프 스키마·헤더·agent-engineer 연결
├── template.md           # 빈 브리프 골격
├── examples/sample.md    # 막연한 요청 → 발산탐색 → 브리프 한 판
└── scripts/validate.mjs  # 브리프 검증 (필수 섹션·확신·차단 미해결)
```
