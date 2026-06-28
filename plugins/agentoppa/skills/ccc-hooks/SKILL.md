---
name: ccc-hooks
description: Claude Code와 Codex의 hook(라이프사이클 이벤트 훅)을 새로 만들거나 점검할 때 사용. "hook 만들어줘", "PreToolUse/PostToolUse/Stop 훅", "hooks.json 작성", "편집 후 자동 포맷·린트 훅", "테스트 자동실행 훅", "위험 명령 차단", "이 이벤트가 맞나", "Codex에서도 도는 훅" 같은 요청이나 어떤 이벤트를 골라야 할지·exit코드/JSON 계약·크로스툴 이식성 질문에 적용. hook과 무관한 단순 셸 스크립트 작성엔 비해당.
---

# ccc-hooks — claude·codex 공용 hook 작성 레퍼런스

hook 만들기의 핵심은 셸 스크립트 작성이 아니다. 거의 모든 실패는 셋 중 하나다 → 이 스킬은 그 셋을 막는다:

1. **이벤트를 잘못 고른다** — "매 편집마다"인데 `Stop`(턴당 1회)을 쓰거나, 관찰만 하면 되는데 `PreToolUse`로 흐름을 막는다.
2. **exit코드(= 프로그램이 끝나며 돌려주는 종료 숫자)/JSON 계약(= 입출력 JSON의 약속된 형식)을 틀려 조용히 무동작** — `PostToolUse`에서 exit 2로 "막으려" 하거나, `hookSpecificOutput.hookEventName`(= 출력 JSON에 적는 이벤트 이름)이 이벤트와 안 맞는다.
3. **Claude 전용 기능을 써서 Codex에서 안 돎** — `Notification`(= Claude 알림 이벤트)·`type: prompt`(= 프롬프트형 핸들러)·입력수정(`updatedInput`)에 의존한다.

> **작성 메타(SKILL.md 형식·description 규칙·≤500줄·점진 로딩)는 [`ccc-skills`](../ccc-skills/SKILL.md)를 따른다.** 여기선 hook 도메인만 다룬다. ccc-hooks 자체가 ccc-skills로 만든 스킬이다.

## 이 패키지 구성

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

## When to use

- hook을 새로 만들거나 고를 때: "이거 어떤 이벤트로 해야 해?", "편집 후 린트", "테스트 자동실행", "위험 명령 차단".
- hook이 **안 먹을 때**: exit코드·JSON·matcher·`hookEventName` 계약 점검.
- **크로스툴**: "Codex에서도 도는 훅", 한 벌로 양쪽 굴리기, 이식성 점검.
- **When NOT to use:** hook과 무관한 일반 스크립트 작성. 스킬(SKILL.md) 자체를 만드는 일 → [`ccc-skills`](../ccc-skills/SKILL.md).

## hook 잘 만드는 5단계

1. **언제?** 실제 순간을 **가장 좁은 이벤트**로 매핑한다. 권한이 필요 없으면 차단형 이벤트를 쓰지 않는다. 매핑표: [`references/events.md`](references/events.md) §4.
2. **무엇에?** matcher(= 어떤 도구·소스에 이 훅을 걸지 고르는 패턴)로 대상 도구/소스를 한정한다. 이식형은 `Write|Edit`처럼 정규식(= 문자열 패턴 표기법)으로도 같은 의미인 형태(Codex matcher는 항상 정규식).
3. **권한?** 관찰 / 차단 / 컨텍스트 주입 / 입력수정 중 무엇인가 — 이게 exit코드·JSON 계약과 "그 이벤트가 그걸 지원하는지"를 정한다. [`references/io-contract.md`](references/io-contract.md).
4. **어느 도구?** 기본은 **공통 10개 이벤트 + `type: command` + stdin JSON**(stdin = 프로그램에 입력으로 흘려 넣는 표준 입력)(= 한 벌로 양쪽). 벗어나면 본문/주석에 "이건 Claude 측"이라 명시하고 Codex 대응을 적는다. [`references/cross-tool.md`](references/cross-tool.md).
5. **패키징 & 검증.** settings.json vs 플러그인 `hooks/hooks.json`, 경로변수 분기. 그리고 **반드시 실행 테스트**: stdin 페이로드를 흘려보고 exit코드·출력 JSON을 확인한다(§아래).

## 한 벌로 양쪽 굴리기 (이식성 요약)

`공통 10 이벤트 + command + stdin/exit2/hookSpecificOutput` 안에 머물면 `hooks.json` 한 벌로 Claude·Codex 양쪽 동작. 갈리는 지점은 명시적으로 분기한다:

- **경로변수** — Claude `${CLAUDE_PLUGIN_ROOT}` ↔ Codex env `PLUGIN_ROOT`. 매니페스트만 도구별로 두거나, 스크립트가 `process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT`로 흡수.
- **입력수정(`updatedInput`)은 Claude 전용** → 양립하려면 deny/allow만 의존.
- **알림·세션종료는 도구별 분기** — `Notification`/`SessionEnd`(Claude) ↔ `notify`/`Stop`(Codex). `notify`는 hook이 아니다(stdin이 아니라 argv(= 명령행 인자)로 받음·하이픈 필드·차단 불가).

## 만들고 테스트하는 법

1. [`template.md`](template.md)의 골격을 복사해 `hooks.json`과 command 스크립트를 채운다.
2. [`examples/sample.md`](examples/sample.md)를 형식·톤의 목표로 삼는다.
3. 스크립트를 stdin 페이로드로 직접 돌려본다 — 예:
   `echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node hook.mjs; echo "exit=$?"`
   → 차단이면 `permissionDecision:"deny"` JSON 또는 exit 2가 나와야 한다.
4. `node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs <hooks.json> [cross|claude|codex]`로 설정을 검증한다.

## 검증 체크리스트

- [ ] 이벤트가 **그 순간 발화하는 가장 좁은 것** + 권한 필요 없으면 비차단 이벤트
- [ ] matcher가 대상을 정확히 한정(이식형: 정규식으로도 같은 의미)
- [ ] exit코드/JSON 계약이 이벤트와 맞음 — `PostToolUse`로 차단 시도 안 함, `hookSpecificOutput.hookEventName` 정확히 일치
- [ ] 크로스툴이면 공통 10 + command 안 + 경로변수·입력수정·알림 분기 명시
- [ ] command를 **stdin 페이로드(= 흘려 넣는 입력 데이터)로 실제 실행 테스트**(exit코드·출력 확인) — 빠르고 멱등(= 여러 번 돌려도 결과가 같음)
- [ ] `node scripts/validate.mjs <hooks.json>` 통과

**빈 골격:** [template.md](template.md) · **견본:** [examples/sample.md](examples/sample.md) · **레퍼런스:** [references/events.md](references/events.md) · [references/io-contract.md](references/io-contract.md) · [references/cross-tool.md](references/cross-tool.md).
