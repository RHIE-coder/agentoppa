---
id: lc2-intent-change
axis: lifecycle
seed: brownfield-oppa
agent_steps: [edit-intent, generate]
judge: [intent_reflected, source_edits_preserved]
tools: [claude]
---
# lc2-intent-change — intent 변경 반영 (부분 재생성)

**검증:** `.harness/intent.md`·`config.yaml` 을 바꿔(phase 추가/제거/순서) 재생성하면 의도대로 갱신되고, 손 안 댄 SOURCE 수기편집은 보존되는가.
**fail:** 변경이 반영 안 됨 / 무관한 부분까지 갈아엎음 / 수기편집 유실.
**판정:** 둘 다 수동(추후 기계화: 변경 phase만 diff · 보존 마커 잔존 검사).

## 절차
1. `setup` → 2. intent/config 편집(예: phase 하나 추가) → 3. generate → 4. `judge`(diff 범위·보존 확인).
