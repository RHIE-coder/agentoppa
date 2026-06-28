# hook 빈 골격 (복사용)

규칙은 [`SKILL.md`](SKILL.md)와 [`references/`](references/)를 따른다. 안내 주석(`//`)은 채운 뒤 지운다.

## 1. `hooks.json` (Claude 플러그인 / settings.json 공통 모양)

```jsonc
{
  "hooks": {
    "<EventName>": [                       // events.md §1에서 가장 좁은 이벤트 선택
      {
        "matcher": "Write|Edit",           // 도구 이벤트만 의미 있음. 이식형: 정규식으로도 같은 의미인 형태
        "hooks": [
          {
            "type": "command",             // Codex가 실행하는 유일한 타입
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/bin/<hook>.mjs\"",
            "timeout": 60                   // 초. 작업 시간에 맞춰(테스트류면 크게)
          }
        ]
      }
    ]
  }
}
```

`.claude/settings.json`에 직접 넣을 때도 `hooks` 블록 모양은 동일. 플러그인은 `hooks/hooks.json`에 두면 자동 발견된다.

## 2. command-hook 스크립트 골격 (`.mjs` — 크로스플랫폼)

```js
#!/usr/bin/env node
// <hook> — <언제 도는지>. stdin으로 JSON 받고, 판정 후 JSON/exit으로 제어.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));   // fd 0 = stdin
// 쓸 수 있는 필드: input.hook_event_name, input.tool_name, input.tool_input, input.cwd … (events.md)

// 예: 위험 명령 차단 (PreToolUse)
if (input.tool_name === "Bash" && /\brm\s+-rf\b/.test(input.tool_input?.command ?? "")) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",            // ⚠ 이벤트명과 정확히 일치해야 함
      permissionDecision: "deny",             // allow | deny | ask
      permissionDecisionReason: "rm -rf 차단",
    },
  }));
  process.exit(0);
}

process.exit(0);   // 통과 (아무 것도 안 하면 그냥 0)
```

테스트: `echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node <hook>.mjs; echo "exit=$?"`

## 3. (선택) Codex 등가형 — `config.toml`

같은 스크립트를 Codex에서도 굴릴 때. matcher는 정규식, 경로변수는 env(= 환경변수) `$PLUGIN_ROOT`.

```toml
[[hooks.PreToolUse]]
matcher = "^Bash$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'node "$PLUGIN_ROOT/bin/hook.mjs"'
timeout = 60
```

> 한 벌로 양쪽 가려면 스크립트가 루트를 흡수: `const root = process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd()`. 알림/세션종료/입력수정 분기는 [`references/cross-tool.md`](references/cross-tool.md) §4.

채운 뒤 `node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs <hooks.json>`로 점검한다.
