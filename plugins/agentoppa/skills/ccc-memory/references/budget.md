# 예산 · 관련성 규율 (길이 축)

[`SKILL.md`](../SKILL.md) 동반 문서. **상시 메모리가 길면 왜 나쁜지**, 그리고 `AGENTS.md`와 지식문서의 진짜 차이.

## 1. 진짜 모델: 길이가 아니라 관련성 × 지속성 × 유형

degradation(= 성능 저하)은 "컨텍스트에 들어갔냐"가 아니라 세 가지의 함수다. ARCHITECTURE.md를 읽는 *그 한 턴*만 보면 긴 AGENTS.md와 똑같이 나쁘지만, 셋을 다 보면 다르다:

| | `AGENTS.md` / `CLAUDE.md` | 지식문서 `<memoryDir>/*.md` |
|---|---|---|
| 언제 in-context | 모든 작업·매 턴 | 그 주제 작업 때만 |
| 그때 그 토큰은 | 대부분 **noise**(무관) | 대체로 **signal**(관련) |
| 비용 적분 | 연속(매 세션·compaction 후 재주입) | 일시(관련 구간, 후 compaction으로 빠짐) |
| 내용 유형 | 동시 준수할 **지시** | 참고할 **지식** |
| 길어지면 | **순응 붕괴**(규칙 무시) | 디테일 약간 놓침 |
| 틀렸을 때 | 모든 작업 오염 | 그 주제만 |

→ AGENTS.md는 **모든 작업에 보편 관련된 지시**만 자리값을 얻는다. 그 외는 전부 noise다. "길어서 나쁜" 게 아니라 "무관한데 상주해서 나쁜" 것.

## 2. 로딩 트리거 (always-on vs on-demand)

| 메커니즘 | 로드 트리거 | 상주? |
|---|---|---|
| `AGENTS.md`/`CLAUDE.md` 본문 | 매 세션 launch | 항상 |
| **`@import`된 문서** | 매 세션 launch (인라인) | **항상 ⚠** |
| 무조건 rule (`paths` 없음) | 매 세션 launch | 항상 |
| 스킬 본문 | description 매칭 | 그때만 (name+desc만 상주) |
| path-scoped rule (Claude) | 매칭 파일 읽을 때 | 그때만 |
| 중첩 `AGENTS.md`/`CLAUDE.md` | 해당 서브트리 작업 | 그때만 |
| 레포 문서 (미import) | 에이전트가 `Read` 호출 | 그때만 |

**`@import` 함정:** import는 문서를 *인라인*한다 = 상주. **정리용이지 비용 절감이 아니다**(Anthropic: "imports help organization but do not reduce context"). 줄이려면 import 말고 **가리키고 필요할 때 `Read`하게** 둔다.

## 3. 지시 ≠ 지식 (실패 방식이 다르다)

- **지시:** 동시에 지킬수록 **준수율↓**(IFScale: 500개에서 68%, primacy bias(= 앞쪽 지시에 쏠림)로 뒤 지시 무시). 긴 지시파일은 토큰만 먹는 게 아니라 *중요한 규칙까지 안 지켜지게* 한다.
- **지식:** 읽고 → 필요한 것 뽑고 → 끝. 동시 준수 경쟁이 없다. 길어도 "한 번 디테일 놓침"이 최악.

→ 지식을 지시파일에 욱여넣으면 **토큰 + 순응** 두 축에서 동시에 손해. 그래서 긴 지식문서는 OK, 긴 지시파일은 NG.

## 4. 숫자

- **Claude `CLAUDE.md`: < 200줄.** 공식: "Longer files consume more context and reduce adherence." 길이와 무관하게 full 로드되므로 짧을수록 순응↑.
- **Codex `AGENTS.md`: 32 KiB** (`project_doc_max_bytes`). **하드캡 — 초과분 파일을 드롭**. 비대해지면 품질 이전에 *내용 자체가 안 읽힌다*.
- **Claude auto-memory `MEMORY.md`: 첫 200줄/25KB**만 로드 → 인덱스만 짧게, 상세는 토픽파일 on-demand.

## 5. IN / OUT

- **IN (`AGENTS.md`):** 빌드/테스트 명령, 컨벤션, 레이아웃, "항상 X" — 보편·선언·검증가능("2-space" O, "포맷 잘" X).
- **OUT:** 절차 → 스킬 / 강제(커밋 전 등) → 훅 / 특정 서브트리 → 중첩 AGENTS.md / 긴 지식 → `<memoryDir>/*.md`(조건부 포인터) / 일회성 → 안 넣음.
- 원칙(Anthropic): **"minimal ≠ short"** — 행동을 다 규정하는 최소치. 무작정 짧게가 아니라 무관한 걸 빼는 것.

## 6. 연구 근거

- **Lost in the Middle** — Liu et al., TACL 2024. 긴 컨텍스트의 *중간*은 무시된다(U자 곡선). https://aclanthology.org/2024.tacl-1.9/
- **Context Rot** — Hong·Troynikov·Huber, Chroma, 2025. 입력 토큰↑ → 성능↓(윈도우 한참 전부터, 18개 모델). https://research.trychroma.com/context-rot
- **Effective context engineering for AI agents** — Anthropic, 2025. "토큰↑ → 정확한 recall↓; context는 한정 자원·한계효용 체감." https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **IFScale** — Jaroslawicz et al., 2025. 지시 500개에서 최고 모델도 68%, primacy bias. https://arxiv.org/abs/2507.11538
- **ManyIFEval** (Harada et al., 2025, arXiv 2509.21051) · **SIFo** (Chen et al., EMNLP 2024, arXiv 2406.19999) — 지시 수/순서로 준수율 저하가 체계적·예측가능.
- 공식 수치: Claude Code Memory(< 200줄) · Codex `project_doc_max_bytes`(32 KiB).
