---
name: impl
description: 명세대로 구현할 때.
---
.harness/demo/artifacts/<작업폴더>/spec.md 기준으로 최소 구현한다. → /test

위 경로의 `<작업폴더>` 는 빌드 때 박지 않는다 — 실행 시 정한다: `.harness/demo/config.yaml` 의 `feature:` 값이 있으면 그것, 없으면 현재 git 브랜치 이름(폴더명으로 쓰게 특수문자는 `-` 로 바꿔), 둘 다 없으면 `default`. 한 작업의 산출물이 모두 이 한 폴더 아래 모인다(브랜치를 바꾸면 그 브랜치 폴더로 따라간다).
