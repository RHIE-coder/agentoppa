# 견본 — 잘 된 메모리 셋 + 기존 엉망 정리 before/after

[`SKILL.md`](../SKILL.md)의 목표 형식(톤·길이). 가상의 NestJS 결제 서비스(`acme-pay`) 기준.

## 잘 된 결과

### `AGENTS.md` (보편 지시 + 포인터만 — 42줄)

```markdown
# acme-pay — 에이전트 지침

## 스택 · 레이아웃
- TypeScript · NestJS · pnpm. 모듈은 `src/modules/<도메인>/`.
- 결제 = Stripe. 테스트 = Jest (`pnpm test`).

## 항상
- 2-space 들여쓰기, named export.
- 커밋 전 `pnpm test && pnpm lint`.
- 외부 API 호출은 `src/lib/http.ts` 래퍼로만.

## 더 깊은 지식 (해당 작업일 때만 읽어라)
- 시스템 구조·경계 → `.agentoppa/architecture.md`
- 결제·webhook → `.agentoppa/payments.md`
- 배포·롤백 런북 → `.agentoppa/runbook.md`
- 과거 디버깅 학습 → `.agentoppa/MEMORY.md`
```

### `CLAUDE.md` (브리지)

```markdown
@AGENTS.md
```

### `.agentoppa/payments.md` (발췌 — 긴 지식, on-demand라 길어도 OK)

```markdown
# 결제 · Webhook

## 순서 보장
Stripe webhook은 도착 순서를 보장하지 않는다. `payment_intent.succeeded`가
`charge.refunded`보다 늦게 올 수 있으므로 상태 머신은 …
(상세 서술 50줄 — 결제 작업일 때만 로드되므로 비대 비용 없음)

## 학습 (harvest됨)
- 결제 버그는 대개 webhook **순서** 문제다. 멱등 키부터 확인.
  (2026-03, 머신로컬 auto-memory에서 이전·커밋)
```

## 기존 엉망 → 정리 (before / after)

### before

```text
~/.claude/CLAUDE.md  : "NestJS, src/modules, 결제 Stripe, 한국어로 답해"  ← 프로젝트 지식이 user-scope 오염
AGENTS.md            : 600줄 (빌드 + 아키텍처 서술 + 스타일 + 배포 런북 뒤섞임)
auto-memory ON       : "결제 버그=webhook 순서" 누적 (이 노트북에만)
CLAUDE.md            : 없음 → Claude는 AGENTS.md를 안 읽어 메모리 ≈ 0
```

### after (위 "잘 된 결과")

```text
AGENTS.md            : 42줄 (보편 지시 + 조건부 포인터)
.agentoppa/*.md      : architecture / payments / runbook + MEMORY.md — 전부 git 커밋
CLAUDE.md            : @AGENTS.md
~/.claude/CLAUDE.md  : "한국어로 답해"만 (개인 취향)
auto-memory          : OFF (학습은 .agentoppa/payments.md·MEMORY.md로 harvest 후 커밋)
→ git fetch한 모든 머신·Codex·Claude가 동일 품질·context
```

### 적용한 변환

- 아키텍처 서술·런북 → `.agentoppa/`로 **추출**, AGENTS.md엔 조건부 포인터만.
- "결제 Stripe" 등 보편 사실 → AGENTS.md로 **증류**(복사 아님).
- user-scope의 프로젝트 지식 → 프로젝트로 이전, "한국어로 답해"만 잔류.
- auto-memory 학습 → harvest·커밋 후 OFF.
- `CLAUDE.md` → `@AGENTS.md` 브리지 신설(드리프트(= 두 곳이 따로 놀며 어긋남) 없음).

> 핵심: 600줄 → 42줄로 줄인 게 아니라, **상시 자리(매 턴 상주)에서 "보편 지시"만 남기고** 나머지는 *관련할 때만 로드되는* 커밋된 지식으로 옮긴 것. 총 정보량은 비슷하거나 늘었지만 상시 noise는 급감했다.
