// qa/checks/lib/fits-runner.mjs — "fits_existing_runner" 순수 판정 로직 (git·fs 무관, 결정적).
//   입력만 받아 pass/fail 을 낸다 → 같은 로직을 run.mjs(.work git diff)와 standalone validator(fixture)가 공유.
//   불변식: 하네스는 *기존* 러너를 재사용한다 — 새 devDependency 0, scripts.test 불변, 새 테스트 프레임워크 설정파일 0.
//   zero-dep · Node 빌트인 호출자 쪽에서만 I/O. 이 모듈은 데이터→판정.

// 흔한 테스트 프레임워크 설정파일 마커(추가되면 = 두 번째 러너 끌어온 신호).
export const TEST_CONFIG_MARKERS = [
  "jest.config",        // jest.config.js/.cjs/.mjs/.ts/.json
  "vitest.config",      // vitest.config.*
  "vitest.workspace",
  "mocha.opts",
  ".mocharc",           // .mocharc.json/.js/.cjs/.yml/.yaml
  "ava.config",
  "jasmine.json",
  "karma.conf",
  "playwright.config",
  "cypress.config",
  "cypress.json",
  "tap.config",         // node-tap
  ".taprc",
];

const isTestConfig = (p) => {
  const base = p.split("/").pop() || p;
  return TEST_CONFIG_MARKERS.some((m) => base === m || base.startsWith(m + ".") || base === m);
};

const obj = (v) => (v && typeof v === "object" ? v : {});

// before/after = 파싱된 package.json (없으면 {}), addedFiles = 시드 baseline 이후 *추가된* 파일 상대경로 배열.
// 반환: { ok, msg } — run.mjs JUDGE 모양과 동일.
export function judgeFitsRunner(before, after, addedFiles = []) {
  const fails = [];

  // 1) 새 devDependencies 추가 0 (버전 변경/제거는 별개 — 여기선 "추가"만 본다).
  const beforeDev = obj(before.devDependencies);
  const afterDev = obj(after.devDependencies);
  const newDev = Object.keys(afterDev).filter((k) => !(k in beforeDev));
  if (newDev.length) fails.push(`새 devDependencies 추가: ${newDev.join(", ")}`);

  // 2) scripts.test 불변 (기존 러너 그대로 재사용).
  const beforeTest = obj(before.scripts).test;
  const afterTest = obj(after.scripts).test;
  if ((beforeTest ?? "") !== (afterTest ?? ""))
    fails.push(`scripts.test 변경: ${JSON.stringify(beforeTest)} → ${JSON.stringify(afterTest)}`);

  // 3) 새 테스트 프레임워크 설정파일 추가 0.
  const newConfigs = addedFiles.filter(isTestConfig);
  if (newConfigs.length) fails.push(`새 테스트 설정파일 추가: ${newConfigs.join(", ")}`);

  return fails.length
    ? { ok: false, msg: `기존 러너 재사용 위반:\n      ${fails.join("\n      ")}` }
    : { ok: true, msg: "기존 러너 재사용 OK (새 devDep·테스트설정 0, scripts.test 불변)" };
}

export { isTestConfig };
