---
name: spec
desc: 요구를 검증가능한 명세로.
consumes: ~   # YAML null = 아무것도 안 받음. 회귀 가드: 팬텀 역할 '~' 로 잘못 파싱돼 거짓 dangling 나면 안 됨(produces 가드와 대칭).
produces: spec
gate: "spec.md status=ready · 인수조건 ≥1"
tier: standard
---
요구를 확인한다. 산출 {spec}. → {next}
