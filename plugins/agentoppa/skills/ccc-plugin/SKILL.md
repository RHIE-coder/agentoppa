---
name: ccc-plugin
description: Claude Code와 Codex 양쪽에 배포되는 플러그인을 패키징할 때 사용 — plugin.json 매니페스트·marketplace.json·컴포넌트(skills/agents/hooks/MCP) 묶기, 그리고 특정 프로젝트에 박힌 요소를 떼어내 범용화(추출·탈동조화). "플러그인 만들어줘", "plugin.json 작성", "마켓플레이스 등록", "Codex에도 배포", "한쪽에서만 설치돼", "매니페스트 두 개 동기화", "이 스킬/훅을 플러그인으로 묶어줘", "프로젝트에 종속적인데 범용으로 빼줘" 같은 요청이나 어떤 컴포넌트가 자동발견되고 어떤 건 포인터가 필요한지·호스트 결합 제거(tsc/eslint 같은 구현 의존)·.claude-plugin↔.codex-plugin 차이·경로변수·배포 질문에 적용. 개별 컴포넌트 자체를 만드는 일은 각 ccc-* 스킬로 넘긴다. 패키징과 무관한 코드 변경엔 비해당.
---

# ccc-plugin — claude·codex 공용 플러그인 패키징 레퍼런스

크로스툴(= 한 벌로 만들어 Claude·Codex 양쪽에서 똑같이 도는 것) 플러그인 패키징의 실패는 대개 넷이다 → 이 스킬은 그 넷을 막는다:

1. **한쪽만 패키징.** Claude `.claude-plugin/`만 만들고 Codex `.codex-plugin/`를 빠뜨려(또는 반대) 한 도구에서만 설치·노출된다. "크로스툴"인데 절반만 실린다.
2. **발견 모델(= 도구가 어떤 컴포넌트가 있는지 알아내는 방식) 차이를 무시.** Claude는 컴포넌트를 **기본 디렉토리에서 자동 발견**(매니페스트는 메타만 있어도 됨), Codex는 **명시 포인터(= 어디에 있는지 직접 적은 경로) 필수**(`skills`·`hooks`·`mcpServers`·`apps`). Claude에서 되던 게 Codex 매니페스트엔 포인터가 없어 컴포넌트가 안 잡힌다.
3. **매니페스트·마켓 드리프트(= 따로 고치다 서로 안 맞아 어긋남).** 두 `plugin.json` + 두 `marketplace.json`을 손으로 따로 관리하다 name/version/description/컴포넌트가 어긋난다. 도구 전용 키(Claude `commands`/`outputStyles`/`lspServers` ↔ Codex `apps`/`interface`)를 반대편에 흘린다.
4. **호스트(= 이 플러그인을 설치해 쓰는 프로젝트) 결합 누수(추출 실패).** 특정 프로젝트에서 떼어낼 때 `tsc`/`eslint`(= 특정 타입검사기·린트 도구) 같은 구현·절대경로·구조 가정을 그대로 들고 와 다른 호스트에선 안 돈다. 플러그인은 *능력(계약)*에 의존해야지 *구현*에 의존하면 안 된다.

> 작성 메타(SKILL.md 형식·description 규칙·≤500줄)는 [`ccc-skills`](../ccc-skills/SKILL.md)를 따른다. 개별 컴포넌트(스킬·훅·에이전트·메모리) 작성은 각 ccc-* 스킬로. 여기선 그것들을 **양쪽에 실어 나르는 패키징 + 호스트에서 떼어내는 추출**을 다룬다. AgentOppa 자체가 이 스킬이 기술하는 구조로 패키징돼 있다(살아있는 예제).

## 이 패키지 구성

