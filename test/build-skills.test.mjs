// build-skills 골든 스냅샷 테스트 — 컴파일러의 *산출 내용*이 고정 스냅샷과 일치하는지.
//   왜: validator red/green 은 pass/fail 만 본다 → 슬롯 치환·self-gate·헤더·런타임읽기 같은 *컴파일 산출 내용*의
//        회귀는 못 잡는다. 이 골든이 그 빈틈을 메운다(라이브 e2e 후속 가드).
//
//   무엇을 보장하나 (잠금된 새 모델 — ARCHITECTURE §2 / AGENTS.md):
//     1. 산출 위치 = Project(.harness/) → 재사용 Core 묶음 `<root>/.agentoppa/` (루트 직하 아님).
//          skills 는 .agentoppa/plugins/<core>/skills/<name>/SKILL.md 한 트리 (core 이름 = config.harness='demo').
//     2. 두 빈자리 모두 런타임-읽기(재사용 비결 — 박으면 소비 프로젝트가 재빌드 없이 못 바꾼다):
//          - 값-빈자리({test_command}) → *박지 않음*. 런타임에 config.yaml(values)을 읽어 쓰라는 결정적 산문으로
//            펼쳐짐 (golden 에 저자 값 'npm test' 는 안 보이고, '값' 안내만 보임).
//          - 능력-빈자리({cap:test-runner}) → *박지 않음*. 런타임에 config.yaml(bindings→impl)을 읽어 풀라는
//            결정적 산문으로 펼쳐짐 (golden 에 구현 토큰 'vitest'·'npx vitest run' 은 안 보이고, '능력' 안내만 보임).
//            이게 "같은 Core, 다른 값·구현 주입"을 가능케 하는 새 모델의 핵심 — golden 이 회귀를 잡는다.
//          - 작업폴더(feature) → *박지 않음*. 경로에 <작업폴더> 자리표시 + "실행 시 config.feature→git브랜치→default 로
//            풀라" 안내로 펼쳐짐(브랜치 바꿔도 폴더 따라감 = resume·병렬 공짜). 박으면 fixture 의 'thing/' 이 경로에 샌다.
//     3. fallback 배선 = 루트 CLAUDE.md(@import)·AGENTS.md(경로 한 줄)가 always-on.md 를 가리킨다
//          (플러그인 없이 떠도 행동 가드 생존). golden 으로 그 줄·형식을 고정.
//     4. README = 적재 메뉴·폴더 목적·배포 옵션. golden 으로 산문 템플릿을 고정.
//     5. 멱등 = 같은 입력 → 같은 산출 (재컴파일해도 SKILL.md·README·CLAUDE.md·AGENTS.md byte-identical).
//          특히 fallback append 는 import 줄 존재검사로 멱등이어야 한다(두 번째 실행이 줄을 또 붙이면 안 됨).
//
//   입력  = .agentoppa/fixtures/build-skills/input/.harness/  (spec→impl→test, 값+능력 빈자리 둘 다)
//   골든  = .agentoppa/fixtures/build-skills/golden/{skills/<name>/SKILL.md, README.md, CLAUDE.md, AGENTS.md}
//   산출  = <tmp>/.agentoppa/... + <tmp>/{CLAUDE.md,AGENTS.md}
//   의도된 컴파일러 변경이면 golden 을 재생성한다(README/주석 참조).
// Node 빌트인만(zero-dep) → mac·linux·windows 동일.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fx = join(repoRoot, ".agentoppa/fixtures/build-skills");
const golden = join(fx, "golden");
const buildSkills = join(repoRoot, "plugins/agentoppa/bin/build-skills.mjs");

function compileInTemp(prefix) {
  const work = mkdtempSync(join(tmpdir(), prefix));
  cpSync(join(fx, "input/.harness"), join(work, ".harness"), { recursive: true });
  const r = spawnSync(process.execPath, [buildSkills, work], { encoding: "utf8" });
  return { work, r };
}

// 골든 파일 한 개와 산출 한 개를 byte-identical 로 비교. (산출 경로는 work 기준 상대.)
function assertGolden(work, goldRel, outRel, what) {
  const got = join(work, outRel);
  assert.ok(existsSync(got), `컴파일 산출 누락: ${outRel} (${what})`);
  assert.equal(
    readFileSync(got, "utf8"),
    readFileSync(join(golden, goldRel), "utf8"),
    `${outRel} 가 golden 과 다름 — 컴파일러 산출 회귀? (${what}; 의도된 변경이면 golden 재생성)`,
  );
}

