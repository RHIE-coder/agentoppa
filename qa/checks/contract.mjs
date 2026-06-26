#!/usr/bin/env node
// qa/checks/contract.mjs — contract 판정의 standalone validator (red/green fixture 용).
//   fixture dir 모양: 그 아래 .md 들이 산출물. 인계 *순서* 는 파일명 앞 숫자 접두로 인코딩(예: 01-spec.md, 02-tdd.md).
//     접두 = 순서, role = 접두 떼고 .md 떼고. (실전 .work 에선 run.mjs 가 config.yaml phase 순서를 준다.)
//   사용법: node qa/checks/contract.mjs <artifactsDir>   exit 0=통과, 1=위반, 2=입력오류.
//   판정 본체는 lib/contract.mjs (run.mjs JUDGE 와 동일 모듈 공유).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { judgeContract, parseDocHeader } from "./lib/contract.mjs";

const dir = process.argv[2];
if (!dir || !existsSync(dir)) { console.log(`✗ artifacts dir 없음: ${dir}`); process.exit(2); }

const files = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "lock.json").sort();
const docs = files.map((f) => {
  const { hasHeader, header } = parseDocHeader(readFileSync(join(dir, f), "utf8"));
  // 앞의 "NN-" 순서 접두를 떼어 role 을 얻는다(파일명 알파벳정렬 ≠ 인계순서 문제를 회피).
  const role = f.replace(/\.md$/, "").replace(/^\d+[-_]/, "");
  return { role, hasHeader, header };
});

const r = judgeContract(docs);
console.log(`${r.ok ? "✓" : "✗"} ${r.msg}`);
process.exit(r.ok ? 0 : 1);
