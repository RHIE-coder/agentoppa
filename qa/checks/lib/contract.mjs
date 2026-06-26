// qa/checks/lib/contract.mjs — "contract" 판정의 순수 로직 (fs 무관, 결정적).
//   contract.md §2(헤더)·§4(연결) 의 *산출물 측* 점검을 데이터로 수행.
//   입력: docs = [{ role, header:{phase,status,inputs[]}, hasHeader }] (artifacts/<feature>/<role>.md 들).
//   불변식: 각 산출물은 frontmatter 헤더(phase·status·inputs)를 달고, 한 산출물의 inputs(consumes)는
//           *앞* 산출물의 role(produces)로 풀려야 한다(dangling 입력 없음). 한 role 한 번만 produces.
//   호출자(run.mjs / standalone validator)가 파일을 읽어 docs 를 만들고 이 함수에 넘긴다.

const STATUSES = ["draft", "ready", "stale"];

// docs 는 *문서 순서*(파일명 정렬 또는 호출자가 준 순서)로 들어온다.
// 반환: { ok, msg }.
export function judgeContract(docs) {
  const fails = [];
  if (!docs.length) return { ok: false, msg: "artifacts 아래 단계 문서 0개 (인계 산출물 없음)" };

  // §2 헤더 점검
  for (const d of docs) {
    if (!d.hasHeader) { fails.push(`'${d.role}.md' frontmatter 헤더 없음`); continue; }
    const h = d.header;
    if (!h.phase) fails.push(`'${d.role}.md' 헤더에 phase 없음`);
    if (!h.status) fails.push(`'${d.role}.md' 헤더에 status 없음`);
    else if (!STATUSES.includes(h.status)) fails.push(`'${d.role}.md' status='${h.status}' (draft|ready|stale 여야)`);
    if (!Array.isArray(h.inputs)) fails.push(`'${d.role}.md' 헤더에 inputs 없음 (없으면 [] 로 명시)`);
  }

  // §4 연결: produces=문서 role, consumes=inputs. 한 role 한 번만 produces.
  const producedBy = {};
  for (const d of docs) {
    if (producedBy[d.role] !== undefined) fails.push(`중복 produces: '${d.role}' (${producedBy[d.role]} & ${d.role}.md)`);
    producedBy[d.role] = `${d.role}.md`;
  }
  // 누적 produced 로 dangling 검사 (앞 문서만 풀 수 있다).
  const producedSoFar = new Set();
  for (const d of docs) {
    const inputs = Array.isArray(d.header?.inputs) ? d.header.inputs : [];
    for (const role of inputs) {
      // 외부 입력(아무 문서도 produces 안 하는 것)은 허용 — 단 *문서로 존재하는데 뒤에서 옴* 이면 dangling.
      if (producedBy[role] && !producedSoFar.has(role))
        fails.push(`dangling: '${d.role}.md' 가 '${role}' 를 consumes 하는데 뒤(또는 자기) 문서가 produces`);
    }
    producedSoFar.add(d.role);
  }

  return fails.length
    ? { ok: false, msg: `contract 위반:\n      ${fails.join("\n      ")}` }
    : { ok: true, msg: `contract OK (${docs.length}개 문서 · 헤더·연결 충족)` };
}

// 산출물 .md 한 개에서 frontmatter 헤더 추출 (raw 문자열 → header).
export function parseDocHeader(raw) {
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { hasHeader: false, header: {} };
  const header = { phase: "", status: "", inputs: null };
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!mm) continue;
    let v = mm[2].replace(/\s*#.*$/, "").trim();
    if (mm[1] === "inputs") {
      if (v.startsWith("[") && v.endsWith("]"))
        header.inputs = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      else header.inputs = v ? [v.replace(/^["']|["']$/g, "")] : [];
    } else header[mm[1]] = v.replace(/^["']|["']$/g, "");
  }
  return { hasHeader: true, header };
}