test("build-skills golden — 컴파일 SKILL.md 가 스냅샷과 일치 (값·능력 모두 런타임읽기)", () => {
  const { work, r } = compileInTemp("bs-golden-");
  try {
    assert.equal(r.status, 0, `build-skills 실패(exit ${r.status})\n${r.stdout}${r.stderr}`);
    const goldSkills = join(golden, "skills");
    const names = readdirSync(goldSkills);
    assert.ok(names.length > 0, "golden skills 비어 있음");
    for (const name of names)
      assertGolden(work, join("skills", name, "SKILL.md"), join(".agentoppa/plugins/demo/skills", name, "SKILL.md"), `skills/${name}`);

    // 새 모델 불변식을 골든 텍스트로 직접 못박는다(경로·접두만 보던 회귀 방지).
    const testSkill = readFileSync(join(work, ".agentoppa/plugins/demo/skills/test/SKILL.md"), "utf8");
    // 값-빈자리도 박지 않는다 — 저자 config 값이 산출에 새면 소비 프로젝트가 재빌드 없이 못 바꾼다(재사용 깨짐).
    assert.ok(!testSkill.includes("npm test"), "값 토큰 'npm test' 가 산출에 박혔다 — 런타임읽기 위반(재사용 깨짐)");
    assert.ok(testSkill.includes("`test_command`(값)"), "값-빈자리가 런타임읽기 산문으로 펼쳐지지 않음");
    assert.ok(testSkill.includes("값 없음: test_command"), "값 미채움 시 멈추라는 안내('값 없음')가 없음");
    // 능력-빈자리는 박지 않는다 — 구현 토큰(bindings/impl 값)이 산출에 새면 재사용이 깨진 것.
    assert.ok(!testSkill.includes("vitest"), "능력 구현 토큰 'vitest' 가 산출에 박혔다 — 런타임읽기 위반(재사용 깨짐)");
    assert.ok(testSkill.includes("`test-runner`(능력)"), "능력-빈자리가 런타임읽기 산문으로 펼쳐지지 않음");
    // 조사 회귀 가드: 옛 '**이름** 능력' 인라인은 본문 '{cap} 로' 를 '능력 로'(비문)로 만들었다 → 조사-중립 형식 고정.
    assert.ok(!testSkill.includes("능력 로"), "능력 인라인 치환이 조사 깨짐('능력 로') — 조사-중립 형식이 아님");
    assert.ok(testSkill.includes("`.harness/config.yaml`"), "런타임읽기 안내(config.yaml 읽어 실행)가 없음");
    // 요청2 회귀 가드: 작업폴더(feature)를 빌드 때 박지 않는다 — 실행 시 config→브랜치→default 로 푼다.
    //   fixture config 는 feature: thing 이라, 박으면 산출 경로에 'artifacts/thing/' 이 샌다. 안 박히면 <작업폴더> 자리표시 + 안내만.
    const specSkill = readFileSync(join(work, ".agentoppa/plugins/demo/skills/spec/SKILL.md"), "utf8");
    for (const [nm, md] of [["spec", specSkill], ["test", testSkill]]) {
      assert.ok(!md.includes("artifacts/thing/"), `${nm}: 작업폴더 'thing' 이 경로에 박힘 — 런타임 해석 위반(resume·재사용 깨짐)`);
      assert.ok(md.includes(".harness/artifacts/<작업폴더>/"), `${nm}: 작업폴더가 <작업폴더> 자리표시로 안 남음`);
    }
    assert.ok(specSkill.includes("실행 시 정한다"), "작업폴더 런타임 해석 안내(실행 시 정한다)가 없음");
    assert.ok(specSkill.includes("git 브랜치"), "작업폴더 안내에 git 브랜치 폴백 규칙이 없음");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("build-skills golden — README·fallback(CLAUDE.md/AGENTS.md) 가 스냅샷과 일치", () => {
  const { work, r } = compileInTemp("bs-aux-");
  try {
    assert.equal(r.status, 0, `build-skills 실패(exit ${r.status})\n${r.stdout}${r.stderr}`);
    // Core 묶음은 <root>/.agentoppa/ 에 자체완결 — 루트 직하에 .claude-plugin/plugins 를 만들면 안 된다.
    assert.ok(existsSync(join(work, ".agentoppa")), "Core 묶음 .agentoppa/ 미생성");
    assert.ok(!existsSync(join(work, "plugins")), "루트 직하 plugins/ 생성됨 — Core 는 .agentoppa/ 안에 묶여야 한다");
    assertGolden(work, "README.md", ".agentoppa/README.md", "적재 메뉴·폴더 목적·배포 옵션");
    assertGolden(work, "CLAUDE.md", "CLAUDE.md", "fallback: @import always-on");
    assertGolden(work, "AGENTS.md", "AGENTS.md", "fallback: always-on 경로 한 줄");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("build-skills 멱등 — 재컴파일해도 SKILL.md·README·CLAUDE.md·AGENTS.md 불변", () => {
  const { work } = compileInTemp("bs-idem-");
  try {
    // SKILL.md(슬롯 치환) + README(템플릿) + CLAUDE.md/AGENTS.md(append-only fallback) 모두 재실행 후 byte-identical.
    //   특히 fallback append 는 import 줄 존재검사로 멱등이어야 한다 — 두 번째 실행이 줄을 또 붙이면 여기서 깨진다.
    const targets = [
      join(work, ".agentoppa/plugins/demo/skills/spec/SKILL.md"),
      join(work, ".agentoppa/plugins/demo/skills/test/SKILL.md"),
      join(work, ".agentoppa/README.md"),
      join(work, "CLAUDE.md"),
      join(work, "AGENTS.md"),
    ];
    const before = targets.map((f) => readFileSync(f, "utf8"));
    spawnSync(process.execPath, [buildSkills, work], { encoding: "utf8" });
    for (let i = 0; i < targets.length; i++)
      assert.equal(readFileSync(targets[i], "utf8"), before[i], `재컴파일이 ${targets[i]} 를 바꿈(비멱등)`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("build-skills — 빌드된 Core 가 소비 프로젝트의 .harness 를 자급한다 (setup·interface·scaffold, AgentOppa 없이)", () => {
  // 새 모델: 빌드된 Core(플러그인)가 *스스로* 소비 프로젝트의 .harness/config.yaml 을 깐다 → 프로젝트B는 AgentOppa 불필요.
  //   여기선 (1) Core 묶음이 interface.json + setup 스킬 + scaffold 헬퍼를 싣는지, (2) 빈 소비 디렉터리에서
  //   그 scaffold 만으로 config 골격이 깔리고 능력 빈자리가 노출되는지, (3) 재실행이 미채움을 보고(전파)하는지 잠근다.
  const { work, r } = compileInTemp("bs-setup-");
  const consumer = mkdtempSync(join(tmpdir(), "bs-consumer-"));
  try {
    assert.equal(r.status, 0, `build-skills 실패(exit ${r.status})\n${r.stdout}${r.stderr}`);
    const core = join(work, ".agentoppa/plugins/demo");

    // 1) Core 묶음이 인터페이스 명세 + setup 스킬 + scaffold 헬퍼를 싣는다.
    const ifacePath = join(core, "interface.json");
    assert.ok(existsSync(ifacePath), "interface.json 미생성");
    const iface = JSON.parse(readFileSync(ifacePath, "utf8"));
    assert.equal(iface.core, "demo", "interface.core 불일치");
    assert.ok(iface.capabilities.some((c) => c.key === "test-runner"), "능력 빈자리 test-runner 가 interface 에 없음");
    assert.ok(existsSync(join(core, "skills/setup/SKILL.md")), "setup 스킬 미생성");
    assert.ok(existsSync(join(core, "skills/setup/scaffold.mjs")), "scaffold 헬퍼 미생성");

    // 2) 소비 프로젝트(빈 디렉터리, AgentOppa 없음)가 Core 의 scaffold.mjs 만으로 .harness/config.yaml 을 깐다.
    const s = spawnSync(process.execPath, [join(core, "skills/setup/scaffold.mjs")], {
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: consumer },
    });
    assert.equal(s.status, 0, `scaffold 실패(exit ${s.status})\n${s.stdout}${s.stderr}`);
    const cfgPath = join(consumer, ".harness/config.yaml");
    assert.ok(existsSync(cfgPath), "소비 프로젝트 .harness/config.yaml 미생성");
    const cfg = readFileSync(cfgPath, "utf8");
    assert.ok(cfg.includes("core: demo"), "스캐폴딩된 config 가 Core 를 가리키지 않음");
    assert.ok(/bindings:[\s\S]*test-runner:/.test(cfg), "스캐폴딩된 config 에 능력 빈자리(test-runner) 없음");

    // 3) 멱등 + 전파: 다시 돌리면 안 채운 빈자리를 보고한다(덮어쓰지 않음).
    const s2 = spawnSync(process.execPath, [join(core, "skills/setup/scaffold.mjs")], {
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: consumer },
    });
    assert.equal(s2.status, 0, "scaffold 재실행 실패");
    assert.ok(/안 채워진 능력 빈자리/.test(s2.stdout), "미채움 빈자리를 보고하지 않음(전파 신호 없음)");

    // 4) 왕복(요청5): 스캐폴딩된 config 를 정본 검사기로 validate → phases 가 블록으로 파싱돼야(통과).
    //    scaffold 가 인라인 배열(`phases: [a,b]`)로 쓰면 parseConfig 가 스칼라로 먹어 "phases 비어 있음"으로 죽는다.
    const validateMjs = join(repoRoot, "plugins/agentoppa/skills/agent-engineer/scripts/validate.mjs");
    const v = spawnSync(process.execPath, [validateMjs, cfgPath], { encoding: "utf8" });
    assert.ok(/phases 3단계: spec → impl → test/.test(v.stdout), "스캐폴딩된 config 의 phases 가 블록으로 안 읽힘 — 인라인 배열 회귀(왕복 깨짐)");
    assert.equal(v.status, 0, `스캐폴딩된 config 가 validate 실패(왕복 깨짐)\n${v.stdout}${v.stderr}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(consumer, { recursive: true, force: true });
  }
});

// 골격 결함 픽스 회귀 가드 (A·B·C) — 골든 입력엔 없는 경로라 별도 인라인 하네스로 못박는다.
//   왜: build 가 (A) 프로젝트 훅을 기본 게이트로 덮거나, (⑤) always-on 주어를 'AgentOppa'로 흘리거나,
//        (C) self-gate 문구를 '일 때만 일 때만' 으로 중복시키거나, (B) README 적재경로에서 .agentoppa/ 를
//        빠뜨리면 — 소비 프로젝트가 후처리를 손으로 짜야 했다. 그 재발을 여기서 잡는다.
function buildInline(prefix, files) {
  const work = mkdtempSync(join(tmpdir(), prefix));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(work, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  const r = spawnSync(process.execPath, [buildSkills, work], { encoding: "utf8" });
  return { work, r };
}

test("build-skills 골격 결함 가드 — 프로젝트 훅 이관(안 덮음)·always-on 주어·self-gate 중복·README 적재경로", () => {
  const { work, r } = buildInline("bs-guard-", {
    ".harness/config.yaml": "harness: guardcore\nsync: strict\nphases:\n  - solo\n",
    ".harness/project/phases/solo.md":
      "---\nname: solo\ndesc: 단독 단계.\nconsumes: ~\nproduces: out\nwhen: 직행 경로일 때만\ngate: \"무언가 green\"\n---\n본문 한 줄. → {next}\n",
    // 프로젝트 저작 훅 — 커스텀 세션훅 + 스크립트. build 가 기본 게이트로 덮으면 안 된다.
    ".harness/project/hooks/hooks.json":
      '{\n  "hooks": {\n    "SessionStart": [\n      { "hooks": [{ "type": "command", "command": "node \\"${CLAUDE_PLUGIN_ROOT}/hooks/inject-x.mjs\\"" }] }\n    ]\n  }\n}\n',
    ".harness/project/hooks/inject-x.mjs": "// custom session hook (marker: INJECT_X)\nprocess.exit(0);\n",
  });
  try {
    assert.equal(r.status, 0, `build 실패(exit ${r.status})\n${r.stdout}${r.stderr}`);
    const core = join(work, ".agentoppa/plugins/guardcore");

    // (A) 프로젝트 훅을 그대로 이관 — 기본 게이트(gate-review.mjs)로 덮지 않는다(strict phase 라도).
    assert.ok(existsSync(join(core, "hooks/hooks.json")), "프로젝트 hooks.json 미이관");
    assert.ok(readFileSync(join(core, "hooks/hooks.json"), "utf8").includes("SessionStart"),
      "이관된 hooks.json 이 프로젝트 저작본이 아님(기본 게이트로 덮임) — clobber 회귀");
    assert.ok(existsSync(join(core, "hooks/inject-x.mjs")), "커스텀 훅 스크립트(inject-x.mjs) 미이관");
    assert.ok(!existsSync(join(core, "hooks/gate-review.mjs")),
      "프로젝트 훅이 있는데 기본 게이트(gate-review.mjs)가 생성됨 — 프로젝트 훅을 덮는 회귀");

    // (⑤) 빌드된 always-on 주어는 이 Core 이름 — 정본 'AgentOppa 플러그인' 이 새면 안 된다.
    const alwaysOn = readFileSync(join(core, "always-on.md"), "utf8");
    assert.ok(alwaysOn.includes("guardcore 하네스가 깔린 세션"), "always-on 주어가 Core 이름으로 정정되지 않음");
    assert.ok(!alwaysOn.includes("AgentOppa 플러그인이 깔린 세션"), "always-on 에 정본 주어 'AgentOppa 플러그인'이 샘 — 이름 잔재 회귀");

    // (C) self-gate 문구 중복 없음 — when 이 '…때만'으로 끝나도 '일 때만' 을 또 붙이지 않는다.
    const skill = readFileSync(join(core, "skills/solo/SKILL.md"), "utf8");
    assert.ok(skill.includes("직행 경로일 때만 한다."), "self-gate 문구가 자연스럽게 나오지 않음");
    assert.ok(!/일 때만\s*일 때만/.test(skill), "self-gate 문구가 '일 때만 일 때만' 으로 중복됨 — 회귀");

    // (B) README 적재경로는 레포 루트 기준(.agentoppa/ 포함) — 빠지면 --plugin-dir 로 못 찾는다.
    const readme = readFileSync(join(work, ".agentoppa/README.md"), "utf8");
    assert.ok(readme.includes("--plugin-dir ./.agentoppa/plugins/guardcore"),
      "README 적재경로에 .agentoppa/ 접두가 빠짐 — 루트에서 플러그인 못 찾는 회귀");

    // (크로스OS) 로컬 저작 phase 소스가 phases/ 로 emit 되는가 — authoredHere 를 path.sep 로 판정(하드코딩 '/'면 윈도우에서 조용히 누락).
    assert.ok(existsSync(join(core, "phases/solo.md")), "로컬 저작 phase 소스가 phases/ 로 emit 안 됨(authoredHere 경로판정 회귀)");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("build-skills 크래시 가드 — phase 소스 0개면 조용한 ENOENT 대신 명확한 에러+exit≠0", () => {
  // core: 재사용 모드인데 Core 묶음이 없어 phase 를 하나도 못 가리키면: 예전엔 interface.json 쓰다 ENOENT 로 죽었다.
  const { work, r } = buildInline("bs-nophase-", {
    ".harness/config.yaml": "core: ghost\nphases:\n  - spec\n", // spec 소스 없음 + ghost 묶음 없음 → 컴파일 0개.
  });
  try {
    assert.notEqual(r.status, 0, "phase 0개인데 성공해버림(빈 Core 를 조용히 산출)");
    const out = r.stdout + r.stderr;
    assert.ok(/컴파일된 스킬 0개/.test(out), "0개일 때 명확한 안내가 없음");
    assert.ok(!/ENOENT/.test(out), "여전히 ENOENT 로 죽음 — 크래시 가드 회귀");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("build-skills 기본 게이트 훅 — 크로스OS rel + 문법·동작(비손상 deny)", () => {
  // strict 게이트 phase 만 있고 project/hooks/ 는 없을 때 emit 되는 '비손상' 기본 게이트.
  const { work, r } = buildInline("bs-gate-", {
    ".harness/config.yaml": "harness: gatecore\nsync: strict\nphases:\n  - spec\n",
    ".harness/project/phases/spec.md": "---\nname: spec\ndesc: 명세.\nconsumes: ~\nproduces: spec\ngate: \"무언가 green\"\n---\n본문.\n",
  });
  const mock = mkdtempSync(join(tmpdir(), "bs-gate-mock-"));
  try {
    assert.equal(r.status, 0, `build 실패\n${r.stdout}${r.stderr}`);
    const hook = join(work, ".agentoppa/plugins/gatecore/hooks/gate-review.mjs");
    assert.ok(existsSync(hook), "strict 게이트인데 기본 게이트 훅 미생성");

    // (크로스OS) rel 을 relative() 로 뽑고 하드코딩 startsWith('/') 는 없어야 — 윈도우에서 src/·test/ 판정이 맞게.
    const src = readFileSync(hook, "utf8");
    assert.ok(src.includes("relative(root, abs)"), "게이트 훅이 relative() 로 rel 을 안 뽑음(하드코딩 경로비교로 회귀 — 윈도우 깨짐)");
    assert.ok(!src.includes("abs.startsWith(resolve(root)"), "게이트 훅에 하드코딩 '/' 경로비교가 남음(윈도우 회귀)");

    // 문법 유효(템플릿 이스케이프 깨짐 방지).
    assert.equal(spawnSync(process.execPath, ["--check", hook]).status, 0, "생성된 게이트 훅 문법 오류(이스케이프 깨짐)");

    // 동작: 기존 src/ 파일 Edit 시도 → deny.
    mkdirSync(join(mock, "src"), { recursive: true });
    writeFileSync(join(mock, "src/x.js"), "old\n");
    const h = spawnSync(process.execPath, [hook], {
      input: '{"tool_name":"Edit","tool_input":{"file_path":"src/x.js"}}',
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: mock },
    });
    assert.ok(/"permissionDecision":"deny"/.test(h.stdout), "기존 src/ 파일 수정을 비손상 게이트가 막지 않음");
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(mock, { recursive: true, force: true });
  }
});

test("build-skills 선택 빈자리 꼬리(요청6) — optional 능력·값은 '건너뛰고 명시' 변형, 필수는 '멈춤' 유지", () => {
  // 능력·값 꼬리 문구가 optional 을 구분해야 한다. 선택(?)인데 "못 찾으면 멈춤"을 emit 하면 본문 '있으면 쓴다'와 모순.
  const { work, r } = buildInline("bs-optslot-", {
    ".harness/config.yaml": "harness: optcore\nphases:\n  - solo\n",
    ".harness/project/phases/solo.md":
      "---\nname: solo\ndesc: 선택·필수 섞은 단계.\nconsumes: ~\nproduces: out\nneeds: [req_val, opt_val?]\nrequires: [req-cap:capability, opt-cap:capability?]\n---\n필수값 {req_val}, 선택값 {opt_val}. 필수능력 {cap:req-cap}, 선택능력 {cap:opt-cap}. → {next}\n",
  });
  try {
    assert.equal(r.status, 0, `build 실패\n${r.stdout}${r.stderr}`);
    const skill = readFileSync(join(work, ".agentoppa/plugins/optcore/skills/solo/SKILL.md"), "utf8");
    // 선택 능력: '건너뛰고 미바인딩 명시' 변형 · 필수 능력: '멈추고 바인딩 없음' 유지.
    assert.ok(/선택 빈자리[\s\S]*미바인딩: opt-cap/.test(skill), "선택 능력에 '건너뛰기+미바인딩 명시' 변형이 없음");
    assert.ok(skill.includes(`멈추고 "바인딩 없음: req-cap"`), "필수 능력의 '멈춤' 문구가 사라짐");
    assert.ok(!skill.includes(`멈추고 "바인딩 없음: opt-cap"`), "선택 능력에 '멈춤' 문구가 남음 — optional 미구분 회귀");
    // 값 슬롯도 대칭: 선택 값은 '건너뛰고 미설정 명시' · 필수 값은 '멈추고 값 없음' 유지.
    assert.ok(/선택 빈자리[\s\S]*미설정: opt_val/.test(skill), "선택 값에 '건너뛰기+미설정 명시' 변형이 없음");
    assert.ok(skill.includes(`멈추고 "값 없음: req_val"`), "필수 값의 '멈춤' 문구가 사라짐");
    assert.ok(!skill.includes(`멈추고 "값 없음: opt_val"`), "선택 값에 '멈춤' 문구가 남음 — optional 미구분 회귀");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
