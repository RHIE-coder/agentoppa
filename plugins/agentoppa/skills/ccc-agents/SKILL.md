---
name: ccc-agents
description: Claude Code와 Codex의 서브에이전트(위임 가능한 전문 에이전트)를 새로 만들거나 점검할 때 사용. "서브에이전트 만들어줘", "agent 추가", ".claude/agents 작성", "리뷰 전문 에이전트", "Codex에서도 도는 에이전트", "이 일 위임해도 되나", "agent 형식이 .md/.toml로 달라" 같은 요청이나 어떤 모델·도구범위를 줄지·md↔toml 형식 차이·크로스툴 이식성 질문에 적용. 서브에이전트와 무관한 단순 함수 추출엔 비해당.
---

# ccc-agents — claude·codex 공용 서브에이전트 작성 레퍼런스

서브에이전트(위임 가능한 전문 에이전트) 만들기의 실패는 대개 셋이다 → 이 스킬은 그 셋을 막는다:

1. **위임 경계 오판** — 스킬/인라인이면 될 일을 서브에이전트로(또는 반대). 서브에이전트 = **격리 컨텍스트 + 요약 반환**. 자주 오가야 하거나 공유 맥락이 많은 일엔 손해다.
2. **형식이 갈리는데 "한 벌"로 착각** — skills(`SKILL.md`)·hooks(`hooks.json`)와 달리 **양쪽이 읽는 공유 파일이 없다**: Claude `.claude/agents/<name>.md`(MD+frontmatter(= 파일 맨 위 `---` 사이에 적는 설정 머리말)) ≠ Codex `.codex/agents/<name>.toml`(TOML(= 키=값 형식의 설정 파일 포맷)), 디렉토리도 다름. → **단일 소스(.md) + 생성**으로 푼다(§형식 차이).
3. **호출 모델 차이 무시** — Claude는 `description`으로 **자동 위임**, Codex는 **명시 전용**("spawn …"). 자동 위임을 가정하면 Codex에서 안 불린다.

> 작성 메타(SKILL 형식·description 규칙·≤500줄·점진 로딩)는 [`ccc-skills`](../ccc-skills/SKILL.md)를 따른다. 여기선 agent 도메인만 다룬다. ccc-agents 자체가 ccc-skills로 만든 스킬이다.

## 이 패키지 구성

```text
ccc-agents/
├── SKILL.md              # (필수) 이 안내 — 서브에이전트 결정 절차의 진입점
├── template.md           # 복사용 빈 .md 서브에이전트 골격 (= 단일 소스)
├── examples/
│   └── sample.md         # 잘 만든 서브에이전트 견본 + 생성된 .toml
├── references/
│   ├── frontmatter.md    # 양쪽 전체 필드 + 교집합 매핑·생성 규칙
│   └── cross-tool.md     # md↔toml·디렉토리·호출·패키징 차이 + 빌드 브리지
└── scripts/
    └── validate.mjs      # .md 점검 (Node). 생성기는 플러그인 bin/build-agents.mjs로 승격
```

## When to use

- 서브에이전트를 새로 만들 때: "리뷰 전문 에이전트", "탐색만 하는 read-only 에이전트", "이 일 위임해도 되나".
- **크로스툴**: "Codex에서도 도는 에이전트", "형식이 달라(.md/.toml)", 한 소스로 양쪽 굴리기.
- 서브에이전트가 **안 불릴 때**: description·호출 모델(자동 vs 명시) 점검.
- **When NOT to use:** 서브에이전트와 무관한 단순 코드 변경. 스킬(SKILL.md) 자체를 만드는 일 → [`ccc-skills`](../ccc-skills/SKILL.md). 라이프사이클 자동화 → [`ccc-hooks`](../ccc-hooks/SKILL.md).

## 좋은 서브에이전트 5단계

