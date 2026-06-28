---
name: ccc-skills
description: Claude Code와 Codex 양쪽에서 동작하는 스킬(SKILL.md)을 새로 만들거나 점검할 때 사용. "스킬 만들어줘", "skill 추가", "SKILL.md 작성", "프론트매터 뭐 넣지", "크로스툴 스킬" 같은 요청이나 스킬 구조·작성 규칙·베스트프랙티스 질문에 적용. 시각 표면 없는 순수 코드 변경엔 비해당.
---

# ccc-skills — claude·codex 공용 스킬 작성 레퍼런스

Claude Code와 Codex는 둘 다 [Agent Skills 개방표준](https://agentskills.io)을 따른다 → **`SKILL.md` 한 벌로 양쪽에서 동작**한다. 이 스킬은 그 *공통 작성법*과 *도구별 차이*를 모은 견본이다. 직접 따라 만들면 두 도구 모두에서 트리거되는 스킬이 나온다.

## 이 패키지 구성 — 두 공식 문서 트리를 합친 것

```text
ccc-skills/
├── SKILL.md              # (필수) 이 안내 — 작성 규칙의 진입점
├── template.md           # 복사해서 채우는 빈 SKILL.md 골격
├── examples/
│   └── sample.md         # 잘 만든 스킬 1개 (목표 형식 견본)
├── references/
│   ├── frontmatter.md    # 프론트매터 전체 필드 (Claude + Codex)
│   └── cross-tool.md     # 공통 vs 도구별 차이 매트릭스
└── scripts/
    └── validate.mjs      # 검증기 (Node — mac·linux·windows 공통)
```

- **번들 = 교집합만**: `SKILL.md`(name+description+본문)·`template.md`·`examples/`·`references/`·`scripts/` — 두 도구가 그대로 공유하는 것만 담는다.
- **Codex 전용 `agents/openai.yaml`**(아이콘·정책·의존성)은 **번들하지 않는다.** 특정 스킬을 Codex에 노출할 때만 곁들이는 *탈출구*이고, 키 설명은 [references/frontmatter.md](references/frontmatter.md) §3에 지도로 남겨 둔다.
- **`SKILL.md`만 필수**, 나머지는 전부 선택.

## 새 스킬 만드는 법

1. `template.md`의 골격을 복사해 `<new-skill>/SKILL.md`로 만들고 `<…>`를 채운다.
2. `examples/sample.md`를 목표 형식(톤·길이)으로 참고한다.
3. 깊은 규칙은 [`references/frontmatter.md`](references/frontmatter.md)·[`references/cross-tool.md`](references/cross-tool.md)에서 확인한다.
4. `node scripts/validate.mjs <new-skill>/SKILL.md`로 검증한다.
5. Codex에도 노출하려면 `agents/openai.yaml`을 곁들인다(선택).

## 3층 점진 로딩 (두 도구의 공통 원리)

| 층 | 내용 | 로드 시점 |
|---|---|---|
| 1 | `name` + `description` | **항상 상주** (Claude: 컨텍스트 ≈1%; Codex: 이름·설명 ~8,000자) |
| 2 | `SKILL.md` 본문 | 스킬이 선택/호출될 때 |
| 3 | `template.md`·`examples/`·`references/`·`scripts/` | 필요할 때만 |

1층은 상주하므로 **비싸다** → 짧게. 본문은 호출 후 **턴 내내 컨텍스트에 남으므로** 매 줄이 반복 토큰 비용. 무거운 건 3층으로 내린다.

## 프론트매터 핵심 (전체: `references/frontmatter.md`)

- 사실상 **`description`만 필수** (Claude는 모든 필드 optional이나 description 권장 / Codex는 `name`+`description` 요구).
- `name` — 소문자+숫자+하이픈, **디렉토리명과 일치**(Claude는 디렉토리명이 곧 `/명령어`).
- `description` — 자동 발동의 전부 → 아래 작성법을 지킨다.

## description 작성법 — 가장 중요

양 문서가 같은 말을 한다: **"무엇을 하는가"가 아니라 "언제 쓰는가"**, 핵심 사용사례·트리거 단어를 **앞에 배치**(front-load = 가장 중요한 걸 문장 맨 앞에 둔다).

- ✅ "…할 때 사용 / Use when …" + 구체 트리거·증상·키워드.
- ❌ **워크플로 요약 금지** — description이 절차를 요약하면 에이전트가 본문을 안 읽고 description만 따라간다(검증된 함정).
- ❌ 모호·1인칭 금지.
- 길이: Claude는 `description`+`when_to_use` 합산 **1,536자**에서 잘림(목록). 앞부터 짧게.

## 본문 작성법

- **간결하게.** 호출되면 턴 내내 상주 → 매 줄이 반복 비용. "왜/어떻게"보다 "무엇을".
- **명령형(imperative).** "You should…" 2인칭 지양.
- **쉬운 말.** 지어낸 용어 금지. 업계 표준 용어를 쓰면 *그게 뭘 가리키는지* 그 자리에서 한 번 풀어 준다 — 스킬 독자는 비전문가일 수 있다.
- **`SKILL.md` ≤ 500줄.** 상세는 `references/`로(progressive disclosure = 필요할 때만 단계적으로 펼쳐 보이기).
- 보조파일은 **본문에서 가리켜야** 로드된다 — `[reference.md](reference.md)`.
- 번들 스크립트 경로는 **`${CLAUDE_SKILL_DIR}`** (플러그인이면 스킬 하위폴더로 해석). `${CLAUDE_PLUGIN_ROOT}` 아님.
- 교차참조는 이름으로. `@경로` force-load(= 그 파일을 무조건 즉시 통째로 불러옴) 금지(컨텍스트 폭발).

## 공통 vs 도구별 (요약, 전체: `references/cross-tool.md`)

**공통:** `SKILL.md` 포맷(`name`+`description`+본문) · `scripts/`·`references/`·`assets/` 보조파일 · 3층 점진로딩 · description 철학 · agentskills.io 표준.

| | Claude Code | Codex |
|---|---|---|
| 개인 경로 | `~/.claude/skills/` | `~/.agents/skills/` |
| 프로젝트 경로 | `.claude/skills/` | `.agents/skills/` (cwd·상위·루트) |
| 비활성/제어 | `skillOverrides` · `/permissions` | `~/.codex/config.toml` `[[skills.config]] enabled=false` |
| 명시 호출 | `/name` · `/plugin:name` | `$skill` 멘션 |
| 도구별 메타 | frontmatter (`allowed-tools` 등) | `agents/openai.yaml` (interface·policy·dependencies) |

## 검증 체크리스트

- [ ] `SKILL.md` 존재 + 유효 YAML frontmatter, `name`(소문자·하이픈) + `description`
- [ ] description: "언제" 중심 · 트리거 front-load · 워크플로 요약 없음 · ≤1,536자
- [ ] 본문 ≤500줄 · 간결 · 명령형, 상세는 `references/`로
- [ ] 보조파일 실재 + 본문에서 가리킴, `@` force-load 없음
- [ ] 스크립트 경로 `${CLAUDE_SKILL_DIR}`
- [ ] (Codex 노출 시) `agents/openai.yaml` 유효
- [ ] `node scripts/validate.mjs <path>/SKILL.md` 통과

**빈 골격:** [template.md](template.md) · **견본:** [examples/sample.md](examples/sample.md) · **전체 레퍼런스:** [references/frontmatter.md](references/frontmatter.md) · [references/cross-tool.md](references/cross-tool.md).
