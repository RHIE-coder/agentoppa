---
id: rb2-bad-intent
axis: robustness
seed: brownfield-bare
agent_steps: [interview-bad]
judge: [interview_gated]
tools: [claude]
---
# rb2-bad-intent — 나쁜/모순 intent 게이팅

**검증:** 면담에 모순·공백을 주면 intent-interview 가 **status=ready 로 넘기지 않는가**(차단 미해결 핸드오프 거부). 게이트가 실제로 게이트인지.
**fail:** 차단 미해결인데 agent-engineer 로 핸드오프 / 반쪽 브리프 통과.
**판정:** `interview_gated` = 기계(산출 `.harness/intent.md` 에 intent-interview validator 를 spawn 으로 물려 not-ready(exit≠0) 확인 — 기존 red/green 픽스처의 라이브판).

## 절차
1. `setup` → 2. 모순된 요구로 면담 진행 → 3. `judge`(intent.md 가 ready 가 아니어야 / 핸드오프 안 됐어야).
