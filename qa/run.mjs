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

const HARNESS = [".harness", ".claude", ".codex"];
const isHarness = (p) => HARNESS.some((h) => p === h || p.startsWith(h + "/"));

// --- 판정들 (기계화된 것만; 나머지는 judge() 가 '?' 수동 표시) ---
const JUDGES = {
  harness_present(work) {
    const missing = HARNESS.filter((h) => !existsSync(join(work, h)));
    return missing.length
      ? { ok: false, msg: `하네스 산출 누락: ${missing.join(", ")} (agent generate 안 돎?)` }
      : { ok: true, msg: "하네스 .harness/.claude/.codex 존재" };
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
    // 호출 전제: 직전 generate 결과를 커밋해 두고 → generate 재실행 → 이 판정.
    const d = git(work, "diff", "--name-only", "--", ".claude", ".codex").stdout.trim();
    return d
      ? { ok: false, msg: `재생성이 COMPILED 를 바꿈(멱등 실패):\n      ${d.split("\n").join("\n      ")}` }
      : { ok: true, msg: "재생성 멱등 — .claude/.codex diff 없음" };
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
    const intent = join(work, ".harness", "intent.md");
    if (!existsSync(validator)) return { ok: false, msg: `intent-interview validator 없음: ${rel(validator)}` };
    if (!existsSync(intent)) return { ok: false, msg: "산출 .harness/intent.md 없음 (면담 안 돎?)" };
    const r = spawnSync(process.execPath, [validator, intent], { cwd: work, encoding: "utf8" });
    // exit 0 = ready/통과 = 게이트 실패(나쁜 intent 가 새어나감). exit≠0 = 게이트 작동 = 통과.
    return r.status !== 0
      ? { ok: true, msg: `게이트 작동 — intent-interview not-ready(exit ${r.status})` }
      : { ok: false, msg: "게이트 실패 — 나쁜 intent 인데 validator 통과(ready) 함" };
  },

  contract(work, kase) {
    // .harness/artifacts/<feature>/ 의 단계 문서들을 헤더(§2)·연결(§4) 로 본다.
    //   판정 본체는 lib/contract (validator 와 동일 모듈). feature 는 case.md 또는 config.yaml 에서.
    const root = join(work, ".harness", "artifacts");
    if (!existsSync(root)) return { ok: false, msg: ".harness/artifacts/ 없음 (단계 산출물 인계 안 됨)" };
    const feat = kase.feature || readConfigFeature(work);
    let fdir = feat ? join(root, feat) : null;
    if (!fdir || !existsSync(fdir)) {
      // feature 미상이면 artifacts 아래 첫 디렉터리를 쓴다(단일 기능 가정).
      const dirs = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
      if (!dirs.length) return { ok: false, msg: `.harness/artifacts/ 아래 기능 디렉터리 없음` };
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
};

// baseline(HEAD) 시점의 JSON 파일을 읽는다 (없으면 undefined). git show 로 — 워킹트리 변경과 무관.
function parseGitJson(work, path) {
  const r = git(work, "show", `HEAD:${path}`);
  if (r.status !== 0) return undefined;
  try { return JSON.parse(r.stdout); } catch { return undefined; }
}
// config.yaml 의 feature 스칼라(있으면).
function readConfigFeature(work) {
  const cfg = join(work, ".harness", "config.yaml");
  if (!existsSync(cfg)) return null;
  const m = readFileSync(cfg, "utf8").match(/^feature:\s*(.+)$/m);
  return m ? m[1].replace(/\s*#.*$/, "").trim().replace(/^["']|["']$/g, "") : null;
}
// config.yaml 의 phases: 리스트에서 phase 이름 순서를 뽑는다 (간이 — '- name' / '- {name: x}').
function readPhaseOrder(work) {
  const cfg = join(work, ".harness", "config.yaml");
  if (!existsSync(cfg)) return [];
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
