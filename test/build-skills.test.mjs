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
import { cpSync, mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from "node:fs";
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
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(consumer, { recursive: true, force: true });
  }
});
