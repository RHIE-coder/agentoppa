#!/usr/bin/env node
// parseConfig 동치 검사기 — build-skills.mjs 와 agent-engineer/scripts/validate.mjs 의 parseConfig 가
//   같은 config 입력에 같은 결과를 내는지(동작 동치) 자동 확인. 둘은 한 config 양식을 각각 빌드·검증에서
//   따로 파싱하므로, 해석이 갈리면 "빌드는 통과인데 검증은 실패"(또는 반대)가 난다 → 그 drift 를 기계로 막는다.
//   왜 코드를 안 합치고 동작만 비교하나: validate.mjs 는 copyFileSync 로 유저 .harness/<하네스>/core/ 에 통째 복사되는
//     자기완결 파일 → 공통 모듈 import(단일소스화)는 배포를 깬다. 그래서 합치는 대신 *동작이 같은지*를 검사한다.
//   방법: 각 파일을 PARSECONFIG_DUMP=<config> 로 자식 실행하면 parseConfig 결과 JSON 만 찍고 종료(파일 안의 덤프 훅).
//     갈릴 만한 변형 샘플(스칼라·values·bindings·impl·loop·인라인주석·따옴표속#)마다 두 출력이 deep-equal 인지 본다.
// 사용법: node check-parseconfig-parity.mjs [fileA fileB]   (기본: build-skills.mjs ↔ validate.mjs)
// 종료코드: 모든 샘플 일치면 0, 하나라도 다르면 1, 파일 없으면 2. Node 빌트인만 → mac·linux·windows 동일.
import { existsSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const c = { r: "\x1b[31m", g: "\x1b[32m", x: "\x1b[0m" };
let errors = 0;
const err = (m) => { console.log(`  ${c.r}✗${c.x} ${m}`); errors++; };

const here = dirname(fileURLToPath(import.meta.url));
// 인자: (없음)=실제 build-skills↔validate · (디렉토리 1개)=그 안 a.mjs↔b.mjs(fixture) · (파일 2개)=그 둘.
const args = process.argv.slice(2);
let fileA, fileB;
if (args.length >= 2) { [fileA, fileB] = [resolve(args[0]), resolve(args[1])]; }
else if (args.length === 1) { fileA = resolve(args[0], "a.mjs"); fileB = resolve(args[0], "b.mjs"); }
else { fileA = resolve(here, "build-skills.mjs"); fileB = resolve(here, "..", "skills", "agent-engineer", "scripts", "validate.mjs"); }
console.log(`check-parseconfig-parity → A=${fileA}`);
console.log(`                          B=${fileB}`);
for (const f of [fileA, fileB]) if (!existsSync(f)) { err(`파일 없음: ${f}`); process.exit(2); }

// 동치를 시험할 config 샘플 — 둘이 갈릴 만한 변형을 일부러 모은다.
const SAMPLES = [
  // 기본 스칼라 + phases 카드
  "feature: demo\nsync: strict\nphases:\n  - plan\n  - build\n",
  // values·bindings·impl 블록
  "phases:\n  - dev\nvalues:\n  test_command: npm test\nbindings:\n  e2e-runner: playwright\nimpl:\n  playwright: ./project/impl/pw.md\n",
  // 인라인 주석 (라이브에서 터졌던 케이스)
  "phases:  # 단계들\n  - plan  # 기획\nvalues:  # 값\n  k: v  # 코멘트\n",
  // 따옴표 안 # (clean 동작이 갈리던 바로 그 지점)
  'phases:\n  - review\nvalues:\n  msg: "a # b"\n  url: "http://x#frag"\n',
  // loop (인라인형)
  'phases:\n  - loop: { do: [dev, review], until: "통과", max: 3 }\n',
  // loop (블록형)
  'phases:\n  - loop:\n      do: [dev, review]\n      until: "기준 충족"\n      max: 5\n',
  // 카드 객체형 + sync + 평범한 카드
  "phases:\n  - { name: ui, sync: loose }\n  - plain\n",
];

// 한 파일을 PARSECONFIG_DUMP 모드로 실행해 parseConfig(cfg) 결과를 받아온다.
function dump(file, cfgText) {
  const dir = mkdtempSync(join(tmpdir(), "pcparity-"));
  const cfgPath = join(dir, "config.yaml");
  try {
    writeFileSync(cfgPath, cfgText);
    const r = spawnSync(process.execPath, [file], {
      env: { ...process.env, PARSECONFIG_DUMP: cfgPath },
      encoding: "utf8",
    });
    if (r.status !== 0) return { error: `exit ${r.status}: ${(r.stderr || r.stdout || "").trim().slice(0, 200)}` };
    try { return { value: JSON.parse(r.stdout) }; }
    catch { return { error: `JSON 파싱 실패(덤프 훅 없음?): ${r.stdout.trim().slice(0, 200)}` }; }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

SAMPLES.forEach((sample, i) => {
  const tag = `샘플#${i + 1}`;
  const a = dump(fileA, sample);
  const b = dump(fileB, sample);
  if (a.error) return err(`${tag}: A 덤프 실패 — ${a.error}`);
  if (b.error) return err(`${tag}: B 덤프 실패 — ${b.error}`);
  if (!isDeepStrictEqual(a.value, b.value))
    err(`${tag}: parseConfig 결과 불일치(drift)\n      A=${JSON.stringify(a.value)}\n      B=${JSON.stringify(b.value)}`);
});

console.log(`result: ${errors} error(s)  · 샘플 ${SAMPLES.length}건 대조`);
process.exit(errors === 0 ? 0 : 1);
