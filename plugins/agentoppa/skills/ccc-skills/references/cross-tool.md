# 공통 vs 도구별 — Claude Code ↔ Codex

[`SKILL.md`](../SKILL.md)의 동반 문서. **무엇을 한 벌로 공유하고, 무엇이 도구마다 갈리는지**를 정리한다. 원칙: 공통은 공통으로 두고, 갈리는 지점만 명시적으로 분기한다.

## 1. 공통 (한 벌만 작성 — 두 도구가 그대로 공유)

- **`SKILL.md` 포맷**: `---` YAML frontmatter(`name`+`description`) + 마크다운 본문. 둘 다 [agentskills.io](https://agentskills.io) 개방표준.
- **보조파일 구조**: `scripts/`(실행 코드) · `references/`(문서) · `assets/`(템플릿·리소스 = 아이콘·서식 등 끼워 쓰는 자료).
- **3층 점진 로딩**: 이름·설명 상주 → 본문은 선택 시 → 보조파일은 필요 시.
- **`description` 철학**: "언제 쓰는가"를 트리거 단어와 함께 front-load(= 맨 앞에 배치). 워크플로 요약 금지.
- **본문 규율**: 간결·명령형·입출력 명시. 한 스킬은 한 가지 일.
- **`name` 규칙**: 소문자+숫자+하이픈.

> 그래서 **컴포넌트(skills 본문·scripts·references)는 공유, 분기 지점만 도구별로** 둔다.

## 2. 도구별 (반드시 분기 — 명시할 것)

| 측면 | Claude Code | Codex |
|---|---|---|
| **개인 스킬** | `~/.claude/skills/<name>/SKILL.md` | `~/.agents/skills/<name>/SKILL.md` |
| **프로젝트 스킬** | `.claude/skills/<name>/SKILL.md` | `.agents/skills/` (cwd → 상위 → 저장소 루트 순 스캔) |
| **관리자/시스템** | enterprise 관리 설정 | `/etc/codex/skills` (admin) · Codex 번들 (system) |
| **자동 발동** | `description`을 모델이 매칭 | `description` 매칭(implicit = 사용자가 명시 호출 안 해도 모델이 알아서) — `policy.allow_implicit_invocation` |
| **명시 호출** | `/name` · plugin은 `/plugin:name` | `$skill` 멘션 |
| **켜기/끄기** | `skillOverrides`(`.claude/settings.local.json`) · `/permissions`의 `Skill(...)` | `~/.codex/config.toml`의 `[[skills.config]]` `enabled = false` |
| **도구별 메타** | frontmatter(`allowed-tools`/`disallowed-tools`/`model`/`hooks`/…) | `agents/openai.yaml`(`interface`·`policy`·`dependencies`) |
| **자동발동 끄기** | `disable-model-invocation: true` | `policy.allow_implicit_invocation: false` |
| **외부 도구 의존** | (권한·MCP(= Model Context Protocol, 외부 도구·데이터를 에이전트에 붙이는 표준) 설정) | `agents/openai.yaml`의 `dependencies.tools[]` |
| **번들 스크립트 경로** | `${CLAUDE_SKILL_DIR}/scripts/...` | 스킬 폴더 기준 상대경로 |
| **이름·설명 예산** | 컨텍스트의 ≈1%, 항목당 1,536자 | 이름·설명 합 ~8,000자 |
| **동적 컨텍스트 주입** | `` !`command` `` / ` ```! ` 블록 | (해당 기능 미지원 — 본문 지시로) |
| **격리 실행** | `context: fork` + `agent` | (해당 frontmatter 없음) |

## 3. 플러그인 패키징 (배포할 때)

| | Claude Code | Codex |
|---|---|---|
| 플러그인 매니페스트 | `.claude-plugin/plugin.json` — `skills/`·`agents/`·`hooks/` 자동발견 | `.codex-plugin/plugin.json` — `"skills": "./skills/"` 명시 |
| 마켓플레이스 | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` |
| 훅 | `.claude/settings.json` 또는 플러그인 `hooks/hooks.json` | `.codex/hooks.json` |
| 스킬 폴더 → 플러그인 승격 | `.claude-plugin/plugin.json`을 스킬 폴더에 넣으면 `<name>@skills-dir` 플러그인 | — |

> AgentOppa는 이 원칙으로 짜인다: **컴포넌트(skills/agents/hooks)는 두 도구가 공유, 매니페스트만 도구별로.** 표준·방법론은 도구중립 문서 한 곳에, 각 도구 파일은 "그 문서를 따르라"는 얇은 어댑터로.

## 4. 크로스툴 스킬을 쓸 때 실무 규칙

1. 본문은 **두 도구 모두 따를 수 있는 산문**으로 쓴다(특정 런타임 전용 기능에 의존하지 않기).
2. 도구 전용 기능(예: Claude `!`command``, `context: fork`)을 쓰면 **"이건 Claude 측"**이라고 본문/주석에 명시하고, Codex 대응(예: `agents/openai.yaml` policy)을 함께 적는다.
3. 경로·발동·메타가 갈리는 지점은 이 문서의 §2 표를 그대로 참조해 분기한다.
4. Codex 노출이 필요하면 `agents/openai.yaml`을 추가한다(Claude는 무시하므로 양립).

## 출처

- Claude Code Skills — https://code.claude.com/docs/ko/skills
- Codex Skills — https://developers.openai.com/codex/skills
- Agent Skills 개방표준 — https://agentskills.io
