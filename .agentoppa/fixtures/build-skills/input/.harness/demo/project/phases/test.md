---
name: test
desc: 테스트로 검증할 때.
consumes: [spec]
produces: test
needs: [test_command]
requires: [test-runner:capability]
gate: "{test_command} 전체 green"
---
{spec} 기준 테스트를 쓴다. {test_command} 로 확인하고, {cap:test-runner} 로 실제 돌려본다. 산출 {test}.
