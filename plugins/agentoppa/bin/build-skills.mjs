#!/usr/bin/env node
// build-skills — AgentOppa phase→스킬 COMPILER. .harness/ (SOURCE) 를 읽어 .claude/·.codex/ (COMPILED) 를 결정적으로 생성한다.
//   왜: 지금까지 .harness → .claude/.codex 컴파일 전 과정이 LLM 수작업이었다. 이 스크립트가 그 다리를 기계화한다.
//   계약 출처: agent-engineer/references/{contract,phases,recipe}.md. 어긋나면 contract 가 정답.
//
// 사용법: node build-skills.mjs <project-root>
//   <project-root>/.harness/ 를 읽어 <project-root>/.claude/ + <project-root>/.codex/ 를 채운다.
//   (project-root 인자만 받는다 — 이 스크립트는 엔진(plugins) 안이라 특정 콘텐츠 트리를 하드코딩하지 않는다. 한방향.)
//
// 하는 일:
//   1. config.yaml + project/phases/*.md 파싱(인라인주석 견고) → phase 마다 .claude/skills/<name>/SKILL.md (슬롯 치환).
//   2. .codex/skills/<name>/SKILL.md (미러) + agents/openai.yaml (Codex UI 메타·발동 정책).
//   3. project/agents/*.md → .claude/agents/*.md (복사) + .codex/agents/*.toml (build-agents.mjs 호출).
//   4. strict 게이트가 있는 phase가 하나라도 있으면 게이트 훅(.claude/hooks + .codex/hooks) 생성.
//   5. core/validate.mjs 를 정본(agent-engineer/scripts/validate.mjs)에서 복사해 .harness/core/ 에 emit (단일소스).
//
// 안 하는 일 (의도적):
//   - plugin.json / marketplace.json (.claude-plugin/·.codex-plugin/) 은 ccc-plugin 의 몫 → 여기선 안 만든다(console 안내만).
//   - loop self-gate 컴파일 / dynamic workers 런타임 선택 인코딩 → DEFER (아래 TODO·경고 참고).
//
// zero-dep(Node 빌트인만) · 크로스OS(mac·linux·windows).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const c = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", b: "\x1b[34m", d: "\x1b[2m", x: "\x1b[0m" };
let warns = 0, errors = 0;
const ok = (m) => console.log(`  ${c.g}✓${c.x} ${m}`);
const warn = (m) => { console.log(`  ${c.y}⚠${c.x} ${m}`); warns++; };
const bad = (m) => { console.log(`  ${c.r}✗${c.x} ${m}`); errors++; };
const info = (m) => console.log(`  ${c.d}${m}${c.x}`);
const deferred = [];
const defer = (m) => { console.log(`  ${c.b}DEFER${c.x} ${m}`); deferred.push(m); };

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- 인자 ----------
const projectRoot = process.argv[2];
if (!projectRoot) {
  console.log(`${c.r}사용법: node build-skills.mjs <project-root>${c.x}`);
  console.log(`  예) node build-skills.mjs /path/to/my-project   (그 안의 .harness/ 를 .claude/.codex 로 컴파일)`);
  process.exit(2);
}
const ROOT = resolve(projectRoot);
const harnessDir = join(ROOT, ".harness");
const cfgPath = join(harnessDir, "config.yaml");
if (!existsSync(cfgPath)) { console.log(`${c.r}✗ config 없음: ${cfgPath}${c.x}`); process.exit(2); }

console.log(`${c.d}build-skills${c.x} ${ROOT}`);
console.log(`${c.d}  SOURCE${c.x} .harness/  ${c.d}→ COMPILED${c.x} .claude/ + .codex/\n`);

