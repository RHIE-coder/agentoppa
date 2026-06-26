import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer } from "./helpers.mjs";

test("signup → 201, 중복 → 409", () =>
  withServer(async (api) => {
    const r1 = await api("/signup", { method: "POST", body: { username: "alice", password: "pw" } });
    assert.equal(r1.status, 201);
    assert.equal((await r1.json()).username, "alice");
    const r2 = await api("/signup", { method: "POST", body: { username: "alice", password: "pw" } });
    assert.equal(r2.status, 409);
  }));

test("login 성공 → token, 실패 → 401", () =>
  withServer(async (api) => {
    await api("/signup", { method: "POST", body: { username: "bob", password: "pw" } });
    const ok = await api("/login", { method: "POST", body: { username: "bob", password: "pw" } });
    assert.equal(ok.status, 200);
    assert.ok((await ok.json()).token);
    const bad = await api("/login", { method: "POST", body: { username: "bob", password: "nope" } });
    assert.equal(bad.status, 401);
  }));
