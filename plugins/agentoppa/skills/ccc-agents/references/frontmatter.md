# 서브에이전트 필드 전체 레퍼런스 (Claude + Codex) + 교집합 매핑

[`SKILL.md`](../SKILL.md)의 동반 문서. 양쪽 전체 필드와 **단일 소스(.md) → 생성(.toml)** 매핑 규칙을 모은다. 근거는 공식 문서(§ 끝 출처).

## 1. Claude Code — `.claude/agents/<name>.md` frontmatter

`---` 사이 YAML(= 들여쓰기로 키·값을 적는 설정 표기법) + 본문(=시스템 프롬프트(= 역할·행동 기본 지시문)). 정체성은 파일명이 아니라 `name`. 경로 우선순위: managed → `--agents` → `.claude/agents/`(프로젝트) → `~/.claude/agents/`(개인) → 플러그인 `agents/`.

| 필드 | 필수 | 의미 |
|---|---|---|
| `name` | ✅ | 식별자(소문자·하이픈). 훅에 `agent_type`으로 전달 |
| `description` | ✅ | **언제 위임하나** — 자동 위임 판단 근거 |
| `tools` | — | 쉼표구분 도구 allowlist(= 허용할 도구만 적은 목록). 생략 시 메인의 전체 도구 상속 |
| `disallowedTools` | — | 상속/지정 풀에서 제거할 도구 |
| `model` | — | `sonnet`/`opus`/`haiku`/`fable`/full-id/`inherit`(기본) |
| `effort` | — | `low`/`medium`/`high`/`xhigh`/`max`. 세션값 오버라이드 |
| `skills` | — | 시작 시 프리로드할 스킬(전체 내용 주입) |
| `mcpServers` | — | 이 에이전트용 MCP(= 외부 도구·데이터를 붙여 주는 연결 규격, Model Context Protocol)(이름 또는 인라인). **플러그인 서브에이전트에선 무시** |
| `permissionMode` | — | `default`/`acceptEdits`/`auto`/`dontAsk`/`bypassPermissions`/`plan` |
| `maxTurns` | — | 최대 에이전트 턴 수 |
| `memory` | — | `user`/`project`/`local` — 세션 간 지속 메모리 |
| `background` | — | `true`면 항상 백그라운드 동시 실행 |
| `isolation` | — | `worktree`면 임시 git worktree(= 같은 저장소의 분리된 작업 사본)에서 실행(병렬 쓰기 충돌 회피) |
| `color` | — | 표시 색 |
| `hooks` | — | 이 에이전트에 스코프된 훅. 플러그인 서브에이전트에선 무시 |
| `initialPrompt` | — | `--agent`로 메인 세션일 때 자동 첫 입력 |

본문 = 서브에이전트의 **시스템 프롬프트**(Claude 본체 프롬프트는 상속 안 함). 격리 컨텍스트라 자립적이어야 한다.

## 2. Codex — `.codex/agents/<name>.toml`

표준 TOML(= 키=값 형식의 설정 파일 포맷) 한 파일. 경로: `.codex/agents/`(프로젝트) · `~/.codex/agents/`(개인, 프로젝트가 우선). 내장 에이전트 `default`/`worker`/`explorer`는 파일 없이 사용(동명 커스텀이 우선).

| 키 | 필수 | 의미 |
|---|---|---|
| `name` | ✅ | 식별자 |
| `description` | ✅ | **언제 쓰나** — 선택 가이드(자동 트리거 아님) |
| `developer_instructions` | ✅ | 핵심 행동 지시(여러 줄 `"""..."""`) = Claude 본문에 해당 |
| `model` | — | 생략 시 부모 세션 상속 |
| `model_reasoning_effort` | — | 추론 강도 `minimal`/`low`/`medium`/`high`/`xhigh`(xhigh는 model-dependent). 생략 시 상속 |
| `sandbox_mode` | — | `"read-only"` 등 능력 범위. 생략 시 상속 |
| `mcp_servers` | — | 이 에이전트용 MCP 테이블 |
| `skills.config` | — | 스킬 설정 |
| `nickname_candidates` | — | **Codex 전용** — 스폰 인스턴스 별명 풀 |

전역 캡(per-agent 아님)은 `config.toml`의 `[agents]`: `max_threads`(기본 6) · `max_depth`(기본 1) · `job_max_runtime_seconds`(기본 1800).

## 3. AgentOppa 힌트 키 (소스 .md 에만 — Claude 무시, `build-agents.mjs`가 소비)

ccc-skills의 Codex `openai.yaml` "탈출구"와 같은 역할. Claude는 모르는 frontmatter 키를 무시하므로 양립.

| 힌트 키 | 매핑 |
|---|---|
| `access: read-only \| read-write` | → Codex `sandbox_mode`. read-only면 `sandbox_mode="read-only"`, read-write면 상속 |
| `codex-model: <id>` | → Codex `model`(예: `gpt-5.4`). Claude 모델명이 번역 안 되므로 명시용 |

## 4. 교집합 매핑 + 생성 규칙 (`.md` → `.toml`)

| 의미(교집합) | Claude `.md` | Codex `.toml` (생성) |
|---|---|---|
| 식별자 | `name` | `name` |
| 언제 쓰나 | `description` | `description` |
| **역할/프롬프트** | 마크다운 본문 | `developer_instructions` |
| 모델 | `model`(이름 다름) | `codex-model` 힌트만 방출, 없으면 생략(상속) |
| 추론 강도 | `effort` | `model_reasoning_effort`(max→xhigh; 나머지 그대로) |
| **능력 범위** | `tools` allowlist | `sandbox_mode`(`access` 우선, 없으면 tools에서 추론) |
| MCP | `mcpServers` | 구조 상이 — **v1 미변환**, Codex 측 수동 설정 |
| 스킬 프리로드 | `skills` | `skills.config`(수동) |

**생성기가 드롭/경고하는 것(무음 누락 금지):**
- Claude 전용 필드(`memory`·`isolation`·`hooks`·`color`·`permissionMode`·`maxTurns`·`background`·`initialPrompt`·`disallowedTools`·`skills`·`mcpServers`) → 드롭 + 로그.
- Claude 모델명(`sonnet`/`opus`/`claude-*`/`inherit`) → 생략(세션 상속) + 경고. `codex-model:`로 명시 가능.
- 능력 범위 추론: `access` 우선 → 없으면 `tools`에 `Edit`/`Write`/`NotebookEdit` 있으면 read-write, 없으면 read-only → 둘 다 없으면 상속(미통제) 경고.

## 5. 공통 권장 (둘 다)

- **단일 책임**, `description`은 "언제"만 front-load(= 앞쪽에 배치, 절차 요약 금지).
- **요약 반환** — 격리 컨텍스트의 가치 = 메인 대화 오염 방지(양 문서 명시).
- **능력 최소화** — read-heavy(= 주로 읽기만 하는 일: 탐색·리뷰·트리아지)에 read-only 기본.
- 지시는 **self-contained**(= 외부 맥락 없이 자립, 격리 컨텍스트).

## 출처

- Claude Code Subagents — https://code.claude.com/docs/en/sub-agents
- Codex Subagents(설정·필드) — https://developers.openai.com/codex/subagents
- Codex Subagents(개념) — https://developers.openai.com/codex/concepts/subagents
- Codex Config(`[agents]`) — https://developers.openai.com/codex/config-reference
