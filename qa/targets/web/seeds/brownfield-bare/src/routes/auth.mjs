import { readJson, send } from "../lib/http.mjs";

export async function signup(store, req, res) {
  const { username, password } = await readJson(req);
  if (!username || !password) return send(res, 400, { error: "username/password required" });
  const r = store.signup(username, password);
  if (r.error) return send(res, 409, { error: "username taken" });
  send(res, 201, { id: r.user.id, username: r.user.username });
}

export async function login(store, req, res) {
  const { username, password } = await readJson(req);
  const r = store.login(username, password);
  if (r.error) return send(res, 401, { error: "invalid credentials" });
  send(res, 200, { token: r.token });
}
