---
name: e2e
desc: 변경을 실제로 띄워 검증할 때.
consumes: [spec]
produces: e2e
requires: [test_command, e2e-runner:capability, browser:capability?]
gate: "e2e status=ready · 실패 0"
---
{spec} 기준 시나리오를 만든다. {test_command} 로 단위부터 통과시킨다.
그다음 {cap:e2e-runner}으로 실제 흐름을 돌린다.
산출 {e2e} (헤더 phase: e2e). → {next}
