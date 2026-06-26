# AgentOppa ROADMAP

> 세션은 죽어도 repo는 안 죽는다. 계획은 *세션 메모*가 아니라 **여기** 산다 — 다음 세션(누구든)이 읽고 잇는다. 우리가 설파하는 ccc-memory(project-committed > 세션 메모리)를 자기 약 먹기(dogfood). *(2026-06-23 재설계 합의 기준 · 2026-06-25 용어 정리.)*

## 한눈에 — 지금 어디

- **토대 + 모델 전환 완료.** Maker 모델(`agent-engineer` + `intent-interview`) 라이브, 검사 러너 `npm test` **green**, 워킹트리 clean.
- **QA 토대 깔림(web · `qa/`):** 시드(시작상태) + 시나리오 러너 + 11케이스 명세 + `plugins↛qa` 기계강제. *(2026-06-25 확정·구축.)*
- **단, 라이브 *실행*은 아직 0회.** scaffold만 완료 — 실제로 면담→생성→**실행**을 돌려 본 적은 없다. 첫 run(case1)이 다음 행동. ← **여기가 0→1.**

## 정체성 (확정)

**AgentOppa = Maker.** 안 돌린다, **만든다.** 산출물 = **Core Layer + Project Layer + Config** (SOURCE `.harness/` → COMPILED `.claude/`·`.codex/`).
→ 개념 모델 상세는 **`ARCHITECTURE.md`** (여기선 반복 안 함). 이 문서는 *현황·계획*만 담는다.

## 원칙·베팅 (확정)

- **런타임 엔진 안 둔다.** 단계 사이 상태 = 커밋된 문서. 전용 실행기 X → resume·병렬·크로스툴이 공짜. *(상세: ARCHITECTURE §3.)*
- **검사 러너는 허용** — 돌고 끝나는 validate(린터·테스트 류). *워크플로우를 상주하며 굴리는 실행기*와 구분하는 게 선.
- **기계가 읽는 데이터 → frontmatter**(스키마 검증), 산문은 본문.
- **dogfood = `--plugin-dir`** 로 로컬 플러그인 로드(`/self-harden` 등). Codex는 `.agents/plugins/marketplace.json` 자동 감지.
- **크로스툴 동일 품질 · zero-dep** — 모든 부품이 Claude·Codex 양쪽, 어느 OS에서든. 헬퍼는 Node 빌트인.

## 지금까지 (완료)

**토대**
- 검사 러너 `npm test`(red 실패·green 통과) 가동.
- 죽은 `harness.yaml` 제거 — AgentOppa는 self-harden 루프 + 검사 러너로 dogfood.
- `AGENTS.md` 중복 줄 정리(always-on 규칙이 커버), `README` 실행법, `ARCHITECTURE.md`(개념 가이드) 신설.

**레이아웃 + 모델 전환**
- 레이아웃 확정: SOURCE `.harness/`(`config.yaml` + `core/` + `project/phases/` + `artifacts/`) → COMPILED `.claude/`·`.codex/`, 둘 다 커밋. references·SKILL·template·examples에 반영.
- **frontmatter 스키마화** — phase·config의 기계 데이터를 frontmatter로 올리고, validator가 파싱·점검.
- **cookbook 제거** — Core는 *만드는 능력*(고정 메뉴 아님). `validate.mjs`를 탈-cookbook으로 재작성(pack 비의존, `.harness/` 기준).
- **Maker 모델 리프레임** — `agent-engineer` + `intent-interview`를 `.harness/`·`config.yaml`·frontmatter phase 기반으로.
- **self-harden 개선** — 키워드 주입 · 수단 순차판정 · 산출(범용)/로그 분리 · 7단계 출력. `always-on.md`에 "삭제·개명 완료 기준" 규칙 + `.agentoppa/hardening-log.md` 신설(첫 엔트리 = cookbook 사건).
- validator 3종(ccc-plugin · agent-engineer · intent-interview) red/green → **검사 러너 green**.
- 문서 4종(README · ARCHITECTURE · AGENTS · 이 파일) Maker 모델로 정렬.

## 다음 (남은 일 · 각각 독립)

### 1. 실전 도입 — 라이브 end-to-end  🔑 최우선  (web · in-repo QA `qa/`)
**확정:** 타깃 = web 서비스, **in-repo 상시 QA**(외부 경로 X — 상시 픽스처라 `git fetch` 한 방에 따라와야). 구조 = **시드(시작상태) + 시나리오 러너** — 케이스마다 앱을 복제하지 않고 시드 복사→scratch 실행→diff 판정. 구조 상세는 `qa/README.md`(여기선 반복 안 함).

**검증 모델(L0–L5):** `L4(가치)`는 내 판단이 아니라 *실행가능 합격기준*(테스트러너 exit code)으로 떨군다. 첫 0→1이 증명하는 건 *메커니즘*(L1–3 동작) + *비용 실측*(L5 — 프로파일러 첫 데이터는 op1에서) + *가치 첫 신호*뿐. **가치의 통계적 증명은 별개**(n=1은 신호 · 과대선언 금지).

**QA 매트릭스 (5축 · 11케이스)** — 명세·판정은 각 `qa/targets/web/cases/<id>/case.md`:

| 축 | 케이스 | fail 판정(예) |
|---|---|---|
| 도입 | case1-greenfield · case2-fitting · case3a-foreign · case3b-idempotent | 프로젝트 원본 `git diff`≠∅ / 중복 러너 추가 |
| 운영 | op1-feature-run | 문서 인계 contract 위반 / 합격테스트 red |
| 크로스툴 | xt1-crosstool | Claude·Codex 한쪽만 통과 → 핵심 주장 붕괴 |
| 생애 | lc1-idempotency · lc2-intent-change · lc3-removal | 재생성 COMPILED diff≠∅ / 수기편집 유실 / 제거 후 원본 변함 |
| 견고성 | rb1-resume · rb2-bad-intent | 커밋문서 재개 불가 / 차단 미해결 ready 핸드오프 |

**순서:** ① case1 + op1 + 한 도구(0→1) → ② xt1(크로스툴) → ③ 나머지 확장. **보류:** 병렬 · AgentOppa 자체 업그레이드→마이그레이션 · 멀티 웹스택(Next/Express/Django…).
**시드:** 브라운필드 = login/signup/profile/board (lean·zero-install·`node --test`) · 그린필드 = 최소(`/health`). *(브라운필드-foreign/-oppa 시드는 첫 generate 이후 파생 — 아직 없음.)*
**불변식 강제:** `plugins/ ↛ qa/` 한방향을 `check-no-qa-ref` + `npm test`로 기계강제 — `qa/` 통째로 빼도 프레임워크 멀쩡.

### 2. 재사용 플러그인 빌드  (target 무관 · 지금 가능)
Core Layer(프로젝트 무관 재사용 배관)를 독립 플러그인으로 빌드·산출. Phase 1 완료로 선행조건은 풀렸다.

## 보류 (나중 재검토 · 안 잊으려 적어둠)
- **병렬**(git-workflow 프리셋) · **Mode B**(skillify — 생성된 하네스가 쓸수록 학습) — 지금 범위 밖.
- **self-harden 후속** — ① dangling-reference 검사기 → `plugins/agentoppa/bin/check-doc-refs.mjs`로 **착수**(링크형 dangling=error · repo밖 절대경로=warn · 커밋 문서 자기점검 포함). 남은 건 산문 속 맨 이름(판단 영역 → always-on "참조와 부재"가 담당). ② (선택) 출력 형식·순차판정의 *기계적* 강제(지금은 스킬 문서 가이드 수준).
