#!/usr/bin/env node
// ccc-agents build — Claude 서브에이전트(.md, 단일 소스)를 Codex(.codex/agents/*.toml)로 생성한다.
// 사용법: node build-agents.mjs [srcDirOrFile] [outDir]
//   기본: .claude/agents  →  .codex/agents
// 교집합만 안전 변환: name · description · 본문(→developer_instructions) · effort · access(→sandbox_mode).
// Claude 전용 필드와 번역 안 되는 모델명은 드롭/상속하고 로그로 알린다(무음 누락 금지).
// 셸·coreutils 비의존(Node 빌트인만) → mac·linux·windows 동일 동작.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const c = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", x: "\x1b[0m" };
const warn = (m) => console.log(`  ${c.y}⚠${c.x} ${m}`);
const ok = (m) => console.log(`  ${c.g}✓${c.x} ${m}`);
const bad = (m) => console.log(`  ${c.r}✗${c.x} ${m}`);

const srcArg = process.argv[2] ?? ".claude/agents";
const outDir = process.argv[3] ?? ".codex/agents";

if (!existsSync(srcArg)) { console.log(`${c.r}소스를 찾을 수 없음: ${srcArg}${c.x}`); process.exit(2); }
const files = statSync(srcArg).isDirectory()
  ? readdirSync(srcArg).filter((f) => f.endsWith(".md")).map((f) => join(srcArg, f))
  : [srcArg];

// frontmatter 파서: 1행 '---' ~ 다음 '---', 단일행 key: value. 본문은 그 이후 전체.
function parse(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== "---") return { fm: {}, body: raw.trim() };
  const endRel = lines.slice(1).findIndex((l) => /^---\s*$/.test(l));
  const fmLines = endRel === -1 ? lines.slice(1) : lines.slice(1, endRel + 1);
  const body = endRel === -1 ? "" : lines.slice(endRel + 2).join("\n").trim();
  const fm = {};
  for (const l of fmLines) {
    const m = l.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { fm, body };
}

const unquote = (s) => s.replace(/^["']/, "").replace(/["']$/, "");
const basic = (s) => `"${unquote(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
function multiline(s) {
  let v = s.replace(/\\/g, "\\\\");
  if (v.includes('"""')) { warn('본문에 """ 포함 — 이스케이프함'); v = v.replace(/"""/g, '\\"\\"\\"'); }
  return `"""\n${v}\n"""`;
}

const CLAUDE_ONLY = ["tools", "disallowedTools", "permissionMode", "maxTurns", "skills",
  "mcpServers", "hooks", "memory", "background", "isolation", "color", "initialPrompt", "disable-model-invocation"];
const CLAUDE_MODEL = /^(sonnet|opus|haiku|fable|inherit|claude-)/;
const WRITE_TOOLS = /\b(Edit|Write|NotebookEdit|MultiEdit)\b/;

let made = 0;
for (const file of files) {
  console.log(`\n${c.d}build${c.x} ${file}`);
  const { fm, body } = parse(readFileSync(file, "utf8"));
  const name = unquote(fm.name ?? basename(file, ".md"));
  if (!/^[a-z0-9-]+$/.test(name)) { bad(`name '${name}' 형식 오류 — 건너뜀`); continue; }
  if (!body) { bad("본문(시스템 프롬프트) 비어 있음 → developer_instructions 필수 — 건너뜀"); continue; }

  // basename 만 — 절대경로를 박으면 .harness 저작 위치≠컴파일 위치에서 스퓨리어스 diff(멱등·이식성 깨짐). (라이브 e2e 발견.)
  const out = [`# generated from ${basename(file)} by AgentOppa ccc-agents — edit the .md source, regenerate`];
  out.push(`name = ${basic(name)}`);
  if (fm.description) out.push(`description = ${basic(fm.description)}`);
  else warn("description 없음 (Codex 권장 필수)");

  // 모델: Claude 모델명은 번역 불가 → codex-model 힌트만 방출, 없으면 세션 상속
  if (fm["codex-model"]) out.push(`model = ${basic(fm["codex-model"])}`);
  else if (fm.model && !CLAUDE_MODEL.test(unquote(fm.model))) out.push(`model = ${basic(fm.model)}`);
  else if (fm.model) warn(`model '${unquote(fm.model)}'은 Codex로 번역 안 됨 → 세션 상속 (codex-model: 로 명시)`);

  // 추론 강도: Claude(low/medium/high/xhigh/max) → Codex(minimal/low/medium/high/xhigh).
  // xhigh는 그대로 유효(Codex에선 model-dependent). max만 Claude 전용 → xhigh로 매핑하며 알린다.
  if (fm.effort) {
    let e = fm.effort;
    if (e === "max") { e = "xhigh"; warn("effort 'max'는 Codex에 없음 → 'xhigh'로 매핑"); }
    if (["minimal", "low", "medium", "high", "xhigh"].includes(e)) out.push(`model_reasoning_effort = ${basic(e)}`);
    else warn(`effort '${fm.effort}' 인식 불가 → model_reasoning_effort 생략`);
  }

  // 능력 범위: access 우선, 없으면 tools 추론
  let access = fm.access;
  if (!access && fm.tools) access = WRITE_TOOLS.test(fm.tools) ? "read-write" : "read-only";
  if (access === "read-only") { out.push(`sandbox_mode = "read-only"`); ok("sandbox_mode = read-only"); }
  else if (access === "read-write") warn("access read-write → sandbox_mode 상속 (필요시 workspace-write 직접 설정)");
  else warn("access·tools 없음 → sandbox_mode 상속(범위 미통제)");

  // 드롭되는 Claude 전용 필드 알림
  const dropped = CLAUDE_ONLY.filter((k) => k in fm);
  if (dropped.length) warn(`Claude 전용 필드 드롭: ${dropped.join(", ")}`);

  out.push(`developer_instructions = ${multiline(body)}`);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, `${name}.toml`);
  writeFileSync(dest, out.join("\n") + "\n");
  ok(`→ ${dest}`);
  made++;
}

console.log(`\n생성 ${made}/${files.length}개 → ${resolve(outDir)}`);
process.exit(0);
