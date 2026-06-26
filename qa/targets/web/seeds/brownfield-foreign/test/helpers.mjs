import { createServer } from "../src/server.mjs";

// 서버를 임시 포트로 띄우고 fetch 클라이언트를 콜백에 넘긴다. 끝나면 닫는다(테스트 격리).
export async function withServer(fn) {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  const base = `http://localhost:${port}`;
  const api = (path, opts = {}) =>
    fetch(base + path, {
      method: opts.method ?? "GET",
      headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  try {
    await fn(api);
  } finally {
    server.close();
  }
}

export async function tokenFor(api, username) {
  await api("/signup", { method: "POST", body: { username, password: "pw" } });
  const r = await api("/login", { method: "POST", body: { username, password: "pw" } });
  return (await r.json()).token;
}
