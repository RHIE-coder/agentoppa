#!/usr/bin/env node
// 문서 참조 검사기 — 커밋된 markdown의 *상대경로 링크*가 실재 파일로 풀리는지 점검(링크형 dangling 검출).
//   왜: "참조를 좁은 데서 못 찾음"을 "없다/stale"로 단정하는 맹점의 기계 조각. 판단 조각(검색 실패 ≠ 부재)은
//        always-on "참조와 부재"가 맡고, 여기선 링크형만 잡는다(산문 속 맨 이름은 인스턴스라 기계화 불가 → always-on).
//   점검: [text](상대경로)가 안 풀리면 error. 절대경로(/Users/…) 링크는 warn(repo 밖 = 조용히 썩음·검증 불가).
//   건너뜀: 외부 URL(scheme://)·mailto·앵커(#)·코드블록(``` ~~~)·인라인코드(`…`) — 예시라.
// 사용법: node check-doc-refs.mjs [파일 또는 디렉터리]   (기본: cwd)
// 종료코드: dangling 0건이면 0, 있으면 1, 경로 없으면 2. Node 빌트인만 → mac·linux·windows 동일.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";

const c = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", x: "\x1b[0m" };
let errors = 0, warns = 0;
const err = (m) => { console.log(`  ${c.r}✗${c.x} ${m}`); errors++; };
const warn = (m) => { console.log(`  ${c.y}⚠${c.x} ${m}`); warns++; };

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".next-test", "dist", "build"]);

const target = process.argv[2] ?? ".";
console.log(`check-doc-refs → ${target}`);
if (!existsSync(target)) { err(`경로 없음: ${target}`); process.exit(2); }

function mdFiles(p) {
  if (statSync(p).isFile()) return extname(p) === ".md" ? [p] : [];
  const out = [];
  for (const name of readdirSync(p)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(p, name);
    if (statSync(full).isDirectory()) out.push(...mdFiles(full));
    else if (extname(full) === ".md") out.push(full);
  }
  return out;
}

function linksOf(text) {
  // 코드블록·인라인코드 제거(예시라 건너뜀) → 링크만 추출
  const stripped = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`]*`/g, "");
  const out = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(stripped))) out.push(m[1].trim().split(/\s+/)[0]); // (path "title") → path만
  return out;
}

let checked = 0;
for (const file of mdFiles(target)) {
  for (const rawLink of linksOf(readFileSync(file, "utf8"))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(rawLink)) continue;  // http: https: mailto: file: …
    if (rawLink.startsWith("#")) continue;                // 앵커
    const p = rawLink.replace(/[#?].*$/, "");             // #anchor·?query 떼기
    if (!p) continue;
    checked++;
    if (p.startsWith("/")) { warn(`${file}: 절대/repo밖 링크 '${p}' — 조용히 썩음(검증 불가). 상대경로로 들이거나 사람이 확인.`); continue; }
    if (!existsSync(resolve(dirname(file), p))) err(`${file}: dangling 링크 '${p}' — 가리키는 파일 없음.`);
  }
}

console.log(`result: ${errors} error(s), ${warns} warning(s)  · 링크 ${checked}건 점검`);
process.exit(errors === 0 ? 0 : 1);
