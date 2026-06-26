#!/usr/bin/env node
// 레이어 점검 — 엔진 디렉터리가 disposable 한 QA 트리(이름은 아래 DISP)를 참조하지 않는지(한방향 의존).
//   왜: 불변식 "core/engine ↛ disposable 콘텐츠" 의 기계 조각. disposable 은 통째로 빼도 프레임워크가 멀쩡해야 함.
//        의존은 한 방향(disposable→프레임워크)만 허용 → 엔진(plugins)에서 반대 방향 참조가 있으면 반칙.
//   점검: <dir> 아래 텍스트 파일에 경로형 'DISP/' 참조가 있으면 error.
//   주의: 이 파일 자신이 plugins 아래 살므로, 리터럴 경로 토큰을 본문에 두지 않는다(자기검출 회피) → DISP 로 조립.
// 사용법: node check-no-qa-ref.mjs <dir>   종료코드: 0=깨끗, 1=참조있음, 2=경로없음. Node 빌트인만 → 크로스OS.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const DISP = "qa"; // disposable 디렉터리 이름 (리터럴 'DISP/' 토큰을 본문에 안 쓰려고 변수로)
const c = { r: "\x1b[31m", g: "\x1b[32m", x: "\x1b[0m" };
const SKIP = new Set(["node_modules", ".git", ".work", "dist", "build"]);
const TEXT = new Set([".md", ".mjs", ".js", ".cjs", ".json", ".yaml", ".yml", ".toml", ".txt", ".sh"]);
const REF = new RegExp(`(^|[\\s"'\`(\\[=:./])${DISP}\\/`); // 경로 경계 뒤에 오는 'DISP/' 만(단어 일부 제외)

const target = process.argv[2] ?? ".";
console.log(`check-no-qa-ref → ${target}`);
if (!existsSync(target)) { console.log(`${c.r}✗ 경로 없음: ${target}${c.x}`); process.exit(2); }

let errors = 0, files = 0;
function walk(p) {
  if (statSync(p).isFile()) { files++; return scan(p); }
  for (const name of readdirSync(p)) {
    if (SKIP.has(name)) continue;
    const full = join(p, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (TEXT.has(extname(full))) { files++; scan(full); }
  }
}
function scan(file) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (REF.test(line)) {
      console.log(`  ${c.r}✗${c.x} ${file}:${i + 1} — disposable('${DISP}/') 참조: ${line.trim().slice(0, 80)}`);
      errors++;
    }
  });
}
walk(target);
console.log(errors
  ? `${c.r}result: ${errors} 참조 — 엔진은 disposable('${DISP}') 의존 금지(한방향)${c.x}`
  : `${c.g}result: 0 — 한방향 유지 (${files} 파일 점검)${c.x}`);
process.exit(errors === 0 ? 0 : 1);
