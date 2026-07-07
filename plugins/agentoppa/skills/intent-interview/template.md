# template.md — 빈 의도 정리 골격 (복사용)

아래 코드블록을 `.harness/<하네스이름>/intent.md`로 복사해 `<…>`를 채운다. 채운 뒤 안내는 지운다. 양식·연결 규칙은 [references/handoff.md](references/handoff.md), 채우는 방법은 [references/method.md](references/method.md). 면담 수준([SKILL.md](SKILL.md) "면담 수준 고르기")에 따라 `level`과 *맨 아래 힌트 섹션 하나*를 고른다 — 나머지 섹션은 공통.

````markdown
---
phase:  intent-interview
status: draft            # 확신 판정 통과 + 막힌 것 없음이면 ready
inputs: []
level:  project          # framework(재사용 Core 짓기) | project(이 프로젝트). 없으면 project
---
# Intent: <한 줄 의도 요약>

## 목표
- <결과로 적는다. "되면 뭐가 달라지나">

## 범위
- 할 것(in): <…>
- 안 할 것(out): <명시적으로 안 할 것>

## 제약
- <도구·시간·기존 것·꼭/절대>

## 예시 / 반례
- 좋은 사례: <…>
- 싫은 사례: <…>

## 우선순위
1. <가장 중요>
2. <…>

## 내린 결정
- <질문> → <합의된 답> (<왜>)

## 미해결
- 차단: <없으면 "없음">
- 비차단: <나중으로 미뤄도 되는 것>

## 확신
- 필수 항목 구체 답: <예/아니오>
- 구체 예시 확보: <예/아니오>
- 결과 가르는 미지수 없음: <예/아니오>
- 마지막 되짚어 확인에 정정 없음: <예/아니오>
- 한 줄 테스트: <"만드는 사람이 진짜 원한 걸 만든다"에 자신 있나>

## 하네스 힌트        # level: project — 아래 둘 중 이 섹션 하나만 둔다
- 어떤 Core: <가리킬 기존 Core 이름 | 새로 지어야 함(→ 프레임워크 면담 먼저)>
- 빈자리→바인딩: <능력 → 이 프로젝트 구현 (예: e2e-runner → playwright)>
- 프로젝트 값·분야: <Core가 읽을 값 / 도메인>
- sync: <loose | medium | strict>
- routing(모델 등급): <budget | balanced | premium>
````

`level: framework`(재사용 Core 짓기)면 위 "하네스 힌트" 대신 아래를 둔다:

````markdown
## Core 설계 힌트       # level: framework
- 철학(강제할 규율): <이 흐름이 반드시 강제할 것 (예: 리뷰 없인 머지 금지)>
- 작업 단계 묶음 + sync: <기획·개발·리뷰·QA·병렬 등 + 게이트 세기>
- 인터페이스 빈자리(requires): <프로젝트마다 다를 값 → 빈자리로 뺄 후보 (예: e2e-runner·test-command)>
- 겨냥 프로젝트군: <web만? go도? 도메인 안 가림?>
````
