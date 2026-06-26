---
id: case2-fitting
axis: adoption
seed: brownfield-bare
agent_steps: [interview, generate]
judge: [project_unchanged, harness_present, fits_existing_runner, acceptance]
acceptance: "node --test"
tools: [claude]
---
# case2-fitting — 개발된 프로젝트(하네스 없음)에 셋업 후 피팅 확인

**검증:** 이미 개발된 web에 하네스를 깔되 **기존 컨벤션에 피팅**·**원본 무손상**.
**fail:** 기존 파일 `git diff`≠∅ / 2번째 테스트 프레임워크 추가 / 기존 `node --test` red.
**판정:** `project_unchanged`·`acceptance`·`fits_existing_runner` = 기계(fits: baseline 대비 package.json 새 devDep 0 · scripts.test 불변 · 새 테스트 설정파일 0).

## 절차
1. `node qa/run.mjs setup case2-fitting`
2. 면담→생성만(실행 X). 하네스는 기존 `node --test`를 *재사용*해야 한다.
3. `node qa/run.mjs judge case2-fitting`
