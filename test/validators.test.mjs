// AgentOppa 결정적 검사 러너 — validator를 red/green fixture에 물려 자동 검사.
// 실행: node --test test/   (또는 npm test)
//   red   = 반칙 입력  → validator가 실패(exit≠0)해야 정상.
//   green = 정상 입력  → validator가 통과(exit 0)해야 정상.
// Node 빌트인만(zero-dep) → mac·linux·windows 동일.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const abs = (p) => join(repoRoot, p);

// 새 규칙을 박을 때마다 여기에 한 줄씩 추가한다 (self-harden 패턴: validator + red/green).
const CASES = [
  {
    name: "ccc-plugin/coupling — 스킬이 다른 스킬의 examples 링크 금지",
    validator: "plugins/agentoppa/skills/ccc-plugin/scripts/validate.mjs",
    red: ".agentoppa/fixtures/ccc-plugin-coupling/red",
    green: ".agentoppa/fixtures/ccc-plugin-coupling/green",
  },
  {
    name: "agent-engineer/config — phase 연결(dangling) 점검",
    validator: "plugins/agentoppa/skills/agent-engineer/scripts/validate.mjs",
    red: ".agentoppa/fixtures/agent-engineer-config/red/.harness/config.yaml",
    green: ".agentoppa/fixtures/agent-engineer-config/green/.harness/config.yaml",
  },
  {
    name: "intent-interview — 차단 미해결인데 status=ready 점검",
    validator: "plugins/agentoppa/skills/intent-interview/scripts/validate.mjs",
    red: ".agentoppa/fixtures/intent-interview/red/.harness/intent.md",
    green: ".agentoppa/fixtures/intent-interview/green/.harness/intent.md",
  },
  {
    name: "check-doc-refs — 커밋 문서의 dangling 상대링크 점검",
    validator: "plugins/agentoppa/bin/check-doc-refs.mjs",
    red: ".agentoppa/fixtures/doc-refs/red",
    green: ".agentoppa/fixtures/doc-refs/green",
  },
];

function run(validator, target) {
  return spawnSync(process.execPath, [abs(validator), abs(target)], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

for (const c of CASES) {
  test(`${c.name} → red 는 실패해야`, () => {
    const r = run(c.validator, c.red);
    assert.notEqual(
      r.status,
      0,
      `red fixture가 통과해버림(exit ${r.status}) — validator가 반칙을 못 잡음\n${r.stdout}`,
    );
  });

  test(`${c.name} → green 은 통과해야`, () => {
    const r = run(c.validator, c.green);
    assert.equal(
      r.status,
      0,
      `green fixture가 실패함(exit ${r.status}) — validator 오작동(멀쩡한 걸 막음)\n${r.stdout}`,
    );
  });
}

// --- 자기 점검: 우리 자신의 커밋 문서는 dangling 상대링크가 0이어야 (검사기가 실제로 repo를 지키게) ---
//     fixtures/ 는 의도적 반칙 입력이라 제외 — 그건 위 red/green CASE로 따로 검증한다.
//     ROADMAP을 포함하는 이유: 임시 참조 파일을 지우면 그 포인터도 0이어야 함을 자동 강제("삭제 완료=참조 0").
const SELF_CHECK = ["plugins", "README.md", "ROADMAP.md", "ARCHITECTURE.md", "AGENTS.md", "CLAUDE.md"];
for (const tgt of SELF_CHECK) {
  test(`check-doc-refs 자기점검 — ${tgt} 의 dangling 상대링크는 0`, () => {
    const r = run("plugins/agentoppa/bin/check-doc-refs.mjs", tgt);
    assert.equal(
      r.status,
      0,
      `${tgt} 에 dangling 상대링크 있음 — 대상 파일을 만들거나 참조를 고칠 것(참조 0까지)\n${r.stdout}`,
    );
  });
}