1. **위임할 가치가 있나?** — 격리 컨텍스트 + 요약 반환이 이득인 일(노이즈 큰 탐색·리뷰·테스트·트리아지)만. 잦은 왕복·공유 맥락이 크면 스킬/인라인. (양 문서 합의)
2. **단일 책임 + description** — 한 에이전트는 한 가지를 잘. `description`은 **"언제 위임/선택하나"를 front-load**(= 가장 중요한 판단 근거를 앞쪽에 배치)(Claude 자동위임·Codex 선택 둘 다의 근거).
3. **능력 범위(`access`)** — 기본은 **read-only**(= 읽기만, 파일 수정 불가). Claude는 `tools` allowlist(= 허용할 도구만 적은 목록), Codex는 `sandbox_mode`로 표현이 다르니 소스엔 **의도(`access: read-only|read-write`)**로 적는다. 쓰기 병렬은 충돌 주의(Claude는 `isolation: worktree`(= 임시 git 작업 사본에서 격리 실행)로 회피).
4. **단일 소스로 작성 → 생성** — `.claude/agents/<name>.md`를 쓰고(=Claude가 그대로 사용), `build-agents.mjs`로 `.codex/agents/<name>.toml`을 만든다. **교집합만 안전 변환**, Claude 전용 필드·모델명은 드롭/상속(검증기가 짚어줌).
5. **검증 + 실제 스폰 테스트** — `validate.mjs`로 점검하고, 양쪽에서 실제로 스폰(= 에이전트를 띄워 실행)해 본다. 지시는 격리 컨텍스트에서도 자립하도록(self-contained(= 외부 맥락 없이 그 글만으로 동작)).

## 형식 차이 푸는 법 — 단일 소스 + 빌드 브리지

skills/hooks는 공유 파일 1벌이 런타임에 양쪽서 그대로 돌았다. **agents는 공유 파일이 없다**(`.md` ≠ `.toml`). → 브리지를 런타임에서 **빌드타임**으로 옮긴다:

```bash
# .claude/agents/*.md  →  .codex/agents/*.toml  (단방향 생성)
node ${CLAUDE_PLUGIN_ROOT}/bin/build-agents.mjs .claude/agents .codex/agents
```

- **소스 = Claude `.md`** (긴 시스템 프롬프트는 마크다운 본문이 자연스럽고, Claude는 빌드 없이 직접 사용).
- **생성 = Codex `.toml`**: 본문 → `developer_instructions`(= Codex 쪽 시스템 프롬프트 자리), `name`/`description` 그대로, `access`(또는 tools 추론) → `sandbox_mode`, `effort` → `model_reasoning_effort`.
- **번역 안 되는 것은 드롭/상속**: Claude 모델명(`sonnet`/`opus`…)은 Codex로 안 옮겨짐 → `.toml`에서 생략(세션 상속), 명시하려면 `codex-model:` 힌트. `memory`/`isolation`/`hooks`/`color` 등 Claude 전용은 드롭. **무음 누락 금지** — 생성기가 드롭 항목을 로그로 알린다.

> 철학 그대로: **컴포넌트(역할 프롬프트=교집합 코어)는 공유, 형식 래퍼만 도구별로 생성.** 구현만 빌드타임 브리지로.

## 호출 모델 (이식성 — 반드시 기억)

| | Claude Code | Codex |
|---|---|---|
| 자동 위임 | ✅ `description` 매칭 | ❌ 자동 안 함 |
| 명시 호출 | `@mention`·자연어·`--agent` | **명시 전용** "spawn …" · `/agent` |

→ 크로스툴 에이전트는 **자동 위임에 의존하지 말 것.** `description`은 선택 품질로 쓰고, 지시는 명시 스폰에서도 자립하게.

## 검증 체크리스트

- [ ] frontmatter + `name`(소문자·하이픈, 파일명과 일치 권장) + `description`("언제 위임/선택" front-load, 절차 요약 아님)
- [ ] 본문(시스템 프롬프트) 비어 있지 않음 — Codex `developer_instructions`로 필수
- [ ] 능력 범위 명시: `access` 또는 `tools`(없으면 Codex `sandbox_mode` 상속 = 미통제)
- [ ] 단일 책임 · 지시 self-contained(격리 컨텍스트) · 요약 반환
- [ ] 크로스툴: 자동 위임 비의존 · Claude 전용 필드/모델명은 드롭/상속임을 인지
- [ ] `node scripts/validate.mjs <agent>.md` 통과 → `build-agents.mjs`로 `.toml` 생성 후 양쪽 스폰 테스트

**빈 골격:** [template.md](template.md) · **견본:** [examples/sample.md](examples/sample.md) · **레퍼런스:** [references/frontmatter.md](references/frontmatter.md) · [references/cross-tool.md](references/cross-tool.md).
