# 메모리 계층 · 스코프 · 로드 순서 (이식성 축)

[`SKILL.md`](../SKILL.md) 동반 문서. 무엇이 어느 스코프에서·언제 로드되는지, 그리고 **왜 project-committed만 허용하는지**.

## 1. 계층

| 계층 | 무엇 | 작성자 | AgentOppa 방침 |
|---|---|---|---|
| 상시 지시 | `AGENTS.md` / `CLAUDE.md` | 사람 | **project-committed.** 보편 지시만. |
| 동적 학습 | Claude auto-memory / Codex memories | 에이전트 | **머신로컬 거부.** `<memoryDir>/MEMORY.md`(커밋)로 대체. |
| [탈출구] 조건부 규칙 | Claude `.claude/rules/ paths:` | 사람 | Claude 전용 최적화. 이식 동등물 = 중첩 `AGENTS.md`. |

## 2. Claude Code 로드 (정밀)

- **파일:** managed(OS별) → `~/.claude/CLAUDE.md`(user) → `./CLAUDE.md` 또는 `./.claude/CLAUDE.md`(project) → `./CLAUDE.local.md`(local). 전부 **concat**(= 이어붙임; override 아님; 가까울수록 뒤·우선).
- **디렉토리 탐색:** 루트→cwd 상위 파일은 **launch에 full 로드**. cwd **하위** 서브트리 파일은 **파일 읽을 때 on-demand**.
- **`@import`:** depth ≤ 4, 코드펜스/인라인코드 제외, 상대경로는 그 파일 기준, `~/` 가능. **launch에 인라인 = 상주**(정리용이지 절감 아님). 외부 import는 첫 사용 시 승인 다이얼로그.
- **auto-memory:** `~/.claude/projects/<proj>/memory/MEMORY.md`(+토픽파일). 매 세션 **첫 200줄/25KB**만 로드. v2.1.59+, 기본 ON. **끄기:** `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` 또는 `autoMemoryEnabled: false`.
- `claudeMdExcludes`로 상위 CLAUDE.md/rules 제외(단 managed는 불가). `/memory`(로드 목록·auto토글), `/init`.
- **Claude는 `AGENTS.md`를 안 읽는다.** → §[`cross-tool.md`](cross-tool.md)의 브리지.

## 3. Codex 로드 (정밀)

- **글로벌:** `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md` (첫 비어있지 않은 것; `$CODEX_HOME`로 위치 변경).
- **프로젝트:** root→cwd 각 디렉토리에서 `AGENTS.override.md` → `AGENTS.md` → `project_doc_fallback_filenames`, **디렉토리당 최대 1파일**. concat, 가까울수록 뒤(=우선). **cwd에서 멈춤 — 아래로 안 내려간다.**
- **한도:** `project_doc_max_bytes` **기본 32 KiB**. 합산이 한도에 닿으면 **이후 파일 드롭(잘림)**. `model_instructions_file`(빌트인 교체, 주의), `developer_instructions`(추가 주입).
- **memories:** `[features] memories` + `~/.codex/memories/`. **머신로컬** → AgentOppa에선 켜지 않음.
- **Codex "rules"는 동음이의** — `.codex/rules/*.rules`는 셸 명령 실행 권한 제어지 지침이 아니다.
- **Codex는 `CLAUDE.md`를 안 읽는다** (오직 `project_doc_fallback_filenames=["CLAUDE.md"]` 옵트인).

## 4. 스코프 규칙 (AgentOppa)

- **지속 메모리 = project-committed만.** `git fetch`로 모든 머신·팀원·CI가 동일 context. 머신로컬(user-scope·auto-memory)에 프로젝트 지식 금지.
- **유일 예외:** 순수 개인 취향(응답 언어·에디터 등)은 user-scope `~/.claude/CLAUDE.md`에 둬도 됨(프로젝트 품질과 무관하므로).
- **`<memoryDir>/` 규약:** 전용 네임스페이스(기본 `.agentoppa/`, `config.json`의 `memoryDir`로 변경). **git 커밋**(gitignore 금지). bare `docs/` 금지(오염·과독). 에이전트-대상 지식과 사람-대상 제품문서를 분리. 디렉토리는 **툴-중립**이어야 한다(둘 다 AGENTS.md 포인터로 Read하므로; `.claude/`·`.codex/`는 툴 전용이라 부적합).

## 5. [탈출구] Claude `.claude/rules/`

- `.claude/rules/*.md`(+`~/.claude/rules/`), 재귀 탐색. `paths:` frontmatter(glob = `*`·`**` 와일드카드 매칭, brace expansion = `{a,b}` 펼치기)가 있으면 **매칭 파일을 읽을 때만** 로드, 없으면 launch 로드(=`.claude/CLAUDE.md`급 우선). user → project 순(project 우선).
- **Claude 전용. 이식 안 됨.** Codex 동등물 없음 → 이식하려면 중첩 `AGENTS.md`(디렉토리 단위) 또는 AGENTS.md 산문 조건("When editing X, …"). **진실은 AGENTS.md에**, rules는 그 위 지연로딩 최적화로만.
- 트리거 차이: Claude `paths:`는 **파일 읽기** 트리거(어느 cwd든), Codex 중첩 AGENTS.md는 **cwd** 기준(아래로 안 내려감). 동일하지 않다.

## 6. 타 도구 (참고)

- Cursor `.cursor/rules/*.mdc`(`globs`/`alwaysApply`), GitHub Copilot `.github/instructions/*.instructions.md`(`applyTo`), Windsurf `.windsurf/rules/*.md`(`trigger`). 전부 **글로브-frontmatter 조건부 규칙** 패턴. `AGENTS.md`는 이들 다수가 지원(nearest wins = 가장 가까운 파일이 우선).

## 출처

- Claude Code Memory — https://code.claude.com/docs/en/memory
- Codex AGENTS.md — https://developers.openai.com/codex/guides/agents-md · Config Reference — https://developers.openai.com/codex/config-reference
- AGENTS.md 개방표준 — https://agents.md
