# 크로스툴 플러그인 빈 골격 (복사용)

규칙은 [`SKILL.md`](SKILL.md)와 [`references/`](references/)를 따른다. 핵심: **컴포넌트는 한 트리에 공유, 매니페스트·마켓만 도구별.** Claude는 자동발견, Codex는 포인터(= 컴포넌트가 어디 있는지 직접 적은 경로) 필수.

## 플러그인 트리

```text
<plugin>/
├── .claude-plugin/plugin.json    # Claude 매니페스트 (메타)
├── .codex-plugin/plugin.json     # Codex 매니페스트 (메타 + 컴포넌트 포인터)
├── skills/<name>/SKILL.md         # 공유 컴포넌트
├── hooks/hooks.json               # 공유
├── agents/<name>.md               # 공유 (Claude .md; Codex는 빌드된 .toml)
└── .mcp.json                      # 공유 (MCP 서버 = 외부 연결 표준)
```

## 1. `.claude-plugin/plugin.json` (메타 — 컴포넌트는 자동발견)

```json
{
  "name": "<plugin-name>",
  "version": "0.1.0",
  "description": "<한 줄 설명>"
}
```

> Claude는 `skills/`·`agents/`·`hooks/`를 자동 발견하므로 포인터가 불필요하다. 비표준 위치만 키로 지정.

## 2. `.codex-plugin/plugin.json` (메타 + 포인터 필수)

```json
{
  "name": "<plugin-name>",
  "version": "0.1.0",
  "description": "<한 줄 설명>",
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

> Codex는 자동발견을 안 하니 **존재하는 컴포넌트마다 포인터를 명시**한다(없는 건 빼라). 선택 `interface{ displayName, category, capabilities, defaultPrompt, brandColor, ... }`로 UI 메타. name/version/description은 §1과 **동일하게**.

## 3. `.claude-plugin/marketplace.json` (Claude 마켓 — repo 루트)

```json
{
  "name": "<marketplace>",
  "owner": { "name": "<owner>" },
  "plugins": [
    { "name": "<plugin-name>", "source": "./plugins/<plugin-name>", "description": "<한 줄>" }
  ]
}
```

> `source`는 상대경로 문자열 또는 객체(`github`/`url`/`git-subdir`/`npm`). `owner.name` 필수.

## 4. `.agents/plugins/marketplace.json` (Codex 마켓 — repo 루트)

```json
{
  "name": "<marketplace>",
  "plugins": [
    {
      "name": "<plugin-name>",
      "source": { "source": "local", "path": "./plugins/<plugin-name>" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

> `source.source`는 `local` 또는 `git-subdir`(`url`/`path`/`ref`). `policy.installation`: `AVAILABLE`·`INSTALLED_BY_DEFAULT`·`NOT_AVAILABLE`. `authentication`은 생략하거나 `ON_INSTALL`·`ON_USE`.
> ⚠ §3 Claude 마켓의 `owner{}` 를 여기 쓰지 말 것 — codex 는 `name`+`interface`. `source.path` 는 `./plugins/<name>/` 서브디렉터리(루트 `"."` 는 codex 가 "No plugins found"). (validator 가 강제.)

## 경로 변수 (스크립트/훅)

- 크로스툴: `${CLAUDE_PLUGIN_ROOT}` 사용 — Codex가 별칭으로 받는다. (Codex 네이티브는 `${PLUGIN_ROOT}`/`${PLUGIN_DATA}`.)

채운 뒤 `node scripts/validate.mjs <plugin-dir>` 로 두 매니페스트 일치·포인터를 점검한다.
