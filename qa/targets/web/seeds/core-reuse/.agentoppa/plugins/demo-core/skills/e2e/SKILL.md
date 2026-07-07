---
name: e2e
description: 변경을 실제로 띄워 검증할 때.
---
.harness/demo-core/artifacts/authoring/spec.md 기준 시나리오를 만든다. {test_command} 로 단위부터 통과시킨다.
그다음 `e2e-runner`(능력) 으로 실제 흐름을 돌린다 (구현은 이 프로젝트 bindings 가 정한다).
산출 .harness/demo-core/artifacts/authoring/e2e.md (헤더 phase: e2e, status: ready, inputs: [spec]). → (종착)

`e2e-runner`(능력)의 구현은 `.harness/demo-core/config.yaml` 의 `bindings: e2e-runner:` 가 가리키는 값이다. 그 값이 단일 토큰이면 같은 파일 `impl:` 아래 그 키가, 명령·경로면 그 자체가 알맹이다. 지금 그 값을 읽어 그대로 실행하라(경로면 그 파일을 열어 따른다). 못 찾으면 멈추고 "바인딩 없음: e2e-runner" 라 알린다(값을 추측하지 않는다).
