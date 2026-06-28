# 공통 vs 도구별 — Claude Code ↔ Codex (메모리)

[`SKILL.md`](../SKILL.md) 동반 문서. **메모리는 skills/hooks와 달리 두 도구가 함께 읽는 파일이 없다** → ccc-agents처럼 *단일 소스 + 브리지*로 푼다.

## 1. 핵심 분기

| 측면 | Claude Code | Codex |
|---|---|---|
| 읽는 상시 파일 | `CLAUDE.md` (managed/user/project/local) | `AGENTS.md` (global/override/project/nested) |
| `AGENTS.md` | **안 읽음** | 표준으로 읽음 |
| `CLAUDE.md` | 읽음 | **안 읽음** (옵트인: `project_doc_fallback_filenames`) |
| user/global | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` (+`AGENTS.override.md`) |
| 병합 | concat(= 이어붙임), 상위 eager(= 시작 때 미리)·하위 on-demand | concat root→cwd, 디렉토리당 1, cwd서 멈춤 |
| import | `@path` (depth 4, 상주) | 없음 → 디렉토리 분할 |
| 크기 | 200줄 권고(순응) | 32 KiB 하드캡(초과분 드롭) |
| 동적 메모리 | auto-memory (머신로컬) | `[features] memories` (머신로컬) |
| "rules" | `.claude/rules/`(지침, `paths` glob) | `.codex/rules/`(셸 권한, **동음이의**) |

## 2. 브리지 (단일 소스 = `AGENTS.md`)

1. **AGENTS.md를 진실원천으로** 작성한다(Codex가 그대로 읽음, 개방표준).
2. **Claude:** `CLAUDE.md`에 `@AGENTS.md` import(권장; Claude 전용 내용은 그 아래에). 또는 `ln -s AGENTS.md CLAUDE.md`(symlink; Windows는 Admin/Developer 모드 필요 → import 권장).
3. **Codex가 CLAUDE.md를 읽어야** 하면 `~/.codex/config.toml`: `project_doc_fallback_filenames = ["CLAUDE.md"]`.
4. **본문 복붙 금지** — CLAUDE.md에 AGENTS.md 내용을 베끼면 drift. **가리키기만** 한다.

## 3. 스코프 분할 이식

- **이식 가능:** 중첩 `AGENTS.md`(양쪽, 디렉토리 단위) · AGENTS.md 산문 조건("When editing `src/x/**`, …").
- **Claude 전용 최적화(탈출구):** `.claude/rules/ + paths:`(매칭 파일 읽을 때 지연로딩). Codex 동등물 없음 → 진실은 AGENTS.md에.
- **트리거 차이 주의:** Claude `paths:`는 **파일 읽기** 트리거(어느 cwd든 발동), Codex 중첩은 **cwd** 기준(아래로 안 내려감). 동작이 같지 않으니 이식 시 명시한다.

## 4. 디렉토리 · 머신로컬

- 지식문서 `<memoryDir>/`(기본 `.agentoppa/`)는 **툴-중립**이어야 한다(둘 다 AGENTS.md 포인터로 `Read`). `.claude/`·`.codex/`는 툴 전용이라 부적합.
- 머신로컬 메모리는 **양쪽 다 끈다:** Claude `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, Codex `[features] memories` 비활성. 학습은 `<memoryDir>/`에 커밋.

## 5. 패키징

- **매니페스트만 도구별:** Claude `.claude-plugin/plugin.json`, Codex `.codex-plugin/plugin.json`. 메모리 컨벤션(`AGENTS.md` + `<memoryDir>/`)은 두 도구가 공유.
- 철학 그대로: **교집합 코어(AGENTS.md·지식문서)는 공유, 형식 래퍼(CLAUDE.md 브리지·매니페스트)만 도구별로.**

## 출처

- Claude Code Memory — https://code.claude.com/docs/en/memory
- Codex AGENTS.md — https://developers.openai.com/codex/guides/agents-md
- AGENTS.md 개방표준 — https://agents.md
