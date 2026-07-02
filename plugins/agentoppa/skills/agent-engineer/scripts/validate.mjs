#!/usr/bin/env node
// agent-engineer validator — .harness/config.yaml(Config) + project/phases/ 를 계약(contract §4)으로 점검.
// 사용법: node validate.mjs [path/to/.harness/config.yaml]   (기본: .harness/config.yaml)
// 종료코드: 오류 0건이면 0, 있으면 1, config 없으면 2.
// 셸·외부 의존 없음(Node 빌트인만) → mac·linux·windows 동일.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

const c = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", x: "\x1b[0m" };
let errors = 0, warns = 0;
const err = (m) => { console.log(`  ${c.r}✗${c.x} ${m}`); errors++; };
const warn = (m) => { console.log(`  ${c.y}⚠${c.x} ${m}`); warns++; };
const ok = (m) => { console.log(`  ${c.g}✓${c.x} ${m}`); };

// YAML 스칼라 값에서 인라인 주석(#)을 떼되 따옴표 안의 #는 보존(build-skills.mjs 와 동치 — parity 검사기가 강제).
function stripComment(s) {
  let inS = false, inD = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (ch === "#" && !inS && !inD) {
      if (i === 0 || /\s/.test(s[i - 1])) return s.slice(0, i);
    }
  }
  return s;
}
const clean = (s) => stripComment(s).trim().replace(/^["']|["']$/g, "");
const splitList = (s) => stripComment(s).replace(/^\[|\]$/g, "").split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);

const DUMP_CFG = process.env.PARSECONFIG_DUMP || null; // 동치 검사용: parseConfig 결과만 덤프하고 종료(아래 훅)
const cfgPath = process.argv[2] ?? ".harness/config.yaml";
let harnessDir = null, raw = null;
if (!DUMP_CFG) {
  console.log(`agent-engineer validate → ${cfgPath}`);
  if (!existsSync(cfgPath)) { err("config.yaml 없음"); process.exit(2); }
  harnessDir = dirname(cfgPath);
  raw = readFileSync(cfgPath, "utf8");
}

// ---------- config.yaml 파서 (라인 기반, 이 양식 전용) ----------
// (build-skills.mjs 의 parseConfig 와 동치 — bindings/impl 블록 파싱을 둘 다에 똑같이 둔다.)
function parseConfig(text) {
  const lines = text.split(/\r?\n/);
  const cfg = { scalars: {}, values: {}, bindings: {}, impl: {}, phases: [] };
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "" || /^\s*#/.test(l)) { i++; continue; }
    if (/^phases:\s*(#.*)?$/.test(l)) { i = parsePhases(lines, i + 1, cfg); continue; }
    if (/^values:\s*(#.*)?$/.test(l)) { i = parseBlock(lines, i + 1, cfg.values); continue; }
    if (/^bindings:\s*(#.*)?$/.test(l)) { i = parseBlock(lines, i + 1, cfg.bindings); continue; }
    if (/^impl:\s*(#.*)?$/.test(l)) { i = parseBlock(lines, i + 1, cfg.impl); continue; }
    const m = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m && m[2].trim() !== "") cfg.scalars[m[1]] = clean(m[2]);
    i++;
  }
  return cfg;
}
// 1-depth 평평한 블록(`키: 값` 한 줄들)을 target 맵에 채운다. values·bindings·impl 공용.
function parseBlock(lines, i, target) {
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "" || /^\s*#/.test(l)) { i++; continue; }
    if (!/^\s+/.test(l)) break;
    const m = l.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) target[m[1]] = clean(m[2]);
    i++;
  }
  return i;
}
function parsePhases(lines, i, cfg) {
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "" || /^\s*#/.test(l)) { i++; continue; }
    if (!/^\s+-/.test(l)) break;
    const v = (l.match(/^\s*-\s*(.+?)\s*$/) || [])[1];
    if (!v) { i++; continue; }
    if (/^loop:/.test(v)) {
      const loop = { type: "loop", do: [], until: null, max: null };
      const inline = v.match(/\{(.+)\}/);
      if (inline) {
        const dm = inline[1].match(/do:\s*\[([^\]]*)\]/); if (dm) loop.do = splitList(dm[1]);
        const um = inline[1].match(/until:\s*"([^"]*)"|until:\s*'([^']*)'|until:\s*([^,}]+)/); if (um) loop.until = (um[1] ?? um[2] ?? um[3]).trim();
        const mm = inline[1].match(/max:\s*(\d+)/); if (mm) loop.max = +mm[1];
        i++;
      } else {
        const base = l.search(/\S/); i++;
        while (i < lines.length && (lines[i].trim() === "" || lines[i].search(/\S/) > base)) {
          const dm = lines[i].match(/do:\s*\[([^\]]*)\]/); if (dm) loop.do = splitList(dm[1]);
          const um = lines[i].match(/^\s*until:\s*(.+)$/); if (um) loop.until = clean(um[1]);
          const mm = lines[i].match(/max:\s*(\d+)/); if (mm) loop.max = +mm[1];
          i++;
        }
      }
      cfg.phases.push(loop);
    } else if (/^\{/.test(v)) {
      const nm = v.match(/name:\s*([^,}\s]+)/);
      const sm = v.match(/sync:\s*([^,}\s]+)/);
      cfg.phases.push({ type: "card", name: nm ? nm[1] : null, sync: sm ? sm[1] : null });
      i++;
    } else {
      cfg.phases.push({ type: "card", name: clean(v) });
      i++;
    }
  }
  return i;
}

