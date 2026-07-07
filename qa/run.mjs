#!/usr/bin/env node
// qa/run.mjs — 라이브 e2e 시나리오 러너 (zero-dep Node · 돌고 끝남 = 검사 러너, 상주 실행기 아님).
//   보장: 셋업(seed→.work 복사 + git baseline)과 *사후* 기계 판정(존재·diff·합격테스트).
//   agent 단계(면담/생성/실행)는 대화형/헤드리스 세션이 따로 몬다 — 러너는 그 전후만 잡는다(정직).
//   plugins/ 에 의존하지 않는다(결합 최소 — 자체 frontmatter 파서). Node 빌트인만 → mac·linux·windows 동일.
// 사용법: node qa/run.mjs list | setup <caseId> | judge <caseId>
import { readFileSync, existsSync, readdirSync, statSync, cpSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
// 판정 본체는 qa/checks/lib (순수 로직) — standalone validator(red/green)와 *같은 모듈* 을 공유한다.
// (plugins/ 의존 아님 — qa→qa 는 한방향 규칙 위반 아님. plugins 검증기는 §interview_gated 처럼 spawn 으로만 부른다.)
import { judgeFitsRunner } from "./checks/lib/fits-runner.mjs";
import { judgeContract, parseDocHeader } from "./checks/lib/contract.mjs";
import { judgeResumeEquivalent } from "./checks/lib/resume.mjs";

const QA = dirname(fileURLToPath(import.meta.url));
const ROOT = join(QA, "..");
const CASES_DIR = join(QA, "targets/web/cases");
const SEEDS_DIR = join(QA, "targets/web/seeds");
const WORK = join(QA, ".work");
const c = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m", x: "\x1b[0m" };

const die = (m) => { console.log(`${c.r}✗ ${m}${c.x}`); process.exit(2); };
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const rel = (p) => p.replace(ROOT + "/", "");

// --- 초미니 frontmatter 파서 (plugins 의 것에 의존하지 않으려 자체 보유) ---
function frontmatter(file) {
  const m = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!mm) continue;
    let v = mm[2].trim();
    if (v.startsWith("[") && v.endsWith("]"))
      v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, "");
    fm[mm[1]] = v;
  }
  return fm;
}

function allCases() {
  if (!existsSync(CASES_DIR)) return [];
  return readdirSync(CASES_DIR)
    .filter((d) => existsSync(join(CASES_DIR, d, "case.md")))
    .map((d) => ({ id: d, ...frontmatter(join(CASES_DIR, d, "case.md")) }));
}
const findCase = (id) => allCases().find((k) => k.id === id) ?? die(`알 수 없는 케이스: ${id} (node qa/run.mjs list)`);
const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

// 재사용 Core 모델: AgentOppa 가 추가하는 경로 = Project(.harness/<하네스>/) + 활성 하네스 선택기(.harness-main) +
//   Core 묶음(.agentoppa: 마켓 2개 + plugins/<core>/) + 루트 fallback 문서(CLAUDE.md·AGENTS.md, Core 규칙 import).
//   적재 포인터 .claude/.codex 는 빌드가 안 만든다(적재 메뉴 몫).
const HARNESS = [".harness", ".harness-main", ".agentoppa", "CLAUDE.md", "AGENTS.md", ".claude", ".codex"];
const isHarness = (p) => HARNESS.some((h) => p === h || p.startsWith(h + "/"));

// 활성 하네스 이름 = HARNESS_MAIN(env) → <root>/.harness-main(첫 비주석·비어있지 않은 줄) → null.
//   여러 하네스가 .harness/<이름>/ 로 공존해도 실행·판정 대상은 selector 가 고른 1개다(단일 활성 하네스).
//   (build-skills.mjs 의 resolveActiveHarness 와 동치 — selector 로만 판단, .harness/ 하위 폴더를 스캔·추측하지 않는다.)
function activeHarness(root) {
  if (process.env.HARNESS_MAIN && process.env.HARNESS_MAIN.trim()) return process.env.HARNESS_MAIN.trim();
  const sel = join(root, ".harness-main");
  if (existsSync(sel)) {
    const name = readFileSync(sel, "utf8").split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
    if (name) return name;
  }
  return null;
}
// 활성 하네스의 Project 폴더 절대경로(.harness/<이름>/). 선택기(.harness-main/HARNESS_MAIN) 없으면 null.
function harnessDir(root) {
  const name = activeHarness(root);
  return name ? join(root, ".harness", name) : null;
}

