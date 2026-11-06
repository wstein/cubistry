/** Static rules for a cube set (pure): app SVG allowlist, style audit, size budget, tile file format. */
import { auditSvg, parseXml } from "./svgcheck.mjs";

export { auditSvg };

/**
 * Hard rule: the file must pass the app's asset validator rules (see svgcheck.mjs: tag and attribute allowlist,
 * decoded values, integer width/height up to 1024). Returns [{id, why, count}] grouped by problem id; [] = clean.
 * Pass `{ dimensions: false, size: false }` for the net.
 */
export function findForbidden(svg, opts) {
  const byId = new Map();
  for (const p of auditSvg(svg, opts)) {
    const g = byId.get(p.id) ?? { id: p.id, why: p.why, count: 0 };
    g.count++;
    byId.set(p.id, g);
  }
  return [...byId.values()];
}

const isWhite = (c) => /^(?:#fff(?:fff)?|white)$/i.test(c);

/** Style audit (advisory): distinct non-white stroke colors (target 1 ink) and stroke weights (target 3). */
export function styleAudit(svg) {
  const colors = new Set(), widths = new Set();
  for (const m of svg.matchAll(/\bstroke\s*=\s*["']([^"']+)["']/g)) if (m[1] !== "none" && !isWhite(m[1])) colors.add(m[1].toLowerCase());
  for (const m of svg.matchAll(/\bstroke-width\s*=\s*["']([^"']+)["']/g)) widths.add(String(+(+m[1]).toFixed(1)));
  return { strokeColors: [...colors], strokeWidths: [...widths].sort((a, b) => a - b) };
}

export const DEFAULT_BUDGET = { tileKB: 30, faceKB: 200 };

/**
 * Size budget. entries: [{file, bytes, kind: "tile" | "face"}]. Returns {rows, over, ok}.
 * Exceeding a budget is a warning unless `strict` is set.
 */
export function checkSizes(entries, budget = DEFAULT_BUDGET) {
  const limit = { tile: budget.tileKB * 1024, face: budget.faceKB * 1024 };
  const rows = entries.map((e) => ({ ...e, limit: limit[e.kind], over: e.bytes > limit[e.kind] }));
  const over = rows.filter((r) => r.over);
  return { rows, over, ok: over.length === 0 };
}

/** Tile file format required by the playground: width/height = tile, viewBox = crop of the face. Returns problems. */
export function checkTileFormat(svg, { r, c, tile }) {
  const root = rootAttrs(svg);
  if (!root) return ["no <svg> root"];
  const attr = (n) => root[n];
  const problems = [];
  if (!Number.isInteger(tile)) problems.push(`tile size ${tile} px is not an integer: the face size must be divisible by N`);
  if (Number(attr("width")) !== tile || Number(attr("height")) !== tile) problems.push(`width/height must be ${tile}, got ${attr("width")}x${attr("height")}`);
  const want = `${c * tile} ${r * tile} ${tile} ${tile}`;
  if ((attr("viewBox") ?? "").trim().replace(/[\s,]+/g, " ") !== want) problems.push(`viewBox must be "${want}", got "${attr("viewBox")}"`);
  return problems;
}

function rootAttrs(svg) {
  try { return Object.fromEntries(parseXml(svg).attrs.map((a) => [a.name, a.value])); } catch { return null; }
}

/** Reads the root width/height/viewBox of a face svg (null when the file is not well-formed). */
export function faceRoot(svg) {
  const a = rootAttrs(svg);
  return a ? { width: Number(a.width), height: Number(a.height), viewBox: a.viewBox } : null;
}
