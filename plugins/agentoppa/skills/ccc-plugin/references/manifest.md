# 플러그인 매니페스트 · 마켓플레이스 스키마 (양쪽 전체 필드)

[`SKILL.md`](../SKILL.md) 동반 문서. `plugin.json` + `marketplace.json`의 Claude·Codex 필드와 발견 모델.

## 1. 발견 모델 (가장 중요)

- **Claude:** 컴포넌트를 **기본 디렉토리에서 자동 발견** — `skills/`·`agents/`·`hooks/`·`commands/`. 컴포넌트는 **플러그인 루트**에 둔다(`.claude-plugin/`엔 `plugin.json`만). 매니페스트는 메타만 있어도 동작.
- **Codex:** 자동 발견 없음 — **매니페스트가 컴포넌트를 명시 포인터로 가리켜야** 한다(`skills`/`hooks`/`mcpServers`/`apps`).

## 2. `plugin.json` — Claude (`.claude-plugin/plugin.json`)

- 필수: `name`.
- 메타: `displayName`, `version`, `description`, `author{name,email,url}`, `homepage`, `repository`, `license`, `keywords`, `defaultEnabled`, `$schema`.
- 컴포넌트 경로(비표준 위치일 때만; 기본은 자동발견): `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `outputStyles`, `lspServers`, `experimental.{themes,monitors}`.
- 기타: `userConfig`(설치 시 프롬프트할 값), `channels`, `dependencies`.
- 검증: `claude plugin validate [--strict]`. 스키마: `https://json.schemastore.org/claude-code-plugin-manifest.json`.

## 3. `plugin.json` — Codex (`.codex-plugin/plugin.json`)

- 필수: `name`(kebab-case = 소문자에 하이픈으로 잇기, 예: `my-plugin`), `version`(semver = `1.2.3` 식 세 자리 버전), `description`.
- 메타: `author{name,email,url}`, `homepage`, `repository`, `license`, `keywords`.
- 컴포넌트 포인터(`./`로 시작, **존재하면 반드시 명시**): `skills`(→디렉토리), `mcpServers`(→`.mcp.json`), `apps`(→`.app.json`), `hooks`(→hooks 파일).
- `interface{}`(UI 메타): `displayName`, `shortDescription`, `longDescription`, `developerName`, `category`, `capabilities`, `websiteURL`, `privacyPolicyURL`, `termsOfServiceURL`, `defaultPrompt[]`, `brandColor`, `composerIcon`, `logo`, `screenshots[]`.
- 검증 CLI는 문서화 안 됨(셀프서브 퍼블리싱 = 직접 올려 배포하기 "coming soon").

## 4. 교집합 / 도구 전용 매핑

| | 공통 | Claude 전용 | Codex 전용 |
|---|---|---|---|
| 메타 | name·version·description·author·homepage·repository·license·keywords | displayName·defaultEnabled·$schema | — |
| 컴포넌트 | skills·hooks·mcpServers | commands·agents·outputStyles·lspServers·userConfig·channels | apps·interface |

→ 공통은 두 매니페스트에 **동일**하게. 전용 키는 반대편에 넣지 말 것.

## 5. `marketplace.json` — Claude (`.claude-plugin/marketplace.json`)

- 필수: `name`, `owner{name(필수),email}`, `plugins[]`.
- 선택: `$schema`, `description`, `version`, `metadata.pluginRoot`, `allowCrossMarketplaceDependenciesOn`.
- `plugins[]` 항목: `name`(필수) + `source`(필수) + 매니페스트 필드 + `category`·`tags`·`strict`·`defaultEnabled`.
- `source`: 상대경로 문자열 `"./path"` 또는 객체 — `github{repo,ref?,sha?}` · `url{url,ref?,sha?}` · `git-subdir{url,path,ref?,sha?}` · `npm{package,version?,registry?}`.

## 6. `marketplace.json` — Codex (`.agents/plugins/marketplace.json`)

- 위치: repo `$ROOT/.agents/plugins/marketplace.json`, 개인 `~/.agents/plugins/marketplace.json`, **legacy(= 구버전 호환)** `$ROOT/.claude-plugin/marketplace.json`(Codex가 폴백 = 없을 때 대신 읽음).
- 구조: `name`, `interface{displayName}`, `plugins[]`.
- `plugins[]` 항목: `name`, `source{source:"local"|"git-subdir", path | url/ref}`, `policy{installation, authentication}`, `category`.
- `policy.installation`: `AVAILABLE` · `INSTALLED_BY_DEFAULT` · `NOT_AVAILABLE`. `authentication`: 생략하거나 `ON_INSTALL` · `ON_USE`.
- CLI: `codex plugin marketplace add owner/repo [--ref <r>] [--sparse <path>]` · `list` · `upgrade` · `remove`.

> ⚠ **흔한 실수(라이브 e2e(= 처음부터 끝까지 전체 흐름을 돌려보는 테스트)에서 실제 발생):** Claude 마켓의 `owner{}` 를 codex 마켓에 베끼지 말 것 — codex 는 `name`+`interface` 를 쓰고 `policy` enum(= 정해진 값 목록 중 하나만 허용) 도 위 값만 받는다(`"explicit"`/`"none"` 등은 거부). `source.path` 는 `"."`(루트) 아니라 **`./plugins/<name>/` 서브디렉터리**여야 codex 가 발견한다(루트는 "No plugins found"). validator(`scripts/validate.mjs`)가 enum·name·layout 을 기계 강제.

## 출처

- Claude Plugins Reference — https://code.claude.com/docs/en/plugins-reference · Marketplaces — https://code.claude.com/docs/en/plugin-marketplaces
- Codex Plugins — https://developers.openai.com/codex/plugins · Build — https://developers.openai.com/codex/plugins/build
