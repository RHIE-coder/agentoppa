import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.mjs";

test("GET /health → {ok:true}", async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    server.close();
  }
});