// ---------- 작은 유틸 (값 정리 — 인라인주석 견고) ----------
// YAML 스칼라 값에서 인라인 주석(#)을 떼되, 따옴표 안의 #는 보존한다.
function stripComment(s) {
  let inS = false, inD = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (ch === "#" && !inS && !inD) {
      // '#' 앞에 공백이 있거나 줄 맨 앞이어야 주석 (url#frag 같은 토큰 보호)
      if (i === 0 || /\s/.test(s[i - 1])) return s.slice(0, i);
    }
  }
  return s;
}
const clean = (s) => stripComment(s).trim().replace(/^["']|["']$/g, "");
const splitList = (s) => stripComment(s).replace(/^\[|\]$/g, "").split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);

// ---------- config.yaml 파서 (라인 기반, 이 양식 전용 — validate.mjs 와 동치, 인라인주석 견고화) ----------
function parseConfig(text) {
  const lines = text.split(/\r?\n/);
  const cfg = { scalars: {}, values: {}, phases: [] };
  let i = 0;
  const isBlank = (l) => l.trim() === "" || /^\s*#/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (isBlank(l)) { i++; continue; }
    if (/^phases:\s*(#.*)?$/.test(l)) { i = parsePhases(lines, i + 1, cfg); continue; }
    if (/^values:\s*(#.*)?$/.test(l)) { i = parseValues(lines, i + 1, cfg); continue; }
    const m = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m && clean(m[2]) !== "") cfg.scalars[m[1]] = clean(m[2]);
    i++;
  }
  return cfg;

  function parseValues(lines, i) {
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) { i++; continue; }
      if (!/^\s+/.test(l)) break;
      const m = l.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
      if (m) cfg.values[m[1]] = clean(m[2]);
      i++;
    }
    return i;
  }
  function parsePhases(lines, i) {
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) { i++; continue; }
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
}

// ---------- phase 파일 파서 (frontmatter + 본문) ----------
function parsePhase(name) {
  const file = join(harnessDir, "project", "phases", `${name}.md`);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  const fm = { name, consumes: [], produces: null, needs: [], hasWorkers: false };
  fm.body = m ? m[2].trim() : raw.trim();
  if (!m) { fm.malformed = true; return fm; }
  const fmText = m[1];
  // frontmatter: 1-depth key: value. workers: 는 중첩 블록이라 존재만 표시.
  const flines = fmText.split(/\r?\n/);
  for (let i = 0; i < flines.length; i++) {
    const l = flines[i];
    let mm;
    if (/^workers:\s*(#.*)?$/.test(l)) { fm.hasWorkers = true; continue; }
    if ((mm = l.match(/^name:\s*(.+)$/))) fm.name = clean(mm[1]);
    else if ((mm = l.match(/^desc:\s*(.+)$/))) fm.desc = clean(mm[1]);
    else if ((mm = l.match(/^when:\s*(.+)$/))) { const x = clean(mm[1]); fm.when = (x === "~" || x === "") ? null : x; }
    else if ((mm = l.match(/^produces:\s*(.+)$/))) { const x = clean(mm[1]); fm.produces = (x === "~" || x === "") ? null : x; }
    else if ((mm = l.match(/^consumes:\s*(.+)$/))) fm.consumes = splitList(mm[1]).map((r) => ({ role: r.replace(/\?$/, ""), optional: /\?$/.test(r) }));
    else if ((mm = l.match(/^needs:\s*(.+)$/))) fm.needs = splitList(mm[1]).map((r) => ({ key: r.replace(/\?$/, ""), optional: /\?$/.test(r) }));
    else if ((mm = l.match(/^gate:\s*(.+)$/))) fm.gate = clean(mm[1]);
    else if ((mm = l.match(/^tier:\s*(.+)$/))) fm.tier = clean(mm[1]);
  }
  return fm;
}

// ---------- 슬롯 치환 ----------
// {role} → 산출물 경로(.harness/artifacts/{feature}/<role>.md, 상대경로 — 컴파일 산출은 프로젝트 루트 기준).
// {next} → recipe 순서상 다음 스킬 (/name) 또는 (종착).
// {프로젝트값} → config.values 의 값. needs 가 가리키는 키 + 한국어 흔한 별칭.
function artifactPath(feature, role) {
  return `.harness/artifacts/${feature}/${role}.md`;
}

// config.values 키 → 본문에서 쓰일 법한 표기들. needs 키와 한국어 별칭을 같은 값으로 매핑.
const VALUE_ALIASES = {
  test_command: ["test_command", "테스트 명령", "테스트명령", "test command"],
};
function buildValueSlots(values) {
  const slots = {};
  for (const [key, val] of Object.entries(values)) {
    slots[key] = val;
    for (const alias of (VALUE_ALIASES[key] || [])) slots[alias] = val;
  }
  return slots;
}

// 본문에 남은 {프로젝트값} 슬롯을 values 로 치환. role/next 는 따로 처리하므로 제외.
function substituteValues(body, valueSlots, knownRoles) {
  return body.replace(/\{([^{}]+)\}/g, (whole, inner) => {
    const key = inner.trim();
    // role·next 슬롯은 여기서 건드리지 않는다 (별도 단계가 처리).
    if (key === "next" || knownRoles.has(key)) return whole;
    if (key in valueSlots) return valueSlots[key];
    return whole; // 모르는 슬롯은 보존 → 미치환 경고로 잡는다.
  });
}

// 산출물 헤더 enrich: 본문의 '(헤더 phase: <name> ...)' 를 status: ready · inputs:[...] 까지 채운다.
// 견본 형식: '(헤더 phase: spec)' → '(헤더 phase: spec, status: ready, inputs: [])'
//            '(헤더 phase: review · inputs: [spec])' → '(헤더 phase: review · status: ready · inputs: [spec])'
// 구분자(',' vs '·')는 원문을 보존한다.
function enrichHeader(body, phaseName, consumesRoles) {
  const inputsList = `[${consumesRoles.join(", ")}]`;
  return body.replace(/\(\s*헤더\s+phase:\s*([^)]*)\)/g, (whole, innerRaw) => {
    let inner = innerRaw.trim();
    // 구분자 추론: 본문이 '·' 를 쓰면 '·', 아니면 ','.
    const sep = inner.includes("·") ? " · " : ", ";
    // phase 이름 토큰만 남기고(원문 첫 토큰 사용), 우리가 status·inputs 를 표준화해 덧붙인다.
    // 이미 status/inputs 가 있으면 거기에 의존하지 말고 재구성(결정적).
    const nameTok = (inner.split(/[,·]/)[0] || phaseName).replace(/^phase:\s*/, "").trim() || phaseName;
    return `(헤더 phase: ${nameTok}${sep}status: ready${sep}inputs: ${inputsList})`;
  });
}

// produces:~ phase 의 본문 마무리 문구 정규화는 *하지 않는다* — 저자가 본문에 직접 쓴다(견본대로).
//   (예: '문서 산출물은 남기지 않는다(produces: ~).' → 저자가 풀어 씀. 컴파일러가 산문을 고쳐쓰지 않음.)

// {next} 치환: 다음 phase 가 있으면 /<next>, 없으면 (종착).
function substituteNext(body, nextName) {
  const repl = nextName ? `/${nextName}` : "(종착)";
  return body.replace(/\{next\}/g, repl);
}

// when → self-gate: 본문 맨 위에 자가 점검 문장 삽입 (contract/phases.md §self-gate).
function prependSelfGate(body, when, nextName) {
  const target = nextName ? `→ /${nextName}` : "흐름을 끝낸다";
  const gate = `이 단계는 ${when} 일 때만 한다. 아니면 아무것도 하지 말고 바로 ${target}.\n\n`;
  return gate + body;
}

// strict 게이트 안내: 본문 첫 단락 뒤에 게이트 강제 문구를 *독립 단락*으로 삽입 (견본 review.md 형식).
//   문구는 콜론-형식("다음을 충족…: {gate}")으로 — gate 가 어떤 토큰으로 끝나든(명사·서술어) 조사 충돌 없이 읽힌다.
//   (지난 라이브의 '{gate} 를 충족' 은 gate 가 '확인' 등으로 끝나면 '확인 를' 처럼 깨졌다 → 콜론형으로 결정적 해결.)
function insertStrictGateNote(body, gate) {
  if (!gate) return body;
  const note = `이 단계는 strict 게이트다 — 다음을 충족하기 전엔 끝내지 않는다: ${gate.replace(/\s+$/, "")}.`;
  // 첫 단락의 끝을 찾는다: 첫 빈 줄(\n\n) 경계가 있으면 거기, 없으면 첫 줄(\n) 뒤.
  const para = body.indexOf("\n\n");
  const firstNl = body.indexOf("\n");
  const cut = para !== -1 ? para : (firstNl !== -1 ? firstNl : body.length);
  const head = body.slice(0, cut).replace(/\s+$/, "");
  const tail = body.slice(cut).replace(/^\s+/, "");
  // 항상 빈 줄로 감싼 독립 단락.
  return tail ? `${head}\n\n${note}\n\n${tail}` : `${head}\n\n${note}`;
}

// ---------- 디렉토리 ----------
function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

// ---------- 메인 ----------
const C = parseConfig(readFileSync(cfgPath, "utf8"));

// feature 결정: config.feature → git 브랜치 슬러그 → default (contract §1).
function gitBranchSlug() {
  try {
    const r = spawnSync("git", ["-C", ROOT, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
    if (r.status === 0) {
      const b = (r.stdout || "").trim();
      if (b && b !== "HEAD") return b.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    }
  } catch { /* git 없음 — 폴백 */ }
  return null;
}
const feature = C.scalars.feature || gitBranchSlug() || "default";
const sync = C.scalars.sync || "medium";
const valueSlots = buildValueSlots(C.values);
info(`harness=${C.scalars.harness || "(미명)"} · feature=${feature} · sync=${sync} · routing=${C.scalars.routing || "(기본)"}`);

// phases 펼침 (loop 안 항목도 시퀀스로; loop 자체의 self-gate 는 DEFER).
const seq = [];
let sawLoop = false;
for (const p of C.phases) {
  if (p.type === "loop") {
    sawLoop = true;
    for (const n of p.do) seq.push({ name: n, syncOverride: null, inLoop: true });
  } else if (p.name) {
    seq.push({ name: p.name, syncOverride: p.sync || null, inLoop: false });
  }
}
if (!seq.length) { bad("phases 비어 있음 — 컴파일할 게 없음"); process.exit(1); }

// next 매핑 (시퀀스상 다음 — phase 는 자기 다음을 모른다, recipe 가 채운다).
for (let i = 0; i < seq.length; i++) seq[i].next = seq[i + 1] ? seq[i + 1].name : null;

const claudeSkillsDir = join(ROOT, ".claude", "skills");
const codexSkillsDir = join(ROOT, ".codex", "skills");

// 어떤 phase 가 strict 인지(게이트 훅 필요 판단). phase override > 전역 sync.
function effectiveSync(item) { return item.syncOverride || sync; }
const knownRoles = new Set(); // {role} 슬롯 판별용 — 전 phase produces/consumes 역할 모음.

// 1차 패스: 모든 phase 정의 로드 + 역할 수집.
const cards = {};
for (const item of seq) {
  if (cards[item.name]) continue;
  const card = parsePhase(item.name);
  if (!card) { warn(`phase '${item.name}' 정의 없음: project/phases/${item.name}.md (스킵 — 즉석저작은 LLM 몫)`); continue; }
  if (card.malformed) warn(`phase '${item.name}' frontmatter 형식 이상 — 본문만 사용`);
  cards[item.name] = card;
  if (card.produces) knownRoles.add(card.produces);
  for (const cn of card.consumes) knownRoles.add(cn.role);
}

// ===== 1. + 2. phase → .claude/skills + .codex/skills =====
let madeSkills = 0;
const seenSkill = new Set();
for (const item of seq) {
  const card = cards[item.name];
  if (!card) continue;
  if (seenSkill.has(item.name)) continue; // loop 로 중복 등장해도 한 번만 emit.
  seenSkill.add(item.name);

  console.log(`\n${c.d}phase${c.x} ${item.name}${item.inLoop ? c.d + " (loop)" + c.x : ""}`);

  const consumesRoles = card.consumes.map((cn) => cn.role);

  // --- 본문 슬롯 치환 (순서 주의) ---
  let body = card.body;
  // (a) {role} → 경로. knownRoles 의 각 역할에 대해 {role} 치환.
  for (const role of knownRoles) {
    const re = new RegExp(`\\{${role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`, "g");
    body = body.replace(re, artifactPath(feature, role));
  }
  // (a2) SOURCE-only 주석 제거: 본문에 새어든 '(produces: ~)' 는 frontmatter 개념이라 컴파일 산출에 두지 않는다.
  //      (컴파일러는 슬롯 치환이 본분이고 산문을 고쳐쓰지 않지만, 이 토큰은 명백한 SOURCE 누수라 슬롯처럼 떼어낸다.)
  body = body.replace(/\s*\(\s*produces:\s*~\s*\)/g, "");
  // (b) {프로젝트값} → values (role/next 제외).
  body = substituteValues(body, valueSlots, knownRoles);
  // (c) 산출물 헤더 enrich (status: ready · inputs).
  if (card.produces) body = enrichHeader(body, item.name, consumesRoles);
  // (d) when → self-gate (본문 맨 위).
  if (card.when) body = prependSelfGate(body, card.when, item.next);
  // (e) strict 게이트 안내 (첫 문장 뒤).
  if (effectiveSync(item) === "strict" && card.gate) body = insertStrictGateNote(body, card.gate);
  // (f) {next} → /next | (종착).  ← 맨 마지막(다른 치환이 {next} 를 건드리지 않게).
  body = substituteNext(body, item.next);

  // 미치환 슬롯 점검 (오타·미정의 값).
  const leftover = [...body.matchAll(/\{([^{}\n]+)\}/g)].map((m) => m[1].trim());
  const realLeft = leftover.filter((k) => k !== "" && !/^\s/.test(k));
  if (realLeft.length) warn(`'${item.name}' 본문에 미치환 슬롯: ${[...new Set(realLeft)].map((k) => `{${k}}`).join(", ")} (config.values 또는 역할명 확인)`);

  // description: desc (없으면 경고 + 플레이스홀더).
  const description = card.desc || `(desc 없음 — phase '${item.name}')`;
  if (!card.desc) warn(`'${item.name}' desc 없음 → description 비게 됨 (phase frontmatter 에 desc: 추가 권장)`);

  // workers 가 있으면: 본문에 선택 로직이 산문으로 있어야 한다(저자가 씀). 컴파일러는 인코딩하지 않음 → DEFER.
  if (card.hasWorkers) defer(`'${item.name}' workers(dynamic) 런타임 선택 — 본문 산문에 의존(컴파일러가 인코딩 안 함). 보조 에이전트 .md 는 project/agents/ → .claude/.codex 로 변환됨.`);

  const skillMd = `---\nname: ${item.name}\ndescription: ${description}\n---\n${body}\n`;

  // .claude/skills/<name>/SKILL.md
  const cDir = join(claudeSkillsDir, item.name);
  ensureDir(cDir);
  writeFileSync(join(cDir, "SKILL.md"), skillMd);
  ok(`.claude/skills/${item.name}/SKILL.md`);

  // .codex/skills/<name>/SKILL.md (미러) + agents/openai.yaml
  const xDir = join(codexSkillsDir, item.name);
  ensureDir(xDir);
  writeFileSync(join(xDir, "SKILL.md"), skillMd);
  ok(`.codex/skills/${item.name}/SKILL.md`);

  // openai.yaml: interface 메타 + 발동 정책. short_description = desc 첫 문장.
  const shortDesc = firstSentence(description);
  const allowImplicit = true; // phase 스킬은 흐름 안에서 자동발동 (수동전용 부작용 작업이 아니므로).
  const yaml =
    `interface:\n` +
    `  display_name: ${yamlStr(item.name)}\n` +
    `  short_description: ${yamlStr(shortDesc)}\n` +
    `  brand_color: "#5b4fd6"\n` +
    `  default_prompt: ${yamlStr(defaultPrompt(item.name))}\n` +
    `policy:\n` +
    `  allow_implicit_invocation: ${allowImplicit}\n`;
  const aDir = join(xDir, "agents");
  ensureDir(aDir);
  writeFileSync(join(aDir, "openai.yaml"), yaml);
  ok(`.codex/skills/${item.name}/agents/openai.yaml`);

  madeSkills++;
}

function firstSentence(s) {
  // 한국어 '…때.' / '…다.' 첫 종지부까지. 못 찾으면 ~80자.
  const m = s.match(/^(.*?[.．])(\s|$)/u);
  if (m) return m[1].trim();
  return s.length > 80 ? s.slice(0, 80).trim() + "…" : s;
}
function defaultPrompt(name) {
  // 결정적 합성 — 저자가 더 나은 문구를 원하면 openai.yaml 을 직접 손본다(한계로 보고).
  return `${name} 단계를 수행해줘.`;
}
function yamlStr(s) {
  // 더블쿼트 + 이스케이프 (YAML double-quoted: \\ 와 \" 만 필요).
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// ===== 3. project/agents/*.md → .claude/agents/*.md + .codex/agents/*.toml =====
const srcAgentsDir = join(harnessDir, "project", "agents");
let madeAgents = 0;
if (existsSync(srcAgentsDir) && statSync(srcAgentsDir).isDirectory()) {
  const agentFiles = readdirSync(srcAgentsDir).filter((f) => f.endsWith(".md"));
  if (agentFiles.length) {
    console.log(`\n${c.d}agents${c.x} project/agents/ → .claude/agents (.md) + .codex/agents (.toml)`);
    const claudeAgentsDir = join(ROOT, ".claude", "agents");
    ensureDir(claudeAgentsDir);
    // (a) Claude: .md 는 그대로 복사 (단일 소스).
    for (const f of agentFiles) {
      copyFileSync(join(srcAgentsDir, f), join(claudeAgentsDir, f));
      ok(`.claude/agents/${f}`);
      madeAgents++;
    }
    // (b) Codex: build-agents.mjs 를 호출해 .toml 생성 (재사용 — 같은 변환 로직).
    const buildAgents = join(__dirname, "build-agents.mjs");
    if (existsSync(buildAgents)) {
      const codexAgentsDir = join(ROOT, ".codex", "agents");
      info(`build-agents.mjs 호출 → ${codexAgentsDir}`);
      const r = spawnSync(process.execPath, [buildAgents, claudeAgentsDir, codexAgentsDir], { encoding: "utf8" });
      if (r.stdout) process.stdout.write(r.stdout.split("\n").map((l) => l ? "    " + l : l).join("\n"));
      if (r.status !== 0) bad(`build-agents.mjs 실패 (exit ${r.status})${r.stderr ? ": " + r.stderr.trim() : ""}`);
      else ok(`.codex/agents/*.toml 생성됨`);
    } else {
      bad(`build-agents.mjs 없음: ${buildAgents} — Codex 에이전트 .toml 미생성`);
    }
  }
} else {
  info("project/agents/ 없음 — 보조 에이전트 스킵");
}

// ===== 4. strict 게이트 훅 =====
// strict phase 가 하나라도 있으면 비손상/게이트 훅을 emit.
//   주의: 게이트 훅의 *구체 로직*(무엇을 차단할지)은 phase·프로젝트마다 다르다.
//   여기선 가장 흔한 '비손상(기존 src/·test/ 무수정)' 가드를 결정적으로 emit 한다 (boppa-gen gate-review.mjs 형식).
//   더 정교한 게이트가 필요하면 ccc-hooks 로 별도 작성 — 이건 안전한 기본값.
const strictPhases = seq.filter((it) => cards[it.name] && effectiveSync(it) === "strict" && cards[it.name].gate);
if (strictPhases.length) {
  console.log(`\n${c.d}hooks${c.x} strict 게이트 ${strictPhases.length}개: ${strictPhases.map((p) => p.name).join(", ")}`);
  const claudeHooksDir = join(ROOT, ".claude", "hooks");
  const codexHooksDir = join(ROOT, ".codex", "hooks");
  ensureDir(claudeHooksDir);
  ensureDir(codexHooksDir);

  const hookScript = GATE_HOOK_SCRIPT();
  writeFileSync(join(claudeHooksDir, "gate-review.mjs"), hookScript);
  writeFileSync(join(codexHooksDir, "gate-review.mjs"), hookScript);
  ok(`.claude/hooks/gate-review.mjs + .codex/hooks/gate-review.mjs`);

  // Claude: hooks.json
  const hooksJson = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Edit|Write|MultiEdit|NotebookEdit",
          hooks: [{ type: "command", command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/gate-review.mjs"', timeout: 30 }],
        },
      ],
    },
  };
  writeFileSync(join(claudeHooksDir, "hooks.json"), JSON.stringify(hooksJson, null, 2) + "\n");
  ok(`.claude/hooks/hooks.json`);

  // Codex: config.toml
  const codexToml =
    `# generated for Codex by AgentOppa build-skills — same script as .claude/hooks/gate-review.mjs\n` +
    `# strict 게이트의 비손상 가드. 경로변수는 $PLUGIN_ROOT(스크립트가 CWD로도 흡수).\n` +
    `[[hooks.PreToolUse]]\n` +
    `matcher = "^(Edit|Write|MultiEdit|NotebookEdit)$"\n\n` +
    `[[hooks.PreToolUse.hooks]]\n` +
    `type = "command"\n` +
    `command = 'node "$PLUGIN_ROOT/.codex/hooks/gate-review.mjs"'\n` +
    `timeout = 30\n`;
  writeFileSync(join(codexHooksDir, "config.toml"), codexToml);
  ok(`.codex/hooks/config.toml`);

  info("주: 이 훅은 '비손상(기존 src/·test/ 무수정)' 기본 가드다. phase 의 gate 가 다른 조건이면 ccc-hooks 로 맞춤 작성 필요.");
} else {
  info("strict 게이트 phase 없음 — 훅 스킵");
}

// ===== 5. core/validate.mjs 단일소스 emit =====
// 정본 = agent-engineer/scripts/validate.mjs. .harness/core/ 로 복사해 자기검사 독립(지난 라이브의 '즉흥 복사' 결정화).
console.log(`\n${c.d}core${c.x} validate.mjs 정본 복사 → .harness/core/`);
const canonicalValidate = resolve(__dirname, "..", "skills", "agent-engineer", "scripts", "validate.mjs");
if (existsSync(canonicalValidate)) {
  const coreDir = join(harnessDir, "core");
  ensureDir(coreDir);
  copyFileSync(canonicalValidate, join(coreDir, "validate.mjs"));
  ok(`.harness/core/validate.mjs (정본: skills/agent-engineer/scripts/validate.mjs)`);
} else {
  bad(`정본 validate.mjs 없음: ${canonicalValidate} — core/validate.mjs 미생성`);
}

// ===== DEFER: loop self-gate =====
if (sawLoop) {
  defer(`loop self-gate 컴파일 — loop.until 조건을 스킬 본문에 self-gate 로 박는 것은 '엔진 없음' 불변식과 긴장. 이번엔 미구현. loop 안 phase 는 개별 스킬로만 emit 됨(반복 제어는 LLM/호출자 몫). TODO: until 을 do[]의 마지막 스킬 본문에 '조건 충족까지 반복' self-gate 로 인코딩하는 설계 확정 필요.`);
}

// ===== 마무리 + ccc-plugin 안내 =====
console.log(`\n${c.d}─── packaging note ───${c.x}`);
info("plugin.json / marketplace.json (.claude-plugin/·.codex-plugin/) 은 ccc-plugin 의 몫 — build-skills 는 안 만든다.");
info("  Codex 발견 모델상 .codex-plugin/plugin.json 에 컴포넌트 포인터 필요: \"skills\": \"./.codex/skills/\"" + (strictPhases?.length ? " · \"hooks\": \"./.codex/hooks/config.toml\"" : ""));

console.log(`\n${c.g}✓ build-skills 완료${c.x}: 스킬 ${madeSkills} · 에이전트 ${madeAgents} · 훅 ${strictPhases.length ? "있음" : "없음"} · 경고 ${warns} · 오류 ${errors}`);
if (deferred.length) {
  console.log(`${c.b}DEFER ${deferred.length}건${c.x} (가짜 구현 대신 명시 보류):`);
  for (const d of deferred) console.log(`  - ${d.split(" — ")[0]}`);
}
console.log(`다음: node .harness/core/validate.mjs ${cfgPath.replace(ROOT + "/", "")}  로 연결 점검.`);
process.exit(errors === 0 ? 0 : 1);

// ---------- 게이트 훅 스크립트 본문 (boppa-gen gate-review.mjs 형식, 결정적 emit) ----------
function GATE_HOOK_SCRIPT() {
  return `#!/usr/bin/env node
// gate-review — strict 게이트가 강제하는 비손상 가드 (PreToolUse). [AgentOppa build-skills 가 생성]
// 불변식: 하네스는 기존 src/·test/ 파일을 수정/삭제하지 않는다(추가만). 기존 파일을 Edit/Write로 덮으려 하면 deny.
// 새 경로(test/<feature>.test.mjs 등) 추가는 허용. zero-dep(Node 빌트인) · 크로스OS · Claude/Codex 공용(루트 변수 흡수).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let input;
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const tool = input.tool_name ?? "";
if (!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) process.exit(0);

const path = input.tool_input?.file_path ?? input.tool_input?.path ?? "";
if (!path) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.env.PLUGIN_ROOT ?? process.cwd();
const abs = resolve(root, path);
const rel = abs.startsWith(resolve(root) + "/") ? abs.slice(resolve(root).length + 1) : path;

// 보호 대상: 기존 소스/테스트. 디렉토리에 새 파일을 *추가*하는 건 허용, 이미 존재하는 파일을 덮는 것만 차단(비손상).
const guarded = /^(src\\/|test\\/)/.test(rel) && existsSync(abs);
if (guarded) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        \`비손상 게이트: 기존 파일 '\${rel}' 수정 금지. 하네스는 새 파일만 추가한다 (예: test/<feature>.test.mjs). 기능 추가는 새 모듈/새 테스트로.\`,
    },
  }));
  process.exit(0);
}
process.exit(0);
`;
}
