import { createServer as httpCreate } from "node:http";

// 그린필드: 거의 빈 진짜 web. 헬스체크 하나뿐 — 하네스가 여기에 phase·기능을 얹는다.
export function createServer() {
  return httpCreate((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
}
