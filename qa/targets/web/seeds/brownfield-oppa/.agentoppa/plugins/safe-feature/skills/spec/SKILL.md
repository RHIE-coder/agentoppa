---
name: spec
description: 기존 board-service에 더할 기능 요청을 검증가능한 명세로 굳힐 때. 인수조건·범위·비범위가 박힌 spec 반환.
---
사용자가 더하려는 기능 요청을 확인한다 (기존 board-service에 안전히 추가).
1. 문제 · 대상 엔드포인트/모듈 · 범위 · 비범위(무엇은 안 한다).
2. 기존 컨벤션 확인: zero-dep `node:http`, 인메모리 store, `test/*.test.mjs`, 러너는 node --test. 새 프레임워크 도입 금지.
3. 회귀 안전: 어떤 기존 파일을 건드리지 않을지 명시. 새 동작의 검증가능한 인수조건을 상태코드 단위로 나열.
산출 .harness/safe-feature/artifacts/board-service/spec.md (헤더 phase: spec, status: ready, inputs: []). → /tdd
