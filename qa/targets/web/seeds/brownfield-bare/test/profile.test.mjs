import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer, tokenFor } from "./helpers.mjs";

test("프로필은 인증 필요", () =>
  withServer(async (api) => {
    assert.equal((await api("/profile")).status, 401);
  }));

test("프로필 조회/수정", () =>
  withServer(async (api) => {
    const token = await tokenFor(api, "carol");
    const auth = { headers: { authorization: `Bearer ${token}` } };
    const g = await api("/profile", auth);
    assert.equal(g.status, 200);
    assert.equal((await g.json()).bio, "");
    const u = await api("/profile", { method: "PUT", ...auth, body: { bio: "hi" } });
    assert.equal((await u.json()).bio, "hi");
  }));
