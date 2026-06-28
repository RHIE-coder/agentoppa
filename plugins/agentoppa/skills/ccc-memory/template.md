# 메모리 빈 골격 (복사용)

아래를 복사해 채운다. 규칙은 [`SKILL.md`](SKILL.md)와 [`references/`](references/)를 따른다. 핵심: **`AGENTS.md` = 단일 소스(보편 지시 + 포인터), 긴 지식은 `<memoryDir>/`로, `CLAUDE.md`는 브리지.**

## 1. `AGENTS.md` (프로젝트 루트 — 단일 진실원천)

```markdown
# <프로젝트> — 에이전트 지침

## 스택 · 레이아웃
- <한 줄: 언어/프레임워크/패키지매니저>
- <핵심 디렉토리 한두 줄>

## 항상 (보편 지시 — 모든 작업에 관련된 것만)
- <"2-space 들여쓰기" 처럼 구체·검증가능한 지시>
- 커밋 전 `<test 명령>` 실행

## 더 깊은 지식 (해당 작업일 때만 읽어라)
- 아키텍처 → `.agentoppa/architecture.md`
- <주제> → `.agentoppa/<주제>.md`
- 누적 학습 → `.agentoppa/MEMORY.md`
```

> ⚠ 200줄을 넘기지 말 것. 길어지면 → 긴 지식은 `<memoryDir>/`로 빼고 포인터만, 절차는 스킬으로, 강제는 훅으로. 포인터는 **조건부**("~작업이면 ~읽어라")여야 한다 — "전부 읽어"는 다시 비대해진다.

## 2. `CLAUDE.md` (Claude 브리지 — 단일 소스를 가리키게만)

```markdown
@AGENTS.md

## Claude 전용 (선택)
<Claude에서만 다르게 둘 한두 줄. 없으면 `@AGENTS.md` 한 줄로 충분>
```

> 또는 symlink(= 한 파일을 가리키는 바로가기): `ln -s AGENTS.md CLAUDE.md` (Windows는 import 권장). **본문을 복붙하지 말 것 = drift(= 두 곳이 따로 놀며 어긋남).**

## 3. `<memoryDir>/` (전용 하네스 디렉토리 — git 커밋)

```text
.agentoppa/                 # 기본값. 바꾸려면 config.json의 memoryDir
├── config.json             # { "memoryDir": ".agentoppa" }
├── MEMORY.md               # 누적 학습 (머신로컬 auto-memory 대체) — 인덱스·짧게
├── architecture.md         # 긴 지식, on-demand
└── <주제>.md
```

> bare `docs/` 금지 — 전용 네임스페이스여야 다른 문서와 안 섞이고 오염도 안 된다(에이전트-대상 지식 ≠ 사람-대상 제품문서). 후보: `.agentoppa/`(추천) · `_harness/` · `docs/<harness>/`. **반드시 git 커밋**(gitignore 금지) — 안 그러면 머신로컬과 똑같아진다.

## 4. 머신로컬 끄기 (이식성)

- Claude auto-memory: `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` (또는 설정 `autoMemoryEnabled: false`).
- Codex: `~/.codex/config.toml`에서 `[features] memories`를 켜지 않음.
- user-scope `~/.claude/CLAUDE.md`: **개인 취향만**(언어·에디터 등). 프로젝트 지식 금지.

## (탈출구) Claude 전용 지연로딩 — `.claude/rules/`

Claude에서 *큰* 규칙셋을 매칭 파일 읽을 때만 로드하고 싶을 때(선택, **이식 안 됨**):

```markdown
---
paths: ["src/billing/**"]
---
결제 코드를 편집할 때 …
```

> Codex 대응 없음. 이식 가능한 동등물은 중첩 `AGENTS.md`(디렉토리 단위) 또는 AGENTS.md 산문 조건("When editing `src/billing/**`, …"). 진실은 AGENTS.md에 두고 rules는 그 위 최적화로만. → [`references/layers.md`](references/layers.md)

채운 뒤 `node scripts/validate.mjs AGENTS.md .` 로 점검한다.
