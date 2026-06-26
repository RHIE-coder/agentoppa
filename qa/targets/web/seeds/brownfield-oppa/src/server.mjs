import { createServer as httpCreate } from "node:http";
import { newStore } from "./lib/store.mjs";
import { send } from "./lib/http.mjs";
import { signup, login } from "./routes/auth.mjs";
import { getProfile, updateProfile } from "./routes/profile.mjs";
import { listPosts, createPost, getPost, deletePost } from "./routes/board.mjs";

// createServer() 마다 새 store → 테스트 격리.
export function createServer() {
  const store = newStore();
  return httpCreate(async (req, res) => {
    const { method } = req;
    const path = new URL(req.url, "http://localhost").pathname;
    try {
      if (method === "POST" && path === "/signup") return await signup(store, req, res);
      if (method === "POST" && path === "/login") return await login(store, req, res);
      if (method === "GET" && path === "/profile") return getProfile(store, req, res);
      if (method === "PUT" && path === "/profile") return await updateProfile(store, req, res);
      if (method === "GET" && path === "/posts") return listPosts(store, req, res);
      if (method === "POST" && path === "/posts") return await createPost(store, req, res);
      const m = path.match(/^\/posts\/([^/]+)$/);
      if (m && method === "GET") return getPost(store, req, res, m[1]);
      if (m && method === "DELETE") return deletePost(store, req, res, m[1]);
      send(res, 404, { error: "not found" });
    } catch {
      send(res, 500, { error: "internal" });
    }
  });
}
