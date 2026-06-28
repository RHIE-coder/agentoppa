---
name: ccc-memory
description: Claude Code와 Codex의 메모리·지침 파일(AGENTS.md·CLAUDE.md·프로젝트 지식문서)을 새로 만들거나, 비대해지거나 머신로컬로 흩어진 걸 정리·이식할 때 사용. "AGENTS.md 만들어줘", "CLAUDE.md 정리", "메모리가 너무 길어", "이거 AGENTS.md에 넣을까 docs로 뺄까", "user-scope/auto-memory 메모리 없애줘", "Codex에서도 같은 지침 적용", "기존 AGENTS.md가 엉망" 같은 요청이나 무엇을 상시 메모리에 두고 무엇을 빼야 하는지·도구별 로드/우선순위·크로스툴 이식 질문에 적용. 절차는 스킬으로, 강제는 훅으로, 위임은 에이전트로 넘긴다. 메모리와 무관한 단순 코드 변경엔 비해당.
---

# ccc-memory — claude·codex 공용 메모리·지침 작성/정리 레퍼런스

에이전트 메모리(상시 지침 + 프로젝트 지식) 만들기의 실패는 대개 셋이다 → 이 스킬은 그 셋을 막는다:

1. **비대 — 다 욱여넣는다.** `AGENTS.md`/`CLAUDE.md`는 매 턴 상주한다. 길수록 무관한 토큰이 신호를 희석하고(context rot = 입력이 길어질수록 모델 성능이 떨어지는 현상), 무엇보다 **지시 수가 늘면 순응률이 붕괴**한다(IFScale = 지시 개수별 준수율 측정 연구: 지시 500개에서 68%, 뒤 지시는 무시). 지식과 지시를 안 가리고 한 파일에 쌓으면 중요한 규칙까지 안 지켜진다.
2. **머신로컬 — 그 노트북에만 산다.** user-scope(= 그 사용자 계정 전역, 예 `~/.claude/CLAUDE.md`)·auto-memory(= 에이전트가 자동으로 쌓는 머신로컬 메모리, 예 `~/.claude/projects/.../MEMORY.md`)·`~/.codex/memories/`에 프로젝트 지식을 두면 다른 머신·팀원·CI(= 자동 빌드·테스트 서버)는 다른 context → 다른 품질. AgentOppa의 "동일한 품질 보장"과 정면충돌한다.
3. **공유 파일 착각.** skills(`SKILL.md`)·hooks와 달리 **두 도구가 함께 읽는 메모리 파일이 없다**: Claude는 `CLAUDE.md`만, Codex는 `AGENTS.md`만 읽는다. 브리지 없이 한쪽만 쓰면 다른 쪽 메모리는 0이다.

> 작성 메타(SKILL.md 형식·description 규칙·≤500줄·점진 로딩)는 [`ccc-skills`](../ccc-skills/SKILL.md)를 따른다. 여기선 메모리 도메인만 다룬다. ccc-memory 자체가 ccc-skills로 만든 스킬이다.

## 이 패키지 구성

```text
ccc-memory/
├── SKILL.md              # (필수) 이 안내 — 메모리 배치 결정의 진입점
├── template.md           # AGENTS.md 단일소스 + CLAUDE.md 브리지 + <memoryDir>/ 골격
├── examples/
│   └── sample.md         # 잘 된 메모리 셋 + 기존 엉망 정리 before/after
├── references/
│   ├── layers.md         # [이식성 축] 스코프·로드순서·우선순위 + 크로스툴 매트릭스 + memoryDir 규약 + [탈출구]Claude rules
│   ├── budget.md         # [길이 축] 관련성×지속성×유형 모델 + @import 함정 + 숫자(200줄/32KiB) + 연구 인용 + IN/OUT
│   └── cross-tool.md     # 공통 vs 도구별 분기표 + 단일소스 브리지법
└── scripts/
    └── validate.mjs      # 예산·머신로컬·드리프트·포인터 점검 (Node — mac·linux·windows 공통)
```

## 메모리를 통제하는 두 축

1. **이식성(스코프).** 지속 메모리는 **project-committed만**. 머신로컬·user-scope 금지(순수 개인 취향은 예외). `git fetch`로 모든 머신·팀원이 동일 context. 머신로컬 auto-memory는 끈다. → [`references/layers.md`](references/layers.md)
2. **길이(관련성).** 상시(always-on) 자리는 **모든 작업에 보편적으로 관련된 지시**만 얻는다. 나머지 지식은 on-demand(= 필요할 때만 불러옴)로 라우팅한다. `@import`도 launch에 인라인되어 상주하니 비용 절감이 아니다. 긴 *지식*문서는 관련할 때만 로드돼 OK, 긴 *지시*파일은 순응을 무너뜨려 NG — 둘은 실패 방식이 다르다. → [`references/budget.md`](references/budget.md)

## When to use

- 메모리/지침 파일을 새로 만들 때: "AGENTS.md 작성", "CLAUDE.md 세팅".
- **기존 엉망 정리(1급 용례):** 비대한 AGENTS.md, user-scope/auto-memory에 흩어진 지식, Claude↔Codex 미브리지.
- 배치 판단: "이거 AGENTS.md에 넣을까, 지식문서로 뺄까, 스킬/훅으로 보낼까".
- **크로스툴:** "Codex에서도 같은 지침", 한 소스로 양쪽 굴리기.
- **When NOT to use:** 메모리와 무관한 코드 변경. 절차 → [`ccc-skills`](../ccc-skills/SKILL.md), 강제 라이프사이클 → [`ccc-hooks`](../ccc-hooks/SKILL.md), 위임 역할 → [`ccc-agents`](../ccc-agents/SKILL.md).

