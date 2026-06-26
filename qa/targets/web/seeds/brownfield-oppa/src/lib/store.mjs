import { randomUUID, createHash } from "node:crypto";

const hash = (s) => createHash("sha256").update(String(s)).digest("hex");

// 인메모리 저장소 — createServer() 마다 새 인스턴스(테스트 격리).
export function newStore() {
  const users = new Map(); // username -> { id, username, passHash, bio }
  const sessions = new Map(); // token -> username
  const posts = []; // { id, title, body, author }

  return {
    signup(username, password) {
      if (users.has(username)) return { error: "exists" };
      const user = { id: randomUUID(), username, passHash: hash(password), bio: "" };
      users.set(username, user);
      return { user };
    },
    login(username, password) {
      const u = users.get(username);
      if (!u || u.passHash !== hash(password)) return { error: "bad" };
      const token = randomUUID();
      sessions.set(token, username);
      return { token };
    },
    userOf(token) {
      const username = token && sessions.get(token);
      return username ? users.get(username) : null;
    },
    updateBio(user, bio) {
      user.bio = bio;
      return user;
    },
    listPosts() {
      return posts.map(({ id, title, author }) => ({ id, title, author }));
    },
    createPost(user, title, body) {
      const post = { id: randomUUID(), title, body, author: user.username };
      posts.push(post);
      return post;
    },
    getPost(id) {
      return posts.find((p) => p.id === id) ?? null;
    },
    deletePost(user, id) {
      const i = posts.findIndex((p) => p.id === id);
      if (i < 0) return { error: "notfound" };
      if (posts[i].author !== user.username) return { error: "forbidden" };
      posts.splice(i, 1);
      return { ok: true };
    },
  };
}
