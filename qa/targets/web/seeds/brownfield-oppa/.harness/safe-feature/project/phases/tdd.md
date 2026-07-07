---
name: tdd
desc: spec이 있고 실패테스트→구현으로 기능을 안전히 추가할 때. 기존 node --test 러너 재사용, 새 파일만 추가.
consumes: [spec]
produces: ~
gate: "{test_command} 전부 통과 · 새 테스트가 인수조건을 덮음 · 기존 src/test 무수정"
requires: [test_command]
tier: standard
---
입력 {spec}을 읽는다.
1. 인수조건마다 *먼저 실패하는* 테스트를 기존 컨벤션대로 새 파일 `test/<feature>.test.mjs`에 작성한다 (기존 `test/*.test.mjs` 수정 금지). 러너는 {test_command} — 2번째 프레임워크 추가 금지.
2. `{test_command}`로 빨간불을 확인한다.
3. 최소 구현을 기존 모듈에 *추가*한다 (`src/routes/*`·`src/lib/*`). 기존 핸들러/테스트는 보존하고 새 동작만 더한다.
4. `{test_command}` 전부 통과(녹색)할 때까지 반복한다. 기존 테스트도 여전히 통과해야 한다(회귀 0).
문서 산출 없음(코드/테스트가 결과). 작업 트리는 다음 단계가 git diff로 읽는다. → {next}
