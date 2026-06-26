# FOREIGN — 외래 하네스 마커 (case3a 입력)

이 시드 = `brownfield-bare` 복사본 + **손으로 만든 비-AgentOppa 하네스**. case3a-foreign(AgentOppa가 남의 하네스를 안 덮어쓰고 공존하나)의 입력이다.

## 외래 하네스 경로 (보존 대상)

```
외래 하네스 경로 = .myflow/
```

`.myflow/` (= `workflow.yaml` + `README.md`)는 AgentOppa가 만든 게 아니다. case3a 판정 `foreign_harness_preserved`는 이 경로의 `git diff`=∅(변형·삭제 없음)를 본다.

## AgentOppa 산출 경로 (이것과 헷갈리지 말 것)

`.harness/` · `.claude/` · `.codex/` — 이름이 `.myflow/`와 달라 충돌하지 않는다. AgentOppa는 여기에 자기 하네스를 깔아 외래 하네스와 **공존**해야 한다(case3a fail = 외래 하네스 변형/삭제 또는 프로젝트 원본 diff≠∅).

> 이 `FOREIGN.md`와 `.myflow/`는 시드 baseline에 커밋된 입력 상태다. `run.mjs` setup이 `git add -A`로 baseline에 넣으므로, 이후 `project_unchanged`(=하네스 외 변경 0) 판정엔 dirty로 잡히지 않는다.