// 동치 검사 훅: PARSECONFIG_DUMP=<config> 면 parseConfig 결과만 JSON 으로 찍고 종료.
//   (bin/check-parseconfig-parity.mjs 가 build-skills.mjs 의 parseConfig 와 동작 일치를 자식 프로세스로 대조.)
if (DUMP_CFG) {
  process.stdout.write(JSON.stringify(parseConfig(readFileSync(DUMP_CFG, "utf8"))));
  process.exit(0);
}

// ---------- phase 파일 frontmatter 파서 ----------
// requires 항목 한 개를 {key, optional, kind} 로 푼다. `:capability` 접미사 = 능력-빈자리, 없으면 값-빈자리.
// (`needs:` 는 값-빈자리의 옛 이름 — 파서에서 같은 풀로 흡수한다.)
function parseRequire(token) {
  const optional = /\?$/.test(token);
  let key = token.replace(/\?$/, "");
  let kind = "value";
  if (/:capability$/.test(key)) { kind = "capability"; key = key.replace(/:capability$/, ""); }
  return { key, optional, kind };
}
// phase 소스 위치 해석 (`core:` 적재 배선 — build-skills.mjs 의 phaseSourceFile 과 *동치*여야 한다).
//   - `core:` 없으면(단독 하네스): .harness/project/phases/<name>.md 만.
//   - `core: <name>` 있으면(재사용 모드): 1) project/phases/<name>.md(있으면 오버라이드 우선) →
//       2) <root 에서 위로 탐색>/.agentoppa/plugins/<core>/phases/<name>.md(Core 묶음이 든 phase 소스).
//   root = dirname(harnessDir) (build-skills 의 ROOT 와 동치 — harnessDir=<root>/.harness).
//   위로 탐색하는 이유: 한 Core 묶음을 여러 프로젝트가 공유(가리켜 재사용)하면 공통 상위에 한 벌 → 단일소스.
function kebab(s) { return String(s).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""); }
function findCorePhasesDir(startDir, core) {
  let dir = resolve(startDir);
  for (;;) {
    const cand = join(dir, ".agentoppa", "plugins", core, "phases");
    if (existsSync(cand)) return cand;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
function phaseSourceFile(name) {
  const local = join(harnessDir, "project", "phases", `${name}.md`);
  if (existsSync(local)) return local;
  const core = C && C.scalars && C.scalars.core ? kebab(C.scalars.core) : null;
  if (core) {
    const dir = findCorePhasesDir(join(harnessDir, ".."), core); // <root> 에서 위로.
    if (dir) {
      const fromCore = join(dir, `${name}.md`);
      if (existsSync(fromCore)) return fromCore;
    }
  }
  return null;
}
function parsePhase(name) {
  const file = phaseSourceFile(name);
  if (!file) return null;
  const fm = readFileSync(file, "utf8").match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const card = { name, consumes: [], produces: null, requires: [], hasWorkers: false };
  if (!fm) return card;
  for (const l of fm[1].split(/\r?\n/)) {
    let m;
    if ((m = l.match(/^produces:\s*(.+)$/))) { const x = clean(m[1]); card.produces = (x === "~" || x === "") ? null : x; }
    // consumes: ~ (YAML null = 아무것도 안 받음) · 빈값 → 빈 리스트. produces 가드와 대칭(안 그러면 팬텀 역할 '~' 생김).
    else if ((m = l.match(/^consumes:\s*(.+)$/))) { const x = clean(m[1]); card.consumes = (x === "~" || x === "") ? [] : splitList(m[1]).map((r) => ({ role: r.replace(/\?$/, ""), optional: /\?$/.test(r) })); }
    // requires 와 needs(옛 이름) 둘 다 requires 풀로 모은다. needs 항목은 항상 값-빈자리(kind:"value").
    else if ((m = l.match(/^requires:\s*(.+)$/))) card.requires.push(...splitList(m[1]).map(parseRequire));
    else if ((m = l.match(/^needs:\s*(.+)$/))) card.requires.push(...splitList(m[1]).map((r) => ({ ...parseRequire(r), kind: "value" })));
    else if (/^workers:\s*$/.test(l)) card.hasWorkers = true;
  }
  return card;
}

const C = parseConfig(raw);

// 줄단위 파서가 조용히 먹는 미지원 YAML 문법 사전 차단(조용한 누락 방지).
//   블록 스칼라(|·>)는 멀티라인이라 이 양식 파서는 마커만 값으로 먹고 본문 줄을 흘린다 → error 로 알린다.
//   (이 config 는 한 줄 스칼라·1-depth 블록·phases 리스트 전용. 멀티라인이 필요하면 한 줄+따옴표로.)
raw.split(/\r?\n/).forEach((l, li) => {
  if (/^\s*[A-Za-z_][\w-]*:\s*[|>][+-]?\d*\s*(#.*)?$/.test(l))
    err(`${li + 1}행 블록 스칼라(|·>) 미지원 — 파서가 한 줄 값만 읽어 본문이 조용히 누락된다. 한 줄로 쓰거나 따옴표로: '${l.trim()}'`);
});

// --- 스칼라 ---
const sync = C.scalars.sync ?? "medium";
if (["loose", "medium", "strict"].includes(sync)) ok(`sync=${sync}`);
else warn(`sync '${sync}' — loose|medium|strict 권장`);
if (C.scalars.routing && !["budget", "balanced", "premium"].includes(C.scalars.routing))
  warn(`routing '${C.scalars.routing}' — budget|balanced|premium 권장`);

// --- phases 펼침 + loop 점검 ---
const seq = [];
for (const p of C.phases) {
  if (p.type === "loop") {
    if (!p.do.length) err("loop에 do[] 없음");
    if (!p.until) err("loop에 until 없음");
    for (const n of p.do) { if (n === "loop") err("loop 중첩 금지 (v1)"); seq.push(n); }
  } else if (!p.name) err("phase 항목에 name 없음");
  else seq.push(p.name);
}
if (!seq.length) err("phases 비어 있음");
else ok(`phases ${seq.length}단계: ${seq.join(" → ")}`);

// --- phase 정의 로드 ---
const cards = {};
for (const name of seq) {
  if (cards[name]) continue;
  const card = parsePhase(name);
  if (!card) warn(`phase '${name}' 정의 없음: project/phases/${name}.md (project/phases 미정의?)`);
  else cards[name] = card;
}

// --- 연결 점검 (contract §4) ---
const produced = new Set(), producedBy = {}, consumed = new Set(), boundCaps = new Set();
for (const name of seq) {
  const card = cards[name];
  if (!card) continue;
  for (const cns of card.consumes) {
    consumed.add(cns.role);
    if (!produced.has(cns.role) && !cns.optional) err(`dangling: '${name}'이 '${cns.role}'를 consumes하는데 앞에서 produces 안 함`);
  }
  if (card.produces) {
    if (produced.has(card.produces)) err(`중복 produces: '${card.produces}' (${producedBy[card.produces]} & ${name})`);
    produced.add(card.produces); producedBy[card.produces] = name;
  }
  // requires 점검 — 값-빈자리는 config.values, 능력-빈자리는 config.bindings(+impl) 가 채워야 한다.
  //   (needs 흡수분 포함. 선택(?) 빈자리는 미충족이어도 통과 — 본문이 '있으면 쓴다'.)
  for (const rq of card.requires) {
    // 선택 빈자리도 '사용 중'으로 먼저 표시 — 안 하면 아래 orphan 바인딩 warn 이 실사용 선택 능력을 오탐한다.
    boundCaps.add(rq.key);
    if (rq.optional) continue;
    if (rq.kind === "value") {
      if (!(rq.key in C.values)) err(`'${name}'의 값-빈자리 '${rq.key}'가 config.values 에 없음`);
    } else { // capability
      if (!(rq.key in C.bindings)) {
        err(`'${name}'의 능력-빈자리 '${rq.key}'가 config.bindings 에 없음 (미바인딩)`);
      } else {
        const impl = C.bindings[rq.key];
        const looksLikeKey = /^[A-Za-z0-9][\w-]*$/.test(impl); // 'playwright' 처럼 단일 토큰 = impl 키 추정.
        if (looksLikeKey && !(impl in C.impl) && !(impl in C.values))
          err(`'${name}'의 능력 '${rq.key}' → '${impl}' 구현 정의 없음 (config.impl 에 '${impl}' 없음)`);
        // 우변이 명령("npx ...")·경로("./project/impl/..")면 인라인으로 보고 통과.
      }
    }
  }
}
for (const role of produced) if (!consumed.has(role)) warn(`orphan 산출물: '${role}' (${producedBy[role]}) — 아무도 소비 안 함 (종착이면 무시)`);
// orphan 바인딩: config.bindings 에 있는데 어느 phase 의 requires 도 안 가리키는 능력 (종착 orphan 과 동급 — warn).
for (const cap of Object.keys(C.bindings)) if (!boundCaps.has(cap)) warn(`orphan 바인딩: '${cap}' — 어느 phase 의 requires 도 안 가리킴`);

// impl 모듈 frontmatter `provides:` 일치 점검 (엉뚱한 모듈 연결 방지).
//   바인딩이 .md 모듈 경로로 풀리면 그 파일의 provides: 를 능력명과 대조 → 불일치면 warn.
//   파일 미존재는 적재 전일 수 있어 error 아님(부재 단정 금지 가드와 정합) — 그냥 건너뛴다.
for (const cap of boundCaps) {
  if (!(cap in C.bindings)) continue;
  const rhs = C.bindings[cap];
  // 모듈 경로 결정: 우변이 경로면 그것, 단일 토큰이면 impl[토큰] 이 경로일 때.
  const path = /[./]/.test(rhs) ? rhs : (C.impl[rhs] || null);
  if (!path || !/\.md$/.test(path)) continue; // 인라인 명령·.mjs 실행기는 provides 점검 대상 아님.
  const abs = join(harnessDir, path);
  if (!existsSync(abs)) continue; // 부재 단정 금지 — 적재 전일 수 있음.
  const pm = readFileSync(abs, "utf8").match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const prov = pm && (pm[1].split(/\r?\n/).map((l) => l.match(/^provides:\s*(.+)$/)).find(Boolean) || [])[1];
  if (prov && clean(prov) !== cap) warn(`impl 모듈 '${path}' 의 provides: '${clean(prov)}' 가 능력 '${cap}' 와 불일치`);
}
if (errors === 0) ok("연결 OK (dangling·중복·requires 빈자리 없음)");

// --- 신선도 (산출물 있을 때만, contract §3) ---
const feat = C.scalars.feature;
if (feat) {
  const fdir = join(harnessDir, "artifacts", feat);
  if (existsSync(fdir)) {
    const lockPath = join(fdir, "lock.json");
    let lock = null;
    if (existsSync(lockPath)) { try { lock = JSON.parse(readFileSync(lockPath, "utf8")); } catch { warn("lock.json 파싱 실패"); } }
    if (!lock) warn(`lock 없음: ${lockPath} (신선도 점검 생략)`);
    else {
      let stale = 0;
      for (const f of readdirSync(fdir)) {
        if (!f.endsWith(".md")) continue;
        const role = f.replace(/\.md$/, "");
        const dig = createHash("sha256").update(readFileSync(join(fdir, f))).digest("hex").slice(0, 6);
        if (lock[role] && lock[role] !== dig) { warn(`stale: '${role}' (지문 ${lock[role]}→${dig})`); stale++; }
      }
      if (!stale) ok("신선도 OK (lock 일치)");
    }
  }
}

console.log(`result: ${errors} error(s), ${warns} warning(s)`);
process.exit(errors === 0 ? 0 : 1);
