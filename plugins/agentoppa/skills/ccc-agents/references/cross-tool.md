# 공통 vs 도구별 — Claude Code ↔ Codex (서브에이전트)

[`SKILL.md`](../SKILL.md)의 동반 문서. 원칙은 [`ccc-skills`](../../ccc-skills/references/cross-tool.md)·[`ccc-hooks`](../../ccc-hooks/references/cross-tool.md)와 같다: **공통은 공통으로, 갈리는 지점만 명시 분기.** 단 agents는 *공유 런타임 파일이 없어* 분기를 **빌드타임 생성**으로 흡수한다(§3).

## 1. 공통 (의미가 같은 교집합 — 한 번만 작성)

- **개념**: 이름 붙은, 재사용·위임 가능한, 자기 역할/지시를 가진 에이전트. 격리 컨텍스트에서 돌고 **요약을 반환**.
- **필드 의미**: `name` · `description`(언제 쓰나) · 시스템 프롬프트(= 역할·행동 기본 지시문) · 모델 · 추론 강도 · 능력 범위 · MCP(= 외부 도구·데이터를 붙여 주는 연결 규격, Model Context Protocol) · 스킬 프리로드(= 시작 시 미리 불러오기).
- **설계 철학**: 단일 책임 · description front-load(= 핵심 판단 근거를 앞쪽에) · 능력 최소화(read-heavy(= 주로 읽기만 하는 일) 우선) · 요약 반환 · self-contained(= 외부 맥락 없이 자립) 지시.

→ 이 의미층은 **소스 `.md` 한 벌**에 담고, 형식만 도구별로 **생성**한다.

## 2. 도구별 (반드시 분기)

| 측면 | Claude Code | Codex |
|---|---|---|
| **파일 형식** | `.md` (YAML frontmatter + 본문) | **`.toml`** |
| **디렉토리** | `.claude/agents/`(프로젝트)·`~/.claude/agents/`(개인) | `.codex/agents/`(프로젝트)·`~/.codex/agents/`(개인) |
| **지시 컨테이너** | 마크다운 본문 | `developer_instructions = """..."""` |
| **능력 범위** | `tools`/`disallowedTools` (도구 allowlist) | `sandbox_mode`(+`mcp_servers`) (샌드박스 클래스) |
| **모델 표기** | `sonnet`/`opus`/`claude-*`/`inherit` | `gpt-*` (이름 호환 안 됨) |
| **추론 강도** | `effort`(low~max) | `model_reasoning_effort`(low/medium/high) |
| **자동 위임** | ✅ `description`으로 모델이 위임 | ❌ **"자동으로 스폰하지 않음"** |
| **명시 호출** | `@mention`·자연어·`--agent` 세션 | **명시 전용** "spawn …"·`/agent` |
| **내장 에이전트** | `Explore`·`Plan`·`general-purpose` | `default`·`worker`·`explorer` |
| **Claude 전용 필드** | `memory`·`isolation`·`hooks`·`color`·`permissionMode`·`maxTurns`·`background`·`initialPrompt` | — |
| **Codex 전용** | — | `nickname_candidates` · 전역 `[agents]` 캡 |

> ⚠ **호출 모델이 최대 함정.** Codex는 `description`으로 *선택*만 가이드하고 *트리거*는 안 한다. 크로스툴 에이전트는 자동 위임에 의존하지 말 것.

## 3. 형식이 안 합쳐진다 → 빌드타임 브리지

skills(`SKILL.md`)·hooks(`hooks.json`)는 **한 파일이 런타임에 양쪽서** 그대로 돌았다. agents는 형식(`.md`/`.toml`)·디렉토리가 둘 다 다르고, 두 도구 모두 에이전트 정의에 **외부 프롬프트 파일 include(= 다른 파일을 끌어다 끼워 넣기)가 없다** → 손으로 두 벌 쓰면 지시문(가장 큰 부분)이 중복·드리프트(= 두 벌이 점점 어긋남).

**해법: 단일 소스 + 단방향 생성.**

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/build-agents.mjs .claude/agents .codex/agents
```

- **소스 = Claude `.md`** (Claude는 빌드 없이 직접 사용; 마크다운이 긴 프롬프트에 적합).
- **생성 = Codex `.toml`**: 본문→`developer_instructions`, `name`/`description` 그대로, `access`(또는 tools 추론)→`sandbox_mode`, `effort`→`model_reasoning_effort`.
- **안전 변환만**: 번역 안 되는 모델명·Claude 전용 필드는 드롭/상속하고 **로그로 알린다**(무음 누락 금지). 매핑 표: [`frontmatter.md`](frontmatter.md) §4.
- **탈출구**: 생성된 `.toml`에 Codex 고유값(`nickname_candidates`, `sandbox_mode="workspace-write"`, `mcp_servers`)이 필요하면 `codex-model:` 같은 힌트로 소스에서 제어하거나, 생성 후 손으로 보강(단 재생성 시 덮어씀에 주의).

> 철학: **컴포넌트(역할 프롬프트=교집합)는 공유, 형식 래퍼(= 도구별 포장 형식)만 도구별 생성.** ccc-skills가 "스크립트 공유 + 매니페스트(= 어떤 컴포넌트가 있는지 적어 둔 구성 정보 파일)만 분기"였다면, agents는 "프롬프트 공유 + 형식을 생성으로 분기"다.

## 4. 플러그인 패키징 (배포)

| | Claude Code | Codex |
|---|---|---|
| 소스 위치 | 플러그인 `agents/*.md` (`.claude-plugin/plugin.json`이 자동발견(= 정해진 위치의 파일을 알아서 찾아 등록)) | — (Codex는 플러그인 에이전트 자동발견 경로 미정) |
| 적용 | 설치/활성화 시 바로 | 생성된 `.toml`을 소비 프로젝트 `.codex/agents/`에 둠(설치 스텝/훅으로 `build-agents.mjs` 실행) |
| 마켓플레이스 | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` |

> AgentOppa 원칙: **소스 `.md`는 플러그인 `agents/`에 두어 Claude가 자동발견**, Codex 산출 `.toml`은 소비처 `.codex/agents/`로 생성. OS 이식: `validate.mjs`·`build-agents.mjs` 모두 Node 빌트인만 → mac·linux·windows 동일.

## 5. 크로스툴 실무 규칙

1. **소스는 Claude `.md` 한 벌.** Codex `.toml`은 항상 `build-agents.mjs`로 생성(손으로 두 벌 쓰지 말 것).
2. **자동 위임에 의존 금지** — Codex는 명시 스폰. `description`은 선택 품질로, 지시는 self-contained로.
3. **능력 범위는 `access` 의도로** 적어 도구별(allowlist vs sandbox)로 생성되게.
4. **모델명은 번역 안 됨** — 기본은 세션 상속, 고정하려면 `codex-model:`.
5. **드롭되는 Claude 전용 필드를 인지** — 그 기능이 핵심이면 크로스툴 가정이 깨짐(그 에이전트는 Claude 측 전용임을 명시).

## 출처

- Claude Code Subagents — https://code.claude.com/docs/en/sub-agents
- Codex Subagents — https://developers.openai.com/codex/subagents · https://developers.openai.com/codex/concepts/subagents
- Codex Config(`[agents]`) — https://developers.openai.com/codex/config-reference
