# qa/ — AgentOppa 라이브 e2e(= 처음부터 끝까지 전체 흐름을 돌려보는 테스트) QA (상시·in-repo·격리)

> AgentOppa가 *만든* 재사용 Core 하네스가 진짜 도는지 증명하는 **상시 QA 타깃**. 검사기 red/green 픽스처(`.agentoppa/fixtures/`, 초소형)와 달리, 여기엔 하네스가 *물고 도는 진짜 미니 프로젝트*(시드)가 산다.
>
> 모델(P0 잠금): 유저 프로젝트 = **Project(`.harness/<하네스>/`: intent + config{core·bindings·values} + 구현)** + **재사용 Core(`.agentoppa/`: 마켓 2개 + `plugins/<core>/` 워크플로우·스킬·훅)**. 도구는 `.claude`/`.codex` 얇은 포인터로 Core 를 *가리켜* 적재. 빌드 = `plugins/agentoppa/bin/build-skills.mjs` (Project → Core 묶음).

## 이게 뭔가 / 뭐가 아닌가

- **대상(test subject)이다** — 프레임워크도 `examples/`도 아니다. 컴파일러 repo가 테스트용 샘플 프로그램을 싣는 것과 같다.
- **한방향 의존:** 엔진(`plugins/agentoppa/`)은 이 트리를 **절대 참조하지 않는다.** 이 트리를 통째로 지워도 프레임워크는 멀쩡해야 한다. → `check-no-qa-ref` + `npm test`가 기계 강제.
- **반대 방향(qa→plugins)** 은 허용(샘플→프레임워크)이나, `run.mjs`는 결합을 줄이려 자족적으로 둔다(자체 frontmatter(= 문서 맨 위 `---` 사이에 적는 기계용 메타데이터) 파서).

## 구조

```
qa/
├── README.md                 이 문서
├── run.mjs                   시나리오 러너 (zero-dep(= 외부 패키지 의존 0) Node · 돌고 끝남 = 검사 러너, 상주 실행기 아님)
├── targets/web/
│   ├── seeds/                커밋된 *시작상태* 픽스처 (pristine · 최소 · 읽기전용 입력)
│   │   ├── greenfield/         거의 빈 진짜 web (/health) — [case1]
│   │   ├── brownfield-bare/    개발된 web: login/signup/profile/board, 하네스 없음 — [case2 등]
│   │   ├── brownfield-foreign/ brownfield-bare + 남이 만든 외래 하네스(.myflow) — [case3a]
│   │   ├── brownfield-oppa/    brownfield-bare + AgentOppa 생성 하네스(.harness + .agentoppa) — [case3b·lc*]
│   │   └── core-reuse/         같은 재사용 Core 를 두 프로젝트가 다른 구현으로 바인딩 — [vp1] (자족형)
│   └── cases/<id>/case.md    케이스별 명세 + 판정 (frontmatter = 기계 데이터)
├── .work/    (gitignored)    실제 실행 scratch — seed 복사본 + 자체 .git(diff 판정용)
└── results/  (gitignored)    run 리포트 + 프로파일러 실측(🧠/🙋/⚙️)
```

## 시드 사전 — 시작 상태별 픽스처

"시드(seed = 케이스가 시작하는 프로젝트 상태)"를 러너가 scratch로 복사해 그 위에서 AgentOppa를 돌린다.

| 시드 | 평문 뜻 | 코드/하네스 | 상태 |
|---|---|---|---|
| `greenfield` | 빈 새 프로젝트 | 코드 거의 없음 · 하네스 없음 | 있음 (`/health` 하나) |
| `brownfield-bare` | 이미 개발된 프로젝트 | 코드 있음 · 하네스 없음 | 있음 (login/signup/profile/board) |
| `brownfield-foreign` | 개발됨 + *남이 만든* 하네스 | 코드 있음 · 외래 하네스(`.myflow`) | 있음 |
| `brownfield-oppa` | 개발됨 + *AgentOppa가 만든* 하네스 | 코드 있음 · Project(`.harness`) + Core(`.agentoppa`) | 있음 |
| `core-reuse` | 같은 Core, 두 프로젝트 다른 바인딩 | 코드 없음 · Core 1 + Project 3(2 green·1 음성) | 있음 (자족형) |

> greenfield(빈 땅) ↔ brownfield(이미 지은 땅)는 업계 표준어. bare=하네스 없음 · foreign=남의 하네스 · oppa=우리 하네스. core-reuse=재사용 증명 전용(코드 없는 구조 픽스처).

## 케이스 사전 — 12개가 뭔지 (ID 읽는 법: 앞=축, 뒤=순번)

