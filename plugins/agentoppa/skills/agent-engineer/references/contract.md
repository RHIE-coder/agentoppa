# contract.md — 산출물 계약 (phase끼리 잇는 선)

phase는 **문서(산출물)로 이어진다.** 앞 phase가 남긴 문서를 뒤 phase가 받는다 — 그 문서가 바통이자, *엔진 없이 도는 상태(state)*다. 이 파일은 규칙 4개를 정의한다. phase 양식은 `phases.md`, 순서·옵션은 `recipe.md`.

> **두 계약은 다른 층이다 — 섞지 말 것.**
> - **산출물 계약(이 파일)** = *phase끼리* 문서 바통을 잇는 선. `produces`/`consumes` role을 앞뒤 phase가 주고받는다(시간축: 앞→뒤).
> - **인터페이스 계약** = *Core 빈자리 ↔ Project 구현*을 잇는 선. phase의 `requires` 능력-빈자리를 프로젝트 `config.bindings`가 채운다(층축: 재사용 Core → 이 프로젝트). 양식은 `recipe.md`(`bindings`/`impl`)·`phases.md`(`requires`/`{cap:}`).
> - 헷갈림 방지: `consumes`는 *앞 단계가 만든 문서*를, `requires`는 *프로젝트가 주입할 값·능력*을 가리킨다. 같은 "필요"라도 채우는 주체가 다르다(앞 phase vs config). 아래 §4는 두 층을 한 번에 점검한다.

## 1. 역할 → 경로

phase는 산출물을 **역할(role)**로 부른다(`{spec}`). 실제 경로는 컴파일 때 풀린다:

```
{artifacts_dir}/{feature}/{role}.md
예) .harness/artifacts/login-oauth/spec.md
```

- `{artifacts_dir}` = `.harness/artifacts` (고정)
- `{feature}` = `config.yaml`의 `feature` → 없으면 git 브랜치 슬러그 → 그것도 없으면 `default`
- `{role}` = phase의 `produces`/`consumes` 값
- 한 역할 = 한 `.md`. git-committed → 어느 도구·세션에서 열어도 같은 바통(resume).
- **한 config 안에서 한 역할은 한 phase만 produces** (충돌 금지).

## 2. 산출물 헤더

모든 산출물 `.md`는 맨 위 frontmatter(= 파일 맨 위 `---` 사이의 구조화된 설정 블록)를 단다 — 다음 phase가 출처·상태를 보게. **사람이 읽을 것만**(해시는 §3 validate 몫):

```yaml
---
phase:  spec            # 누가 만들었나
status: ready           # draft → (gate 통과) → ready → (입력 바뀜) → stale
inputs: [requirements]  # 내가 먹은 역할들 (없으면 [])
---
# Spec: …(본문)
```

## 3. 신선도 (stale 감지)

입력이 바뀌었는데 산출물이 안 따라간 상태 = **stale**. 헤더는 사람용(역할만), **지문 대조는 validate가** 한다 (해시는 LLM 말고 Node가 — 결정적):

- `.harness/artifacts/{feature}/lock.json` 에 `역할 → 지문(내용 해시)` 스냅샷.
- validate가 각 역할 파일의 *현재* 지문을 lock과 비교 → 입력이 바뀐 산출물을 `stale`로 표시(연쇄 전파), 통과 시 lock 갱신.
- 시계·mtime(= 파일 수정 시각)·git 상태 안 씀 → 크로스툴·재현 가능.

## 4. 연결 점검 (validate가 잡음)

`config`의 phase들 + 각 phase 정의를 그래프로 보고:

- [ ] 모든 비선택 `consumes` 역할이 **앞 phase의 `produces`에 존재** (dangling 입력 = 받을 문서를 아무 단계도 안 만드는 끊긴 입력 ❌)
- [ ] 모든 `produces`는 뒤에서 소비되거나 종착 (orphan 출력 = 아무 단계도 안 받는 외톨이 출력은 warn)
- [ ] 한 역할은 한 phase만 produces (중복 ❌)
- [ ] 모든 비선택 `requires` 값-빈자리가 `config.values`에 존재 (`needs` 옛 이름 포함)
- [ ] 모든 비선택 `requires` 능력-빈자리가 `config.bindings`에 존재 (미바인딩 ❌ = error), 구현 키는 `config.impl`에 알맹이 존재 (인터페이스 계약 층)
- [ ] stale 산출물 없음 (§3)
- [ ] (`sync=strict`) `gate` 미충족(`status≠ready`)인 채 다음으로 넘어간 곳 없음

## 어디서 쓰나

- **컴파일 시:** Maker가 §1 규칙으로 `{역할}` 슬롯을 *실제 경로*로 박는다 → 그래서 생성 스킬은 AgentOppa 없이도 경로를 안다.
- **검사 시:** `.harness/core/validate.mjs`가 §2·3·4를 기계로 점검.
- 규칙의 **정본은 이 파일**(AgentOppa references). 하네스엔 `validate.mjs`가 이 규칙을 *코드로* 들고 간다(자기검사 독립).

---

이게 "선(edge)"의 전부다. 점(phase)은 `phases.md`, 순서·강도(sync)·라우팅은 `recipe.md`.
