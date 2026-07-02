#!/usr/bin/env node
// ccc-hooks validator — hooks.json(또는 settings.json의 hooks 블록)을 Claude+Codex 기준으로 점검.
// 사용법: node validate.mjs [path/to/hooks.json] [target]
//   target: cross(기본) | claude | codex   — 이식성 경고 수위를 정한다.
// 종료코드: 오류 0건이면 0, 있으면 1, 파일 없음/JSON 파싱 실패면 2.
// 셸·coreutils 비의존(Node 빌트인만) → mac·linux·windows 동일 동작.
import { readFileSync, existsSync } from "node:fs";

const c = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", x: "\x1b[0m" };
let errors = 0, warns = 0;
const err = (m) => { console.log(`  ${c.r}✗${c.x} ${m}`); errors++; };
const warn = (m) => { console.log(`  ${c.y}⚠${c.x} ${m}`); warns++; };
const ok = (m) => { console.log(`  ${c.g}✓${c.x} ${m}`); };

const file = process.argv[2] ?? "hooks.json";
const target = (process.argv[3] ?? "cross").toLowerCase();
console.log(`ccc-hooks validate → ${file} (target: ${target})`);
if (!existsSync(file)) { err("파일을 찾을 수 없음"); process.exit(2); }

let data;
try { data = JSON.parse(readFileSync(file, "utf8")); }
catch (e) { err(`JSON 파싱 실패: ${e.message}`); process.exit(2); }

const hooks = data && data.hooks;
if (!hooks || typeof hooks !== "object") {
  err("`hooks` 객체 없음 (settings.json 또는 hooks.json의 hooks 블록을 가리켜야 함)");
  process.exit(1);
}
ok("hooks 블록 확인");

// --- 이벤트 집합 (events.md 기준) ---
const CODEX = new Set(["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
  "PermissionRequest", "PreCompact", "PostCompact", "SubagentStart", "SubagentStop", "Stop"]);
const CLAUDE_CORE = new Set([...CODEX, "Notification", "SessionEnd"]);
const CLAUDE_EXT = new Set(["Setup", "UserPromptExpansion", "StopFailure", "PostToolUseFailure",
  "PostToolBatch", "PermissionDenied", "TaskCreated", "TaskCompleted", "TeammateIdle",
  "CwdChanged", "FileChanged", "InstructionsLoaded", "MessageDisplay", "ConfigChange",
  "Elicitation", "ElicitationResult", "WorktreeCreate", "WorktreeRemove"]);
const CLAUDE_ALL = new Set([...CLAUDE_CORE, ...CLAUDE_EXT]);
// exit 2가 차단하지 못하는 이벤트(여기서 막으려 하면 사고) — io-contract.md §3
const NO_BLOCK = new Set(["PostToolUse", "PostCompact", "SessionStart", "SubagentStart",
  "Notification", "SessionEnd", "CwdChanged", "FileChanged"]);

const wantCodex = target === "cross" || target === "codex";
let portable = true;

// --- top-level 여분 필드 (Codex 는 hooks.json 에서 `hooks` 만 받음 — description 등은 파싱 거부) ---
// settings.json 은 hooks 외 키가 정상이므로, 파일명이 hooks.json 일 때만 본다.
if (/(^|[\\/])hooks\.json$/.test(file)) {
  for (const key of Object.keys(data)) {
    if (key === "hooks") continue;
    if (wantCodex) { err(`top-level '${key}' 필드 — Codex 가 hooks.json 에서 거부함('hooks' 만 허용). 제거하라`); portable = false; }
    else warn(`top-level '${key}' 필드 — Claude 는 봐주나 Codex 는 파싱 거부(이식 시 제거)`);
  }
}

for (const [event, entries] of Object.entries(hooks)) {
  // 이벤트명 유효성
  if (CODEX.has(event)) ok(`이벤트 '${event}' — 공통(양쪽 동작 가능)`);
  else if (CLAUDE_ALL.has(event)) {
    if (wantCodex) { warn(`이벤트 '${event}' — Claude 전용(Codex엔 없음)`); portable = false; }
    else ok(`이벤트 '${event}' — Claude`);
  } else {
    warn(`이벤트 '${event}' — 알 수 없음(오타거나 신규 이벤트; 공식 문서 확인)`);
  }

  if (!Array.isArray(entries)) { err(`'${event}' 값이 배열이 아님`); continue; }
  for (const entry of entries) {
    const hs = entry && entry.hooks;
    if (!Array.isArray(hs)) { err(`'${event}' 항목에 hooks 배열 없음`); continue; }
    for (const h of hs) {
      if (!h || typeof h !== "object") { err(`'${event}' 핸들러가 객체가 아님`); continue; }
      const type = h.type ?? "command";
      if (!h.type) warn(`'${event}' 핸들러에 type 없음 (command로 가정)`);
      else if (type !== "command" && wantCodex) {
        warn(`'${event}' 핸들러 type='${type}' — Codex는 command만 실행`); portable = false;
      }
      const cmd = h.command || "";
      if (type === "command" && !cmd) err(`'${event}' command 핸들러에 command 문자열 없음`);
      // 경로변수 이식성 (Codex 실측: CLAUDE_PLUGIN_ROOT·CLAUDE_PLUGIN_DATA 는 Codex 가 별칭으로 세팅 → 양쪽 동작.
      //   그래서 그 둘이 크로스툴 정답. 경고 대상은 (a) Codex 가 별칭 안 하는 CLAUDE_PROJECT_DIR(작업폴더는 cwd),
      //   (b) Claude 가 별칭 안 하는 맨 PLUGIN_ROOT/PLUGIN_DATA(= CLAUDE_ 접두 없는 Codex 네이티브).)
      if (wantCodex && /\$\{?CLAUDE_PROJECT_DIR\}?/.test(cmd)) {
        warn(`'${event}' command가 CLAUDE_PROJECT_DIR 사용 — Codex엔 이 별칭 없음(작업폴더는 cwd); 분기하거나 스크립트가 흡수`);
        portable = false;
      }
      if (/\$\{?PLUGIN_(?:ROOT|DATA)\}?/.test(cmd)) {
        warn(`'${event}' command가 맨 PLUGIN_ROOT/PLUGIN_DATA 사용 — Claude엔 이 별칭 없다(안 풀림). 크로스툴은 \${CLAUDE_PLUGIN_ROOT}(Codex가 별칭)로`);
        portable = false;
      }
      if (typeof h.timeout === "number" && h.timeout <= 0) err(`'${event}' timeout이 0 이하`);
    }
  }
}

console.log(wantCodex
  ? `portability: ${portable ? "양쪽 동작 가능해 보임" : "Claude 전용 요소 있음 — 위 경고 참고"}`
  : "portability: Claude 기준만 검사");
console.log(`result: ${errors} error(s), ${warns} warning(s)`);
process.exit(errors === 0 ? 0 : 1);
