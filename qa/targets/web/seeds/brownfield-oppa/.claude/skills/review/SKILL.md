---
name: review
description: tdd가 끝난 변경을 spec·보안·기존 컨벤션 기준으로 리뷰할 때. 위험·누락을 review.md로 못박아 반환.
---
입력 .harness/artifacts/board-service/spec.md과 작업 트리 변경(`git diff`)을 읽는다.

이 단계는 strict 게이트다 — 다음을 충족하기 전엔 끝내지 않는다: review.md status=ready · 차단 지적 0 · 기존 파일 무손상(diff가 새 경로만) 확인.

1. diff를 보고 어떤 보조 리뷰어를 띄울지 *고른다*: 인증/권한 코드(`src/routes/auth.mjs`·`bearer`·`userOf`·토큰)가 닿으면 security-reviewer를, 그 외 로직/라우팅/저장 변경이면 code-reviewer를. 둘 다 read-only로 병렬 스폰하고 결과를 합본한다.
2. 변경이 .harness/artifacts/board-service/spec.md의 인수조건을 전부 충족하는지, 기존 컨벤션(zero-dep·`node --test`·레이아웃)을 지켰는지 대조한다.
3. 비손상 확인: diff가 기존 `src/`·`test/` 파일을 수정/삭제하지 않고 *새 경로만* 추가했는지 본다. 위반은 차단 지적.
산출 .harness/artifacts/board-service/review.md (헤더 phase: review · status: ready · inputs: [spec]). → (종착)
