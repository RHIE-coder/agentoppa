# AgentOppa 아키텍처 (개념 가이드)

> 이 문서 = AgentOppa의 **개념 모델**(왜·무엇). 같은 설명을 두 번 안 하려고 한 번에 적는다.
> 정밀 스펙은 스킬별 `references/`, 늘 지킬 규칙은 `AGENTS.md`, 실행법은 `README.md`. (무엇이 언제 됐나(히스토리)는 git 로그·`.agentoppa/hardening-log.md`.)

## 1. 한 줄 — AgentOppa = Maker

안 돌린다, **만든다.** Claude Code·Codex 양쪽에서, 어느 OS에서든 똑같이 도는 **하네스**(harness = 에이전트가 작업을 확실히 해내게 잡아주는 골격)를 짓는 공장.
→ 컴파일러·`create-react-app` 류. **런타임 프레임워크(React 같은)가 아니다.**

## 2. 무엇을 만드나 — Core(재사용 프레임워크) + Project(구현)

AgentOppa(Maker)는 **아무것도 안 싣는다.** 유저가 Maker로 **자기만의 재사용 하네스 프레임워크**를 만들고, 여러 프로젝트가 그걸 *가리켜서* 쓴다. 한 유저 프로젝트는 이렇게 생긴다:

```
유저 프로젝트/
├── .agentoppa/             ← Core Layer = 재사용 프레임워크 (유저가 만들고 소유 · 이식 가능)
│   ├── .claude-plugin/ .agents/   ·  두 마켓 (AgentOppa 자신과 같은 패키징 → github·복붙)
│   └── plugins/<core>/            ·  워크플로우(단계 흐름·게이트) + 범용 스킬·훅 + 인터페이스(빈자리) + 검사기
├── .harness-main           ← 활성 하네스 하나를 지정 (gitignore 대상; 환경변수 HARNESS_MAIN이 우선)
├── .harness/<하네스>/       ← Project Layer = 이 프로젝트의 구현·바인딩 (하네스 이름별 네임스페이스)
│   ├── intent.md                  ·  이 프로젝트 의도
│   ├── config.yaml                ·  core: 어떤 Core + bindings(능력→구현) + values
│   └── project/                   ·  구현 모듈(예: playwright) · 이 프로젝트 보조 에이전트
├── CLAUDE.md · AGENTS.md   ← Core 규칙 import (fallback: 플러그인 없이 떠도 행동 가드 생존)
└── .claude/ .codex/        ← 얇은 포인터 (`.agentoppa/`의 Core를 가리켜 적재 · Core 사본 아님)
```
*(Core 내부·`.harness/<하네스>/` 세부 배치는 `agent-engineer` 스킬과 `build-skills.mjs`에 구현돼 있다.)*

**단일 활성 하네스:** 한 프로젝트에 여러 하네스가 `.harness/<하네스>/`로 공존해도 도는 건 늘 하나다. 루트 `.harness-main`(gitignore 대상 · 이름 하나만 적음)이 활성 하네스를 정한다 — 환경변수 `HARNESS_MAIN`이 있으면 그게 우선. 훅은 자기가 활성일 때만 작동하고(아니면 조용히 빠짐), `.harness-main`이 없으면 하네스 훅은 아무것도 막지 않는다.

**왜 두 층인가 — 재사용의 비결은 "값을 안 박는 것":**
- **Core**는 프로젝트 값(`{test_command}`·`{e2e-runner}`)을 *굳히지 않는다.* 단계가 `requires:[e2e-runner]`로 **빈자리**만 선언하고, 그 값은 **실행 시점에 `.harness/<하네스>/`에서 읽는다**(상주 실행기가 아니라 스킬이 제 설정파일을 읽는 것 — §3과 무관). 그래서 Core는 web·mobile·go 어디든 통째로 옮겨도 돈다.
- **Project**는 그 빈자리를 *이 프로젝트 구현*으로 채운다 — `bindings:{e2e-runner: playwright}` + 구현 모듈. 프로젝트 차이는 전부 여기에만. (미바인딩 빈자리는 Core 검사기가 error로.)

