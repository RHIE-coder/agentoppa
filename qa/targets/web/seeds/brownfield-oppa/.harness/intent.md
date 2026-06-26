---
phase:  intent-interview
status: ready
inputs: []
---
# Intent: 이미 개발된 board-service에 기능을 *안전하게* 추가하는 하네스

## 목표
- 기존 board-service(회원가입/로그인/프로필/게시판)에 새 기능을 추가할 때, 명세→테스트우선구현→리뷰의 일관된 흐름으로 회귀를 막는다.
- "되면 뭐가 달라지나": 기능 요청 하나를 던지면 검증가능한 spec이 남고, 기존 `node --test` 위에 실패테스트→구현이 쌓이고, diff가 spec·보안·기존 컨벤션 기준으로 리뷰돼 review.md로 못박힌다. 사람이 매번 절차를 기억하지 않아도 된다.

## 범위
- 할 것(in): spec(명세) · tdd(실패테스트 후 구현, 기존 러너 재사용) · review(diff↔spec 대조 + 보조 리뷰어) 3단계 하네스. 기존 컨벤션(zero-dep, `node:http`, 인메모리, `test/*.test.mjs`)에 피팅.
- 안 할 것(out): 2번째 테스트 프레임워크 도입(vitest/jest 등) 금지 — 기존 `npm test`(=`node --test`) 재사용만. 기존 src/test 파일 수정·삭제 금지(추가만). 배포·CI 파이프라인·DB 도입은 범위 밖.

## 제약
- 런타임은 Node 빌트인만(zero-install). 하네스 헬퍼도 zero-dep `.mjs`(크로스OS).
- 테스트 러너는 기존 `node --test`를 그대로 쓴다 (`values.test_command: "node --test"`).
- 크로스툴 동일 품질: Claude·Codex 양쪽에서 같은 phase가 돈다.
- 기존 파일 무손상: 하네스는 `.harness/`·`.claude/`·`.codex/` 등 *새 경로만* 추가한다. 원본 `src/`·`test/`는 건드리지 않는다.

## 예시 / 반례
- 좋은 사례: "게시글 수정(PUT /posts/:id, 작성자만)" 요청 → spec에 인수조건(작성자 200·타인 403·없으면 404) → `test/post-edit.test.mjs` 새로 실패시킨 뒤 `src/routes/board.mjs`에 핸들러 추가 → review가 권한 검사 누락·기존 컨벤션 일탈을 잡아 review.md로.
- 싫은 사례: 기능 추가하면서 vitest를 깔거나, 기존 `board.test.mjs`를 통째로 갈아엎거나, 테스트 없이 바로 구현하는 흐름.

## 우선순위
1. 비손상(기존 파일·러너 보존) — 어기면 실패.
2. 기존 컨벤션 피팅(zero-dep, 레이아웃, `node --test`).
3. 안전성: review에서 인증/권한·회귀를 잡는다(보안 중요 → review만 strict).
4. 크로스툴 동일 동작.

## 내린 결정
- 테스트 러너 → 기존 `node --test` 재사용 (README가 명시: 2번째 프레임워크 금지).
- review 강도 → 전역 medium이되 review만 strict (인증/권한 회귀가 치명적이라 게이트로 차단).
- workers → review에서 동적 선택: diff에 인증/권한 코드가 닿으면 security-reviewer, 그 외 변경엔 code-reviewer.
- feature 스코프 → `board-service`로 고정(git 브랜치 슬러그 추론에 의존하지 않게 명시).

## 미해결
- 차단: 없음
- 비차단: 추후 ui phase(프런트가 생기면), 병렬 worktree 흐름은 본체 안정 후 검토.

## 확신
- 필수 항목 구체 답: 예
- 구체 예시 확보: 예 (게시글 수정 기능)
- 결과 가르는 미지수 없음: 예
- 마지막 되짚어 확인에 정정 없음: 예
- 한 줄 테스트: 예 — 이 정리를 넘기면 대화를 못 본 사람도 "기존 board-service에 안전히 기능 더하는 spec→tdd→review 하네스"를 만든다.

## 하네스 힌트
- 작업 묶음: 기획(spec) → 개발(tdd, 기존 러너) → 리뷰(review, 보조 리뷰어 동적)
- 분야: 백엔드 web 서비스(브라운필드 피팅)
- sync: medium (review만 strict)
- routing(모델 등급): balanced
- values: test_command="node --test"
