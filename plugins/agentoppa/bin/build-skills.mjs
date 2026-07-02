#!/usr/bin/env node
// build-skills — Project(.harness/)를 읽어 재사용 Core 묶음(.agentoppa/)을 결정적으로 산출한다.
//   왜: .harness → 적재 가능한 Core 묶음으로 만드는 과정이 LLM 수작업이었다. 이 스크립트가 그 다리를 기계화한다.
//   모델(P0 잠금): AgentOppa = Maker(아무것도 안 싣는다). 유저가 자기 Project(.harness/)에서 재사용 Core(.agentoppa/)를
//         빌드한다. Core = AgentOppa 자신과 동형의 자체완결 묶음(.claude-plugin + .agents + plugins/<core>/) →
//         github·복붙으로 이식, 여러 프로젝트가 *가리켜* 쓴다. 프로젝트 값을 본문에 안 박는 게 재사용의 비결:
//         값-빈자리({이름})도 능력-빈자리({cap:이름})도 박지 않는다 — 둘 다 런타임에 .harness/config.yaml
//         (values:/bindings:)에서 읽힌다. 소비 프로젝트는 config 만 바꾸면 재빌드 없이 같은 Core 를 쓴다(ARCHITECTURE §2).
//   계약 출처: agent-engineer/references/{contract,phases,recipe}.md, 포맷 출처: ccc-skills·ccc-agents·ccc-hooks·ccc-plugin.
//             어긋나면 그 SKILL.md/references 가 정답.
//
// 사용법: node build-skills.mjs <project-root>
//   <project-root>/.harness/ 를 읽어 <project-root>/.agentoppa/ 에 Core 묶음 한 벌 + 그 안 마켓 2개를 채운다.
//   (project-root 인자만 받는다 — 이 스크립트는 엔진(plugins) 안이라 특정 콘텐츠 트리를 하드코딩하지 않는다. 한방향.)
//
// 생성 레이아웃 (.agentoppa/ 자체완결 묶음 — AgentOppa 자신과 동형):
//   <root>/.agentoppa/.claude-plugin/marketplace.json              # Claude 마켓 (owner 스키마), source "./plugins/<core>"
//   <root>/.agentoppa/.agents/plugins/marketplace.json             # Codex 마켓 (name/interface/policy AVAILABLE), source.path "./plugins/<core>"
//   <root>/.agentoppa/plugins/<core>/.claude-plugin/plugin.json    # 메타만 (Claude 자동발견)
//   <root>/.agentoppa/plugins/<core>/.codex-plugin/plugin.json     # 메타 + 존재하는 컴포넌트 포인터 (skills·hooks)
//   <root>/.agentoppa/plugins/<core>/skills/<phase>/SKILL.md       # 워크플로우(=Core 콘텐츠). 슬롯 치환. openai.yaml 금지.
//   <root>/.agentoppa/plugins/<core>/skills/setup/SKILL.md+scaffold.mjs  # 소비 프로젝트가 .harness 를 자급(설치만, AgentOppa 없이).
//   <root>/.agentoppa/plugins/<core>/phases/<name>.md              # phase 소스(슬롯 미치환 원문) — 로컬 저작분만, core:<name> 으로 가리켜 재사용.
//   <root>/.agentoppa/plugins/<core>/interface.json                # 이 Core 가 선언한 빈자리 명세(능력·값·단계) — setup/scaffold 가 읽음.
//   <root>/.agentoppa/plugins/<core>/agents/<name>.md (+.toml)     # Claude 에이전트(.md) + build-agents.mjs 가 Codex .toml 동반 생성.
//   <root>/.agentoppa/plugins/<core>/hooks/hooks.json (+ .mjs)     # project/hooks/ 저작분 그대로 이관(없으면 strict 시 기본 게이트). Codex 는 plugin.json 포인터로.
//   <root>/.agentoppa/plugins/<core>/always-on.md                  # Core 행동 규칙 (fallback import 대상).
//   <root>/.agentoppa/README.md                                    # 연동 명령(적재 메뉴) + 폴더 목적 + 배포 옵션.
//   <root>/CLAUDE.md · <root>/AGENTS.md                            # Core 규칙 import 줄 (append-only · 멱등 — 플러그인 없이도 행동 가드 생존).
//
// 안 하는 일 (의도적):
//   - <root>/.claude/ · <root>/.codex/ 디렉터리 생성 금지 — 그 포인터는 적재 메뉴(--plugin-dir / install / settings.json)가 만든다.
//   - per-skill openai.yaml 금지, 스킬 트리 복제 금지.
//   - 런타임 엔진 금지: loop·dynamic workers 는 *컴파일된 SKILL.md 본문에 self-gate 산문*으로 emit 한다
//       (스킬 읽는 LLM 이 스스로 반복/선택 — 외부 오케스트레이터 없음). loop=do[] 마지막 phase 맨 위 self-gate,
//       workers=첫 단락 뒤 선택 블록.
//   - core/validate.mjs 는 .harness/core/ 그대로 emit (검사 대상 config 와 같은 Project(.harness/) 영역, Core 묶음으로 옮기지 않음).
//   - CLAUDE.md/AGENTS.md 전체 재작성 금지 — import 줄 존재검사 후 append-only (기존 사용자 파일 비손상).
//
// zero-dep(Node 빌트인만) · 크로스OS(mac·linux·windows).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { dirname, join, resolve, basename, sep } from "node:path";
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
const DUMP_CFG = process.env.PARSECONFIG_DUMP || null; // 동치 검사용: parseConfig 결과만 덤프하고 종료(아래 훅)
const projectRoot = process.argv[2];
let ROOT, harnessDir, cfgPath;
if (!DUMP_CFG) {
  if (!projectRoot) {
    console.log(`${c.r}사용법: node build-skills.mjs <project-root>${c.x}`);
    console.log(`  예) node build-skills.mjs /path/to/my-project   (그 안의 .harness/ 를 .agentoppa/ Core 묶음으로 빌드)`);
    process.exit(2);
  }
  ROOT = resolve(projectRoot);
  harnessDir = join(ROOT, ".harness");
  cfgPath = join(harnessDir, "config.yaml");
  if (!existsSync(cfgPath)) { console.log(`${c.r}✗ config 없음: ${cfgPath}${c.x}`); process.exit(2); }

  console.log(`${c.d}build-skills${c.x} ${ROOT}`);
  console.log(`${c.d}  Project${c.x} .harness/  ${c.d}→ Core 묶음${c.x} .agentoppa/ (자체완결: 마켓 2개 + plugins/<core>/)\n`);
}

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
//   bindings/impl 블록 파싱은 validate.mjs 의 parseConfig 와 똑같이 둔다(둘이 동치여야 함).
function parseConfig(text) {
  const lines = text.split(/\r?\n/);
  const cfg = { scalars: {}, values: {}, bindings: {}, impl: {}, phases: [] };
  let i = 0;
  const isBlank = (l) => l.trim() === "" || /^\s*#/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (isBlank(l)) { i++; continue; }
    if (/^phases:\s*(#.*)?$/.test(l)) { i = parsePhases(lines, i + 1, cfg); continue; }
    if (/^values:\s*(#.*)?$/.test(l)) { i = parseBlock(lines, i + 1, cfg.values); continue; }
    if (/^bindings:\s*(#.*)?$/.test(l)) { i = parseBlock(lines, i + 1, cfg.bindings); continue; }
    if (/^impl:\s*(#.*)?$/.test(l)) { i = parseBlock(lines, i + 1, cfg.impl); continue; }
    const m = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m && clean(m[2]) !== "") cfg.scalars[m[1]] = clean(m[2]);
    i++;
  }
  return cfg;

  // 1-depth 평평한 블록(`키: 값` 한 줄들)을 target 맵에 채운다. values·bindings·impl 공용.
  function parseBlock(lines, i, target) {
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) { i++; continue; }
      if (!/^\s+/.test(l)) break;
      const m = l.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
      if (m) target[m[1]] = clean(m[2]);
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
          const um = inline[1].match(/until:\s*"([^"]*)"|until:\s*'([^']*)'|until:\s*([^,}]+)/); if (um) loop.until = (um[1] ?? um[2] ?? um[3]).trim();
          const mm = inline[1].match(/max:\s*(\d+)/); if (mm) loop.max = +mm[1];
          i++;
        } else {
          const base = l.search(/\S/); i++;
          while (i < lines.length && (lines[i].trim() === "" || lines[i].search(/\S/) > base)) {
            const dm = lines[i].match(/do:\s*\[([^\]]*)\]/); if (dm) loop.do = splitList(dm[1]);
            // until 값은 안에 따옴표(예: '기준 충족')를 품을 수 있다 → clean()으로 주석·바깥따옴표만 떼고 보존.
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
}

// 동치 검사 훅: PARSECONFIG_DUMP=<config> 면 parseConfig 결과만 JSON 으로 찍고 종료.
//   (bin/check-parseconfig-parity.mjs 가 validate.mjs 의 parseConfig 와 동작 일치를 자식 프로세스로 대조.)
if (DUMP_CFG) {
  process.stdout.write(JSON.stringify(parseConfig(readFileSync(DUMP_CFG, "utf8"))));
  process.exit(0);
}

// ---------- phase 파일 파서 (frontmatter + 본문) ----------
// requires 항목 한 개를 {key, optional, kind} 로 푼다(validate.mjs 와 동형). `:capability` = 능력-빈자리.
//   needs: 는 값-빈자리의 옛 이름 — 같은 requires 풀로 흡수(kind:"value").
function parseRequire(token) {
  const optional = /\?$/.test(token);
  let key = token.replace(/\?$/, "");
  let kind = "value";
  if (/:capability$/.test(key)) { kind = "capability"; key = key.replace(/:capability$/, ""); }
  return { key, optional, kind };
}
// `core: <name>` 묶음의 phase-소스 디렉터리를 찾는다 — startDir 에서 위로 올라가며 첫 매치.
//   (build-skills.mjs ↔ validate.mjs 동치 — 둘이 같은 규칙으로 푼다.) startDir 자신부터 본다.
//   위로 올라가는 이유: 한 Core 묶음을 *여러 프로젝트가 공유*(가리켜 재사용)할 때, 묶음이 프로젝트들의
//   공통 상위(워크스페이스 루트)에 한 벌로 있으면 sibling 프로젝트들이 *같은 한 파일*을 가리킨다(복사 0,
//   단일소스 — Core phase 한 장 고치면 N개 프로젝트 반영). 자기 루트에 묶음이 있으면 거기서 바로 멈춘다.
function findCorePhasesDir(startDir, core) {
  let dir = resolve(startDir);
  for (;;) {
    const cand = join(dir, ".agentoppa", "plugins", core, "phases");
    if (existsSync(cand)) return cand;
    const up = dirname(dir);
    if (up === dir) return null; // 파일시스템 루트 도달.
    dir = up;
  }
}
// phase 소스 파일 위치 해석 (`core:` 적재 배선 — recipe.md §1·contract 정합).
//   - `core:` 없으면(단독 하네스): 종전대로 .harness/project/phases/<name>.md 만.
//   - `core: <name>` 있으면(재사용 모드): "복사 말고 가리켜 재사용". 두 곳을 *우선순위*로 본다.
//       1) .harness/project/phases/<name>.md  — 있으면 이게 프로젝트 오버라이드(우선).
//       2) <위로 탐색>/.agentoppa/plugins/<core>/phases/<name>.md — Core 묶음이 들고 있는 phase 소스(공유 단일본).
//     [설계 결정 — 보고서 flag] 문서는 "Core 묶음 안" 까지만 못박았고 *정확한 파일·탐색*은 미확정이었다.
//     Core 묶음(.agentoppa/)은 컴파일 산출 SKILL.md 만 들고 phase '소스'(슬롯 미치환 원문)는 없었다 →
//     "Core phase 한 장 고치면 N개 프로젝트 반영"(단일소스)이 성립하려면 *소스 한 벌*이 묶음에 있어야 한다.
//     그래서 (a) Core 빌드 때 phase 소스를 묶음의 phases/ 로 emit(자체완결·이식 보존), (b) 소비 프로젝트는
//     core:<name> 로 그 phases/<name>.md 를 *가리켜* 컴파일(복사 0). SKILL.md(컴파일물)는 소스로 안 쓴다.
function phaseSourceFile(name) {
  const local = join(harnessDir, "project", "phases", `${name}.md`);
  if (existsSync(local)) return local; // 단독 하네스 = 여기만 · 재사용 모드 = 프로젝트 오버라이드(우선).
  const core = C && C.scalars && C.scalars.core ? kebab(C.scalars.core) : null;
  if (core) {
    const dir = findCorePhasesDir(ROOT, core); // 자기 루트 → 위로 탐색(공유 묶음).
    if (dir) {
      const fromCore = join(dir, `${name}.md`);
      if (existsSync(fromCore)) return fromCore; // Core 묶음이 들고 있는 phase 소스(가리켜 재사용).
    }
  }
  return null;
}
function parsePhase(name) {
  const file = phaseSourceFile(name); // core: 적재 배선 — 없으면 project/phases/, core: 면 묶음 phases/ 도.
  if (!file) return null;
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  const fm = { name, consumes: [], produces: null, requires: [], hasWorkers: false, workers: null };
  fm.srcFile = file;            // 어디서 소스를 읽었나 — 묶음 phase-소스 emit 판단(아래 §1)에 쓴다.
  fm.raw = raw;                 //   원문(슬롯 미치환) — 로컬 저작이면 Core 묶음 phases/ 로 그대로 옮긴다.
  fm.body = m ? m[2].trim() : raw.trim();
  if (!m) { fm.malformed = true; return fm; }
  const fmText = m[1];
  // frontmatter: 1-depth key: value. workers: 는 중첩 블록 → select + options(pool) 까지 파싱.
  const flines = fmText.split(/\r?\n/);
  for (let i = 0; i < flines.length; i++) {
    const l = flines[i];
    let mm;
    // workers: 중첩 블록. 다음 들여쓰기 줄들에서 select + options(<agent>: "<기준>") 를 모은다.
    //   select(all|none|dynamic) 이 *무엇을* 호출할지, options 의 각 줄이 *언제* 그 보조를 띄울지(기준).
    if (/^workers:\s*(#.*)?$/.test(l)) {
      fm.hasWorkers = true;
      fm.workers = { select: null, options: [] };
      const base = l.search(/\S/);
      let j = i + 1, inOptions = false;
      while (j < flines.length) {
        const wl = flines[j];
        if (wl.trim() === "" || /^\s*#/.test(wl)) { j++; continue; }
        if (wl.search(/\S/) <= base) break; // 들여쓰기 빠지면 workers 블록 끝.
        const sm = wl.match(/^\s+select:\s*(.+)$/);
        const om = wl.match(/^\s+options:\s*(#.*)?$/);
        if (sm) { fm.workers.select = clean(sm[1]); inOptions = false; j++; continue; }
        if (om) { inOptions = true; j++; continue; }
        // options 하위 항목: '<agent-name>: "<언제 띄울지>"' (select 보다 더 들여쓰여 있음).
        const opt = wl.match(/^\s+([A-Za-z0-9][\w-]*):\s*(.+)$/);
        if (inOptions && opt) fm.workers.options.push({ name: opt[1], when: clean(opt[2]) });
        j++;
      }
      i = j - 1; // 바깥 for 가 ++ 하므로 마지막 소비 줄에 맞춤.
      continue;
    }
    if ((mm = l.match(/^name:\s*(.+)$/))) fm.name = clean(mm[1]);
    else if ((mm = l.match(/^desc:\s*(.+)$/))) fm.desc = clean(mm[1]);
    else if ((mm = l.match(/^when:\s*(.+)$/))) { const x = clean(mm[1]); fm.when = (x === "~" || x === "") ? null : x; }
    else if ((mm = l.match(/^produces:\s*(.+)$/))) { const x = clean(mm[1]); fm.produces = (x === "~" || x === "") ? null : x; }
    // consumes: ~ (YAML null = 아무것도 안 받음) · 빈값 → 빈 리스트. produces 가드와 대칭(안 그러면 header inputs 에 팬텀 역할 '~' 누수).
    else if ((mm = l.match(/^consumes:\s*(.+)$/))) { const x = clean(mm[1]); fm.consumes = (x === "~" || x === "") ? [] : splitList(mm[1]).map((r) => ({ role: r.replace(/\?$/, ""), optional: /\?$/.test(r) })); }
    // requires 와 needs(옛 이름) 둘 다 requires 풀로 모은다. needs 항목은 항상 값-빈자리(kind:"value").
    else if ((mm = l.match(/^requires:\s*(.+)$/))) fm.requires.push(...splitList(mm[1]).map(parseRequire));
    else if ((mm = l.match(/^needs:\s*(.+)$/))) fm.requires.push(...splitList(mm[1]).map((r) => ({ ...parseRequire(r), kind: "value" })));
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

// requires 의 값-빈자리 키 → 본문에서 쓰일 법한 표기들(한국어 별칭 포함)을 같은 키로 매핑.
const VALUE_ALIASES = {
  test_command: ["test_command", "테스트 명령", "테스트명령", "test command"],
};

// {값슬롯} → 런타임-읽기 산문. 능력-빈자리와 같은 결: *결과를 박지 않는다* — 본문이 실행 시
//   .harness/config.yaml 의 values: 에서 직접 읽어 풀게 만든다(같은 Core 가 프로젝트마다 다른 값으로 동작,
//   소비자는 재빌드 없이 config 만 고친다 — ARCHITECTURE §2 "실행 시점에 .harness 에서 읽는다" 정합).
//   valueKeys: 이 phase 의 requires 중 kind:"value" 인 키 집합(needs 흡수분 포함) — 능력의 capKeys 와 동형.
//   여기 없는 {x} 는 role·next·미선언이라 건드리지 않는다(미선언은 뒤의 미치환 경고가 잡는다 — 선언 강제).
function expandValueSlots(body, valueKeys, knownRoles) {
  const aliasToKey = {};
  for (const key of valueKeys) {
    aliasToKey[key] = key;
    for (const alias of VALUE_ALIASES[key] || []) aliasToKey[alias] = key;
  }
  const used = new Set();
  let out = body.replace(/\{([^{}\n]+)\}/g, (whole, raw) => {
    const tok = raw.trim();
    if (tok === "next" || knownRoles.has(tok)) return whole; // role·next 는 별도 단계가 처리.
    const key = aliasToKey[tok];
    if (!key) return whole; // 미선언 슬롯 → 보존(미치환 경고로 잡음).
    used.add(key);
    return `\`${key}\`(값)`;
  });
  if (!used.size) return out;
  // 값별 해석 안내(결정적 산문). 정렬해 멱등 — 능력 안내(expandCapabilitySlots)와 같은 형식.
  const notes = [...used].sort().map((key) =>
    `\`${key}\`(값)의 알맹이는 \`.harness/config.yaml\` 의 \`values: ${key}:\` 가 담은 값이다. ` +
    `지금 그 값을 읽어 그대로 쓰라(명령이면 그대로 실행한다). ` +
    `못 찾으면 멈추고 "값 없음: ${key}" 라 알린다(값을 추측하지 않는다).`
  ).join("\n");
  return `${out.replace(/\s+$/, "")}\n\n${notes}`;
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

// {cap:<이름>} → 런타임-읽기 산문. 값 슬롯과 달리 *결과를 박지 않는다* — 본문이 실행 시 .harness/config.yaml 을
//   직접 읽어 풀게 만든다(같은 Core 가 프로젝트마다 다른 구현으로 동작 = 재사용). when/loop self-gate emit 과 동형.
//   동작: 각 {cap:이름} 인라인을 '`이름`(능력)' 으로 바꾸고, 본문 끝에 *능력별 한 번* 해석 안내 단락을 붙인다.
//     - 조사 중립: 토큰을 괄호로 끊어('`이름`(능력)') 뒤에 어떤 한국어 조사(로/를/은…)가 붙어도 자연스럽게 읽힌다.
//       (옛 '**이름** 능력' 은 본문 '{cap:x} 로' 를 '능력 로'(비문)로 만들었다 — insertStrictGateNote 콜론형 선례와 같은 결).
//     - capKeys: 이 phase 의 requires 중 kind:"capability" 인 이름 집합. 여기 없는 {cap:x} 는 미선언이라
//       치환하지 않고 그대로 둔다(뒤의 미치환 슬롯 경고가 잡는다 — 오타·미선언 능력 탐지).
//   expandValueSlots(값 슬롯) 보다 *먼저* 돌려야 한다 — {cap:..} 의 콜론이 값 슬롯 정규식에 걸리지 않게.
function expandCapabilitySlots(body, capKeys) {
  const used = new Set();
  let out = body.replace(/\{cap:([^{}]+)\}/g, (whole, raw) => {
    const cap = raw.trim();
    if (!capKeys.has(cap)) return whole; // 미선언 능력 슬롯 → 보존(미치환 경고로 잡음).
    used.add(cap);
    return `\`${cap}\`(능력)`;
  });
  if (!used.size) return out;
  // 능력별 해석 안내(결정적 산문). 정렬해 멱등 — 재컴파일해도 같은 텍스트.
  const notes = [...used].sort().map((cap) =>
    `\`${cap}\`(능력)의 구현은 \`.harness/config.yaml\` 의 \`bindings: ${cap}:\` 가 가리키는 값이다. ` +
    `그 값이 단일 토큰이면 같은 파일 \`impl:\` 아래 그 키가, 명령·경로면 그 자체가 알맹이다. ` +
    `지금 그 값을 읽어 그대로 실행하라(경로면 그 파일을 열어 따른다). ` +
    `못 찾으면 멈추고 "바인딩 없음: ${cap}" 라 알린다(값을 추측하지 않는다).`
  ).join("\n");
  return `${out.replace(/\s+$/, "")}\n\n${notes}`;
}

// when → self-gate: 본문 맨 위에 자가 점검 문장 삽입 (contract/phases.md §self-gate).
function prependSelfGate(body, when, nextName) {
  const target = nextName ? `→ /${nextName}` : "흐름을 끝낸다";
  // when 이 이미 '…때만'으로 끝나면 '일 때만' 을 또 붙이지 않는다(중복 '일 때만 일 때만' 방지) — '한다'만 잇는다.
  //   맨조건('직행 경로')이면 종전대로 '일 때만 한다' 를 붙여 그대로 읽히게 둔다(회귀 없음).
  const cond = when.trim();
  const clause = /때만$/.test(cond) ? `${cond} 한다` : `${cond} 일 때만 한다`;
  const gate = `이 단계는 ${clause}. 아니면 아무것도 하지 말고 바로 ${target}.\n\n`;
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

// workers → 보조 에이전트 선택 블록. 본문에 *독립 단락*으로 emit (LLM 이 읽고 스스로 고름 — 런타임 엔진 없음).
//   select=dynamic: pool 중 *관련된 것만* 골라 병렬 read-only 스폰 + 결과 합본. 기준 = options 의 각 '<언제>'.
//   select=all: pool 전부 병렬 스폰. select=none: (블록 없음).
//   producesPath: 합본 대상(= 산출물 경로) 또는 null(문서 산출 없음 → "결과를 다음 단계 입력으로 합본").
//   삽입 위치: strict 게이트 노트처럼 첫 단락 뒤(독립 단락). 멱등 — 재컴파일해도 같은 텍스트.
function insertWorkerBlock(body, workers, producesPath) {
  if (!workers || !workers.options || !workers.options.length) return body;
  const select = (workers.select || "dynamic").toLowerCase();
  if (select === "none") return body; // 명시적으로 안 부름.
  const pool = workers.options.map((o) => o.name).join(", ");
  const mergeTarget = producesPath ? `\`${producesPath}\`` : "다음 단계 입력";
  let note;
  if (select === "all") {
    // 정적 전체 호출.
    const crit = workers.options.map((o) => `- ${o.name}: ${o.when.replace(/[.。]\s*$/, "")}.`).join("\n");
    note =
      `보조 에이전트 호출(정적 select: all): 다음을 *모두* 병렬 read-only 로 스폰한다 — ${pool}. ` +
      `각자의 소관:\n${crit}\n결과를 ${mergeTarget}에 합본한다.`;
  } else {
    // dynamic(기본): 관련된 것만. 기준 문자열은 저자가 쓴 그대로(보통 '…때'로 끝남) + 마침표만.
    const crit = workers.options.map((o) => `- ${o.name}: ${o.when.replace(/[.。]\s*$/, "")}.`).join("\n");
    note =
      `보조 에이전트 선택(select: dynamic): 아래 풀에서 *관련된 것만* 골라 병렬 read-only 로 스폰한다 — ${pool}. ` +
      `관련성 기준(작업 트리/diff 신호로 판단):\n${crit}\n` +
      `고른 보조들을 read-only 로 동시에 띄우고, 각 요약 결과를 ${mergeTarget}에 합본한다. (해당 신호가 없으면 그 보조는 건너뛴다.)`;
  }
  // strict 게이트 노트와 같은 삽입 규칙: 첫 단락 경계 뒤에 독립 단락으로.
  const para = body.indexOf("\n\n");
  const firstNl = body.indexOf("\n");
  const cut = para !== -1 ? para : (firstNl !== -1 ? firstNl : body.length);
  const head = body.slice(0, cut).replace(/\s+$/, "");
  const tail = body.slice(cut).replace(/^\s+/, "");
  return tail ? `${head}\n\n${note}\n\n${tail}` : `${head}\n\n${note}`;
}

// loop → self-gate. 본문 *맨 위*에 반복 자가 점검 산문 emit (when self-gate 와 동형 — 엔진 없음).
//   do[] 의 *마지막* phase 본문에만 단다(한 바퀴를 끝낸 지점에서 until 을 본다).
//   loopFirst: 미충족 시 되돌아갈 do[]의 첫 스킬. loopExit: 충족/max 시 빠져나갈 다음 단계.
//   매 바퀴 do 묶음을 다시 돈다 — 카운트·판정은 스킬 읽는 에이전트가 self-gate 로 수행.
function prependLoopGate(body, until, max, doNames, loopFirst, loopExit) {
  const backTarget = loopFirst ? `/${loopFirst}` : "이 묶음의 처음";
  const exitTarget = loopExit ? `→ /${loopExit}` : "흐름을 끝낸다";
  const cycle = doNames.length ? doNames.join(" → ") : "이 묶음";
  const cap = max ? `최대 ${max}회` : "충분히";
  const gate =
    `이 묶음(${cycle})을 **${until}** 충족까지 반복한다(${cap}). ` +
    `한 바퀴를 마치면 조건을 본다: 미충족이고 횟수가 남았으면 ${backTarget}(으)로 되돌아가 다시 돈다. ` +
    `충족했거나 ${max || "최대"}회에 도달하면 ${exitTarget}.\n\n`;
  return gate + body;
}

// ---------- 디렉토리 ----------
function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function writeJSON(p, obj) { writeFileSync(p, JSON.stringify(obj, null, 2) + "\n"); }

// ---------- fallback 배선 (CLAUDE.md/AGENTS.md 에 Core 규칙 import 줄을 append-only·멱등으로) ----------
// 비손상 불변식: 기존 사용자 파일을 *전체 재작성하지 않는다* — import 줄이 이미 있으면 skip, 없으면 끝에 한 줄 추가,
//   파일 자체가 없으면 최소 헤더와 함께 생성. importLine 토큰(경로)이 들어 있으면 '있음'으로 본다 → 멱등(재실행 무변).
//   tool="claude" 면 '@<경로>' 형식(Claude import 문법), "agents" 면 경로 한 줄(AGENTS.md 는 산문 참조).
function wireFallback(filePath, importLine, tool) {
  const rel = importLine.replace(/^@/, "");
  if (existsSync(filePath)) {
    const cur = readFileSync(filePath, "utf8");
    // 이미 그 Core 규칙 경로를 가리키면(어떤 형식이든) 그대로 둔다 — 멱등.
    if (cur.includes(rel)) { info(`${basename(filePath)}: Core 규칙 import 이미 있음 — 유지(멱등)`); return; }
    // 끝에 빈 줄 보장 후 import 줄만 append (기존 내용 보존).
    const sep = cur.endsWith("\n\n") ? "" : (cur.endsWith("\n") ? "\n" : "\n\n");
    writeFileSync(filePath, cur + sep + importLine + "\n");
    ok(`${basename(filePath)}: Core 규칙 import 줄 추가(append-only) → ${importLine}`);
  } else {
    // 신규 생성: 최소 헤더 + import. (이 repo CLAUDE.md/AGENTS.md 브리지 패턴과 동형.)
    const title = tool === "claude" ? "# CLAUDE.md" : "# AGENTS.md";
    const note = "> 플러그인 없이 떠도 행동 가드가 살아있게 — 아래 import 로 Core 규칙(always-on)을 읽는다(fallback).";
    writeFileSync(filePath, `${title}\n\n${note}\n\n${importLine}\n`);
    ok(`${basename(filePath)}: 신규 생성 + Core 규칙 import → ${importLine}`);
  }
}

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

// Core 이름: config.core(재사용 모드, 가리키는 Core 이름) → config.harness(단독 하네스 하위호환) → basename(ROOT).
//   이게 Core 묶음 폴더(.agentoppa/plugins/<core>/)·매니페스트 name 이 된다 (kebab-case 강제 — recipe.md §9).
function kebab(s) { return String(s).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""); }
const coreRaw = C.scalars.core || C.scalars.harness || basename(ROOT) || "core";
const coreName = kebab(coreRaw) || "core";
if (coreName !== coreRaw) info(`Core 이름 정규화: '${coreRaw}' → '${coreName}' (plugin name 은 kebab-case)`);
const version = C.scalars.version || "0.1.0";
const description = C.scalars.description || `${coreName} Core (AgentOppa 빌드).`;
const owner = C.scalars.owner || "AgentOppa";
const displayName = C.scalars.display_name || coreName;

info(`core=${coreName} · feature=${feature} · sync=${sync} · routing=${C.scalars.routing || "(기본)"}`);

// phases 펼침 (loop 안 항목도 시퀀스로; loop 의 self-gate 는 do[] 마지막 phase 본문에 emit).
//   각 loop 항목에 loop 메타를 단다: first(되돌아갈 곳)·last(여기서 until 판정)·until·max·doNames.
const seq = [];
let sawLoop = false;
for (const p of C.phases) {
  if (p.type === "loop") {
    sawLoop = true;
    const doNames = p.do.slice();
    const loopFirst = doNames[0] || null;
    for (let k = 0; k < doNames.length; k++) {
      seq.push({
        name: doNames[k], syncOverride: null, inLoop: true,
        loopFirst, loopUntil: p.until, loopMax: p.max, loopDoNames: doNames,
        loopLast: k === doNames.length - 1, // do[]의 마지막 → 여기서 until self-gate.
      });
    }
  } else if (p.name) {
    seq.push({ name: p.name, syncOverride: p.sync || null, inLoop: false });
  }
}
if (!seq.length) { bad("phases 비어 있음 — 컴파일할 게 없음"); process.exit(1); }

// next 매핑 (시퀀스상 다음 — phase 는 자기 다음을 모른다, recipe 가 채운다).
//   loop 의 마지막 phase 는 next 가 'loop 탈출구'(= 묶음 다음)이기도 하다. self-gate 가 이를 exit 으로 쓴다.
for (let i = 0; i < seq.length; i++) seq[i].next = seq[i + 1] ? seq[i + 1].name : null;

// ---------- Core 묶음 트리 경로 (.agentoppa/ 자체완결 — AgentOppa 자신과 동형) ----------
const coreRoot = join(ROOT, ".agentoppa");                 // <root>/.agentoppa/ (이식 가능한 Core 한 벌)
const pluginDir = join(coreRoot, "plugins", coreName);     //   plugins/<core>/
const skillsDir = join(pluginDir, "skills");               //   skills/<phase>/SKILL.md  (공유 한 트리)
const phasesDir = join(pluginDir, "phases");               //   phases/<name>.md  (phase 소스 — 재사용 단일본)
const agentsDir = join(pluginDir, "agents");               //   agents/<name>.md (+.toml)
const hooksDir = join(pluginDir, "hooks");                 //   hooks/hooks.json (+ .mjs)
const claudePluginDir = join(pluginDir, ".claude-plugin"); //   .claude-plugin/plugin.json (메타만)
const codexPluginDir = join(pluginDir, ".codex-plugin");   //   .codex-plugin/plugin.json (메타 + 포인터)
// 마켓 source 는 *묶음 상대* — 마켓 파일이 .agentoppa/{.claude-plugin,.agents/plugins}/ 에 사니 ./plugins/<core> 그대로.
const pluginSource = `./plugins/${coreName}`;              // 마켓 source (루트 '.' 아님 — codex 발견 요건)

// 어떤 phase 가 strict 인지(게이트 훅 필요 판단). phase override > 전역 sync.
function effectiveSync(item) { return item.syncOverride || sync; }
const knownRoles = new Set(); // {role} 슬롯 판별용 — 전 phase produces/consumes 역할 모음.

// 1차 패스: 모든 phase 정의 로드 + 역할 수집.
const cards = {};
for (const item of seq) {
  if (cards[item.name]) continue;
  const card = parsePhase(item.name);
  if (!card) { warn(`phase '${item.name}' 정의 없음: project/phases/${item.name}.md (스킵 — phase 본문은 LLM이 직접 작성)`); continue; }
  if (card.malformed) warn(`phase '${item.name}' frontmatter 형식 이상 — 본문만 사용`);
  cards[item.name] = card;
  if (card.produces) knownRoles.add(card.produces);
  for (const cn of card.consumes) knownRoles.add(cn.role);
}

// ===== 1. phase → .agentoppa/plugins/<core>/skills/<name>/SKILL.md (공유 한 트리, openai.yaml 없음) =====
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
  // (a0) {cap:<능력>} → 런타임-읽기 산문 (값/role/next 치환보다 *먼저* — 콜론이 값 슬롯 정규식에 안 걸리게).
  //      값 슬롯도 능력 슬롯도 박지 않는다(재사용 비결) — 능력은 여기, 값은 (b)에서 편다. capKeys = 이 phase requires 의 능력 이름.
  const capKeys = new Set(card.requires.filter((r) => r.kind === "capability").map((r) => r.key));
  body = expandCapabilitySlots(body, capKeys);
  // (a) {role} → 경로. knownRoles 의 각 역할에 대해 {role} 치환.
  for (const role of knownRoles) {
    const re = new RegExp(`\\{${role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`, "g");
    body = body.replace(re, artifactPath(feature, role));
  }
  // (a2) frontmatter 누수 주석 제거: 본문에 새어든 '(produces: ~)' 는 frontmatter 개념이라 컴파일 산출에 두지 않는다.
  //      (컴파일러는 슬롯 치환이 본분이고 산문을 고쳐쓰지 않지만, 이 토큰은 명백한 frontmatter 누수라 슬롯처럼 떼어낸다.)
  body = body.replace(/\s*\(\s*produces:\s*~\s*\)/g, "");
  // (b) {프로젝트값} → 런타임-읽기 산문 (능력과 같은 결 — 값을 박지 않는다). requires 의 값-빈자리만 편다.
  const valueKeys = new Set(card.requires.filter((r) => r.kind === "value").map((r) => r.key));
  body = expandValueSlots(body, valueKeys, knownRoles);
  // (c) 산출물 헤더 enrich (status: ready · inputs).
  if (card.produces) body = enrichHeader(body, item.name, consumesRoles);
  // (d) when → self-gate (본문 맨 위).
  if (card.when) body = prependSelfGate(body, card.when, item.next);
  // (e) workers → 보조 에이전트 선택/호출 블록 (첫 단락 뒤, 독립 단락). select=none 이면 no-op.
  //     합본 대상은 {produces} 경로(있으면) — 없으면 다음 단계 입력으로 합본.
  //     strict 노트보다 *먼저* 삽입 → 둘 다 첫 단락 뒤를 노려서, 나중 삽입이 위로 간다.
  //     순서 결과: line1 → strict 게이트 노트 → workers 블록 → 본문 (게이트 프레이밍이 먼저 읽히게).
  if (card.workers && card.workers.options.length) {
    const producesPath = card.produces ? artifactPath(feature, card.produces) : null;
    const before = body;
    body = insertWorkerBlock(body, card.workers, producesPath);
    const sel = (card.workers.select || "dynamic").toLowerCase();
    if (body !== before) ok(`workers(${sel}) 선택 블록 emit: ${card.workers.options.map((o) => o.name).join(", ")}`);
    else if (sel === "none") info(`workers select: none — 선택 블록 생략 (명시적 비호출)`);
  }
  // (e2) strict 게이트 안내 (첫 문장 뒤 — workers 블록보다 위로).
  if (effectiveSync(item) === "strict" && card.gate) body = insertStrictGateNote(body, card.gate);
  // (e3) loop → self-gate (본문 맨 위). do[]의 *마지막* phase 에만(거기서 until 판정).
  if (item.loopLast) {
    body = prependLoopGate(body, item.loopUntil, item.loopMax, item.loopDoNames, item.loopFirst, item.next);
    ok(`loop self-gate emit: '${item.loopDoNames.join(" → ")}' until "${item.loopUntil}" (max ${item.loopMax ?? "?"})`);
  }
  // (f) {next} → /next | (종착).  ← 맨 마지막(다른 치환이 {next} 를 건드리지 않게).
  body = substituteNext(body, item.next);

  // 미치환 슬롯 점검 (오타·미정의 값).
  const leftover = [...body.matchAll(/\{([^{}\n]+)\}/g)].map((m) => m[1].trim());
  const realLeft = leftover.filter((k) => k !== "" && !/^\s/.test(k));
  if (realLeft.length) warn(`'${item.name}' 본문에 미치환 슬롯: ${[...new Set(realLeft)].map((k) => `{${k}}`).join(", ")} (config.values 또는 역할명 확인)`);

  // description: desc (없으면 경고 + 플레이스홀더).
  const desc = card.desc || `(desc 없음 — phase '${item.name}')`;
  if (!card.desc) warn(`'${item.name}' desc 없음 → description 비게 됨 (phase frontmatter 에 desc: 추가 권장)`);

  const skillMd = `---\nname: ${item.name}\ndescription: ${desc}\n---\n${body}\n`;

  // 공유 한 트리: .agentoppa/plugins/<core>/skills/<name>/SKILL.md (Claude 자동발견 + Codex 포인터가 같은 트리를 가리킴).
  // 복제 없음 · openai.yaml 없음 — AgentOppa 자신의 검증된 모델.
  const sDir = join(skillsDir, item.name);
  ensureDir(sDir);
  writeFileSync(join(sDir, "SKILL.md"), skillMd);
  ok(`.agentoppa/plugins/${coreName}/skills/${item.name}/SKILL.md`);

  // phase 소스(슬롯 미치환 원문)를 Core 묶음 phases/ 로 emit — *로컬 저작*일 때만(이 프로젝트가 Core 의 저자).
  //   왜: Core 묶음(.agentoppa/)이 phase 소스를 들고 있어야 다른 프로젝트가 core:<name> 로 *가리켜* 재컴파일하고,
  //       Core phase 한 장을 고치면 그 한 벌 소스가 N개 프로젝트에 반영된다(복사 0 = 단일소스 재사용).
  //   재사용 모드(소스를 이미 묶음에서 읽은 경우)는 자기 묶음을 덮어쓰지 않는다 — 한방향(저자만 emit).
  const localPhasesDir = join(harnessDir, "project", "phases");
  const authoredHere = card.srcFile && resolve(card.srcFile).startsWith(resolve(localPhasesDir) + sep); // sep: 윈도우 역슬래시에서도 맞게(하드코딩 '/'면 Windows 에서 phases 소스 emit 이 조용히 안 됨).
  if (authoredHere) {
    ensureDir(phasesDir);
    writeFileSync(join(phasesDir, `${item.name}.md`), card.raw); // 원문 그대로(byte-보존) — 컴파일 전 소스.
    ok(`.agentoppa/plugins/${coreName}/phases/${item.name}.md (phase 소스 — 재사용 단일본)`);
  }

  madeSkills++;
}

// phase 소스를 하나도 못 찾으면(예: core: 재사용 모드인데 Core 묶음이 아직 없어 phases/ 를 못 가리킴) 컴파일할 게 없다.
//   → 여기서 명확히 멈춘다. (안 그러면 아래 pluginDir 가 안 만들어진 채 interface.json 을 써서 ENOENT 로 죽는다 — 조용한 크래시 방지.)
if (madeSkills === 0) {
  bad(`컴파일된 스킬 0개 — phase 소스를 하나도 못 찾음(.harness/project/phases/<name>.md, 또는 core: 재사용이면 그 묶음의 phases/<name>.md 가 필요). 빌드 중단.`);
  process.exit(1);
}

// ===== 1b. Core 인터페이스 명세 + setup 스킬 (소비 프로젝트가 AgentOppa 없이 .harness 를 자급) =====
// 왜: 빌드된 Core(플러그인)가 *스스로* 소비 프로젝트의 .harness/config.yaml 을 깐다 → 프로젝트B는 AgentOppa 불필요.
//   interface.json = 이 Core 가 선언한 빈자리(능력·값) + 단계 목록. scaffold.mjs 가 읽어 골격을 쓰고, setup 스킬이
//   에이전트에게 "프로젝트를 살펴 values·bindings 를 채워라" 지시. 값-빈자리(values)도 능력-빈자리(bindings)도
//   런타임에 읽히므로 소비자가 채우면 그대로 동작. = "복사 말고 가리켜 재사용"의 소비자 자급.
console.log(`\n${c.d}interface${c.x} .agentoppa/plugins/${coreName}/ — 빈자리 명세 + setup 스킬 (소비자 자체 스캐폴딩)`);

// 단계 순서(유니크) + 빈자리 집계(values vs capabilities) — cards 의 requires 에서.
const phaseOrder = [];
{ const s = new Set(); for (const it of seq) if (cards[it.name] && !s.has(it.name)) { s.add(it.name); phaseOrder.push(it.name); } }
const ifaceVals = new Map(), ifaceCaps = new Map();
for (const it of seq) {
  const card = cards[it.name];
  if (!card) continue;
  for (const r of card.requires) {
    const tgt = r.kind === "capability" ? ifaceCaps : ifaceVals;
    if (!tgt.has(r.key)) tgt.set(r.key, { key: r.key, phases: [], optional: true });
    const e = tgt.get(r.key);
    if (!e.phases.includes(it.name)) e.phases.push(it.name);
    if (!r.optional) e.optional = false; // 한 단계라도 비선택으로 요구하면 필수.
  }
}
const interfaceObj = {
  core: coreName,
  phases: phaseOrder,
  capabilities: [...ifaceCaps.values()],
  values: [...ifaceVals.values()],
};
writeJSON(join(pluginDir, "interface.json"), interfaceObj);
ok(`.agentoppa/plugins/${coreName}/interface.json (단계 ${phaseOrder.length} · 능력빈자리 ${ifaceCaps.size} · 값빈자리 ${ifaceVals.size})`);

// setup 스킬 + scaffold 헬퍼 (프레임워크 제공 — 도메인 무관, 모든 Core 에 동일 주입; validate.mjs·always-on.md 와 같은 복사 패턴).
const setupTplDir = join(__dirname, "templates", "setup");
const setupDir = join(skillsDir, "setup");
let hasSetup = false;
if (existsSync(join(setupTplDir, "SKILL.md")) && existsSync(join(setupTplDir, "scaffold.mjs"))) {
  ensureDir(setupDir);
  const setupSkill = readFileSync(join(setupTplDir, "SKILL.md"), "utf8").replace(/\{\{CORE\}\}/g, coreName);
  writeFileSync(join(setupDir, "SKILL.md"), setupSkill);
  copyFileSync(join(setupTplDir, "scaffold.mjs"), join(setupDir, "scaffold.mjs"));
  hasSetup = true;
  ok(`.agentoppa/plugins/${coreName}/skills/setup/ (SKILL.md + scaffold.mjs — 설치만으로 .harness 자급)`);
} else {
  bad(`setup 템플릿 없음: ${setupTplDir} — Core 자체 스캐폴딩(setup 스킬) 미생성`);
}

// ===== 2. project/agents/*.md → .agentoppa/plugins/<core>/agents/*.md (Claude) + *.toml (Codex, build-agents.mjs) =====
// 공유 한 트리: 소스 .md 와 생성 .toml 을 같은 agents/ 폴더에 둔다 (.codex/ 별도 트리 안 만듦).
//   Claude 는 agents/*.md 자동발견. Codex 플러그인 에이전트 자동발견 경로는 미정(ccc-agents cross-tool §4)이라
//   .codex-plugin 에 agents 포인터를 넣지 않는다(그건 Claude 전용 키 — ccc-plugin validator 가 codex 매니페스트에서 경고).
//   생성된 .toml 은 소비 프로젝트가 자신의 .codex/agents/ 로 복사/심볼릭하는 산출물(ccc-agents 규율).
const srcAgentsDir = join(harnessDir, "project", "agents");
let madeAgents = 0;
let hasAgents = false;
if (existsSync(srcAgentsDir) && statSync(srcAgentsDir).isDirectory()) {
  const agentFiles = readdirSync(srcAgentsDir).filter((f) => f.endsWith(".md"));
  if (agentFiles.length) {
    hasAgents = true;
    console.log(`\n${c.d}agents${c.x} project/agents/ → .agentoppa/plugins/${coreName}/agents/ (.md 소스 + .toml 동반생성)`);
    ensureDir(agentsDir);
    // (a) Claude: .md 는 그대로 복사 (단일 소스, Claude 자동발견).
    for (const f of agentFiles) {
      copyFileSync(join(srcAgentsDir, f), join(agentsDir, f));
      ok(`.agentoppa/plugins/${coreName}/agents/${f}`);
      madeAgents++;
    }
    // (b) Codex: build-agents.mjs 를 호출해 같은 폴더에 .toml 동반생성 (재사용 — 같은 변환 로직).
    const buildAgents = join(__dirname, "build-agents.mjs");
    if (existsSync(buildAgents)) {
      info(`build-agents.mjs 호출 → ${agentsDir} (.md → .toml, 같은 폴더)`);
      const r = spawnSync(process.execPath, [buildAgents, agentsDir, agentsDir], { encoding: "utf8" });
      if (r.stdout) process.stdout.write(r.stdout.split("\n").map((l) => l ? "    " + l : l).join("\n"));
      if (r.status !== 0) bad(`build-agents.mjs 실패 (exit ${r.status})${r.stderr ? ": " + r.stderr.trim() : ""}`);
      else ok(`.agentoppa/plugins/${coreName}/agents/*.toml 생성됨 (Codex 소비처가 .codex/agents/ 로 복사)`);
    } else {
      bad(`build-agents.mjs 없음: ${buildAgents} — Codex 에이전트 .toml 미생성`);
    }
  }
} else {
  info("project/agents/ 없음 — 보조 에이전트 스킵");
}

// ===== 3. 훅 → .agentoppa/plugins/<core>/hooks/ (공유 한 트리) =====
// 우선순위: (1) 프로젝트가 .harness/project/hooks/ 를 저작했으면 *그 폴더를 그대로* 묶음 hooks/ 로 옮긴다
//               (1급 입력 — 매니페스트·스크립트·데이터 동반, 기본 게이트로 덮지 않는다).
//           (2) 프로젝트 훅이 없고 strict 게이트 phase 가 있으면 → 안전한 '비손상' 기본 게이트를 emit(종전 동작).
//   왜 (1): 이게 없으면 build 가 매번 hooks.json 을 기본 게이트로 덮어써 커스텀 훅(커밋 관문·세션 규칙 주입)이
//           조용히 죽는다 → 소비 프로젝트가 'build 뒤 되돌리는' 후처리를 손으로 짜야 했다. 그 강요를 없앤다.
//   관례: 묶음 hooks/ 는 자체완결 — 훅 스크립트는 자기 데이터(규칙 md 등)를 자기 위치(${CLAUDE_PLUGIN_ROOT}/hooks/)
//         기준으로 읽는다. (always-on.md 만은 §7 이 묶음 루트에 두고 CLAUDE.md/AGENTS.md 가 import 한다.)
const strictPhases = seq.filter((it) => cards[it.name] && effectiveSync(it) === "strict" && cards[it.name].gate);
const srcHooksDir = join(harnessDir, "project", "hooks");
const projectHookFiles =
  existsSync(srcHooksDir) && statSync(srcHooksDir).isDirectory()
    ? readdirSync(srcHooksDir).filter((f) => !f.startsWith(".") && statSync(join(srcHooksDir, f)).isFile())
    : [];
let hasHooks = false;
if (projectHookFiles.length) {
  // (1) 프로젝트 저작 훅 — 폴더 내용을 그대로 이관(덮지 않음).
  hasHooks = true;
  console.log(`\n${c.d}hooks${c.x} 프로젝트 저작 project/hooks/ ${projectHookFiles.length}개 → .agentoppa/plugins/${coreName}/hooks/ (그대로 이관 — 기본 게이트로 안 덮음)`);
  ensureDir(hooksDir);
  for (const f of projectHookFiles) {
    copyFileSync(join(srcHooksDir, f), join(hooksDir, f));
    ok(`.agentoppa/plugins/${coreName}/hooks/${f}`);
  }
  if (!projectHookFiles.includes("hooks.json"))
    warn(`project/hooks/ 에 hooks.json 없음 — Codex 포인터(.codex-plugin hooks)가 가리킬 매니페스트가 필요하다`);
  if (strictPhases.length)
    info(`strict 게이트 phase ${strictPhases.length}개 있음 — 프로젝트 훅이 그 게이트를 담당한다고 보고 기본 게이트는 생략(프로젝트 hooks.json 이 강제).`);
} else if (strictPhases.length) {
  // (2) 프로젝트 훅 없음 + strict 게이트 → 안전한 '비손상' 기본 게이트 emit.
  //   주의: 게이트 훅의 *구체 로직*은 phase·프로젝트마다 다르다. 여기선 가장 흔한 '비손상(기존 src/·test/ 무수정)' 가드를 emit 한다.
  //   더 정교한 게이트가 필요하면 project/hooks/ 에 직접 저작하면 (1) 경로로 그대로 실린다.
  hasHooks = true;
  console.log(`\n${c.d}hooks${c.x} strict 게이트 ${strictPhases.length}개: ${strictPhases.map((p) => p.name).join(", ")} → .agentoppa/plugins/${coreName}/hooks/ (기본 비손상 게이트)`);
  ensureDir(hooksDir);

  const hookScript = GATE_HOOK_SCRIPT();
  writeFileSync(join(hooksDir, "gate-review.mjs"), hookScript);
  ok(`.agentoppa/plugins/${coreName}/hooks/gate-review.mjs (기본 게이트 — Claude·Codex 한 벌)`);

  // 기본 hooks.json (양쪽 같은 JSON 모양 — ccc-hooks §1). 경로변수는 ${CLAUDE_PLUGIN_ROOT}
  //   (Codex 가 별칭으로 받음 — ccc-plugin template '경로 변수'). 스크립트 위치를 가리키되,
  //   가드의 '프로젝트 루트' 는 스크립트가 CLAUDE_PROJECT_DIR/cwd 로 흡수(plugin root 와 분리).
  const hooksJson = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Edit|Write|MultiEdit|NotebookEdit",
          hooks: [{ type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/gate-review.mjs"', timeout: 30 }],
        },
      ],
    },
  };
  writeJSON(join(hooksDir, "hooks.json"), hooksJson);
  ok(`.agentoppa/plugins/${coreName}/hooks/hooks.json (기본 게이트 — Codex 는 .codex-plugin 포인터로 가리킴)`);

  info("주: 이 훅은 '비손상(기존 src/·test/ 무수정)' 기본 가드다. 다른 게이트가 필요하면 project/hooks/ 에 저작하면 그대로 실린다.");
} else {
  info("훅 없음 — project/hooks/ 도, strict 게이트 phase 도 없음");
}

// ===== 4. 매니페스트 2개 (plugin.json) — AgentOppa 자신과 동형 =====
console.log(`\n${c.d}manifests${c.x} .agentoppa/plugins/${coreName}/.claude-plugin + .codex-plugin`);
ensureDir(claudePluginDir);
ensureDir(codexPluginDir);

// Claude: 메타만 (컴포넌트는 자동발견). ccc-plugin template §1.
const claudeManifest = { name: coreName, version, description };
if (C.scalars.author) claudeManifest.author = C.scalars.author;
writeJSON(join(claudePluginDir, "plugin.json"), claudeManifest);
ok(`.agentoppa/plugins/${coreName}/.claude-plugin/plugin.json (메타만)`);

// Codex: 메타 + 존재하는 컴포넌트 포인터 (없는 건 빼라 — ccc-plugin template §2 / manifest §3).
//   skills 포인터: skills/ 가 있으면 필수 (validator error 조건). hooks: hooks.json 이 있으면.
//   agents 는 Codex 매니페스트 포인터가 없다(Claude 전용 키 — validator 가 codex 매니페스트에서 경고). 빼둔다.
const codexManifest = { name: coreName, version, description };
if (C.scalars.author) codexManifest.author = C.scalars.author;
const codexPointers = [];
if (madeSkills > 0 || hasSetup) { codexManifest.skills = "./skills/"; codexPointers.push("skills→./skills/"); }
if (hasHooks) { codexManifest.hooks = "./hooks/hooks.json"; codexPointers.push("hooks→./hooks/hooks.json"); }
// UI 메타(선택) — AgentOppa 자신은 안 싣지만, displayName 만 있으면 Codex 표시명이 깔끔. category 는 마켓에.
codexManifest.interface = { displayName };
writeJSON(join(codexPluginDir, "plugin.json"), codexManifest);
ok(`.agentoppa/plugins/${coreName}/.codex-plugin/plugin.json (메타 + 포인터: ${codexPointers.length ? codexPointers.join(", ") : "없음"})`);

// ===== 5. 마켓플레이스 2개 (Core 묶음 안) — 도구별 스키마 =====
// 묶음 자체완결: 마켓도 .agentoppa/ 안에 둔다(repo 루트 아님) → 묶음 통째로 이식·복붙해도 source 가 그대로 가리킴.
console.log(`\n${c.d}marketplaces${c.x} .agentoppa/.claude-plugin/ (Claude) + .agentoppa/.agents/plugins/ (Codex)`);

// Claude 마켓: owner 스키마. source 는 ./plugins/<core> (묶음 상대 문자열 — 마켓이 .agentoppa/ 안이라). ccc-plugin template §3.
const claudeMarketDir = join(coreRoot, ".claude-plugin");
ensureDir(claudeMarketDir);
const claudeMarket = {
  name: coreName,
  owner: { name: owner },
  plugins: [{ name: coreName, source: pluginSource, description }],
};
writeJSON(join(claudeMarketDir, "marketplace.json"), claudeMarket);
ok(`.agentoppa/.claude-plugin/marketplace.json (owner='${owner}', source='${pluginSource}')`);

// Codex 마켓: name + interface + policy AVAILABLE. source.path 는 ./plugins/<core> (묶음 상대, 루트 '.' 금지). ccc-plugin template §4.
//   owner{} 누수 금지 (codex 가 무시·validator 경고). category 필수 권장.
const codexMarketDir = join(coreRoot, ".agents", "plugins");
ensureDir(codexMarketDir);
const codexCategory = C.scalars.category || "Development";
const codexMarket = {
  name: coreName,
  interface: { displayName },
  plugins: [
    {
      name: coreName,
      source: { source: "local", path: pluginSource },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: codexCategory,
    },
  ],
};
writeJSON(join(codexMarketDir, "marketplace.json"), codexMarket);
ok(`.agentoppa/.agents/plugins/marketplace.json (name='${coreName}', source.path='${pluginSource}', policy=AVAILABLE)`);

// ===== 6. core/validate.mjs 단일소스 emit (.harness/core/ 그대로) =====
// 정본 = agent-engineer/scripts/validate.mjs. .harness/core/ 로 복사해 자기검사 독립(지난 라이브의 '즉흥 복사' 결정화).
//   플러그인 트리로 옮기지 않는다 — 검사 대상(.harness/config.yaml)과 같은 Project(.harness/) 영역에 둔다.
console.log(`\n${c.d}core${c.x} validate.mjs 정본 복사 → .harness/core/ (Project 영역)`);
const canonicalValidate = resolve(__dirname, "..", "skills", "agent-engineer", "scripts", "validate.mjs");
if (existsSync(canonicalValidate)) {
  const coreDir = join(harnessDir, "core");
  ensureDir(coreDir);
  copyFileSync(canonicalValidate, join(coreDir, "validate.mjs"));
  ok(`.harness/core/validate.mjs (정본: skills/agent-engineer/scripts/validate.mjs)`);
} else {
  bad(`정본 validate.mjs 없음: ${canonicalValidate} — core/validate.mjs 미생성`);
}

// loop: do[]의 마지막 phase 본문에 self-gate 산문으로 emit 됨(위 e3) — 반복·카운트는 스킬 읽는 에이전트가 수행(엔진 없음).
if (sawLoop) info(`loop self-gate: do[] 마지막 phase 본문 맨 위에 '조건 충족까지 반복' 산문으로 컴파일됨 (반복 제어는 LLM self-gate — 엔진 없음).`);

// ===== 7. Core 행동 규칙(always-on.md) emit + CLAUDE.md/AGENTS.md fallback 배선 =====
// fallback 의 뜻: 플러그인을 안 실어도(--plugin-dir 없이 떠도) 프로젝트 루트 CLAUDE.md/AGENTS.md 가 Core 규칙을
//   import 하므로 *행동 가드*는 산다(규칙만 — 단계 스킬·게이트 같은 실행 부품은 플러그인 적재 필요). ARCHITECTURE §Fallback.
//   = 이 repo 자신이 쓰는 always-on 브리지 패턴을 생성물에도 심는다.
console.log(`\n${c.d}fallback${c.x} Core 규칙 emit + CLAUDE.md/AGENTS.md import 배선 (append-only · 멱등)`);
const canonicalAlwaysOn = resolve(__dirname, "..", "always-on.md");
const alwaysOnRel = `.agentoppa/plugins/${coreName}/always-on.md`; // 프로젝트 루트 기준 — import 줄이 가리키는 곳.
if (existsSync(canonicalAlwaysOn)) {
  ensureDir(pluginDir);
  // 정본 always-on 의 주어(정본은 'AgentOppa 플러그인이 깔린 세션')를 이 Core 이름으로 바꿔 emit —
  //   자립형 Core 는 자기 이름으로 말해야 한다. 그대로 복사하면 빌드된 Core 가
  //   'AgentOppa 플러그인이 깔린 세션이면…' 이라 자기를 잘못 소개한다(이름 바꾸기 잔재). 나머지 규칙 본문은 도메인 무관·그대로.
  const alwaysOnText = readFileSync(canonicalAlwaysOn, "utf8")
    .replace("AgentOppa 플러그인이 깔린 세션", `${coreName} 하네스가 깔린 세션`);
  writeFileSync(join(pluginDir, "always-on.md"), alwaysOnText);
  ok(`${alwaysOnRel} (Core 행동 규칙 — 주어 '${coreName}' 로 정정, fallback import 대상)`);
  // CLAUDE.md(@import)·AGENTS.md(경로 한 줄) 둘 다 배선. 기존 파일은 import 줄만 append(없으면 생성) — 전체 재작성 금지.
  wireFallback(join(ROOT, "CLAUDE.md"), `@${alwaysOnRel}`, "claude");
  wireFallback(join(ROOT, "AGENTS.md"), alwaysOnRel, "agents");
} else {
  bad(`정본 always-on.md 없음: ${canonicalAlwaysOn} — Core 규칙·fallback 미생성`);
}

// ===== 8. .agentoppa/README.md emit (연동 명령 + 폴더 목적 + 배포 옵션) =====
console.log(`\n${c.d}readme${c.x} .agentoppa/README.md emit (적재 메뉴·폴더 목적·배포 옵션)`);
ensureDir(coreRoot);
writeFileSync(join(coreRoot, "README.md"), CORE_README(coreName, pluginSource, description));
ok(`.agentoppa/README.md (적재 메뉴 + 폴더 목적 + 배포 옵션)`);

// ===== 마무리 =====
console.log(`\n${c.d}─── packaging (재사용 Core 모델: .agentoppa/ 자체완결 묶음 + 두 마켓 포인터) ───${c.x}`);
info(`Claude: .agentoppa/plugins/${coreName}/ 컴포넌트 자동발견. Codex: .codex-plugin/plugin.json 포인터(${codexPointers.length ? codexPointers.join(" · ") : "skills 없음?"}) 로 발견.`);
info(`마켓 source 는 '${pluginSource}' (묶음 상대 — 루트 '.' 아님, codex 'No plugins found' 회피).`);
if (hasAgents) info(`Codex 에이전트: .agentoppa/plugins/${coreName}/agents/*.toml 을 소비 프로젝트 .codex/agents/ 로 복사(플러그인 자동발견 경로 미정).`);

console.log(`\n${c.g}✓ build-skills 완료${c.x}: 스킬 ${madeSkills} · 에이전트 ${madeAgents} · 훅 ${hasHooks ? "있음" : "없음"} · 경고 ${warns} · 오류 ${errors}`);
if (deferred.length) {
  console.log(`${c.b}DEFER ${deferred.length}건${c.x} (가짜 구현 대신 명시 보류):`);
  for (const d of deferred) console.log(`  - ${d.split(" — ")[0]}`);
}
console.log(`다음: node plugins/agentoppa/skills/ccc-plugin/scripts/validate.mjs ${pluginDir}  로 Core 플러그인(매니페스트·마켓) 점검.`);
process.exit(errors === 0 ? 0 : 1);

// ---------- 게이트 훅 스크립트 본문 (비손상 가드, 결정적 emit) ----------
function GATE_HOOK_SCRIPT() {
  return `#!/usr/bin/env node
// gate-review — strict 게이트가 강제하는 비손상 가드 (PreToolUse). [AgentOppa build-skills 가 생성]
// 불변식: 하네스는 기존 src/·test/ 파일을 수정/삭제하지 않는다(추가만). 기존 파일을 Edit/Write로 덮으려 하면 deny.
// 새 경로(test/<feature>.test.mjs 등) 추가는 허용. zero-dep(Node 빌트인) · 크로스OS · Claude/Codex 공용(루트 변수 흡수).
//   주의: 스크립트 파일은 플러그인 hooks/ 에 있지만, 가드의 '프로젝트 루트' 는 CLAUDE_PROJECT_DIR(또는 cwd)로 잡는다
//         — PLUGIN_ROOT(플러그인 위치)가 아니다. 둘을 섞으면 src/·test/ 판정이 어긋난다.
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

let input;
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }

const tool = input.tool_name ?? "";
if (!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) process.exit(0);

const path = input.tool_input?.file_path ?? input.tool_input?.path ?? "";
if (!path) process.exit(0);

// 프로젝트 루트: CLAUDE_PROJECT_DIR(Claude) → cwd(에이전트 실행 위치) 순. PLUGIN_ROOT 는 *쓰지 않는다*(플러그인 위치라 무관).
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const abs = resolve(root, path);
const rel = relative(root, abs).replace(/\\\\/g, "/"); // 크로스OS: 윈도우 역슬래시를 '/'로 정규화(아래 src/·test/ 정규식이 모든 OS에서 맞게).

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

// ---------- .agentoppa/README.md 본문 (적재 메뉴 + 폴더 목적 + 배포 옵션, 결정적 emit) ----------
// 멱등: 같은 (core, source, description) → byte-identical. 본문은 산문(템플릿) — 컴파일러가 상황별로 안 고친다.
function CORE_README(core, source, desc) {
  const pdir = `./.agentoppa/plugins/${core}`; // 프로젝트 루트 기준 적재 경로 — 묶음은 .agentoppa/ 안이므로 그 접두가 필요(마켓 source '.agentoppa 내부 상대'와 다름).
  return `# ${core} — 재사용 Core (\`.agentoppa/\`)

> ${desc}
>
> 이 폴더는 **재사용 Core**다 — 워크플로우(단계 흐름·게이트) + 범용 스킬 + 훅 + 인터페이스(빈자리)를 자체완결로 담는다.
> AgentOppa(Maker)가 이 프로젝트의 \`.harness/\`(의도·바인딩·값)를 읽어 결정적으로 빌드한 산출물이다.
> 프로젝트 값을 본문에 안 박는 게 재사용의 비결 — 값-빈자리도 능력-빈자리(\`{cap:}\`)도 실행 시
> \`.harness/config.yaml\`(\`values:\` / \`bindings:\`·\`impl:\`)에서 읽힌다. 그래서 같은 Core를 여러 프로젝트가 *가리켜* 쓴다.

## 폴더 구조

\`\`\`
.agentoppa/
├── .claude-plugin/marketplace.json   # Claude 마켓 (source: ${source})
├── .agents/plugins/marketplace.json  # Codex 마켓 (source.path: ${source})
└── plugins/${core}/
    ├── .claude-plugin/plugin.json     # Claude 메타 (컴포넌트 자동발견)
    ├── .codex-plugin/plugin.json      # Codex 메타 + 컴포넌트 포인터
    ├── skills/<phase>/SKILL.md         # 워크플로우 단계 스킬
    ├── skills/setup/                   # 셋업 스킬 + scaffold.mjs (소비 프로젝트 .harness 자급)
    ├── phases/<name>.md                # 단계 소스(슬롯 미치환 — core: 로 가리켜 재사용하는 단일본)
    ├── interface.json                  # 이 Core 가 선언한 빈자리 명세 (setup 이 읽음)
    ├── agents/<name>.md (+.toml)       # 보조 에이전트 (있으면)
    ├── hooks/hooks.json (+.mjs)        # 훅 (project/hooks/ 저작분 그대로, 없으면 기본 게이트 — 있으면)
    └── always-on.md                    # 행동 규칙 (루트 CLAUDE.md/AGENTS.md 가 import)
\`\`\`

## 적재 = 가리키기 (by-reference)

도구가 읽는 \`.claude\`/\`.codex\`는 이 Core의 *사본이 아니라 얇은 포인터*다. 아래 중 하나로 이 Core를 물린다:

- **Claude (그때그때):** \`claude --plugin-dir ${pdir}\`
- **Claude (커밋해 항상):** \`.claude/settings.json\`에 이 마켓/플러그인을 등록(프로젝트에 커밋 → 팀 공유).
- **Codex:** 루트 \`.agents/plugins/marketplace.json\`을 자동 감지 → \`installation: AVAILABLE\`이라 설치 후 사용.

## 새 프로젝트에 붙이기 (setup — AgentOppa 없이)

이 Core를 적재한 뒤(위), 이 프로젝트의 \`.harness/config.yaml\`을 깐다 — **AgentOppa 없이 이 플러그인만으로.** 이 Core가 든 \`setup\` 스킬에게 *"이 하네스 붙여줘"* 라고 하면 자동으로, 또는 헬퍼를 직접 돌린다:

\`\`\`bash
node "\${CLAUDE_PLUGIN_ROOT}/skills/setup/scaffold.mjs"
\`\`\`

→ \`.harness/config.yaml\` 골격을 만들고 채울 빈자리 — 값(\`values\`)과 능력(\`bindings\`) — 을 알려 준다. 그 자리를 이 프로젝트 것으로 채우면(예: \`test_command: "npm test"\` · \`test-runner: "npx playwright test"\`) 끝 — 단계 스킬이 실행될 때 그 값을 읽어 동작한다.

## Fallback — 플러그인 없이 떠도 행동 가드 생존

이 프로젝트 루트의 \`CLAUDE.md\`/\`AGENTS.md\`가 \`plugins/${core}/always-on.md\`를 import한다.
그래서 \`--plugin-dir\` 없이 떠도 *행동 규칙*은 살아 있다(규칙만 — 단계 스킬·게이트 같은 실행 부품은 위 적재가 필요).

## 배포 옵션

- **이식:** 이 \`.agentoppa/\` 폴더는 자체완결이라 통째로 다른 repo에 복사하거나 github에 올려 여러 프로젝트가 가리킬 수 있다.
- **재빌드:** \`.harness/\`(의도·값·바인딩)를 고친 뒤 \`node <agentoppa>/plugins/agentoppa/bin/build-skills.mjs <project-root>\`로 다시 빌드(멱등 — 같은 입력→같은 산출).

---

*손으로 고치지 마라 — 이 폴더는 \`.harness/\`에서 결정적으로 빌드된 산출물이다. 바꿀 게 있으면 \`.harness/\`를 고치고 재빌드한다.*
`;
}