| ID | 평문 이름 | 무엇을 증명하나 | 시드 |
|---|---|---|---|
| **case1**-greenfield | 빈 프로젝트에 셋업→첫 기능 | 맨바닥에서 면담→생성→실행이 한 바퀴 도나 | greenfield |
| **case2**-fitting | 개발된 프로젝트에 셋업·피팅 | 기존 컨벤션에 맞춰지고 원본 안 깨지나 | brownfield-bare |
| **case3a**-foreign | 남의 하네스와 공존 | *다른* 하네스를 안 덮어쓰고 같이 사나 | brownfield-foreign |
| **case3b**-idempotent | 자기 하네스 위 재실행 | 자기가 만든 하네스를 알아보고 안 부수나 | brownfield-oppa |
| **op1**-feature-run | 기능 하나를 끝까지 (op=운영) | 설치 말고 *실제로 기능을 단계 밟아 완성*하나 | brownfield-bare |
| **xt1**-crosstool | 양쪽 도구에서 (xt=크로스툴) | 같은 하네스가 Claude·Codex 둘 다 도나 | brownfield-bare |
| **lc1**-idempotency | 멱등 재생성 (lc=생애주기) | 의도 안 바꾸고 다시 만들면 결과 그대로(변경 0) | brownfield-oppa |
| **lc2**-intent-change | 의도 변경 반영 | 의도 바꾼 만큼만 바뀌고 손댄 건 보존되나 | brownfield-oppa |
| **lc3**-removal | 하네스 제거 | 떼어내면 프로젝트 원본 멀쩡하나 | brownfield-oppa |
| **rb1**-resume | 중단→재개 (rb=견고성) | 중간에 끊겨도 커밋된 문서에서 이어지나 | brownfield-bare |
| **rb2**-bad-intent | 나쁜 의도 게이팅 | 모순된 요구는 "준비됨"으로 안 넘기고 막나 | brownfield-bare |
| **vp1**-core-reuse | 같은 Core, 다른 바인딩 (vp=비전증명) | *재사용 Core = 워크플로우 동일, 구현만 다름*을 증명 | core-reuse |

> 축 약어: **case**=도입(adoption) · **op**=운영(operation) · **xt**=크로스툴(cross-tool) · **lc**=생애주기(lifecycle) · **rb**=견고성(robustness) · **vp**=비전증명(vision-proof). 절차·판정 상세는 각 `cases/<id>/case.md`.

## 검증 모델 — 왜 이 테스트들이 유효한가 (근거)

"유효하다" = **틀렸을 때 실제로 빨강이 뜬다.** 그래서 5원칙 위에 세웠다:

1. **반증 가능(falsifiable).** 모든 판정엔 "이러면 실패"가 박혀 있다(각 `case.md`의 *fail*). 절대 실패 못 하는 검사는 검사가 아니다(항상 통과 = 무의미).
2. **사람/AI 느낌이 아니라 기계가 떨어뜨린다.**
   - `git diff = ∅` → "원본 안 건드림"의 *바이트 단위 사실*. 한 글자만 바뀌어도 diff에 뜬다 — "안 건든 것 같다"가 아니다.
   - 합격테스트 **exit code** → "기능이 진짜 돈다"의 사실. 빨강이면 실패, 내 판단이 안 들어간다.
   - 멱등(재생성 diff=∅) → "두 번 돌려도 같다"의 사실.
3. **깨끗한 기준점(baseline).** 시드를 scratch에 복사하고 git baseline을 찍으니, 그 뒤 모든 변화는 "AgentOppa가 한 일"로 귀속된다. 대조군이 있어야 "무엇이 바뀌었나"가 분명하다.
4. **주관(가치)을 객관으로 환원.** "하네스가 좋은가"(L4)는 주관이라 내가 판단 못 한다 → 대신 "기능 합격테스트가 통과하나"라는 *실행가능 기준*으로 바꿔 기계가 판정. 이게 이 QA의 핵심 트릭.
5. **거짓 green 금지(정직).** n=1은 신호지 통계 증명이 아니다. 판정 *로직*은 다 기계화돼 있고(red/green), 다만 일부는 라이브 산출 *수집*을 세션이 몰아야 완성된다(예: `resume_equivalent` 의 무중단·재개 2-run) — 러너는 판정만 하지 "전자동"인 척 안 한다.

> 한 줄: **바꾸면 안 되는 건 `git diff`로, 돌아야 하는 건 테스트 exit code로** 떨어뜨려 판정에서 주관을 최대한 빼냈다.

## 쓰는 법

```bash
node qa/run.mjs list                 # 케이스 + 판정 목록
node qa/run.mjs setup <caseId>       # seed → .work/<id> 복사 + git baseline 커밋
#  → .work/<id> 에서 agent 단계를 몬다 (면담/생성/실행):
#     cd qa/.work/<id> && claude --plugin-dir <repo>/plugins/agentoppa ...   (또는 codex)
node qa/run.mjs judge <caseId>       # 사후 판정 (diff·합격테스트·존재 등) — exit≠0 이면 fail
```

### 정직한 자동화 경계

러너가 **보장하는 것**: 셋업(seed→scratch+baseline)과 *사후* 기계 판정. **agent 단계(면담/생성/실행)** 는 대화형/헤드리스 세션이 따로 몬다 — 첫 바퀴는 손으로 몰 수도 있다. "전자동 버튼"은 과대선언이라 두지 않는다.
예외: `vp1`(비전 증명)은 시드 자체가 완성된 두 바인딩이라 **agent 단계 없이** 셋업 직후 바로 judge — 자족형.

기계화된 판정(JUDGES): `harness_present` · `project_unchanged` · `compiled_idempotent` · `acceptance` · `fits_existing_runner` · `foreign_harness_preserved` · `interview_gated` · `contract` · `source_edits_preserved` · `intent_reflected` · `core_reuse` · `unbound_errors` · `resume_equivalent`.
`resume_equivalent` 는 *판정 로직*이 기계화됨 — 중단본 vs 무중단본의 **역할 집합·인계 순서·유효 헤더** 구조 동등(`checks/lib/resume.mjs`, red/green 픽스처로 검증). 내용 텍스트는 안 본다(LLM 생성이라 매번 다름 — "같은 단계를 같은 순서로 이었나"가 핵심). 라이브 2-run *수집*(무중단본 `.harness/<하네스>/artifacts-baseline/` + 재개본 `.harness/<하네스>/artifacts/` 두 산출 뜨기)만 세션이 몬다 — "전자동 버튼"은 과대선언이라 안 둔다.
