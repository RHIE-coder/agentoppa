# demo — 재사용 Core (`.agentoppa/`)

> demo Core (AgentOppa 빌드).
>
> 이 폴더는 **재사용 Core**다 — 워크플로우(단계 흐름·게이트) + 범용 스킬 + 훅 + 인터페이스(빈자리)를 자체완결로 담는다.
> AgentOppa(Maker)가 이 프로젝트의 `.harness/demo/`(의도·바인딩·값)를 읽어 결정적으로 빌드한 산출물이다.
> 프로젝트 값을 본문에 안 박는 게 재사용의 비결 — 값-빈자리도 능력-빈자리(`{cap:}`)도 실행 시
> `.harness/demo/config.yaml`(`values:` / `bindings:`·`impl:`)에서 읽힌다. 그래서 같은 Core를 여러 프로젝트가 *가리켜* 쓴다.

## 폴더 구조

```
.agentoppa/
├── .claude-plugin/marketplace.json   # Claude 마켓 (source: ./plugins/demo)
├── .agents/plugins/marketplace.json  # Codex 마켓 (source.path: ./plugins/demo)
└── plugins/demo/
    ├── .claude-plugin/plugin.json     # Claude 메타 (컴포넌트 자동발견)
    ├── .codex-plugin/plugin.json      # Codex 메타 + 컴포넌트 포인터
    ├── skills/<phase>/SKILL.md         # 워크플로우 단계 스킬
    ├── skills/setup/                   # 셋업 스킬 + scaffold.mjs (소비 프로젝트 .harness 자급)
    ├── phases/<name>.md                # 단계 소스(슬롯 미치환 — core: 로 가리켜 재사용하는 단일본)
    ├── interface.json                  # 이 Core 가 선언한 빈자리 명세 (setup 이 읽음)
    ├── agents/<name>.md (+.toml)       # 보조 에이전트 (있으면)
    ├── hooks/hooks.json (+.mjs)        # 훅 (project/hooks/ 저작분 그대로, 없으면 기본 게이트 — 있으면)
    └── always-on.md                    # 행동 규칙 (루트 CLAUDE.md/AGENTS.md 가 import)
```

## 적재 = 가리키기 (by-reference)

도구가 읽는 `.claude`/`.codex`는 이 Core의 *사본이 아니라 얇은 포인터*다. 아래 중 하나로 이 Core를 물린다:

- **Claude (그때그때):** `claude --plugin-dir ./.agentoppa/plugins/demo`
- **Claude (커밋해 항상):** `.claude/settings.json`에 이 마켓/플러그인을 등록(프로젝트에 커밋 → 팀 공유).
- **Codex:** 루트 `.agents/plugins/marketplace.json`을 자동 감지 → `installation: AVAILABLE`이라 설치 후 사용.

## 새 프로젝트에 붙이기 (setup — AgentOppa 없이)

이 Core를 적재한 뒤(위), 이 프로젝트의 `.harness/demo/config.yaml`을 깐다 — **AgentOppa 없이 이 플러그인만으로.** 이 Core가 든 `setup` 스킬에게 *"이 하네스 붙여줘"* 라고 **명시로 요청**할 때만 깐다(일반 구현 요청만으로 하네스 설정을 만들지 않는다). 또는 헬퍼를 직접 돌린다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scaffold.mjs"
```

→ `.harness/demo/config.yaml` 골격을 만들고 채울 빈자리 — 값(`values`)과 능력(`bindings`) — 을 알려 준다. 그 자리를 이 프로젝트 것으로 채우면(예: `test_command: "npm test"` · `test-runner: "npx playwright test"`) 끝 — 단계 스킬이 실행될 때 그 값을 읽어 동작한다.

## 활성 하네스 선택 (`.harness-main`)

한 프로젝트에 여러 하네스가 `.harness/<이름>/` 로 공존할 수 있지만, **실행되는 건 항상 1개다.** 루트의 `.harness-main`(gitignore 대상) 파일에 하네스 이름 하나만 적으면 그게 활성 하네스다 — 예: `demo`. `HARNESS_MAIN` 환경변수가 있으면 그게 `.harness-main` 보다 우선한다.

- 이 하네스의 훅·단계는 활성 하네스가 `demo` 일 때만 작동한다(아니면 조용히 빠짐 — 동시에 여러 하네스가 커밋을 막지 않는다).
- `.harness-main` 이 없으면 이 하네스의 훅은 아무 파일도 만들거나 커밋을 막지 않는다.
- `.harness-main` 에 적힌 이름의 폴더·config가 없으면 "활성 하네스 설정 없음"으로 멈춘다.
- `setup` 은 이 하네스를 처음 붙일 때 `.harness-main` 이 비어 있으면 `demo` 로 채워 활성화한다(다른 하네스가 이미 활성이면 덮지 않고 알려 준다).

## Fallback — 플러그인 없이 떠도 행동 가드 생존

이 프로젝트 루트의 `CLAUDE.md`/`AGENTS.md`가 `plugins/demo/always-on.md`를 import한다.
그래서 `--plugin-dir` 없이 떠도 *행동 규칙*은 살아 있다(규칙만 — 단계 스킬·게이트 같은 실행 부품은 위 적재가 필요).

## 배포 옵션

- **이식:** 이 `.agentoppa/` 폴더는 자체완결이라 통째로 다른 repo에 복사하거나 github에 올려 여러 프로젝트가 가리킬 수 있다.
- **재빌드:** `.harness/demo/`(의도·값·바인딩)를 고친 뒤 `node <agentoppa>/plugins/agentoppa/bin/build-skills.mjs <project-root> demo`로 다시 빌드(멱등 — 같은 입력→같은 산출).

---

*손으로 고치지 마라 — 이 폴더는 `.harness/demo/`에서 결정적으로 빌드된 산출물이다. 바꿀 게 있으면 `.harness/demo/`를 고치고 재빌드한다.*
