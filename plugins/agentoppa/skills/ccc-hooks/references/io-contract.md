# hook 입출력 계약 (exit 코드 · JSON)

[`SKILL.md`](../SKILL.md)의 동반 문서. hook이 **무엇을 받고, 어떻게 제어를 돌려주는지**. 여기서 틀리면 **조용한 무동작**이 난다(가장 흔한 버그). 이벤트 목록은 [`events.md`](events.md).

## 1. 입력 — stdin JSON 공통 필드

모든 hook은 stdin(= 프로그램에 흘려 넣는 표준 입력)으로 JSON 한 덩어리를 받는다. 공통 필드:

```jsonc
{
  "session_id": "…",
  "transcript_path": "/…/transcript.jsonl",   // null일 수 있음
  "cwd": "/…",
  "hook_event_name": "PreToolUse",             // 이벤트명 — 분기 기준
  "permission_mode": "default",                // default·plan·acceptEdits·… (있을 때)
  // 이벤트별 필드는 events.md 참조 (tool_name, prompt, source, trigger …)
}
```

읽기(Node, fd 0 = stdin): `const input = JSON.parse(readFileSync(0, "utf8"))`.

## 2. 출력 — exit 코드

| exit | 의미 | stdout JSON 파싱? | 동작 |
|---|---|---|---|
| **0** | 성공 | **예** | stdout의 JSON으로 결정 적용 |
| **2** | 차단 에러 | 아니오 | 이벤트별로 차단(아래 §3), stderr(= 표준 에러 출력)가 모델/사용자에 전달 |
| 1·3+ | 비차단 에러 | 아니오 | stderr 첫 줄 표시 후 계속 |

**두 가지 차단 방법:** ① exit 2 + stderr 메시지(간단), ② exit 0 + `hookSpecificOutput`(= 이벤트별 제어를 담는 출력 JSON 블록) JSON(정밀). 정밀 제어가 필요하면 ②.

## 3. exit 2가 차단하는가? (공통 10 기준)

| 이벤트 | exit 2 | 효과 |
|---|---|---|
| `PreToolUse` | ✅ | 도구 실행 막음 |
| `UserPromptSubmit` | ✅ | 프롬프트 거부 |
| `PermissionRequest` | ✅ | 권한 거부 |
| `PreCompact` | ✅ | 압축 막음 |
| `Stop` | ✅ | 턴 못 끝내게 → 모델 계속 |
| `SubagentStop` | ✅ | 서브에이전트 못 끝내게 |
| `PostToolUse` | ❌ | 도구는 이미 실행됨. stderr만 **모델에** 전달 |
| `SessionStart`·`SubagentStart`·`PostCompact` | ❌ | 사용자에게만 표시 |

→ **`PostToolUse`에서 exit 2로 "막으려" 하면 안 막힌다.** 차단이 필요하면 `PreToolUse`로 옮긴다.

## 4. JSON 출력 — 범용 필드(모든 이벤트)

```jsonc
{
  "continue": true,           // false면 에이전트를 통째로 멈춤
  "stopReason": "…",          // continue:false일 때 사유
  "suppressOutput": true,     // stdout을 트랜스크립트에서 숨김
  "systemMessage": "…"        // 사용자에게 경고로 표시
}
```

## 5. `hookSpecificOutput` — 이벤트별 (공통 10 중심)

**`hookEventName`은 이벤트명과 정확히 일치해야 한다.** 안 맞으면 무시됨(흔한 버그).

**PreToolUse — 제어가 가장 강함**
```jsonc
{ "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",         // allow | deny | ask
    "permissionDecisionReason": "…",
    "updatedInput": { /* … */ },          // ⚠ Claude 전용 — Codex는 입력수정 불가
    "additionalContext": "…"
}}
```
여러 hook이 겹치면 우선순위 **deny > ask > allow**.

**PostToolUse**
```jsonc
{ "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "…",
    "updatedToolOutput": "…"              // Claude: 모델이 보기 전 결과 교체
}}
```

**UserPromptSubmit** — 차단 + 주입
```jsonc
{ "decision": "block", "reason": "차단 사유",
  "hookSpecificOutput": { "hookEventName": "UserPromptSubmit", "additionalContext": "…" } }
```

**SessionStart / SubagentStart** — 컨텍스트 주입
```jsonc
{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "…" } }
```

**Stop / SubagentStop / PreCompact** — 차단(계속시키기)
```jsonc
{ "decision": "block", "reason": "아직 끝내지 마라 — 이걸 먼저 해라" }
```

**PermissionRequest**
```jsonc
{ "hookSpecificOutput": { "hookEventName": "PermissionRequest",
    "decision": { "behavior": "allow", "updatedInput": { /* allow일 때만 */ } } } }
```

## 6. 비동기 (Claude 전용)

부작용(로그·메트릭·웹훅)만 하고 즉시 반환:
```jsonc
{ "async": true, "asyncTimeout": 30000 }
```
차단·입력수정·컨텍스트 주입 불가.

## 7. Codex에서 달라지는 점 (이식성)

- **command 타입만 실행됨.** `prompt`·`agent` 핸들러는 파싱만 하고 스킵 → 의존 금지.
- **`PreToolUse`는 deny만, 입력수정(`updatedInput`) 불가.** 한 벌로 가려면 allow/deny에만 의존.
- **`Notification`·`SessionEnd` 없음** → 그 출력 계약을 쓰면 Claude 전용.
- exit 2 / `hookSpecificOutput` / 범용 필드(`continue`·`systemMessage`)의 **모양은 동일**.
- `PostToolUse` 커버리지는 비-Bash 도구에서 버전 의존(설치 버전에서 실제 발화 확인).

## 출처

- Claude Code Hooks — https://code.claude.com/docs/en/hooks
- Codex Hooks — https://developers.openai.com/codex/hooks
