# 공통 vs 도구별 — Claude Code ↔ Codex (hook)

[`SKILL.md`](../SKILL.md)의 동반 문서. **무엇을 한 벌로 공유하고, 무엇이 도구마다 갈리는지.** 원칙은 [`ccc-skills`](../../ccc-skills/references/cross-tool.md)와 같다: **공통은 공통으로, 갈리는 지점만 명시적으로 분기.**

## 1. 공통 (한 벌만 작성 — 두 도구가 그대로 공유)

- **공통 10개 이벤트** ([`events.md`](events.md) §1) — Codex의 전부이자 Claude의 부분집합.
- **`type: "command"`** 핸들러 — Codex가 실제 실행하는 유일한 타입.
- **stdin JSON 입력**(stdin = 프로그램에 흘려 넣는 표준 입력), **exit 2 차단**(exit = 프로그램 종료 숫자, 2면 차단 신호), **`hookSpecificOutput` JSON 출력**(= 이벤트별 제어를 담는 출력 JSON 블록) — 계약 모양 동일([`io-contract.md`](io-contract.md)).
- **`hooks.json`의 JSON 모양이 동일**: `{ "hooks": { "<Event>": [ { "matcher": "...", "hooks": [ { "type": "command", "command": "..." } ] } ] } }`.

→ 이 안에 머물면 **hooks.json 한 벌로 양쪽 동작**.

## 2. 도구별 (반드시 분기 — 명시할 것)

| 측면 | Claude Code | Codex |
|---|---|---|
| **이벤트 수** | 대략 20~30 | **정확히 10** (Claude의 부분집합) |
| **설정 파일** | `.claude/settings.json` · 플러그인 `hooks/hooks.json` | `.codex/hooks.json` · `config.toml`의 `[[hooks.<Event>]]` |
| **핸들러 타입** | command·http·mcp_tool·prompt·agent | **command만 실행**(나머지는 스킵) |
| **matcher**(= 어느 도구·소스에 훅을 걸지 고르는 패턴) | 리터럴/파이프목록, 특수문자 있으면 정규식(= 문자열 패턴 표기법) | **항상 정규식**(`"^Bash$"`) |
| **PreToolUse 입력수정** | `updatedInput` 가능 | **불가**(deny/allow만) |
| **플러그인 경로변수** | `${CLAUDE_PLUGIN_ROOT}` · `${CLAUDE_PROJECT_DIR}` | env **`PLUGIN_ROOT`** · `PLUGIN_DATA` |
| **알림 채널** | `Notification` 이벤트 | **`notify`**(별개 채널, argv, `agent-turn-complete`만) |
| **세션 종료** | `SessionEnd` | 없음(대안: `Stop`) |
| **플러그인 신뢰** | 활성화하면 동작 | **신뢰 게이트** — 검토·신뢰 전엔 번들 hook 스킵 |

> matcher 안전형: `Bash`, `Write|Edit`처럼 정규식으로도 같은 의미인 형태를 쓴다. `^Bash$`도 양쪽 OK. Codex에선 `Bash`가 정규식이라 `Bashful`도 매칭될 수 있으니 정확히 한정하려면 `^Bash$`.

## 3. 플러그인 패키징 (배포할 때)

| | Claude Code | Codex |
|---|---|---|
| 매니페스트(= 플러그인 구성 정보 파일) | `.claude-plugin/plugin.json` — `hooks/` 자동발견(= 정해진 위치 파일을 알아서 찾아 등록) | `.codex-plugin/plugin.json` |
| hook 파일 | `hooks/hooks.json` | `hooks/hooks.json` 또는 plugin.json의 `"hooks"` |
| 경로변수(번들 명령) | `${CLAUDE_PLUGIN_ROOT}/bin/…` | env `$PLUGIN_ROOT/bin/…` |
| 신뢰 | 자동 | 검토·신뢰 필요 |
| 마켓플레이스 | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` |

> AgentOppa 원칙: **컴포넌트(hook 스크립트)는 두 도구 공유, 매니페스트·경로변수만 도구별로.** 스크립트가 `process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT ?? process.env.CLAUDE_PROJECT_DIR`로 루트를 흡수하면 명령 한 줄도 양립.

## 4. 크로스툴 hook 실무 규칙

1. **공통 10 + command + stdin/exit2/hookSpecificOutput** 안에 머물면 한 벌로 양쪽.
2. **경로변수는 분기점.** 매니페스트만 도구별로 두거나, 스크립트가 env를 흡수(§3).
3. **`PreToolUse` 입력수정은 Claude 전용** → 양립하려면 deny/allow만 의존.
4. **알림·세션종료는 도구별 분기**(`Notification`/`SessionEnd` ↔ `notify`/`Stop`).
5. **`notify`는 hook이 아니다** — stdin 아닌 argv(= 명령행 인자), 하이픈 필드, 차단 불가, user-level `config.toml`의 테이블 섹션(= `[...]`로 묶는 설정 묶음)보다 **앞**에. 절대 hook과 섞지 말 것.
6. Codex 노출이 필요하면 신뢰 게이트를 안내한다(설치≠신뢰).

## 출처

- Claude Code Hooks — https://code.claude.com/docs/en/hooks
- Codex Hooks · Config Reference — https://developers.openai.com/codex/hooks · https://developers.openai.com/codex/config-reference
- Codex `notify` — https://developers.openai.com/codex/config-advanced
