/** Concept sheet (pre-sketch stage): pure helpers that turn a small JSON into a flat-block net and check the edge
 * colors the owner is about to approve. It is a thumbnail tool, not an illustrator: blocks and labels only.
 *
 * Concept JSON:
 * { "theme": "name",
 *   "faces": { "L": { "hero": "Sun", "heroColor": "#f9d56e", "heroShare": 0.4, "heroShape": "circle",
 *                      "sky": ["#f7c5d6", "#fde7c6"], "ground": "#bfe0b0",
 *                      "edges": { "left": "#...", "right": "#..." } }, ... } }
 * Belt faces (L F R B) give sky [top, horizon] and ground; their left/right edge colors default to the sky mid color,
 * top = sky[0], bottom = ground. U and D derive their four edges from the belt unless given.
 */
import { FACE_NAMES, EDGES, NET_POS } from "./geometry.mjs";
import { parseHex, toHex, mixRgb, maxChannelDiff } from "./color.mjs";

export const HERO_SHARE = [0.35, 0.5];
const BELT_FACES = ["L", "F", "R", "B"];

export function validateConcept(c) {
  const problems = [];
  if (!c?.faces) return ["concept needs a faces object"];
  for (const f of FACE_NAMES) {
    const face = c.faces[f];
    if (!face) { problems.push(`face ${f} is missing`); continue; }
    if (!face.hero) problems.push(`${f}: hero is required (ONE dominating object per face)`);
    if (BELT_FACES.includes(f) && !(Array.isArray(face.sky) && face.sky.length === 2 && face.ground)) problems.push(`${f}: belt faces need sky [top, horizon] and ground`);
    for (const col of [face.heroColor, ...(face.sky ?? []), face.ground, ...Object.values(face.edges ?? {})].filter(Boolean)) {
      try { parseHex(col); } catch { problems.push(`${f}: bad color ${col}`); }
    }
  }
  return problems;
}

/** Resolved {top, bottom, left, right} hex colors per face. */
export function resolveEdges(c) {
  const e = {};
  for (const f of BELT_FACES) {
    const face = c.faces[f], mid = toHex(mixRgb(parseHex(face.sky[0]), parseHex(face.sky[1]), 0.5));
    e[f] = { top: face.sky[0], bottom: face.ground, left: mid, right: mid, ...(face.edges ?? {}) };
  }
  const given = (f) => c.faces[f]?.edges ?? {};
  e.U = { bottom: e.F.top, left: e.L.top, right: e.R.top, top: e.B.top, ...given("U") };
  e.D = { top: e.F.bottom, left: e.L.bottom, right: e.R.bottom, bottom: e.B.bottom, ...given("D") };
  return e;
}

/** For each of the 12 shared edges: both colors and their max-channel difference (of 255). */
export function seamReport(c, limit = 10) {
  const e = resolveEdges(c);
  return EDGES.map((d) => {
    const a = e[d.a[0]][d.a[1]], b = e[d.b[0]][d.b[1]];
    const diff = maxChannelDiff(parseHex(a), parseHex(b));
    return { edge: d.name, a, b, diff, pass: diff <= limit };
  });
}

/** Warnings about hero share (35-50 % of the face is the target). */
export function heroWarnings(c) {
  return FACE_NAMES.flatMap((f) => {
    const s = c.faces[f]?.heroShare ?? 0.4;
    return s < HERO_SHARE[0] || s > HERO_SHARE[1] ? [`${f}: heroShare ${s} is outside ${HERO_SHARE[0]}-${HERO_SHARE[1]}`] : [];
  });
}

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

/** Net svg of flat blocks. Uses <text> labels: a concept sheet is NOT a deliverable face. */
export function sketchSvg(c, report = seamReport(c), cell = 200) {
  const e = resolveEdges(c), gap = 12, bar = 8;
  const at = (f) => { const [x, y] = NET_POS[f]; return [gap + x * (cell + gap), gap + y * (cell + gap)]; };
  const parts = FACE_NAMES.map((f) => {
    const face = c.faces[f], [x, y] = at(f), share = face.heroShare ?? 0.4, shape = face.heroShape ?? "circle";
    const horizon = BELT_FACES.includes(f) ? 0.72 : null;
    let s = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${e[f].top}"/>`;
    if (horizon !== null) {
      s += `<rect x="${x}" y="${y + cell * 0.36}" width="${cell}" height="${cell * (horizon - 0.36)}" fill="${face.sky[1]}"/><rect x="${x}" y="${y + cell * horizon}" width="${cell}" height="${cell * (1 - horizon)}" fill="${face.ground}"/>`;
    } else s += `<rect x="${x}" y="${y + cell * 0.5}" width="${cell}" height="${cell * 0.5}" fill="${e[f].bottom}"/>`;
    const cx = x + cell / 2, cy = y + cell * 0.46, area = share * cell * cell;
    s += shape === "rect"
      ? `<rect x="${cx - Math.sqrt(area) / 2}" y="${cy - Math.sqrt(area) / 2}" width="${Math.sqrt(area)}" height="${Math.sqrt(area)}" rx="12" fill="${face.heroColor ?? "#ddd"}" stroke="#4a3a38" stroke-width="2"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${Math.sqrt(area / Math.PI).toFixed(1)}" fill="${face.heroColor ?? "#ddd"}" stroke="#4a3a38" stroke-width="2"/>`;
    s += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#4a3a38">${esc(face.hero)}</text><text x="${x + 8}" y="${y + 20}" font-family="sans-serif" font-size="16" font-weight="700" fill="#4a3a38">${f}</text>`;
    s += `<rect x="${x}" y="${y}" width="${cell}" height="${bar}" fill="${e[f].top}"/><rect x="${x}" y="${y + cell - bar}" width="${cell}" height="${bar}" fill="${e[f].bottom}"/><rect x="${x}" y="${y}" width="${bar}" height="${cell}" fill="${e[f].left}"/><rect x="${x + cell - bar}" y="${y}" width="${bar}" height="${cell}" fill="${e[f].right}"/>`;
    return s + `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="#4a3a38" stroke-width="2"/>`;
  }).join("");
  // red marks on mismatching edges (belt edges only; U/D edges are marked at the face side)
  const marks = report.filter((r) => !r.pass).map((r) => {
    const d = EDGES.find((x) => x.name === r.edge), [x, y] = at(d.a[0]);
    const side = d.a[1];
    const line = { top: [x, y, x + cell, y], bottom: [x, y + cell, x + cell, y + cell], left: [x, y, x, y + cell], right: [x + cell, y, x + cell, y + cell] }[side];
    return `<line x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" stroke="#e0554f" stroke-width="5" stroke-dasharray="10 6"/>`;
  }).join("");
  const W = 4 * (cell + gap) + gap, H = 3 * (cell + gap) + gap + 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f5f3eb"/>${parts}${marks}<text x="${gap}" y="${H - 8}" font-family="sans-serif" font-size="14" fill="#4a3a38">Concept sheet: ${esc(c.theme ?? "theme")} (flat blocks, not final art). Red dashed = edge colors differ.</text></svg>\n`;
}
