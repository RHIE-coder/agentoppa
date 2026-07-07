# handoff.md — 산출 계약 (의도 브리프)

면담의 산출물 = `.harness/<하네스이름>/intent.md`. *설계 의도*를 담아 다음 단계로 넘기는 문서다 — 커밋되면 어느 도구·세션에서 열어도 같은 의도를 집어 든다(resume(= 끊겼다 이어서 하기)·크로스툴(= Claude·Codex 양쪽)). 캐는 방법은 [method.md](method.md). 면담 수준(프레임워크/프로젝트 — [SKILL.md](../SKILL.md) "면담 수준 고르기")에 따라 머리말 `level`과 *힌트 섹션*이 갈린다(나머지 섹션은 두 수준 공통).

## 경로
`.harness/<하네스이름>/intent.md` — 하네스 폴더 안에 두되, `{feature}` 경로 스킴(= 기능 이름별로 폴더를 나누는 경로 규칙)의 하위폴더 *밖*에 둔다(하네스 *설계 시 1회* 산출이라 기능마다가 아니다). `<하네스이름>`은 면담에서 정해지는 값이라 이름이 확정된 뒤 그 폴더에 쓴다. 기능별 요구는 다른 층위다(↓ 재사용).

## 문서 머리말
agent-engineer [contract.md](../../agent-engineer/references/contract.md) §2 양식을 그대로 따른다:

```yaml
---
phase:  intent-interview
status: ready          # draft → (확신 판정 통과) → ready
inputs: []             # 면담은 보통 시작점 (앞 산출물 없음)
level:  project        # framework(재사용 Core 짓기) | project(이 프로젝트). 없으면 project로 봄
---
```

## 브리프 스키마
✓ = `scripts/validate.mjs`가 존재를 확인하는 필수 섹션:

```markdown
# Intent: <한 줄 의도 요약>

## 목표         ✓   결과(기능 아님). "되면 뭐가 달라지나"
## 범위         ✓   할 것(in) / 안 할 것(out) — 비목표 명시
## 제약         ✓   도구·시간·기존자산·반드시/절대
## 예시 / 반례        좋은 사례·싫은 사례 (추상을 땅에 묶음)
## 우선순위      ✓   트레이드오프 서열
## 내린 결정          면담에서 해소된 질문→답 기록 (왜 이렇게 정했나)
## 미해결       ✓   "- 차단:" / "- 비차단:" 으로 분리 (차단 있으면 status=ready 금지)
## 확신         ✓   판정 4체크 결과 + 한 줄 테스트 통과 여부
```

마지막 *힌트 섹션*은 `level`에 따라 **하나만** 넣는다 — agent-engineer가 이걸 입력으로 받는다:

```markdown
# level: framework  →
## Core 설계 힌트      철학(강제할 규율) · 작업 단계 묶음 + sync · 인터페이스 빈자리 후보(requires) · 겨냥 프로젝트군

# level: project   →
## 하네스 힌트         어떤 Core(가리킬/새로) · 빈자리→바인딩(능력→구현) · 프로젝트 값·도메인 · sync·routing
```

## 연결 — 누가 이 브리프를 받나
agent-engineer가 `level`을 보고 맞는 모드로 읽는다 — 그게 이 브리프의 유일한 소비자다:
- **`level: framework` → "Core 짓기" 모드.** "Core 설계 힌트"가 *재사용 Core*(`.agentoppa/plugins/<core>/`)의 출발점 — 작업 단계 흐름·게이트·범용 스킬과, **인터페이스 빈자리**(`requires`)를 어디에 둘지. 프로젝트 값은 *안* 박는다.
- **`level: project` → "프로젝트 바인딩" 모드.** "하네스 힌트"가 `config.yaml`(`core`·`bindings`·`values`)의 출발점 — 어떤 Core를 가리키고 그 빈자리를 무엇으로 채울지.

> **무엇이 *아닌가*:** intent는 *어떤 Core를 지을지* 또는 *이 프로젝트를 어떤 Core에 맞출지*(설계 시 1회)다. 하네스가 *돌면서* 만드는 개별 산출물(명세·기능 요구 등)과는 층위가 다르다 — 그건 흐름 안의 작업이 알아서 한다.

## status 규칙
- 확신 판정 4체크 통과 **+ 차단 미해결 없음** → `ready`.
- 차단 미해결이 하나라도 있으면 → `draft`. agent-engineer는 `draft`를 받으면 그 항목부터 되묻는다.
