#!/usr/bin/env node
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
const guarded = /^(src\/|test\/)/.test(rel) && existsSync(abs);
if (guarded) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `비손상 게이트: 기존 파일 '${rel}' 수정 금지. 하네스는 새 파일만 추가한다 (예: test/<feature>.test.mjs). 기능 추가는 새 모듈/새 테스트로.`,
    },
  }));
  process.exit(0);
}
process.exit(0);
