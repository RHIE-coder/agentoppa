# 견본 서브에이전트 — `code-reviewer` (read-only)

**잘 만든 서브에이전트 하나의 전체 형태.** 새 에이전트를 만들 때 형식·톤의 목표로 삼는다. 외부 파일 의존이 없어 **어느 프로젝트에든 그대로 통하는 자립형** 견본이다.

## 1. 소스 — `.claude/agents/code-reviewer.md` (Claude가 그대로 사용)

```markdown
---
name: code-reviewer
description: 코드를 쓰거나 고친 직후 정확성·보안·가독성을 리뷰할 때 사용. file:line으로 인용한 우선순위별 지적을 반환. read-only — 판단·제안만 하고 편집은 안 한다.
tools: Read, Grep, Glob, Bash
---

You are a senior code reviewer. When invoked:

1. Run `git diff` to see what changed; focus only on the changed files.
2. Review against this checklist:
   - correctness & edge cases
   - error handling (no swallowed errors)
   - security (no injected input, no leaked secrets)
   - clarity, naming, no needless duplication
3. Never edit files.

Return findings grouped by priority — Critical / Warning / Suggestion — each with `file:line` and a concrete fix. If nothing is wrong, say so.
```

## 왜 이게 좋은 견본인가

- **단일 책임** — 리뷰만. 고치는 건 별도 에이전트 몫.
- **description이 "언제"에 집중** — 언제 부르나(코드 변경 직후), 무엇을 반환(인용된 우선순위 지적), 경계(read-only). 절차 요약이 아니다.
- **능력 최소화** — `tools: Read, Grep, Glob, Bash`(허용 도구 목록, Edit/Write 없음) → Claude에서 실제로 쓰기가 차단되고, 생성 시 `sandbox_mode="read-only"`로 추론된다.
- **요약 반환 + self-contained**(= 외부 맥락 없이 그 지시문만으로 동작) — 외부 파일 안 읽고 `git diff`만으로 자립. 격리 컨텍스트에서도 동작.

## 2. 생성 — `.codex/agents/code-reviewer.toml`

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/build-agents.mjs .claude/agents .codex/agents
```

`tools`에 Edit/Write가 없으니 **read-only로 추론**, `tools` 자체는 Claude 전용이라 드롭(로그 고지). 결과:

```toml
# generated from .claude/agents/code-reviewer.md by AgentOppa ccc-agents — edit the .md source, regenerate
name = "code-reviewer"
description = "코드를 쓰거나 고친 직후 정확성·보안·가독성을 리뷰할 때 사용. ... 편집은 안 한다."
sandbox_mode = "read-only"
developer_instructions = """
You are a senior code reviewer. When invoked:
...
Return findings grouped by priority — Critical / Warning / Suggestion — each with `file:line` and a concrete fix. If nothing is wrong, say so.
"""
```

`model` 미지정 → Codex 세션 상속(고정하려면 소스에 `codex-model: gpt-5.4`).

## 이식성 교보재 — 한 줄이 분기점

- **능력 범위**: Claude `tools` allowlist ↔ Codex `sandbox_mode`. tools에 Edit/Write가 없으면 생성기가 read-only로 추론. tools 없이 Codex 범위만 지정하려면 소스에 `access: read-only` 힌트(Claude는 무시).
- **호출**: Claude는 description으로 **자동 위임**(또는 `@code-reviewer`). Codex는 **명시 전용** — "spawn `code-reviewer` on the diff"처럼 직접 시킨다.

## 도구별 주의

- `tools`/`disallowedTools`·`memory`·`isolation`·`color`는 **Claude 전용** → 생성 `.toml`에서 드롭(생성기가 로그로 알림).
- 병렬로 여러 리뷰어를 돌릴 때: read-only면 양쪽 다 안전. **쓰기** 에이전트를 병렬로 돌리면 Claude는 `isolation: worktree`(Claude 전용), Codex는 신중히.
