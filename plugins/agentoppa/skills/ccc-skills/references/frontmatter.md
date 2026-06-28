# 프론트매터 전체 레퍼런스 (Claude + Codex)

[`SKILL.md`](../SKILL.md)의 동반 문서. 모든 frontmatter 필드와 Codex의 `agents/openai.yaml` 키를 모은다. 근거는 공식 문서(§ 끝 출처).

## 1. Claude Code — SKILL.md frontmatter

`---` 마커 사이의 YAML. **모든 필드 optional**, `description`만 권장. `description`+`when_to_use` 합산은 목록에서 **1,536자**로 잘린다(`maxSkillDescriptionChars`로 조정).

| 필드 | 필수 | 의미 |
|---|---|---|
| `name` | 아니오 | 목록 표시 이름. 기본값 = 디렉토리명. 명령어 이름은 위치에서 옴(아래) — plugin 루트 `SKILL.md`에서만 `name`이 명령어를 정함 |
| `description` | 권장 | 무엇을·**언제**. 자동 적용 판단 근거. 생략 시 본문 첫 단락 사용. 핵심 사용사례를 앞에 |
| `when_to_use` | 아니오 | 추가 트리거 문구. `description`에 이어붙고 1,536자에 포함 |
| `argument-hint` | 아니오 | 자동완성 인자 힌트. 예: `[issue-number]`, `[filename] [format]` |
| `arguments` | 아니오 | `$name` 치환용 명명 위치 인자. 공백 구분 문자열 또는 YAML 목록 |
| `disable-model-invocation` | 아니오 | `true`면 자동 로드 차단(수동 `/name`만). 서브에이전트 preload(= 미리 끌어다 둠)도 막음. 기본 `false` |
| `user-invocable` | 아니오 | `false`면 `/` 메뉴에서 숨김(Claude 자동발동은 가능). 순수 배경지식용. 기본 `true` |
| `allowed-tools` | 아니오 | 활성 중 **프롬프트 없이** 쓸 도구(사전승인). *제한이 아님* — 다른 도구도 호출 가능. 공백/쉼표 문자열 또는 목록 |
| `disallowed-tools` | 아니오 | 활성 중 풀에서 제거할 도구. 자율 스킬에서 특정 도구(예: `AskUserQuestion`) 차단용. 다음 메시지에 해제 |
| `model` | 아니오 | 활성 중 모델 오버라이드. `/model` 값 또는 `inherit`. 해당 턴에만, 설정에 저장 안 됨 |
| `effort` | 아니오 | 노력 수준 `low`/`medium`/`high`/`xhigh`/`max`. 세션값 오버라이드. 기본 상속 |
| `context` | 아니오 | `fork`면 forked 서브에이전트에서 실행(대화 기록 접근 불가) |
| `agent` | 아니오 | `context: fork`일 때 쓸 서브에이전트 유형(`Explore`/`Plan`/`general-purpose`/커스텀). 생략 시 `general-purpose` |
| `hooks` | 아니오 | 이 스킬 라이프사이클에 스코프된 hooks |
| `paths` | 아니오 | glob 패턴(= `*`·`**` 같은 와일드카드로 파일을 묶어 지정). 매칭 파일을 다룰 때만 자동 로드. 쉼표/목록 |
| `shell` | 아니오 | `` !`command` `` 주입 셸. `bash`(기본) 또는 `powershell`(`CLAUDE_CODE_USE_POWERSHELL_TOOL=1` 필요) |

### 명령어 이름이 정해지는 곳 (`name`과 별개)

| 스킬 위치 | 명령어 이름 |
|---|---|
| `~/.claude/skills/<dir>/` 또는 `.claude/skills/<dir>/` | **디렉토리명** |
| `.claude/commands/<file>.md` | 확장자 뗀 파일명 |
| Plugin `skills/<dir>/` | 디렉토리명, plugin 네임스페이스 → `/plugin:dir` |
| Plugin 루트 `SKILL.md` | frontmatter `name`(폴백: plugin 디렉토리명) — **`name`이 명령어를 정하는 유일한 경우** |

### 문자열 치환

| 변수 | 의미 |
|---|---|
| `$ARGUMENTS` | 호출 시 전달된 전체 인자 문자열 (없으면 `ARGUMENTS: <값>`이 본문 끝에 추가) |
| `$ARGUMENTS[N]` / `$N` | 0기반 위치 인자 (`$0` = 첫 인자). shell 스타일 인용 |
| `$name` | `arguments` 목록에서 선언한 명명 인자 |
| `${CLAUDE_SESSION_ID}` | 현재 세션 ID |
| `${CLAUDE_EFFORT}` | 현재 노력 수준 |
| `${CLAUDE_SKILL_DIR}` | **SKILL.md를 담은 디렉토리.** plugin 스킬이면 plugin 루트가 아니라 스킬 하위폴더. 번들 스크립트 경로에 사용 |

## 2. Codex — SKILL.md frontmatter

```yaml
---
name: skill-name
description: 이 스킬이 언제 발동하고 언제 발동하면 안 되는지 정확히. 핵심 사용사례·트리거 단어를 앞에.
---
```

- `name` + `description` **필수.** description은 "핵심 사용사례·트리거 단어를 front-load(= 맨 앞에 배치)".
- 본문 규칙(간결·명령형·입출력 명시)은 Claude와 같다. 도구 메타·발동 정책은 frontmatter가 아니라 **`agents/openai.yaml`**에 둔다(아래).

## 3. Codex — `agents/openai.yaml`

같은 스킬 폴더에 두는 선택 파일. UI 메타 · 발동 정책 · 도구 의존성을 설정한다(Claude는 이 파일을 무시).

```yaml
interface:
  display_name: "사용자에게 보일 이름"        # 선택
  short_description: "짧은 설명"               # 선택
  icon_small: "./assets/small-logo.svg"       # 선택 (assets/에 파일 필요)
  icon_large: "./assets/large-logo.png"       # 선택
  brand_color: "#3B82F6"                       # 선택
  default_prompt: "이 스킬을 쓰는 기본 프롬프트" # 선택

policy:
  allow_implicit_invocation: false   # false면 $skill 명시 호출만. (Claude의 disable-model-invocation 대응)

dependencies:
  tools:                              # 이 스킬이 의존하는 외부 도구(MCP 등)
    - type: "mcp"
      value: "openaiDeveloperDocs"
      description: "OpenAI Docs MCP server"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```

| 블록 | 의미 |
|---|---|
| `interface` | 표시 이름·설명·아이콘·브랜드색·기본 프롬프트 (UI 외형) |
| `policy.allow_implicit_invocation` | `true`=description 매칭 자동발동, `false`=명시 호출만 |
| `dependencies.tools[]` | 필요한 MCP(= Model Context Protocol, 외부 도구·데이터를 에이전트에 붙이는 표준)/외부 도구 선언 (`type`/`value`/`description`/`transport`/`url`) |

## 4. 공통 권장값 (둘 다)

- `description`: "언제"만, 트리거 front-load, 워크플로 요약 금지.
- `name`: 소문자+숫자+하이픈, 디렉토리명 일치.
- 본문: 간결·명령형, `SKILL.md` ≤500줄, 상세는 `references/`.

## 출처

- Claude Code Skills — https://code.claude.com/docs/ko/skills (frontmatter 참조 · 문자열 치환 · 지원 파일)
- Codex Skills — https://developers.openai.com/codex/skills (`agents/openai.yaml` · 경로 · 발동)
- Agent Skills 개방표준 — https://agentskills.io
