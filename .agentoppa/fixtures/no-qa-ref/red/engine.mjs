// 반칙 입력: 엔진이 disposable 트리를 직접 끌어옴 (한방향 의존 위반) → 검사기가 잡아야 한다.
import helper from "../qa/run.mjs";
export const x = helper;
