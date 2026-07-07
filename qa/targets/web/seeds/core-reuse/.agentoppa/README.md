# demo-core — 재사용 Core (`.agentoppa/`)

> demo-core Core (AgentOppa 빌드).
>
> 이 폴더는 **재사용 Core**다 — 워크플로우(단계 흐름·게이트) + 범용 스킬 + 훅 + 인터페이스(빈자리)를 자체완결로 담는다.
> AgentOppa(Maker)가 이 프로젝트의 `.harness/demo-core/`(의도·바인딩·값)를 읽어 결정적으로 빌드한 산출물이다.
> 프로젝트 값을 본문에 안 박는 게 재사용의 비결 — 값-빈자리는 빌드 때 박히고, 능력-빈자리(`{cap:}`)는
> 실행 시 `.harness/demo-core/config.yaml`의 `bindings`/`impl`에서 읽힌다. 그래서 같은 Core를 여러 프로젝트가 *가리켜* 쓴다.

## 폴더 구조

```
.agentoppa/
├── .claude-plugin/marketplace.json   # Claude 마켓 (source: ./plugins/demo-core)
├── .agents/plugins/marketplace.json  # Codex 마켓 (source.path: ./plugins/demo-core)
└── plugins/demo-core/
    ├── .claude-plugin/plugin.json     # Claude 메타 (컴포넌트 자동발견)
    ├── .codex-plugin/plugin.json      # Codex 메타 + 컴포넌트 포인터
    ├── skills/<phase>/SKILL.md         # 워크플로우 단계 스킬
    ├── agents/<name>.md (+.toml)       # 보조 에이전트 (있으면)
    ├── hooks/hooks.json (+.mjs)        # strict 게이트 훅 (있으면)
    └── always-on.md                    # 행동 규칙 (루트 CLAUDE.md/AGENTS.md 가 import)
```

## 적재 = 가리키기 (by-reference)

도구가 읽는 `.claude`/`.codex`는 이 Core의 *사본이 아니라 얇은 포인터*다. 아래 중 하나로 이 Core를 물린다:

- **Claude (그때그때):** `claude --plugin-dir ./plugins/demo-core`
- **Claude (커밋해 항상):** `.claude/settings.json`에 이 마켓/플러그인을 등록(프로젝트에 커밋 → 팀 공유).
- **Codex:** 루트 `.agents/plugins/marketplace.json`을 자동 감지 → `installation: AVAILABLE`이라 설치 후 사용.

## Fallback — 플러그인 없이 떠도 행동 가드 생존

이 프로젝트 루트의 `CLAUDE.md`/`AGENTS.md`가 `plugins/demo-core/always-on.md`를 import한다.
그래서 `--plugin-dir` 없이 떠도 *행동 규칙*은 살아 있다(규칙만 — 단계 스킬·게이트 같은 실행 부품은 위 적재가 필요).

## 배포 옵션

- **이식:** 이 `.agentoppa/` 폴더는 자체완결이라 통째로 다른 repo에 복사하거나 github에 올려 여러 프로젝트가 가리킬 수 있다.
- **재빌드:** `.harness/demo-core/`(의도·값·바인딩)를 고친 뒤 `node <agentoppa>/plugins/agentoppa/bin/build-skills.mjs <project-root> demo-core`로 다시 빌드(멱등 — 같은 입력→같은 산출).

---

*손으로 고치지 마라 — 이 폴더는 `.harness/demo-core/`에서 결정적으로 빌드된 산출물이다. 바꿀 게 있으면 `.harness/demo-core/`를 고치고 재빌드한다.*
