import { readJson, send, bearer } from "../lib/http.mjs";

export function getProfile(store, req, res) {
  const user = store.userOf(bearer(req));
  if (!user) return send(res, 401, { error: "unauthorized" });
  send(res, 200, { id: user.id, username: user.username, bio: user.bio });
}

export async function updateProfile(store, req, res) {
  const user = store.userOf(bearer(req));
  if (!user) return send(res, 401, { error: "unauthorized" });
  const { bio } = await readJson(req);
  store.updateBio(user, bio ?? "");
  send(res, 200, { id: user.id, username: user.username, bio: user.bio });
}
