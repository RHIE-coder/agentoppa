# hook 이벤트 매트릭스 (Claude + Codex)

[`SKILL.md`](../SKILL.md)의 동반 문서. **어떤 이벤트가 언제 발화하고, 무엇을 받고, 무엇을 할 수 있는지**를 모은다. 근거는 공식 문서(§ 끝 출처).

> 핵심 사실: **Codex의 10개 이벤트는 전부 Claude에도 있다(Codex ⊂ Claude, 즉 Codex가 Claude의 부분집합).** 겹치는 이름은 철자까지 동일하다. 그래서 *이 10개 안에서, command 타입 + stdin(= 표준 입력) JSON + exit2(= 종료 숫자 2로 차단)/hookSpecificOutput(= 이벤트별 제어 출력 JSON)*만 쓰면 **hooks.json 한 벌로 양쪽 동작**한다. 벗어나는 순간(예: `Notification`, `type: prompt`) Claude 전용이 된다.

## 1. 공통(이식 가능) — 10개

stdin으로 JSON을 받고, exit 2 또는 `hookSpecificOutput` JSON으로 제어한다(계약 상세: [`io-contract.md`](io-contract.md)).

| 이벤트 | 언제 발화 | 주요 입력 필드 | 차단/제어 |
|---|---|---|---|
| `SessionStart` | 세션 시작·재개 | `source`(startup·resume·clear·compact) | 컨텍스트 주입(차단 불가) |
| `UserPromptSubmit` | 사용자 프롬프트 처리 직전 | `prompt` | **차단** + 컨텍스트 주입 |
| `PreToolUse` | 도구 실행 **직전** | `tool_name`·`tool_input`·`tool_use_id` | **차단(deny)** / Claude만 입력수정(`updatedInput`) |
| `PostToolUse` | 도구 성공 **직후** | `tool_name`·`tool_input`·`tool_response` | 차단 불가(stderr는 모델에 전달) / 컨텍스트 주입 |
| `PermissionRequest` | 권한 대화가 뜰 시점 | `tool_name`·`tool_input` | 결정(allow·deny) |
| `PreCompact` | 컨텍스트 압축 **직전** | `trigger`(manual·auto) | **차단** |
| `PostCompact` | 압축 직후 | `trigger` | 관찰 |
| `SubagentStart` | 서브에이전트 생성 | `agent_id`·`agent_type` | 관찰/주입 |
| `SubagentStop` | 서브에이전트 종료 | `agent_id`·`agent_type`·`stop_hook_active` | **차단**(계속시키기) |
| `Stop` | 턴(응답) 종료 시 | `stop_hook_active`·`last_assistant_message` | **차단**(턴 못 끝내게 → 모델 계속) |

> matcher(= 어느 도구·소스에 훅을 걸지 고르는 패턴)가 의미 있는 건 도구 이벤트(`PreToolUse`/`PostToolUse`/`PermissionRequest` → 도구명)와 일부 소스 이벤트(`SessionStart` → 소스)뿐. 안전한 이식형 matcher는 `Write|Edit` 같은 형태 — Claude·Codex 양쪽에서 같은 의미(상세: [`cross-tool.md`](cross-tool.md) §2).

## 2. Claude 전용 (Codex엔 없음)

이 이벤트들을 쓰면 그 hook은 **Claude 전용**이다. Codex에 같은 설정을 넣어도 발화하지 않는다.

**코어(확실):**

| 이벤트 | 언제 | 비고 |
|---|---|---|
| `Notification` | Claude가 알림 보낼 때(`message`·`notification_type`) | Codex는 대신 별개 `notify`(§3) |
| `SessionEnd` | 세션 종료(`reason`) | 정리·로그용. Codex 대안: `Stop` |

**확장(버전마다 늘어남 — 쓰기 전 공식 문서로 존재 확인):**
`Setup` · `UserPromptExpansion` · `StopFailure` · `PostToolUseFailure` · `PostToolBatch` · `PermissionDenied` · `TaskCreated`/`TaskCompleted` · `TeammateIdle` · `CwdChanged` · `FileChanged` · `InstructionsLoaded` · `MessageDisplay` · `ConfigChange` · `Elicitation`/`ElicitationResult` · `WorktreeCreate`/`WorktreeRemove`.

> Claude의 정확한 이벤트 수는 버전마다 다르다(대략 20~30). **수를 외우지 말고**, "내가 원하는 순간에 발화하는 가장 좁은 이벤트"를 §4로 찾고 공식 문서로 확정한다.

## 3. Codex `notify` — hook이 아님 (함정)

Codex엔 hook과 **별개**의 옛 알림 채널이 있다. hook과 섞으면 안 된다.

| | hook | `notify` |
|---|---|---|
| 입력 전달 | **stdin** JSON | **argv[1]** JSON(명령행 인자) |
| 필드명 | 언더스코어(`turn_id`) | **하이픈**(`turn-id`·`last-assistant-message`) |
| 차단 | 가능 | **불가**(fire-and-forget = 던져 놓고 결과를 안 기다림) |
| 타입 | 10개 이벤트 | `agent-turn-complete` **하나뿐** |
| 설정 | `.codex/hooks.json`·`config.toml [[hooks.X]]` | `config.toml`의 `notify = ["prog","arg"]` |
| 스코프 | user·project | **user-level만**(프로젝트 설정은 무시) + 테이블 섹션보다 **앞**에 와야 함 |

→ "턴 끝났다고 외부 알림(데스크톱·슬랙)"은 **Codex에선 `notify`**, **Claude에선 `Notification` 또는 `Stop`**. 도구별로 분기한다.

## 4. 이벤트 고르기 — "하고 싶은 것 → 이벤트"

| 하고 싶은 것 | 이벤트 | 메모 |
|---|---|---|
| 위험 도구 실행을 막기(예: `rm -rf`) | `PreToolUse` + deny | matcher로 도구 한정 |
| 편집·쓰기 후 포맷·린트 | `PostToolUse` | matcher `Write\|Edit` |
| 코드 바뀐 뒤 테스트, 실패면 턴 막기 | `Stop` + block | AgentOppa가 이걸 씀(견본: [`../examples/sample.md`](../examples/sample.md)) |
| 프롬프트에 컨텍스트 주입·검열 | `UserPromptSubmit` | 차단 + `additionalContext` |
| 세션 시작 시 환경 준비·컨텍스트 주입 | `SessionStart` | `source`로 분기 |
| 압축 전에 무언가 보존 | `PreCompact` | `trigger` |
| 턴 종료 외부 알림 | Claude `Notification`/`Stop` · Codex `notify` | **도구별 분기** |
| 세션 종료 시 정리 | Claude `SessionEnd` · Codex 없음(→`Stop`) | **도구별 분기** |

> 가장 흔한 사고: "매 편집마다" 일을 `Stop`(턴당 1회)에 넣거나, **관찰만** 하면 되는데 `PreToolUse`로 흐름을 막는 것. 권한이 필요 없으면 차단형 이벤트를 쓰지 않는다.

## 출처

- Claude Code Hooks — https://code.claude.com/docs/en/hooks
- Codex Hooks — https://developers.openai.com/codex/hooks
- Codex Config Reference(이벤트·TOML) — https://developers.openai.com/codex/config-reference
- Codex `notify`(argv 페이로드) — https://developers.openai.com/codex/config-advanced
