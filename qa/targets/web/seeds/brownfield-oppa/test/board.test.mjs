import { test } from "node:test";
import assert from "node:assert/strict";
import { withServer, tokenFor } from "./helpers.mjs";

test("글 작성 → 목록 → 단건 조회", () =>
  withServer(async (api) => {
    const token = await tokenFor(api, "dave");
    const auth = { headers: { authorization: `Bearer ${token}` } };
    const c = await api("/posts", { method: "POST", ...auth, body: { title: "Hello", body: "world" } });
    assert.equal(c.status, 201);
    const { id } = await c.json();
    const list = await api("/posts");
    assert.equal((await list.json()).length, 1);
    const g = await api(`/posts/${id}`);
    assert.equal((await g.json()).title, "Hello");
  }));

test("삭제는 작성자만", () =>
  withServer(async (api) => {
    const t1 = await tokenFor(api, "eve");
    const t2 = await tokenFor(api, "frank");
    const c = await api("/posts", {
      method: "POST",
      headers: { authorization: `Bearer ${t1}` },
      body: { title: "X" },
    });
    const { id } = await c.json();
    const forbidden = await api(`/posts/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${t2}` },
    });
    assert.equal(forbidden.status, 403);
    const ok = await api(`/posts/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${t1}` },
    });
    assert.equal(ok.status, 204);
  }));
