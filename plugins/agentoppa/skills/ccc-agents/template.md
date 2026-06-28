# 서브에이전트 빈 골격 (복사용)

규칙은 [`SKILL.md`](SKILL.md)와 [`references/`](references/)를 따른다. 안내 주석(`#`)은 채운 뒤 지운다. 이 **`.md` 한 벌이 단일 소스** — Claude는 그대로 쓰고, Codex `.toml`은 `build-agents.mjs`가 생성한다.

## 1. 소스: `.claude/agents/<name>.md`

```markdown
---
name: <agent-name>          # 소문자+숫자+하이픈. 파일명과 일치 권장.
description: <언제 이 에이전트에 위임/선택하나 — 트리거·증상을 앞에. Claude 자동위임·Codex 선택의 근거. 절차 요약 금지.>
# --- 능력 범위 (택1 권장) ---
access: read-only           # AgentOppa 힌트(Claude 무시) → Codex sandbox_mode. read-only | read-write
# tools: Read, Grep, Glob, Bash   # Claude 도구 allowlist. access 없으면 여기서 read-only/write 추론(Edit/Write 있으면 write)
# --- 선택 ---
# model: sonnet             # Claude 모델 오버라이드. ⚠ Codex로 번역 안 됨 → .toml에선 상속(아래 codex-model로 명시)
# codex-model: gpt-5.4      # AgentOppa 힌트(Claude 무시) → Codex .toml의 model
# effort: high              # low|medium|high|xhigh|max → Codex model_reasoning_effort (max만 xhigh로; 나머지 그대로)
# --- 아래는 Claude 전용 (생성 .toml에서 드롭됨) ---
# permissionMode / maxTurns / skills / mcpServers / hooks / memory / background / isolation / color / initialPrompt
---

You are a <역할>. <한 문장 정체성/목표>

When invoked:
1. <첫 단계 — 명령형>
2. ...

<체크리스트 / 도메인 규칙>

<출력 형식 — 메인 대화로 무엇을 요약 반환할지 명시. 격리 컨텍스트라 self-contained로.>
```

본문(`---` 아래 전체)이 **시스템 프롬프트**(= 에이전트의 역할·행동을 정해 주는 기본 지시문)이자 Codex `developer_instructions`(= Codex 쪽 그 지시문 자리)가 된다 → 비우면 안 된다.

## 2. 생성: `.codex/agents/<name>.toml` (직접 쓰지 말 것 — 생성물)

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/build-agents.mjs .claude/agents .codex/agents
```

위 골격(`access: read-only`)이면 다음이 생성된다:

```toml
# generated from .claude/agents/<name>.md by AgentOppa ccc-agents — edit the .md source, regenerate
name = "<agent-name>"
description = "<...>"
sandbox_mode = "read-only"
developer_instructions = """
You are a <역할>. ...
"""
```

## 3. 점검

```bash
node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs .claude/agents/<name>.md
```

→ `name`/`description`/본문/능력범위 + 이식성(Claude 전용 필드·모델명 번역 불가)을 짚어준다. 통과하면 §2로 생성하고 **양쪽에서 실제 스폰 테스트**한다. 호출 차이(자동 vs 명시)는 [`references/cross-tool.md`](references/cross-tool.md) §2.
