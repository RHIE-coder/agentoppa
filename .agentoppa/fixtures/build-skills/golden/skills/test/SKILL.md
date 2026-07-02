---
name: test
description: 테스트로 검증할 때.
---
.harness/artifacts/<작업폴더>/spec.md 기준 테스트를 쓴다. `test_command`(값) 로 확인하고, `test-runner`(능력) 로 실제 돌려본다. 산출 .harness/artifacts/<작업폴더>/test.md.

`test-runner`(능력)의 구현은 `.harness/config.yaml` 의 `bindings: test-runner:` 가 가리키는 값이다. 그 값이 단일 토큰이면 같은 파일 `impl:` 아래 그 키가, 명령·경로면 그 자체가 알맹이다. 지금 그 값을 읽어 그대로 실행하라(경로면 그 파일을 열어 따른다). 못 찾으면 멈추고 "바인딩 없음: test-runner" 라 알린다(값을 추측하지 않는다).

`test_command`(값)의 알맹이는 `.harness/config.yaml` 의 `values: test_command:` 가 담은 값이다. 지금 그 값을 읽어 그대로 쓰라(명령이면 그대로 실행한다). 못 찾으면 멈추고 "값 없음: test_command" 라 알린다(값을 추측하지 않는다).

위 경로의 `<작업폴더>` 는 빌드 때 박지 않는다 — 실행 시 정한다: `.harness/config.yaml` 의 `feature:` 값이 있으면 그것, 없으면 현재 git 브랜치 이름(폴더명으로 쓰게 특수문자는 `-` 로 바꿔), 둘 다 없으면 `default`. 한 작업의 산출물이 모두 이 한 폴더 아래 모인다(브랜치를 바꾸면 그 브랜치 폴더로 따라간다).
