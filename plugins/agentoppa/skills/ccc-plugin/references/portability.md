# 추출 · 탈동조화 — 플러그인을 호스트에서 떼어내기 (portability = 어디에 옮겨 깔아도 도는 성질)

[`SKILL.md`](../SKILL.md) 동반 문서. 특정 프로젝트에서 만든 컴포넌트를 **임의의 호스트에 설치 가능한 범용 플러그인**으로 추출할 때의 규율.

## 원칙: 구현이 아니라 능력(계약)에 의존

플러그인은 임의의 호스트에 깔린다 → **특정 구현(`tsc`·`eslint`·`src/`·절대경로)이 아니라 능력(`타입검사`·`린트`·`테스트`)에 의존**해야 한다. 죄는 "호스트에 의존하는 것"이 아니라(불가피하다) **암묵적·경직되게** 의존하는 것이다. → 의존을 **명시적이고 호스트가 채울 수 있는 계약**으로 바꾼다.

> **판별 테스트:** "다르게 구조화된 프로젝트에 깔면 깨지나?" → 깨지면 결합이다 → 계약으로 추출.

> **또 하나의 방향 — core ↛ disposable 콘텐츠:** 엔진·프로세스 컴포넌트는 *disposable(= 통째로 빼도 되는) 샘플*(`examples/`)을 의존 참조하지 않는다. 의존은 한 방향(샘플→프레임워크)이고, 샘플은 통째로 빼도 프레임워크가 멀쩡해야 한다. 경로-링크 형태는 ccc-plugin 검증기가 기계 강제(`self-harden` 1호 사례), 산문 형태는 `AGENTS.md` always-on 불변식이 잡는다.

## 무엇을 떼고 어떻게

| 결합(coupled) | 탈동조(decoupled) | 방법 |
|---|---|---|
| `tsc`/`eslint`/`jest` 하드코딩 | "타입검사"/"린트"/"테스트" 능력 | 호스트 계약·감지 |
| 원본 절대경로·가정 레이아웃 | `${CLAUDE_PLUGIN_ROOT}`·`${CLAUDE_PROJECT_DIR}` | 경로 변수 |
| `./package.json`·`src/` 존재 가정 | 감지하거나 우아하게 degrade(= 없으면 기능을 줄여 버팀) | 탐지/폴백 |
| 생태계 암묵 가정(TS+jest) | 범위 선언 or 능력 추상화 | 의식적 택1 |
| 호스트에 특정 패키지 설치 가정 | 번들 or zero-dep | self-contained(= 필요한 걸 다 품어 혼자 돎) |

## 능력 계약 메커니즘 (호스트가 구체값을 채운다)

1. **userConfig** — Claude `plugin.json`의 `userConfig`(설치 시 프롬프트). 간단한 값(명령)에. 값은 `${user_config.KEY}`·`CLAUDE_PLUGIN_OPTION_<KEY>`로 노출.
2. **호스트 계약 파일** — 호스트 프로젝트에 둔 약속 파일(`.agentoppa/capabilities.json` 등)을 플러그인이 읽음. 여러 명령·경로 같은 풍부한 구체값에. (ccc-memory의 `.agentoppa/`와 같은 원리.)
3. **감지(detection)** — 호스트 `package.json`의 `scripts`, lockfile(= 설치된 의존성 버전을 고정한 파일; `pnpm-lock.yaml`→pnpm 등)로 명령·도구를 돌릴 때 추론. 폴백(= 못 찾을 때 쓰는 기본값) + 오버라이드(= 사용자가 덮어쓰기) 제공.

### 예: TypeScript TDD(= 테스트를 먼저 짜고 그걸 통과시키며 개발) 워크플로 추출

```text
[before · 결합]  hook: "tsc --noEmit && eslint . --fix && jest --findRelatedTests"
                 스크립트가 ./package.json 읽고 src/ 가정

[after · 탈동조] 호스트 계약 .agentoppa/capabilities.json (호스트가 채움):
                   { "typecheck": "pnpm tsc --noEmit", "lint": "pnpm eslint --fix", "test": "pnpm jest" }
                 hook: node ${CLAUDE_PLUGIN_ROOT}/bin/run-cap.mjs typecheck
                   → 계약에서 읽고, 없으면 package.json scripts/lockfile로 감지
```

## 정직한 좁힘도 OK — 숨은 결합만 나쁘다

모든 걸 추상화할 필요는 없다. "이건 **TS/Node TDD** 플러그인"이라 **범위를 선언**하고 필요한 도구를 **문서화된 의존**으로 두는 것도 정답이다(userConfig `required` 등). 나쁜 건 *선언 없이 새는* 결합이다 — **declared dependency(= 드러내 적은 의존) ✓ vs hidden coupling(= 숨어 새는 결합) ✗**.

## 크로스툴 경로 변수

- 플러그인 자기 파일: `${CLAUDE_PLUGIN_ROOT}` (Codex가 별칭 지원 → 양쪽 동작).
- 호스트 프로젝트 루트: `${CLAUDE_PROJECT_DIR}` / cwd. **원본 프로젝트 경로를 박지 말 것.**
- 헬퍼 스크립트는 **zero-dep**(= 외부 패키지 의존 0, Node 빌트인만 쓰는 `.mjs` 등) — 호스트 의존 0. AgentOppa 검증기들이 이 모델이다.

## 패밀리 연결

- **ccc-memory `.agentoppa/`:** 호스트-제공·커밋되는 계약 위치 — `capabilities.json`도 여기 두면 자연스럽다.
- 일반 원칙: **플러그인 = 메커니즘(범용), 호스트 = 구체값(계약).**

## 출처

- Claude userConfig · 경로 변수 — https://code.claude.com/docs/en/plugins-reference
- Codex 플러그인 경로 변수 — https://developers.openai.com/codex/plugins/build