```text
ccc-plugin/
├── SKILL.md              # (필수) 이 안내 — 패키징·추출 결정의 진입점
├── template.md           # 두 plugin.json + 두 marketplace.json 골격
├── examples/
│   └── sample.md         # AgentOppa 실제 구조 = dual-target 견본
├── references/
│   ├── manifest.md       # plugin.json + marketplace.json 전체 필드(양쪽) + 발견모델 + 교집합/전용 매핑
│   ├── cross-tool.md     # 공통 vs 도구별 분기표 + 단일소스 동기화 + 경로변수 + 배포
│   └── portability.md    # 추출·탈동조화 — 능력(계약) 의존, 호스트 결합 제거
└── scripts/
    └── validate.mjs      # 두 매니페스트 존재·드리프트·포인터·마켓 + 결합 lint (Node — 크로스플랫폼)
```

## When to use

- 플러그인을 새로 패키징/배포할 때: "이 스킬·훅을 플러그인으로 묶어 양쪽에 배포".
- **추출(가장 흔한 경우):** 특정 프로젝트에 박혀 쓰이던 요소를 떼어내 **범용 플러그인**으로. → 호스트 결합 제거가 핵심.
- **한쪽만 설치될 때:** 빠진 매니페스트·컴포넌트 포인터 점검.
- 두 매니페스트/마켓 **동기화**(드리프트 제거).
- **When NOT to use:** 개별 컴포넌트 작성 — 스킬 [`ccc-skills`](../ccc-skills/SKILL.md), 훅 [`ccc-hooks`](../ccc-hooks/SKILL.md), 에이전트 [`ccc-agents`](../ccc-agents/SKILL.md), 메모리 [`ccc-memory`](../ccc-memory/SKILL.md). 패키징과 무관한 코드 변경.

## 발견 모델 — 한 줄 차이가 함정의 핵심

| | Claude Code | Codex |
|---|---|---|
| 매니페스트 | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` |
| 컴포넌트 발견 | **기본 디렉토리 자동 발견**(`skills/`·`agents/`·`hooks/`) — 매니페스트는 메타만 | **명시 포인터 필수** — `skills`·`hooks`·`mcpServers`·`apps` 키로 경로 지정 |
| 마켓플레이스 | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` (legacy로 `.claude-plugin/`도 읽음) |
| 도구 전용 키 | `commands`·`agents`·`outputStyles`·`lspServers`·`userConfig` | `apps`·`interface{}` |
| 경로 변수 | `${CLAUDE_PLUGIN_ROOT}` | `${PLUGIN_ROOT}` (단 `${CLAUDE_PLUGIN_ROOT}` 별칭 지원) |

→ **컴포넌트(skills/hooks/MCP)는 한 트리에 공유, 매니페스트·마켓만 도구별.** Codex 매니페스트에 포인터를 빠뜨리지 말 것(Claude 자동발견에 익숙해 빠뜨리기 쉽다).

## MCP 서버 번들 (선택 컴포넌트)

