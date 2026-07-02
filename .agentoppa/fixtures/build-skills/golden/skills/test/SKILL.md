---
name: test
description: 테스트로 검증할 때.
---
.harness/artifacts/thing/spec.md 기준 테스트를 쓴다. `test_command`(값) 로 확인하고, `test-runner`(능력) 로 실제 돌려본다. 산출 .harness/artifacts/thing/test.md.

`test-runner`(능력)의 구현은 `.harness/config.yaml` 의 `bindings: test-runner:` 가 가리키는 값이다. 그 값이 단일 토큰이면 같은 파일 `impl:` 아래 그 키가, 명령·경로면 그 자체가 알맹이다. 지금 그 값을 읽어 그대로 실행하라(경로면 그 파일을 열어 따른다). 못 찾으면 멈추고 "바인딩 없음: test-runner" 라 알린다(값을 추측하지 않는다).

`test_command`(값)의 알맹이는 `.harness/config.yaml` 의 `values: test_command:` 가 담은 값이다. 지금 그 값을 읽어 그대로 쓰라(명령이면 그대로 실행한다). 못 찾으면 멈추고 "값 없음: test_command" 라 알린다(값을 추측하지 않는다).