// --- 판정들 (기계화된 것만; 나머지는 judge() 가 '?' 수동 표시) ---
const JUDGES = {
  harness_present(work) {
    const REQUIRED = [".harness", ".agentoppa"]; // Project(.harness) + 재사용 Core 묶음(.agentoppa)
    const missing = REQUIRED.filter((h) => !existsSync(join(work, h)));
    return missing.length
      ? { ok: false, msg: `하네스 산출 누락: ${missing.join(", ")} (build-skills 안 돎?)` }
      : { ok: true, msg: "하네스 .harness/(Project) + .agentoppa/(재사용 Core 묶음) 존재" };
  },
  project_unchanged(work) {
    // seed 원본(tracked) 파일이 수정/삭제되지 않았는가 — 하네스 경로 추가만 허용
    const lines = git(work, "status", "--porcelain").stdout.split("\n").filter(Boolean);
    const bad = lines.filter((l) => !isHarness(l.slice(3)));
    return bad.length
      ? { ok: false, msg: `프로젝트 원본 손상/오염(하네스 외 변경):\n      ${bad.join("\n      ")}` }
      : { ok: true, msg: "프로젝트 원본 무손상 (하네스 경로만 추가)" };
  },
  compiled_idempotent(work) {
    // 호출 전제: 직전 build-skills 결과를 커밋해 두고 → build-skills 재실행 → 이 판정.
    //   빌드 산출은 전부 Core 묶음 .agentoppa/ 안 (마켓 2개 + plugins/<core>/) → 거기 diff=∅ 이면 멱등.
    // status --porcelain: tracked diff + 미추적 신규(??) + 삭제 모두 잡는다.
    //   (diff --name-only 는 미추적 신규 파일을 놓쳐, 재생성이 새 파일을 흘려도 멱등으로 거짓통과했다.)
    const d = git(work, "status", "--porcelain", "--", ".agentoppa").stdout.trim();
    return d
      ? { ok: false, msg: `재생성이 Core 묶음을 바꿈(멱등 실패):\n      ${d.split("\n").join("\n      ")}` }
      : { ok: true, msg: "재생성 멱등 — .agentoppa/ 변화 없음" };
  },
  acceptance(work, kase) {
    if (!kase.acceptance) return { ok: false, msg: "case.md 에 acceptance 명령 미정의" };
    const [bin, ...a] = kase.acceptance.split(/\s+/);
    const r = spawnSync(bin, a, { cwd: work, encoding: "utf8" });
    return r.status === 0
      ? { ok: true, msg: `합격테스트 green: \`${kase.acceptance}\`` }
      : { ok: false, msg: `합격테스트 red(exit ${r.status}): \`${kase.acceptance}\`\n${(r.stdout || "") + (r.stderr || "")}` };
  },

  fits_existing_runner(work) {
    // baseline(seed) 의 package.json vs 현재(생성 후) 를 git 으로 떠 비교 — 기존 러너 재사용인지.
    //   판정 본체는 lib/fits-runner (validator 와 동일 모듈).
    const before = parseGitJson(work, "package.json");      // seed baseline 시점
    if (before === undefined) return { ok: false, msg: "baseline 에 package.json 없음 (fits 판정 불가)" };
    const afterPath = join(work, "package.json");
    let after;
    try { after = JSON.parse(readFileSync(afterPath, "utf8")); }
    catch { return { ok: false, msg: "현재 package.json 파싱 실패" }; }
    // baseline 이후 *추가된* 파일들(git status --porcelain '??' + 'A') — 새 테스트 설정파일 탐지용.
    const added = git(work, "status", "--porcelain").stdout.split("\n").filter(Boolean)
      .filter((l) => /^(\?\?|A )/.test(l)).map((l) => l.slice(3));
    return judgeFitsRunner(before, after, added);
  },

  foreign_harness_preserved(work) {
    // 외래(비-AgentOppa) 하네스 경로 = seed 가 심은 마커파일 '.qa-foreign-paths'(줄당 경로) 로 식별.
    //   그 경로들의 git diff(baseline 대비) 가 ∅ 이어야 한다(변형·삭제 금지).
    const marker = join(work, ".qa-foreign-paths");
    if (!existsSync(marker)) return { ok: false, msg: "외래 하네스 마커 없음(.qa-foreign-paths) — 시드가 외래 경로를 심어야 함" };
    const paths = readFileSync(marker, "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
    if (!paths.length) return { ok: false, msg: ".qa-foreign-paths 가 비어 있음 (외래 경로 0)" };
    const changed = [];
    for (const p of paths) {
      // tracked 변경(diff) + 삭제 + 미추적 변화 모두 잡기: status --porcelain 로 본다.
      const st = git(work, "status", "--porcelain", "--", p).stdout.split("\n").filter(Boolean);
      for (const l of st) changed.push(l);
    }
    return changed.length
      ? { ok: false, msg: `외래 하네스 변형/삭제됨:\n      ${changed.join("\n      ")}` }
      : { ok: true, msg: `외래 하네스 보존 (${paths.length}경로 diff=∅)` };
  },

  interview_gated(work) {
    // 나쁜 intent → intent-interview validator 가 not-ready(exit≠0) 로 게이트해야 통과.
    //   기존 검증기 재사용을 *spawn* 으로(결합 최소 — qa 가 plugins 를 import 하지 않음).
    const validator = join(ROOT, "plugins/agentoppa/skills/intent-interview/scripts/validate.mjs");
    const hd = harnessDir(work);
    const intent = hd && join(hd, "intent.md");
    if (!existsSync(validator)) return { ok: false, msg: `intent-interview validator 없음: ${rel(validator)}` };
    if (!hd || !existsSync(intent)) return { ok: false, msg: "산출 .harness/<하네스>/intent.md 없음 (활성 하네스 미설정 또는 면담 안 돎?)" };
    const r = spawnSync(process.execPath, [validator, intent], { cwd: work, encoding: "utf8" });
    // exit 0 = ready/통과 = 게이트 실패(나쁜 intent 가 새어나감). exit≠0 = 게이트 작동 = 통과.
    return r.status !== 0
      ? { ok: true, msg: `게이트 작동 — intent-interview not-ready(exit ${r.status})` }
      : { ok: false, msg: "게이트 실패 — 나쁜 intent 인데 validator 통과(ready) 함" };
  },

  contract(work, kase) {
    // .harness/<하네스>/artifacts/<feature>/ 의 단계 문서들을 헤더(§2)·연결(§4) 로 본다.
    //   판정 본체는 lib/contract (validator 와 동일 모듈). feature 는 case.md 또는 config.yaml 에서.
    const hd = harnessDir(work);
    if (!hd) return { ok: false, msg: "활성 하네스 없음 (.harness-main/HARNESS_MAIN 미설정)" };
    const root = join(hd, "artifacts");
    if (!existsSync(root)) return { ok: false, msg: ".harness/<하네스>/artifacts/ 없음 (단계 산출물 인계 안 됨)" };
    const feat = kase.feature || readConfigFeature(work);
    let fdir = feat ? join(root, feat) : null;
    if (!fdir || !existsSync(fdir)) {
      // feature 미상이면 artifacts 아래 첫 디렉터리를 쓴다(단일 기능 가정).
      const dirs = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
      if (!dirs.length) return { ok: false, msg: `.harness/<하네스>/artifacts/ 아래 기능 디렉터리 없음` };
      fdir = join(root, dirs[0]);
    }
    // 인계 순서: config.yaml phase 순서가 있으면 그걸로, 없으면 파일명 정렬.
    const order = readPhaseOrder(work);
    const files = readdirSync(fdir).filter((f) => f.endsWith(".md")).sort((a, b) => {
      const ra = a.replace(/\.md$/, "").replace(/^\d+[-_]/, ""), rb = b.replace(/\.md$/, "").replace(/^\d+[-_]/, "");
      const ia = order.indexOf(ra), ib = order.indexOf(rb);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
    const docs = files.map((f) => {
      const { hasHeader, header } = parseDocHeader(readFileSync(join(fdir, f), "utf8"));
      return { role: f.replace(/\.md$/, "").replace(/^\d+[-_]/, ""), hasHeader, header };
    });
    return judgeContract(docs);
  },

  resume_equivalent(work, kase) {
    // 두 산출 세트 비교: 무중단(baseline) vs 중단→재개(resumed) 가 *구조 동등*인가.
    //   라이브 2-run *수집* 은 세션이 몬다(정직 경계) — 러너는 *판정* 만(역할 집합·순서·유효 헤더 → lib/resume).
    //   경로 컨벤션: baseline=.harness/<하네스>/artifacts-baseline/<feat>/ · resumed=.harness/<하네스>/artifacts/<feat>/.
    //   (세션이 무중단 기준본을 -baseline 으로 따로 떠 둔다. 하나라도 없으면 2-run 미수집 → 안내.)
    const feat = kase.feature || readConfigFeature(work);
    const order = readPhaseOrder(work);
    const baseline = loadArtifactDocs(work, "artifacts-baseline", feat, order);
    const resumed = loadArtifactDocs(work, "artifacts", feat, order);
    if (!baseline || !resumed)
      return { ok: false, msg: `2-run 산출 필요 — baseline(.harness/<하네스>/artifacts-baseline/) ${baseline ? "있음" : "없음"} · resumed(.harness/<하네스>/artifacts/) ${resumed ? "있음" : "없음"}. 세션이 무중단·재개 두 산출을 떠야(라이브 수집).` };
    return judgeResumeEquivalent(baseline, resumed);
  },

  source_edits_preserved(work) {
    // build-skills 는 Project(.harness/<하네스>/) 저작물을 읽기만 한다 — 재생성 후에도 config·intent·phases 가 그대로(수기편집 보존).
    const name = activeHarness(work);
    if (!name) return { ok: false, msg: "활성 하네스 없음 (.harness-main/HARNESS_MAIN 미설정)" };
    const base = `.harness/${name}`;
    const d = git(work, "diff", "--name-only", "--", `${base}/config.yaml`, `${base}/intent.md`, `${base}/project`).stdout.trim();
    return d
      ? { ok: false, msg: `재생성이 Project 저작물을 바꿈(수기편집 유실 위험):\n      ${d.split("\n").join("\n      ")}` }
      : { ok: true, msg: "Project 저작물(config·intent·phases) 무변 — build-skills 가 안 건드림" };
  },

  intent_reflected(work) {
    // config.yaml 의 phase 들이 컴파일된 스킬로 1:1 반영됐는가 (의도→산출 반영의 기계 근사).
    const phases = readPhaseOrder(work);
    if (!phases.length) return { ok: false, msg: "config.yaml 에 phases 없음" };
    const pluginsDir = join(work, ".agentoppa", "plugins");   // Core 묶음 안 (재사용 Core 모델)
    if (!existsSync(pluginsDir)) return { ok: false, msg: ".agentoppa/plugins/ 없음 (build-skills 안 돎?)" };
    const skillDirs = new Set();
    for (const h of readdirSync(pluginsDir).filter((d) => statSync(join(pluginsDir, d)).isDirectory())) {
      const sdir = join(pluginsDir, h, "skills");
      if (existsSync(sdir)) for (const s of readdirSync(sdir)) skillDirs.add(s);
    }
    const missing = phases.filter((p) => !skillDirs.has(p));
    const extra = [...skillDirs].filter((s) => !phases.includes(s));
    return (missing.length || extra.length)
      ? { ok: false, msg: `config phase ↔ 컴파일 스킬 불일치 — 누락:[${missing}] 잉여:[${extra}]` }
      : { ok: true, msg: `config phase ${phases.length}개 전부 스킬로 반영 (의도↔산출 일치)` };
  },

  core_reuse(work, kase) {
    // 비전 증명(새 모델 = 복사 말고 *가리켜* 재사용): 같은 재사용 Core 묶음 하나를 ≥2개 프로젝트가
    //   core:<name> 로 가리키되, 각자 config.yaml 의 values·bindings 만 다르다 → 둘 다 통과.
    //   판정 본체 = Core 가 쓰는 바로 그 agent-engineer validator(spawn — qa 가 plugins 를 import 하지 않음).
    //   1) 복사 0 — 어느 프로젝트도 project/phases/ 사본을 안 든다(들면 "가리켜 재사용"이 아니라 복사).
    //   2) 단일소스 — 셋이 가리키는 Core phase 소스가 *한 벌*(공유 묶음 .agentoppa/plugins/<core>/phases/) 뿐.
    //      그래서 그 한 파일을 고치면 N개 프로젝트에 반영된다(이 케이스가 그 단일성을 못박는다).
    //   3) 둘 다 green — 다른 바인딩이어도 같은 Core 가 돈다(validator exit 0).
    const projects = arr(kase.projects);
    if (projects.length < 2) return { ok: false, msg: "case.md 에 projects:[A,B] (≥2) 미정의" };
    // 1) 복사 0: 프로젝트가 phase 소스를 직접 들면 안 된다(가리켜 재사용 ≠ 복사).
    const copiers = projects.filter((p) => {
      const hd = harnessDir(join(work, "projects", p));
      return hd && existsSync(join(hd, "project", "phases"));
    });
    if (copiers.length) return { ok: false, msg: `프로젝트가 phase 를 *복사*해 듦(가리켜 재사용 아님): ${copiers.join(", ")}` };
    // 2) 단일소스: 공유 Core 묶음의 phase-소스 디렉터리가 정확히 하나여야(복붙된 묶음이 아님).
    const bundleDirs = findAgentoppaPhaseDirs(work);
    if (bundleDirs.length === 0) return { ok: false, msg: "Core 묶음 phase 소스(.agentoppa/plugins/<core>/phases/) 없음 — 가리킬 단일본이 없음" };
    if (bundleDirs.length > 1) return { ok: false, msg: `Core phase 소스가 ${bundleDirs.length}곳 — 단일소스 아님(복사):\n      ${bundleDirs.map(rel).join("\n      ")}` };
    // 3) 각 프로젝트 config 가 agent-engineer validator green 인가(공유 묶음 소스를 가리켜 검사).
    const reds = [];
    for (const p of projects) {
      const hd = harnessDir(join(work, "projects", p));
      if (!hd) { reds.push(`${p}(활성 하네스 없음)`); continue; }
      const r = runAgentEngineer(join(hd, "config.yaml"));
      if (r.status !== 0) reds.push(`${p}(exit ${r.status})`);
    }
    return reds.length
      ? { ok: false, msg: `같은 Core 인데 일부 프로젝트가 red: ${reds.join(", ")} — "구현만 다름, 둘 다 통과" 주장 붕괴` }
      : { ok: true, msg: `단일 Core 소스 한 벌(${rel(bundleDirs[0])}) 을 ${projects.length}개 프로젝트가 가리켜 재사용(복사 0) · 다른 바인딩 모두 green` };
  },

  unbound_errors(work, kase) {
    // 음성 증명: 능력-빈자리를 안 채운 프로젝트는 validator 가 error(exit≠0) 로 막아야 한다.
    const p = kase.unbound;
    if (!p) return { ok: false, msg: "case.md 에 unbound: <프로젝트> 미정의" };
    const hd = harnessDir(join(work, "projects", p));
    const cfg = hd && join(hd, "config.yaml");
    if (!cfg || !existsSync(cfg)) return { ok: false, msg: `음성 프로젝트 config 없음 (활성 하네스 미설정?): ${p}` };
    const r = runAgentEngineer(cfg);
    return r.status !== 0
      ? { ok: true, msg: `미바인딩 게이트 작동 — '${p}' validator error(exit ${r.status})` }
      : { ok: false, msg: `게이트 실패 — '${p}' 가 능력 미바인딩인데 validator 통과(green) 함` };
  },
};

// Core 가 쓰는 agent-engineer validator 를 spawn 으로 부른다 (qa→plugins import 아님 — 결합 최소).
function runAgentEngineer(cfgPath) {
  const validator = join(ROOT, "plugins/agentoppa/skills/agent-engineer/scripts/validate.mjs");
  return spawnSync(process.execPath, [validator, cfgPath], { encoding: "utf8" });
}
// work 트리에서 Core 묶음의 phase-소스 디렉터리(.agentoppa/plugins/<core>/phases/) 들을 모은다.
//   단일소스 증명: 정확히 한 곳이어야 "복사 말고 가리켜 재사용"(여러 프로젝트가 같은 한 파일을 가리킴).
//   두 곳 이상이면 묶음이 복붙된 것 = 단일소스 깨짐.
function findAgentoppaPhaseDirs(work) {
  const out = [];
  const pluginsRoot = join(work, ".agentoppa", "plugins");
  if (!existsSync(pluginsRoot)) return out;
  for (const core of readdirSync(pluginsRoot)) {
    const ph = join(pluginsRoot, core, "phases");
    if (existsSync(ph) && statSync(ph).isDirectory()) out.push(ph);
  }
  return out;
}

// baseline(HEAD) 시점의 JSON 파일을 읽는다 (없으면 undefined). git show 로 — 워킹트리 변경과 무관.
function parseGitJson(work, path) {
  const r = git(work, "show", `HEAD:${path}`);
  if (r.status !== 0) return undefined;
  try { return JSON.parse(r.stdout); } catch { return undefined; }
}
// config.yaml 의 feature 스칼라(있으면).
function readConfigFeature(work) {
  const hd = harnessDir(work);
  const cfg = hd && join(hd, "config.yaml");
  if (!cfg || !existsSync(cfg)) return null;
  const m = readFileSync(cfg, "utf8").match(/^feature:\s*(.+)$/m);
  return m ? m[1].replace(/\s*#.*$/, "").trim().replace(/^["']|["']$/g, "") : null;
}
// config.yaml 의 phases: 리스트에서 phase 이름 순서를 뽑는다 (간이 — '- name' / '- {name: x}').
function readPhaseOrder(work) {
  const hd = harnessDir(work);
  const cfg = hd && join(hd, "config.yaml");
  if (!cfg || !existsSync(cfg)) return [];
  const lines = readFileSync(cfg, "utf8").split(/\r?\n/);
  const order = []; let inPhases = false;
  for (const l of lines) {
    if (/^phases:\s*$/.test(l)) { inPhases = true; continue; }
    if (inPhases) {
      if (/^\S/.test(l)) break;            // 다음 톱레벨 키 → phases 끝
      const m = l.match(/^\s+-\s*(?:\{[^}]*name:\s*)?([A-Za-z_][\w-]*)/);
      if (m) order.push(m[1]);
    }
  }
  return order;
}

// artifacts 하위(<sub>/<feat 또는 첫 디렉터리>/) 의 단계 문서들을 인계순서로 [{role,hasHeader,header}] 로 읽는다.
//   (resume_equivalent 의 두 세트 로딩 공용. order 있으면 phase 순서로, 없으면 파일명 정렬.)
function loadArtifactDocs(work, sub, feat, order) {
  const hd = harnessDir(work);
  if (!hd) return null;
  const root = join(hd, sub);
  if (!existsSync(root)) return null;
  let fdir = feat ? join(root, feat) : null;
  if (!fdir || !existsSync(fdir)) {
    const dirs = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
    if (!dirs.length) return null;
    fdir = join(root, dirs[0]);
  }
  const files = readdirSync(fdir).filter((f) => f.endsWith(".md")).sort((a, b) => {
    const ra = a.replace(/\.md$/, "").replace(/^\d+[-_]/, ""), rb = b.replace(/\.md$/, "").replace(/^\d+[-_]/, "");
    const ia = order.indexOf(ra), ib = order.indexOf(rb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return a.localeCompare(b);
  });
  return files.map((f) => {
    const { hasHeader, header } = parseDocHeader(readFileSync(join(fdir, f), "utf8"));
    return { role: f.replace(/\.md$/, "").replace(/^\d+[-_]/, ""), hasHeader, header };
  });
}

function setup(id) {
  const kase = findCase(id);
  const seed = join(SEEDS_DIR, kase.seed || "");
  if (!kase.seed) die(`case.md 에 seed 미정의: ${id}`);
  if (!existsSync(seed)) die(`seed 없음: ${kase.seed} (아직 파생 안 된 시드일 수 있음 — README 참조)`);
  const work = join(WORK, id);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(seed, work, { recursive: true });
  git(work, "init", "-q");
  git(work, "add", "-A");
  git(work, "-c", "user.email=qa@agentoppa", "-c", "user.name=qa", "commit", "-qm", "seed baseline");
  console.log(`${c.g}✔${c.x} setup ${id}  ${c.d}(seed=${kase.seed} → ${rel(work)}, baseline 커밋됨)${c.x}`);
  console.log(`${c.d}  다음(수동/헤드리스): cd ${rel(work)} 에서 agent 단계를 몬다 — ${arr(kase.agent_steps).join(" → ") || "(없음)"}`);
  console.log(`${c.d}        예) claude --plugin-dir ${rel(join(ROOT, "plugins/agentoppa"))} …   (또는 codex)`);
  console.log(`${c.d}  그 후: node qa/run.mjs judge ${id}${c.x}`);
}

function judge(id) {
  const kase = findCase(id);
  const work = join(WORK, id);
  if (!existsSync(work)) die(`scratch 없음 — 먼저: node qa/run.mjs setup ${id}`);
  const checks = arr(kase.judge);
  if (!checks.length) die(`case.md 에 judge 미정의: ${id}`);
  console.log(`judge ${id} ${c.d}(${checks.length}개 판정 · ${arr(kase.tools).join(",") || "claude"})${c.x}`);
  let fail = 0, manual = 0;
  for (const name of checks) {
    const fn = JUDGES[name];
    if (!fn) { console.log(`  ${c.y}?${c.x} ${name} ${c.d}— 아직 수동 판정(추후 기계화)${c.x}`); manual++; continue; }
    const r = fn(work, kase);
    console.log(`  ${r.ok ? c.g + "✔" : c.r + "✗"}${c.x} ${name}: ${r.msg}`);
    if (!r.ok) fail++;
  }
  const tail = manual ? ` ${c.y}(+${manual} 수동)${c.x}` : "";
  console.log(fail ? `${c.r}result: ${fail} fail${c.x}${tail}` : `${c.g}result: 기계판정 all pass${c.x}${tail}`);
  process.exit(fail ? 1 : 0);
}

const [cmd, id] = process.argv.slice(2);
if (cmd === "list") {
  const cs = allCases();
  if (!cs.length) console.log("케이스 없음");
  for (const k of cs)
    console.log(`  ${k.id.padEnd(22)} ${c.d}[${k.axis}] seed=${k.seed} judge=${arr(k.judge).join(",")}${c.x}`);
} else if (cmd === "setup" && id) setup(id);
else if (cmd === "judge" && id) judge(id);
else { console.log("사용법: node qa/run.mjs list | setup <caseId> | judge <caseId>"); process.exit(2); }
