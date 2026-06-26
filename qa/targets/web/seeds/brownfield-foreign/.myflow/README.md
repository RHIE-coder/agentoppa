# .myflow/ — 외래(비-AgentOppa) 하네스

이 프로젝트엔 이미 **다른** 워크플로 도구("myflow")가 깔려 있다. AgentOppa가 만든 게 아니다.

- 설정: `workflow.yaml` (단일 파일 · 평평한 `stages` 리스트 — AgentOppa의 `.harness/` 멀티파일 구조와 다른 포맷).
- 실행(가정): `myflow run` 이 `stages`를 순서대로 돈다. (이 시드엔 myflow 바이너리는 없다 — 흔적만 둔다.)

AgentOppa가 이 프로젝트에 들어올 때 이 디렉터리를 **덮어쓰거나 지우면 안 된다**(case3a). 자기 산출은 `.harness/`·`.claude/`·`.codex/`에 둬서 공존해야 한다.
