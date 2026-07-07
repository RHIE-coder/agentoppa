---
name: setup
description: 이 하네스 프레임워크({{CORE}})를 새 프로젝트에 처음 붙일 때 사용. .harness/{{CORE}}/config.yaml 이 없거나 빈자리(values·bindings)가 안 채워졌을 때 깔아 준다. "이 하네스 붙여줘", "셋업 해줘", "{{CORE}} 설정" 같이 **명시로 요청할 때만** — 일반 구현 요청만으로 하네스 설정을 만들지 않는다. AgentOppa 없이 이 플러그인만으로 동작.
---
이 Core(`{{CORE}}`)를 이 프로젝트에 붙이는 셋업이다. **AgentOppa 없이 이 플러그인만으로** `.harness/{{CORE}}/config.yaml` 을 깐다.

> **명시 요청일 때만 돈다.** "셋업 해줘"·"이 하네스 붙여줘" 처럼 사용자가 대놓고 요청할 때만 config 를 만든다. 일반 구현 요청("이 기능 만들어줘")만으로 하네스 설정을 깔지 않는다.

## 절차

1. **골격을 깔고 / 빠진 빈자리를 찾는다** — 스캐폴딩 헬퍼를 돌린다:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scaffold.mjs"
   ```
   프로젝트 루트에 `.harness/{{CORE}}/config.yaml` 골격을 만들고(없으면), 채워야 할 **빈자리 — 값(`values`)과 능력(`bindings`)** — 목록을 출력한다. 이미 있으면 *안 채워진 빈자리만* 알려 준다(덮어쓰지 않음 — 멱등). 이때 루트 `.harness-main`(활성 하네스 선택기)이 비어 있으면 `{{CORE}}` 로 채워 활성화한다(다른 하네스가 이미 활성이면 덮지 않고 알려 준다). `.harness-main` 은 gitignore 대상이다.

2. **빈자리를 이 프로젝트에 맞게 채운다** — 출력된 각 빈자리에 *이 프로젝트 것*을 적는다.
   - 값 빈자리(`values`): 한 줄 리터럴 — 명령·경로 (예: `test_command: "npm test"`, `spec_dir: "docs/spec"`).
   - 능력 빈자리(`bindings`): 이 프로젝트의 구현 — 한 줄 명령이면 우변에 바로, 여러 줄 절차면 `.harness/{{CORE}}/project/impl/<키>.md` 에 두고 경로로 가리킨다.
   - 프로젝트를 살펴 추론하라: `package.json`·설정 파일·설치된 도구(예: playwright 가 있으면 `test-runner: "npx playwright test"`).
   - **모르면 추측하지 말고 사용자에게 묻는다.**

3. **확인받는다** — "이렇게 채웠다 — 맞나?" 로 사용자에게 보여주고 확정한다.

4. **끝** — 이제 이 Core 의 단계 스킬을 그대로 쓸 수 있다(활성 하네스가 `{{CORE}}` 일 때). 단계 스킬이 실행될 때 `.harness/{{CORE}}/config.yaml` 의 `values` 와 `bindings` 를 읽어 이 프로젝트 값·구현으로 동작한다.

## 참고

- **활성 하네스는 1개.** 여러 하네스가 `.harness/<이름>/` 로 공존해도 실행되는 건 `.harness-main`(또는 `HARNESS_MAIN` 환경변수, 이게 우선)이 가리키는 1개다. `.harness-main` 이 `{{CORE}}` 가 아니면 이 하네스의 훅·단계는 조용히 빠진다. `.harness-main` 에 적힌 이름의 폴더·config 가 없으면 "활성 하네스 설정 없음"으로 멈춘다.
- **빈자리 = 이 Core 가 선언한 자리.** `${CLAUDE_PLUGIN_ROOT}/interface.json` 에 있고 `scaffold.mjs` 가 읽는다.
- **자동 전파:** Core 가 바뀌어 빈자리가 늘면(인터페이스 변경), 이 셋업을 *다시 돌리면* 빠진 자리만 다시 알려 준다. `.harness/{{CORE}}/core/validate.mjs` 가 있으면 미채움을 error 로도 잡는다.
- **값 빈자리(`values`)도 이 파일에서 채운다.** 단계 스킬이 실행 시점에 `values`·`bindings` 를 읽는다 — Core 재빌드 없이 프로젝트마다 다른 값·구현으로 동작한다(재사용의 핵심). 차이는 하나: 값 = 한 줄 리터럴(명령·경로), 능력 = 구현(모듈로 풀 수 있음).
