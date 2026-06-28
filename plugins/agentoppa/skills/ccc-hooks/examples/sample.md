# 견본 hook — `AgentOppa verify` (Stop)

**잘 만든 hook 하나의 전체 형태.** 새 hook을 만들 때 형식·판단의 목표로 삼는다. 실제로 이 레포 `plugins/agentoppa/hooks/hooks.json`에 있는 훅이다.

```json
{
  "description": "AgentOppa verify — run the project's declared verification on code change; block the turn on failure.",
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/bin/test-guard.mjs\"",
            "timeout": 900
          }
        ]
      }
    ]
  }
}
```

## 왜 이게 좋은 견본인가

- **이벤트 선택이 의도와 맞음** — "코드 바뀐 뒤 검증, 실패면 못 끝내게"는 턴 종료 시점이므로 `Stop`. 실패 시 `decision:"block"`(또는 exit 2)으로 턴을 막아 **모델이 스스로 고치게** 한다. 이게 `Stop`의 정석 용법이다.
- **matcher 없음** — `Stop`은 도구 이벤트가 아니라 매처가 의미 없다(항상 발화). 군더더기를 안 붙였다.
- **`type: command`** — Codex도 실행하는 유일한 타입 → 이식 가능한 코어.
- **`timeout: 900`** — 테스트는 오래 걸리니 넉넉히. 기본(짧음)을 그대로 뒀다면 테스트 도중 잘렸을 것.

## 이식성 교보재 — 한 줄이 분기점

`Stop`·`command`는 **공통 10**이라 Codex에서도 그대로 발화한다. 하지만 **`${CLAUDE_PLUGIN_ROOT}`는 Claude 전용**이다. Codex에서 같은 훅을 굴리려면:

- Codex 매니페스트(= 어떤 컴포넌트가 있는지 적어 둔 구성 정보 파일)/설정에선 env(= 환경변수) **`$PLUGIN_ROOT`**를 쓰거나,
- `test-guard.mjs`가 스스로 흡수: `const root = process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd()`.

→ 검증기를 돌리면 정확히 이 지점을 짚어준다:
`node ../scripts/validate.mjs ../../../hooks/hooks.json` → `Stop` 공통 ✓ / command ✓ / `${CLAUDE_PLUGIN_ROOT}` Codex 분기 경고 ⚠.

## 미니 예제 — 위험 명령 차단 (PreToolUse, deny)

관찰이 아니라 **차단**이 목적이면 `PostToolUse`(이미 실행됨)가 아니라 `PreToolUse`다. 스크립트 골격은 [`../template.md`](../template.md) §2.

```jsonc
{ "hooks": { "PreToolUse": [
  { "matcher": "Bash",
    "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/bin/bash-guard.mjs\"" } ] } ] } }
```

스크립트는 `tool_input.command`를 검사해 위험하면 `permissionDecision:"deny"`를 출력한다(계약: [`../references/io-contract.md`](../references/io-contract.md) §5).

## 도구별 주의

- `${CLAUDE_PLUGIN_ROOT}`·`updatedInput`(입력수정)은 **Claude 기능**. Codex는 `PLUGIN_ROOT`(env)·deny만.
- Codex 플러그인 hook은 **신뢰 게이트**가 있다 — 설치·활성화만으론 안 돌고, 사용자가 검토·신뢰해야 발화. ([`../references/cross-tool.md`](../references/cross-tool.md))
