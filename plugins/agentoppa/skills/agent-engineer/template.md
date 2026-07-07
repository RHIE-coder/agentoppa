# template.md — 빈 골격 (복사용)

새 하네스를 만들 때 아래를 복사해 채운다. 규칙은 `references/phases.md`(단계)·`references/recipe.md`(Config)·`references/contract.md`(연결).

**어느 블록을 어디에 두나 (두 모드):**
- **ⓐ 재사용 Core 짓기** — 단계 정의(빈 단계·구현 모듈 frontmatter(= 파일 맨 위 `---` 사이의 구조화된 설정 블록)의 *빈자리 선언*)는 Core 묶음 `.agentoppa/plugins/<core>/`에 둔다. *프로젝트 값을 안 박는다* — 능력은 일반명으로(`e2e-runner` ✓, `playwright` ✗).
- **ⓑ 이 프로젝트에 바인딩** — `config.yaml`(`core:`+`bindings:`+`impl:`+`values:`)·구현 모듈·보조 에이전트는 `.harness/<하네스>/`에 둔다(여러 하네스가 공존해도 실행되는 건 루트 `.harness-main`/`HARNESS_MAIN`이 고른 1개). 빈자리를 *이 프로젝트 구현*으로 채우는 곳.
- **`core:` 생략 = 단독 하네스** — Core 없이 단계를 `.harness/<하네스>/project/phases/`가 직접 든다(그대로 유효).

## 빈 Config — `.harness/<하네스>/config.yaml`

```yaml
harness:  <이름>
core:     <Core 이름>        # (선택) 가리키는 재사용 Core = .agentoppa/plugins/<core>/. 생략 = 단독 하네스
feature:  <작업 스코프>      # 생략 시 git 브랜치
sync:     medium             # loose | medium | strict (전역 기본)
routing:  balanced           # budget | balanced | premium
phases:
  - <phase>
  - <phase>
  # 반복:        - loop: { do: [<a>, <b>], until: "<조건>", max: 5 }
  # phase별 강도: - {name: <phase>, sync: strict}
values:                      # 값-빈자리 채움 (requires의 값-빈자리 / {프로젝트값}) → 컴파일 때 본문에 박힘
  <키>: "<값>"
bindings:                    # (선택) 능력-빈자리 채움 (requires의 <능력>:capability) → 런타임에 읽힘
  <능력>: <구현>             #   impl 키를 가리키거나 명령·경로를 직접(인라인)
impl:                        # (선택) 구현 키의 알맹이. 한 줄 명령이면 여기, 절차/여러줄이면 모듈 경로
  <구현>: "<명령>"           #   또는 ./project/impl/<구현>.md (절차) · ./project/impl/<구현>.mjs (실행 스크립트)
```

## 빈 단계 — Core면 `.agentoppa/plugins/<core>/`의 단계, 단독이면 `.harness/<하네스>/project/phases/<name>.md`

```markdown
---
name:     <소문자-하이픈>
desc:     "<언제 쓰나(트리거). 절차 요약 ❌>"
when:     "<조건>"          # (선택) 없으면 항상 실행
consumes: [<역할?>, ...]    # 없으면 [] (시작 단계)
produces: <역할>            # 없으면 ~ (코드/상태만, 문서 바통 없음)
gate:     "<done 조건>"     # (선택)
requires: [<값?>, <능력>:capability?, ...]  # (선택) 프로젝트 빈자리. 값-빈자리 | :capability 능력-빈자리(?=선택)
tier:     standard          # (선택) cheap | standard | strong
workers:                    # (선택) 없으면 블록째 삭제
  select: all | dynamic | none
  options:
    <agent-name>: "<언제 띄울지>"
---
입력 {역할}을 읽는다.
1. <명령형 지시>          # 능력을 쓸 땐 {cap:<능력>} (런타임에 config.bindings에서 읽힘)
산출 {역할} (헤더 phase: <name>). → {next}
```

## 빈 구현 모듈 — `.harness/<하네스>/project/impl/<key>.md` (bindings가 모듈 경로로 가리킬 때)

```markdown
---
provides: <능력명>          # 이 모듈이 채우는 능력 (validate가 능력↔모듈 일치 점검)
---
# <key> — <능력> 구현 절차
(설치·env·명령 순서 — 능력 슬롯 산문이 "이 파일을 열어 따르라"로 안내)
```

한 줄 명령이면 모듈 없이 `bindings`/`impl` 우변에 직접(인라인). 여러 줄 절차·실행 스크립트일 때만 모듈(`.md`/`.mjs`).

## 빈 보조 에이전트 — `.harness/<하네스>/project/agents/<name>.md` (workers가 참조할 때)

```markdown
---
name: <소문자-하이픈>
description: <무엇을 / 언제>
access: read-only           # 권한·도구
tier: standard              # (선택)
---
(스폰됐을 때 할 일 — 명령형)
```

슬롯: `{역할}`→경로(contract) · `{next}`→config 순서 · `{프로젝트값}`→config.values·면담(값-빈자리, 컴파일 때 박힘) · `{cap:<능력>}`→config.bindings/impl(능력-빈자리, 런타임에 읽힘).
채운 뒤 `node .harness/<하네스>/core/validate.mjs`로 점검한다(인자 없이 실행하면 `.harness-main`/`HARNESS_MAIN`으로 활성 하네스를 찾는다).
