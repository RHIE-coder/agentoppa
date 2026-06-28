# 견본 — AgentOppa 자체가 dual-target(= 한 벌로 두 도구를 다 겨냥하는) 플러그인

[`SKILL.md`](../SKILL.md)의 목표 형식. **이 플러그인(AgentOppa)이 곧 예제다** — 컴포넌트는 한 트리에 공유, 매니페스트·마켓만 도구별.

## 구조

```text
AgentOppa/                              # 마켓 repo 루트
├── .claude-plugin/marketplace.json     # Claude 마켓 (owner, plugins[])
├── .agents/plugins/marketplace.json    # Codex 마켓 (source{}, policy{})
└── plugins/agentoppa/                  # ← 실제 플러그인
    ├── .claude-plugin/plugin.json      # Claude 매니페스트 (메타; 컴포넌트 자동발견)
    ├── .codex-plugin/plugin.json       # Codex 매니페스트 (메타 + skills 포인터)
    ├── skills/                         # 공유: ccc-skills·ccc-agents·ccc-hooks·ccc-memory·ccc-plugin
    ├── agents/  hooks/  core/          # 공유 컴포넌트 디렉토리
    └── bin/build-agents.mjs            # 빌드 브리지 (.md→.toml)
```

## 두 매니페스트 (동기화됨)

### `plugins/agentoppa/.claude-plugin/plugin.json`
```json
{
  "name": "agentoppa",
  "version": "0.1.0",
  "description": "Cross-agent · cross-OS harness for Claude Code and Codex."
}
```

### `plugins/agentoppa/.codex-plugin/plugin.json`
```json
{
  "name": "agentoppa",
  "version": "0.1.0",
  "description": "Cross-agent · cross-OS harness for Claude Code and Codex.",
  "skills": "./skills/"
}
```

> 같은 name/version/description. **Codex만 `skills` 포인터를 추가**(자동발견이 없으므로). `hooks/`·`agents/`가 채워지면 Codex 매니페스트에 `hooks` 포인터를 더한다 — Claude는 그래도 자동발견이라 안 들키니 주의.

## 두 마켓플레이스

- `.claude-plugin/marketplace.json` — `name` + `owner{name}` + `plugins[{name, source:"./plugins/agentoppa"}]`.
- `.agents/plugins/marketplace.json` — `name` + `plugins[{name, source:{source:"local", path:"./plugins/agentoppa"}, policy:{installation, authentication}}]`.

둘 다 같은 플러그인(`./plugins/agentoppa`)을 가리킨다.

## 흔한 함정 (AgentOppa가 실제로 겪은 것)

- `description: ""` · `version: "0.0.0"` · `owner: "TODO"` 방치 → 검증기가 잡는다. 채우고 **두 곳을 일치**시킨다.
- Codex 매니페스트에서 `skills` 포인터를 빠뜨리면 Codex에서 스킬이 안 잡힌다. Claude는 자동발견이라 같은 누락이 안 들켜서, 한쪽만 테스트하면 놓친다 → **양쪽 다 설치 테스트**.
- 매니페스트 메타를 한쪽만 고치고 다른 쪽을 안 고치면 드리프트(= 서로 어긋남). 단일 소스로 두거나 `bin/build-manifests.mjs`로 생성.
