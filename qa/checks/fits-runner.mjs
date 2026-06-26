#!/usr/bin/env node
// qa/checks/fits-runner.mjs — fits_existing_runner 판정 로직의 standalone validator (red/green fixture 용).
//   fixture dir 모양: before/ 와 after/ 두 스냅샷. before→after 의 package.json 비교 + after 에만 있는 파일 = 추가파일.
//   사용법: node qa/checks/fits-runner.mjs <fixtureDir>   exit 0=통과, 1=위반, 2=입력오류.
//   판정 본체는 lib/fits-runner.mjs (run.mjs 의 JUDGE 와 동일 모듈 공유 → 한 곳만 테스트하면 둘 다 보증).
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { judgeFitsRunner } from "./lib/fits-runner.mjs";

const dir = process.argv[2];
if (!dir || !existsSync(dir)) { console.log(`✗ fixture dir 없음: ${dir}`); process.exit(2); }
const beforeDir = join(dir, "before"), afterDir = join(dir, "after");
if (!existsSync(beforeDir) || !existsSync(afterDir)) {
  console.log(`✗ fixture 는 before/ 와 after/ 를 가져야 함: ${dir}`); process.exit(2);
}

const readPkg = (d) => {
  const p = join(d, "package.json");
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { console.log(`✗ package.json 파싱 실패: ${p}`); process.exit(2); }
};

// 디렉터리 전체 파일을 상대경로 셋으로.
function walk(root) {
  const out = new Set();
  const rec = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) rec(full);
      else out.add(relative(root, full));
    }
  };
  rec(root);
  return out;
}

const before = readPkg(beforeDir), after = readPkg(afterDir);
const beforeFiles = walk(beforeDir), afterFiles = walk(afterDir);
const addedFiles = [...afterFiles].filter((f) => !beforeFiles.has(f));

const r = judgeFitsRunner(before, after, addedFiles);
console.log(`${r.ok ? "✓" : "✗"} ${r.msg}`);
process.exit(r.ok ? 0 : 1);
