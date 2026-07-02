#!/usr/bin/env node
// scaffold — 이 Core 를 소비하는 프로젝트의 .harness/config.yaml 을 깔거나, 빠진 빈자리를 알려준다.
//   [AgentOppa build-skills 가 빌드 때 모든 Core 에 주입 — 프레임워크 제공, 도메인 무관]
//   AgentOppa 없이, 설치된 이 플러그인만으로 동작한다. interface.json(이 Core 가 선언한 빈자리)을 읽어 골격을 쓴다.
//   빈자리 두 종류 다 이 프로젝트가 채운다 — 값(values: 명령·경로 리터럴)과 능력(bindings: 구현).
//   단계 스킬이 실행 시점에 둘 다 읽으므로 Core 재빌드 없이 프로젝트마다 다른 값으로 동작한다.
//   멱등: config 가 이미 있으면 *덮지 않고* 안 채워진 빈자리만 보고한다(인터페이스 변경 = 자동 전파). zero-dep · 크로스OS.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));            // plugins/<core>/skills/setup/
const ifacePath = resolve(here, "..", "..", "interface.json");  // plugins/<core>/interface.json
if (!existsSync(ifacePath)) {
  console.error("interface.json 없음: " + ifacePath + " — 이 Core 가 제대로 빌드되지 않았다.");
  process.exit(2);
}
const iface = JSON.parse(readFileSync(ifacePath, "utf8"));

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();   // 소비 프로젝트 루트
const harnessDir = join(root, ".harness");
const cfgPath = join(harnessDir, "config.yaml");

const caps = iface.capabilities || [];
const vals = iface.values || [];
const phases = iface.phases || [];

function skeleton() {
  const L = [];
  L.push("# " + iface.core + " — 이 프로젝트에 붙인 하네스 설정 (setup 이 깔아 줌)");
  L.push("core: " + iface.core);
  L.push("phases: [" + phases.join(", ") + "]");
  if (vals.length) {
    L.push("values:");
    for (const v of vals) {
      const mark = v.optional ? "   # (선택) TODO" : "   # TODO";
      L.push('  ' + v.key + ': ""' + mark + ': 이 프로젝트의 값 (예: "npm test" · 쓰는 단계: ' + v.phases.join(",") + ")");
    }
  }
  if (caps.length) {
    L.push("bindings:");
    for (const cp of caps) {
      const mark = cp.optional ? "   # (선택) TODO" : "   # TODO";
      L.push('  ' + cp.key + ': ""' + mark + ': 이 프로젝트의 구현 (예: "npx playwright test")');
    }
    L.push("impl: {}");
  }
  return L.join("\n") + "\n";
}

if (!existsSync(cfgPath)) {
  if (!existsSync(harnessDir)) mkdirSync(harnessDir, { recursive: true });
  writeFileSync(cfgPath, skeleton());
  console.log("✓ 만듦: .harness/config.yaml (골격) — core: " + iface.core);
  if (vals.length) {
    console.log("채워야 할 값 빈자리(values) " + vals.length + "개:");
    for (const v of vals) console.log("  - " + v.key + (v.optional ? " (선택)" : "") + "  ← 이 프로젝트의 값(명령·경로)을 적어라");
  }
  if (caps.length) {
    console.log("채워야 할 능력 빈자리(bindings) " + caps.length + "개:");
    for (const cp of caps) console.log("  - " + cp.key + (cp.optional ? " (선택)" : "") + "  ← 이 프로젝트의 구현을 적어라");
  }
  if (!vals.length && !caps.length) console.log("빈자리 없음 — 그대로 단계 스킬을 쓰면 된다.");
  process.exit(0);
}

// 이미 있으면: 덮지 않고 안 채워진 빈자리만 보고 — 인터페이스가 바뀌어 빈자리가 늘어도 여기서 잡힌다(전파).
//   블록(values:/bindings:) 안에서 우변이 비어 있지 않은 키를 '채워짐'으로 본다.
const cur = readFileSync(cfgPath, "utf8");
function filledKeys(block) {
  const found = new Set();
  let inB = false;
  for (const raw of cur.split(/\r?\n/)) {
    if (new RegExp("^" + block + ":\\s*(#.*)?$").test(raw)) { inB = true; continue; }
    if (!inB) continue;
    if (/^\s+/.test(raw)) {
      const m = raw.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
      if (m) {
        const v = m[2].replace(/#.*$/, "").trim().replace(/^["']|["']$/g, "");
        if (v) found.add(m[1]);
      }
    } else if (raw.trim() !== "" && !/^\s*#/.test(raw)) {
      inB = false;
    }
  }
  return found;
}
const filledVals = filledKeys("values");
const filledCaps = filledKeys("bindings");
const missingVals = vals.filter((v) => !v.optional && !filledVals.has(v.key));
const missingCaps = caps.filter((cp) => !cp.optional && !filledCaps.has(cp.key));
if (missingVals.length || missingCaps.length) {
  console.log(".harness/config.yaml 있음 — 아직 안 채워진 빈자리:");
  if (missingVals.length) {
    console.log("안 채워진 값 빈자리(values) " + missingVals.length + "개:");
    for (const v of missingVals) console.log("  - " + v.key + "  ← values 에 이 프로젝트의 값을 적어라");
  }
  if (missingCaps.length) {
    console.log("안 채워진 능력 빈자리(bindings) " + missingCaps.length + "개:");
    for (const cp of missingCaps) console.log("  - " + cp.key + "  ← bindings 에 이 프로젝트의 구현을 적어라");
  }
  process.exit(0);
}
console.log("✓ .harness/config.yaml 의 값·능력 빈자리가 모두 채워져 있다 — 그대로 쓰면 된다.");
process.exit(0);