**도구는 어떻게 적재하나 — 가리키기(by-reference):**
- 도구가 실제로 읽는 `.claude`/`.codex`는 **Core 사본이 아니라 얇은 포인터**다. 적재 메뉴: `--plugin-dir` · marketplace install · 커밋한 `.claude/settings.json`(Claude) · 마켓 자동감지(Codex). 정확한 포인터 배선(특히 Codex)은 빌드 단계에서 확정. → `.agentoppa/`의 Core는 한 벌로 깨끗이 남고(복제 없음) 이식이 공짜.
- **소비 프로젝트 자급(설치만 · AgentOppa 없이):** 빌드된 Core는 `interface.json`(빈자리 명세) + `setup` 스킬을 함께 싣는다. 남이 그 Core를 설치하면 `setup`이 `.harness/<하네스>/config.yaml`을 *스스로 깔고* 능력 빈자리를 노출 → 소비자는 `bindings`만 채운다. **AgentOppa는 Core를 *만들* 때만 필요(= 컴파일러).** Core가 바뀌어 빈자리가 늘면 `setup` 재실행이 빠진 자리를 알린다(= 자동 전파).
- **Fallback:** 프로젝트의 `CLAUDE.md`/`AGENTS.md`가 Core의 *규칙*을 import → 플러그인을 안 실어도 행동 가드는 산다(**규칙만**; 단계 스킬·게이트 같은 실행 부품은 플러그인 적재가 필요). = 이 repo가 자기한테 쓰는 always-on 브리지 패턴(§7)을 생성물에도.

> ⚠ **이름 주의:** **Maker**(이 repo · 공장 — ccc-* 부품으로 *짓는 능력*) ≠ **Core**(유저가 *만든* 재사용 프레임워크). AgentOppa는 Core를 짓지만 Core를 *싣지는* 않는다.

## 3. 런타임 엔진 안 둔다 (핵심 베팅)

단계 사이 상태 = **커밋된 문서**. 전용 실행기를 안 만든다.
→ resume·병렬·크로스툴이 공짜. 생성물이 도구 네이티브라 독립.

- **허용:** 검사 러너 — 돌고 끝나는 validate (린터·테스트 류).
- **금지:** 워크플로우를 *상주하며 굴리는* 실행기 (HUD(= 늘 떠 있는 상태판)·워커팬·auto-resume류).
- 그게 선이다.

## 4. 부품 공장 — ccc-* 패밀리 + 생성기

- **ccc-skills / memory / agents / hooks / plugin** (`ccc` = create-claude-codex) — "에이전트가 X를 확실히" 한 종류씩(스킬·메모리·에이전트·훅·패키징).
- **agent-engineer** — 그 부품으로 하네스를 면담→조립 (Maker 본체).
- **intent-interview** — 짓기 전 의도를 ~95%까지 확정.
- **self-harden** — 정정을 영구 가드로 (아래).

## 5. self-harden — 쓸수록 단단해짐

정정 한 번 → *같은 종류 전체*를 막는 **영구 가드**. 강하고 싼 것부터:
`검사기 > 훅 > 리뷰어 > Gate > 문서 > 항상 켜진 규칙`.

핵심: **LLM이 똑똑해지는 게 아니라 환경(repo)이 단단해진다.** project-committed(= repo에 커밋돼 함께 굴러감)라 다음 세션·도구·사람이 그 가드를 물려받는다. (정정이 날 때마다 도는 루프 — 정해진 단계 순서를 따르지 않고 아무 때나 끼어든다.)

## 6. 어디에 무엇이 사나 (문서 지도)

같은 걸 두 번 설명 안 하려면 — 지식은 자리마다:

| 자리 | 무엇 |
|---|---|
| `README.md` | 첫 화면(소개·설치) + 실행법 |
| `ARCHITECTURE.md` (이 문서) | 개념 모델 (왜·무엇) |
| `AGENTS.md` | 늘 지킬 횡단 불변식 |
| 스킬별 `references/` | **정밀 스펙** — 스키마·계약·옵션 의미 (가장 깊은 detail) |
| 스킬별 `examples/` | 워크드 견본 |
| git 로그 · `.agentoppa/hardening-log.md` | 무엇이 언제·왜 됐나 (히스토리) |

3층 점진 로딩(ccc-skills): `SKILL.md`(짧은 입구) → `references/`(상세) → `examples/`(견본).

## 7. 이 저장소가 자기 도구를 직접 쓴다 (이 repo 자신)

- **실행:** `claude --plugin-dir ./plugins/agentoppa` 로 자기 플러그인 물려 `/self-harden` 등 사용 (→ README "이 저장소에서 직접 실행하기").
- **검사:** `npm test` (validator를 red/green fixture에 물림).
- **메모리:** `AGENTS.md` (= ccc-memory: project-committed > 세션 메모리).

---

> 무엇이 언제·왜 바뀌었는지(히스토리)는 git 로그와 `.agentoppa/hardening-log.md`에. 이 문서는 *모델(왜·무엇)*이다.
