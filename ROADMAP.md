# AgentOppa ROADMAP

> 세션은 죽어도 repo는 안 죽는다. 계획은 *세션 메모*가 아니라 **여기** 산다 — 다음 세션(누구든)이 읽고 잇는다. 우리가 설파하는 ccc-memory(project-committed > 세션 메모리)를 자기 약 먹기(dogfood). *(2026-06-23 재설계 합의 기준 · 2026-06-25 용어 정리.)*

## 한눈에 — 지금 어디

- **토대 + 모델 전환 완료.** Maker 모델(`agent-engineer` + `intent-interview`) 라이브, 검사 러너 `npm test` **green**, 워킹트리 clean.
- **단, 라이브 end-to-end는 아직 0회.** 전부 *정적*으로만 green이다 — 실제 프로젝트에 하네스를 깔고 면담→생성→**실행**해 본 적이 없다. ← **이게 다음 최대 과제.**

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

### 1. 실전 도입 — 라이브 end-to-end  🔑 최우선
실제 프로젝트 하나를 정해 하네스를 깔고(또는 기존 것 **마이그레이션**), 그 프로젝트의 스택·구조를 파악한 뒤 **면담 → 생성 → 실행**까지 한 바퀴 돌린다.

- **막힌 지점 (유저 결정):** *어느 프로젝트인가.* — 내가 못 정한다.
- **왜 최우선:** 지금 전부 정적 green이지만 라이브 실행이 0회 → 프레임워크 주장이 미증명. 이 한 바퀴가 generate+run을 처음으로 행사한다.
- **곁들여 — 하네스 프로파일러:** AgentOppa가 만든 하네스가 타당한지·병목·비용·개선점을 데이터로 보여주는 도구. (정적 시제품을 만들었으나 *라이브로 돌 게 없는데 미리 만든 것*이라 제거 — 실전 도입 때 통째로 빌드. 라이브 실행이 있어야 데이터가 생기므로 #1과 한 묶음.) **재현 목표(예시 분석):** 한 세션 비용을 *실측* 분해 — 🧠모델 사고 / 🙋유저 대기 / ⚙️하네스 → 병목·개선점. 핵심은 가장 큰 레버가 흔히 워크플로우가 아니라 *사고 깊이·질문 왕복*이라, 정적 추정 말고 *측정*이라야 드러난다는 것. worked example: Rhaumos `ANALYZED.md`(구현 단계에서 참고 후 삭제 · 구현 방식은 그때).

### 2. 재사용 플러그인 빌드  (target 무관 · 지금 가능)
Core Layer(프로젝트 무관 재사용 배관)를 독립 플러그인으로 빌드·산출. Phase 1 완료로 선행조건은 풀렸다.

## 보류 (나중 재검토 · 안 잊으려 적어둠)
- **병렬**(git-workflow 프리셋) · **Mode B**(skillify — 생성된 하네스가 쓸수록 학습) — 지금 범위 밖.
- **self-harden 후속** — ① dangling-reference 검사기 → `plugins/agentoppa/bin/check-doc-refs.mjs`로 **착수**(링크형 dangling=error · repo밖 절대경로=warn · 커밋 문서 자기점검 포함). 남은 건 산문 속 맨 이름(판단 영역 → always-on "참조와 부재"가 담당). ② (선택) 출력 형식·순차판정의 *기계적* 강제(지금은 스킬 문서 가이드 수준).