플러그인은 MCP(= Model Context Protocol, 도구가 외부 데이터·기능에 붙는 표준 연결 규약) 서버를 포함할 수 있다 — 단 **ccc-plugin은 서버를 만들지 않는다.** 서버 빌드는 클라이언트-중립 표준이다([modelcontextprotocol.io](https://modelcontextprotocol.io) SDK · Claude `mcp-server-dev` 플러그인). ccc-plugin은 *번들된 서버를 양쪽 도구에 배선*만 한다:

- 연결 정의 `.mcp.json`을 플러그인 루트에 둔다 → **Claude 자동 발견**, **Codex는 `.codex-plugin/plugin.json`에 `mcpServers: "./.mcp.json"` 포인터 필수**(발견 모델 규칙 그대로). 서버 실행 경로는 `${CLAUDE_PLUGIN_ROOT}`로(Codex 별칭 지원).
- `validate.mjs`가 `.mcp.json`은 있는데 Codex 포인터가 없으면 경고한다.
- **번들** MCP는 양쪽 다 `.mcp.json`(JSON)이라 거의 대칭 — JSON↔TOML 차이는 *유저가 자기 `config.toml`에 직접 꽂는*(패키징 밖) 경우의 얘기다.

## 추출·탈동조화 (extract — 특정 프로젝트에서 떼어낼 때)

플러그인은 임의의 호스트에 깔린다 → **특정 구현(`tsc`·`eslint`·`src/`·절대경로)이 아니라 능력(`타입검사`·`린트`·`테스트`)에 의존**해야 한다. 판별 테스트: *"다르게 구조화된 프로젝트에 깔면 깨지나?" → 깨지면 결합이다 → 계약으로 추출.*

- **명령** → 능력 계약: `userConfig`(설치 시 프롬프트) · 호스트 계약 파일(`.agentoppa/capabilities.json`) · 감지(`package.json` scripts·lockfile(= 설치된 의존성 버전을 고정해 둔 파일)).
- **경로** → `${CLAUDE_PLUGIN_ROOT}`(플러그인 자기 파일) / `${CLAUDE_PROJECT_DIR}`(호스트 루트). 원본 절대경로 금지.
- **구조·생태계 가정** → 감지하거나, 범위를 **정직하게 선언**(declared dependency(= 드러내 적은 의존) ✓ vs hidden coupling(= 숨어 새는 결합) ✗).
- **헬퍼 스크립트** → 번들 or **zero-dep**(= 외부 패키지 의존 0, 호스트에 깔린 게 없어도 도는 것).

> 패밀리 원리 그대로: **플러그인 = 메커니즘(범용), 호스트 = 구체값(계약).** 자세히는 [`references/portability.md`](references/portability.md).

## 만드는 법

1. **컴포넌트를 한 트리에 + 결합 제거.** `skills/`·`agents/`·`hooks/`·`.mcp.json`을 플러그인 루트에 모으고, **추출이면 호스트 결합부터 떼어낸다**(§추출·탈동조화). 컴포넌트 작성은 각 ccc-* 스킬로.
2. **단일 소스 → 두 매니페스트.** 공통 메타(name·version·description·author·license)는 한 벌로 정하고, `.claude-plugin/plugin.json`(메타)과 `.codex-plugin/plugin.json`(메타 + **컴포넌트 포인터** + 선택 `interface{}`)를 만든다. 드리프트는 검증기로 막거나 생성 스크립트(`bin/build-manifests.mjs`)로. → [`references/manifest.md`](references/manifest.md)
3. **두 마켓플레이스.** `.claude-plugin/marketplace.json`(`owner` 필수, `source` 문자열/객체) + `.agents/plugins/marketplace.json`(`source{source,path}`, `policy{installation,authentication}`).
4. **경로 변수 이식.** 스크립트는 `${CLAUDE_PLUGIN_ROOT}`(Codex가 별칭으로 받음) / 호스트 루트는 `${CLAUDE_PROJECT_DIR}`. → [`references/cross-tool.md`](references/cross-tool.md)
5. **검증 + 양쪽 설치 테스트.** `validate.mjs`(매니페스트 + 결합 lint) → Claude `/plugin`·Codex `codex plugin marketplace add`로 실제 설치해 컴포넌트가 다 잡히는지 + 다른 구조 프로젝트에 깔아 결합 누수 확인.

## 검증 체크리스트

- [ ] **두 매니페스트 다 존재** — `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json` (한쪽만 = 절반 배포)
- [ ] 공통 메타 일치 — name(필수)·version·description이 두 매니페스트(+두 마켓)에서 동일(드리프트 없음)
- [ ] `description` 채워짐 · `version`이 `0.0.0` 아님 · 마켓 `owner` 채워짐(`TODO` 아님)
- [ ] **Codex 매니페스트에 컴포넌트 포인터** — 존재하는 `skills/`·`hooks/`·`.mcp.json`마다 키 지정
- [ ] 도구 전용 키가 반대편에 안 새어 있음(Claude `outputStyles` ↔ Codex `apps`/`interface`)
- [ ] **호스트 결합 없음** — 도구명/절대경로/구조 가정 하드코딩 대신 능력 계약·경로변수·zero-dep
- [ ] `node scripts/validate.mjs <plugin-dir>` 통과 → 양쪽 + **다른 구조 프로젝트**에 실제 설치 테스트

**빈 골격:** [template.md](template.md) · **견본:** [examples/sample.md](examples/sample.md) · **레퍼런스:** [references/manifest.md](references/manifest.md) · [references/cross-tool.md](references/cross-tool.md) · [references/portability.md](references/portability.md).
