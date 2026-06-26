---
id: xt1-crosstool
axis: crosstool
seed: brownfield-bare
agent_steps: [generate, run]
judge: [acceptance, contract]
acceptance: "node --test"
tools: [claude, codex]
---
# xt1-crosstool — 같은 하네스를 Claude·Codex 양쪽에서 (중심 주장)

**검증:** 동일 작업을 양쪽 도구로 돌렸을 때 둘 다 유효·통과하고 산출 문서가 같은 contract 만족. **"크로스툴 동일 품질"이 빈말이 아님을 증명.**
**fail:** 한쪽만 통과 → 핵심 주장 붕괴.
**판정:** `acceptance`·`contract` = 기계(양쪽 각각 green + 산출물 헤더·연결). 두 패스 산출이 *동등*한지는 수동(전자동 미주장).

## 절차 (2-pass · 수동)
1. `setup` → 2-pass:
   - Claude: `.work/xt1-crosstool` 에서 generate+run → `judge`.
   - Codex: 같은 seed로 다시 `setup` 후 codex로 generate+run → `judge`.
2. 두 패스 결과(합격테스트 green + 산출 문서)를 비교한다.

> 러너는 `.work/<id>` 단일 디렉터리라, 현재는 도구별 2-pass를 수동으로 돈다(전자동 미주장).
