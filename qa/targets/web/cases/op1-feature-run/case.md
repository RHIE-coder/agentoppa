---
id: op1-feature-run
axis: operation
seed: brownfield-bare
agent_steps: [generate, run]
judge: [contract, acceptance]
acceptance: "node --test"
tools: [claude]
---
# op1-feature-run — 기능 한 개를 하네스로 끝까지 (L3+L4 본체)

**검증:** 셋업이 아니라 *운영* — 하네스가 phase1→2→… 문서를 인계하며 기능 하나를 실제로 완성하는가. **여기가 가치(L4)를 객관 합격기준으로 처음 행사하는 지점.**
**fail:** 단계 사이 문서 인계가 contract(헤더·신선도·연결) 위반 / 기능 합격테스트 red.
**판정:** `acceptance`·`contract` = 기계(contract: `.harness/artifacts/<feature>/` 산출물의 헤더(§2)·연결(§4 consumes→앞 produces) 점검. 신선도 §3 lock 대조는 미구현 — agent-engineer validator 몫으로 남김).

## 절차
1. `setup` → 2. generate(하네스) → 3. run: 기능 1개 구현(예: 게시판 댓글 `POST /posts/:id/comments` + 테스트). 단계 산출은 `.harness/artifacts/<feature>/` 에 쌓인다. → 4. `judge`.

> 프로파일러 첫 실측(🧠/🙋/⚙️)을 이 run 에서 뽑아 `results/` 에 남긴다.
