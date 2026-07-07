---
name: tdd
desc: 테스트 먼저, 통과시키며 구현.
consumes: [spec]
produces: ~
needs: [test_command]
gate: "{테스트 명령} 전체 그린"
---
{spec} 기준 테스트부터. → {next}
