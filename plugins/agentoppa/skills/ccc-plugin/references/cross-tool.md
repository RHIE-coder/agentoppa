# 공통 vs 도구별 — Claude Code ↔ Codex (플러그인 패키징)

[`SKILL.md`](../SKILL.md) 동반 문서. **컴포넌트는 공유, 매니페스트·마켓만 도구별.**

## 1. 핵심 분기

| 측면 | Claude Code | Codex |
|---|---|---|
| 매니페스트 | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` |
| 컴포넌트 발견 | 자동(기본 디렉토리) | **포인터 필수** |
| 마켓플레이스 | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` (+legacy(= 구버전 호환) `.claude-plugin/`) |
| 마켓 `source` | 문자열/`github`/`url`/`git-subdir`/`npm` | `{source:"local"\|"git-subdir", ...}` + `policy{}` |
| 전용 매니페스트 키 | `commands`·`outputStyles`·`lspServers`·`userConfig`·`channels` | `apps`·`interface{}` |
| 경로 변수 | `${CLAUDE_PLUGIN_ROOT}`·`${CLAUDE_PLUGIN_DATA}` | `${PLUGIN_ROOT}`·`${PLUGIN_DATA}` (`${CLAUDE_PLUGIN_ROOT}` 별칭) |
| 검증 CLI | `claude plugin validate` | (문서화 안 됨) |

## 2. 단일 소스 동기화 (드리프트 방지)

두 매니페스트가 공유하는 메타(name·version·description·author·license·keywords)는 **한 곳에서 정하고 양쪽에 같게** 쓴다:

- **최소:** 검증기로 드리프트(= 두 매니페스트가 따로 고쳐져 서로 어긋남)를 막는다 — `validate.mjs`가 name 불일치=error, version/description 불일치=warn.
- **권장:** 생성 스크립트(`bin/build-manifests.mjs`)로 *공통 메타 + 컴포넌트 스캔 → 두 매니페스트 생성*. Codex쪽은 존재하는 컴포넌트에 포인터를 자동 부여, Claude쪽은 메타만. ccc-agents의 `build-agents.mjs`와 같은 빌드 브리지(= 한 소스에서 도구별 산출물을 미리 찍어 내는 생성 단계) 철학(돌릴 때 공유하는 파일이 없으니, 빌드할 때 미리 두 벌로 푼다).

## 3. 경로 변수

스크립트/훅 경로는 **`${CLAUDE_PLUGIN_ROOT}`로 쓰면 양쪽에서 동작**한다(Codex가 별칭 지원). Codex 네이티브 `${PLUGIN_ROOT}`만 쓰면 Claude에서 안 풀린다 → 크로스툴은 `${CLAUDE_PLUGIN_ROOT}` 권장.

## 4. 패키징 철학 (AgentOppa)

- **교집합(skills/hooks/agents/MCP)은 한 트리에 공유, 매니페스트·마켓만 도구별 어댑터.** 이게 AgentOppa 전체를 관통하는 원칙이고, ccc-plugin은 그걸 가장 바깥에서 감싸는 마지막 포장 단계다.
- 컴포넌트 작성은 각 ccc-* 스킬이, 그것들을 양쪽에 싣는 일은 ccc-plugin이 한다.
- 매니페스트만 도구별로 두면 되는 이유: 컴포넌트 포맷 자체가 이미 각 ccc-* 스킬에서 크로스툴로 정리됨(skills=공유 `SKILL.md`, hooks=공유 `hooks.json`, agents=빌드 브리지).

## 출처

- Claude Plugins — https://code.claude.com/docs/en/plugins · Reference — https://code.claude.com/docs/en/plugins-reference
- Codex Plugins — https://developers.openai.com/codex/plugins · Build — https://developers.openai.com/codex/plugins/build
