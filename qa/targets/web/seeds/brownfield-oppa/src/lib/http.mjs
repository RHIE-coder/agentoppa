// 공용 HTTP 헬퍼 — 본문 파싱·JSON 응답·Bearer 토큰 추출.
export function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function send(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(obj === undefined ? "" : JSON.stringify(obj));
}

export function bearer(req) {
  const h = req.headers.authorization ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}
