import { readJson, send, bearer } from "../lib/http.mjs";

export function listPosts(store, req, res) {
  send(res, 200, store.listPosts());
}

export async function createPost(store, req, res) {
  const user = store.userOf(bearer(req));
  if (!user) return send(res, 401, { error: "unauthorized" });
  const { title, body } = await readJson(req);
  if (!title) return send(res, 400, { error: "title required" });
  send(res, 201, store.createPost(user, title, body ?? ""));
}

export function getPost(store, req, res, id) {
  const post = store.getPost(id);
  if (!post) return send(res, 404, { error: "not found" });
  send(res, 200, post);
}

export function deletePost(store, req, res, id) {
  const user = store.userOf(bearer(req));
  if (!user) return send(res, 401, { error: "unauthorized" });
  const r = store.deletePost(user, id);
  if (r.error === "notfound") return send(res, 404, { error: "not found" });
  if (r.error === "forbidden") return send(res, 403, { error: "forbidden" });
  send(res, 204);
}
