#!/usr/bin/env node
// agent-engineer validator — .harness/config.yaml(Config) + project/phases/ 를 계약(contract §4)으로 점검.
// 사용법: node validate.mjs [path/to/.harness/config.yaml]   (기본: .harness/config.yaml)
// 종료코드: 오류 0건이면 0, 있으면 1, config 없으면 2.
// 셸·외부 의존 없음(Node 빌트인만) → mac·linux·windows 동일.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const c = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", x: "\x1b[0m" };
let errors = 0, warns = 0;
const err = (m) => { console.log(`  ${c.r}✗${c.x} ${m}`); errors++; };
const warn = (m) => { console.log(`  ${c.y}⚠${c.x} ${m}`); warns++; };
const ok = (m) => { console.log(`  ${c.g}✓${c.x} ${m}`); };

const clean = (s) => s.replace(/\s*#.*$/, "").trim().replace(/^["']|["']$/g, "");
const splitList = (s) => s.replace(/^\[|\]$/g, "").split(",").map((x) => x.trim()).filter(Boolean);

const cfgPath = process.argv[2] ?? ".harness/config.yaml";
console.log(`agent-engineer validate → ${cfgPath}`);
if (!existsSync(cfgPath)) { err("config.yaml 없음"); process.exit(2); }
const harnessDir = dirname(cfgPath);
const raw = readFileSync(cfgPath, "utf8");

// ---------- config.yaml 파서 (라인 기반, 이 양식 전용) ----------
function parseConfig(text) {
  const lines = text.split(/\r?\n/);
  const cfg = { scalars: {}, values: {}, phases: [] };
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "" || /^\s*#/.test(l)) { i++; continue; }
    if (/^phases:\s*(#.*)?$/.test(l)) { i = parsePhases(lines, i + 1, cfg); continue; }
    if (/^values:\s*(#.*)?$/.test(l)) { i = parseValues(lines, i + 1, cfg); continue; }
    const m = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m && m[2].trim() !== "") cfg.scalars[m[1]] = clean(m[2]);
    i++;
  }
  return cfg;
}
function parseValues(lines, i, cfg) {
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "" || /^\s*#/.test(l)) { i++; continue; }
    if (!/^\s+/.test(l)) break;
    const m = l.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) cfg.values[m[1]] = clean(m[2]);
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
        const um = inline[1].match(/until:\s*["']?([^,"'}]+)["']?/); if (um) loop.until = um[1].trim();
        const mm = inline[1].match(/max:\s*(\d+)/); if (mm) loop.max = +mm[1];
        i++;
      } else {
        const base = l.search(/\S/); i++;
        while (i < lines.length && (lines[i].trim() === "" || lines[i].search(/\S/) > base)) {
          const dm = lines[i].match(/do:\s*\[([^\]]*)\]/); if (dm) loop.do = splitList(dm[1]);
          const um = lines[i].match(/until:\s*["']?([^"'#]+?)["']?\s*(?:#.*)?$/); if (um) loop.until = um[1].trim();
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

// ---------- phase 파일 frontmatter 파서 ----------
function parsePhase(name) {
  const file = join(harnessDir, "project", "phases", `${name}.md`);
  if (!existsSync(file)) return null;
  const fm = readFileSync(file, "utf8").match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const card = { name, consumes: [], produces: null, needs: [], hasWorkers: false };
  if (!fm) return card;
  for (const l of fm[1].split(/\r?\n/)) {
    let m;
    if ((m = l.match(/^produces:\s*(.+)$/))) { const x = clean(m[1]); card.produces = (x === "~" || x === "") ? null : x; }
    else if ((m = l.match(/^consumes:\s*(.+)$/))) card.consumes = splitList(m[1]).map((r) => ({ role: r.replace(/\?$/, ""), optional: /\?$/.test(r) }));
    else if ((m = l.match(/^needs:\s*(.+)$/))) card.needs = splitList(m[1]).map((r) => ({ key: r.replace(/\?$/, ""), optional: /\?$/.test(r) }));
    else if (/^workers:\s*$/.test(l)) card.hasWorkers = true;
  }
  return card;
}

const C = parseConfig(raw);

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
  if (!card) warn(`phase '${name}' 정의 없음: project/phases/${name}.md (즉석 저작?)`);
  else cards[name] = card;
}

// --- 연결 점검 (contract §4) ---
const produced = new Set(), producedBy = {}, consumed = new Set();
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
  for (const nd of card.needs) {
    if (!nd.optional && !(nd.key in C.values)) err(`'${name}'의 needs '${nd.key}'가 config.values에 없음`);
  }
}
for (const role of produced) if (!consumed.has(role)) warn(`orphan 산출물: '${role}' (${producedBy[role]}) — 아무도 소비 안 함 (종착이면 무시)`);
if (errors === 0) ok("연결 OK (dangling·중복·needs 없음)");

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