## 무엇을 어디에 두나 (배치 라우팅 — 이 스킬의 뇌)

| 내용 | 어디에 | 왜 |
|---|---|---|
| 모든 작업에 관련된 **보편 지시** ("2-space", "커밋 전 test") | `AGENTS.md` (증류·짧게) | 상시 관련 → 상시 자리값 |
| 긴 **지식** (아키텍처·결제·런북) | `<memoryDir>/*.md` + AGENTS.md에 조건부 포인터 | 해당 작업 때만 로드 |
| 누적 **학습** (에이전트가 알아낸 것) | `<memoryDir>/MEMORY.md` (커밋) | 머신로컬 auto-memory 대체 |
| **절차** (다단계 how-to) | 스킬 → [`ccc-skills`](../ccc-skills/SKILL.md) | 온디맨드 로드 |
| **강제** (커밋 전 등 시점 보장) | 훅 → [`ccc-hooks`](../ccc-hooks/SKILL.md) | AGENTS.md는 권고일 뿐 강제 못 함 |
| **위임 역할** | 에이전트 → [`ccc-agents`](../ccc-agents/SKILL.md) | 격리 컨텍스트 |
| **서브트리 전용** | 중첩 `AGENTS.md` | 그 트리 작업 때만 |
| 순수 **개인 취향** ("한국어로 답해") | user-scope `~/.claude/CLAUDE.md` | 프로젝트 품질 무관 (유일 허용 예외) |

## 새로 만드는 법

1. **단일 소스 = `AGENTS.md`.** 보편 지시(증류) + 긴 지식으로 가는 조건부 포인터. 루트에 두고, 서브트리 전용은 중첩 `AGENTS.md`로.
2. **지식은 전용 디렉토리로.** `<memoryDir>/`(기본 `.agentoppa/`, `config.json`의 `memoryDir`로 변경) — **git 커밋**, on-demand. bare `docs/` 금지(다른 문서가 오염).
3. **Claude 브리지.** `CLAUDE.md` = `@AGENTS.md` 한 줄 + Claude 전용 몇 줄. (Codex가 CLAUDE.md를 읽게 하려면 `project_doc_fallback_filenames`.) → [`references/cross-tool.md`](references/cross-tool.md)
4. **예산 지킴.** AGENTS.md < 200줄(Claude 권고) · 체인 합계 < 32 KiB(Codex 하드캡, 초과분 드롭). 길면 라우팅으로 내보낸다. → [`references/budget.md`](references/budget.md)
5. **검증 + 실제 로드 테스트.** `validate.mjs` → Claude `/memory`·Codex 지침요약으로 확인 → 다른 머신에서 `git fetch`해 동일 context인지 확인.

## 기존 엉망 정리 (remediation)

1. **감사.** 두 도구·모든 스코프 스캔(프로젝트 + 머신로컬). `validate.mjs`가 비대·드리프트·머신로컬 의존을 플래그.
2. **분류.** 위 라우팅표로 줄 단위 분류.
3. **재배치 — harvest(= 흩어진 데서 쓸 것만 거둬옴) 먼저, 삭제 나중.** auto-memory·user-scope의 진짜 학습을 `<memoryDir>/`에 **증류**(복사 아님)해 **`git commit`** → *그 다음에야* auto-memory OFF(`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, Codex `memories` 비활성)·user-scope에서 프로젝트 지식 제거(개인 취향만 잔류). **커밋이 안전장치** — 원본을 지워도 학습이 안 사라진다.
4. **브리지.** `CLAUDE.md`를 `@AGENTS.md`로 단일화(중복 본문=드리프트(= 같은 내용 두 곳이 따로 놀며 어긋남) 제거).
5. **검증.** §새로 만드는 법 5단계.

## 한 벌로 양쪽 (이식성 요약)

**두 도구가 함께 읽는 메모리 파일은 없다** → AGENTS.md를 단일 소스로:

- **Claude:** `CLAUDE.md`에 `@AGENTS.md`(import) 또는 `ln -s AGENTS.md CLAUDE.md`(symlink; Windows는 import 권장).
- **Codex:** `AGENTS.md` 그대로 읽음. CLAUDE.md를 읽히려면 `project_doc_fallback_filenames=["CLAUDE.md"]`.
- **스코프 분할:** 이식 가능한 건 중첩 `AGENTS.md`. Claude `.claude/rules/ paths:`는 **Claude 전용 지연로딩 최적화**(탈출구) — 진실은 AGENTS.md 산문에. → [`references/layers.md`](references/layers.md)

## 검증 체크리스트

- [ ] AGENTS.md가 단일 소스 · CLAUDE.md는 `@AGENTS.md` 브리지(중복 본문 없음 = no drift)
- [ ] AGENTS.md엔 **보편 지시만** · 긴 지식은 `<memoryDir>/`로 빠지고 조건부 포인터만 남음
- [ ] 예산: < 200줄(Claude) · 체인 합계 < 32 KiB(Codex, 안 그러면 잘림)
- [ ] `@import`를 비용 절감용으로 오용하지 않음(상주임) · depth ≤ 4 · 코드펜스 밖
- [ ] **머신로컬 0:** auto-memory OFF · user-scope엔 개인 취향만 · `<memoryDir>/`는 git 커밋(gitignore 아님)
- [ ] 절차→스킬 · 강제→훅 · 위임→에이전트로 라우팅됨
- [ ] `node scripts/validate.mjs [AGENTS.md] [project-root]` 통과 → 양쪽 로드 + 타 머신 `git fetch` 테스트

**빈 골격:** [template.md](template.md) · **견본:** [examples/sample.md](examples/sample.md) · **레퍼런스:** [references/layers.md](references/layers.md) · [references/budget.md](references/budget.md) · [references/cross-tool.md](references/cross-tool.md).
