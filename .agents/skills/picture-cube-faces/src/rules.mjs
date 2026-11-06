/** Static rules for a cube set (pure): forbidden constructs, style audit, size budget, tile file format. */

/** Constructs that must not appear in any face or tile svg. */
export const FORBIDDEN = [
  { id: "gradient", re: /<\s*(?:linear|radial|mesh)Gradient\b/i, why: "gradients are not flat vector" },
  { id: "pattern", re: /<\s*pattern\b/i, why: "patterns are not flat vector" },
  { id: "filter", re: /<\s*filter\b|\bfilter\s*[=:]/i, why: "filters make print output unpredictable" },
  { id: "clipPath", re: /<\s*clipPath\b|\bclip-path\s*[=:]/i, why: "clip paths are rejected by the playground SVG validator" },
  { id: "mask", re: /<\s*mask\b|\bmask\s*=/i, why: "masks are not flat vector" },
  { id: "url()", re: /url\s*\(/i, why: "no url() references" },
  { id: "text", re: /<\s*(?:text|tspan|textPath)\b/i, why: "text needs fonts; use path glyphs" },
  { id: "image", re: /<\s*image\b/i, why: "no embedded rasters" },
  { id: "script", re: /<\s*script\b/i, why: "no scripts" },
  { id: "foreignObject", re: /<\s*foreignObject\b/i, why: "no HTML inside svg" },
  { id: "href", re: /\b(?:xlink:)?href\s*=/i, why: "no external or internal references" },
  { id: "style-element", re: /<\s*style\b/i, why: "no style sheets; use presentation attributes" },
  { id: "event-handler", re: /\son[a-z]+\s*=/i, why: "no event handlers" },
  { id: "doctype", re: /<!\s*(?:DOCTYPE|ENTITY)/i, why: "no DTD or entities" },
];

/** Returns [{id, why, count}] for every forbidden construct found in the svg text. */
export function findForbidden(svg) {
  const hits = [];
  for (const rule of FORBIDDEN) {
    const g = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    const count = (svg.match(g) ?? []).length;
    if (count) hits.push({ id: rule.id, why: rule.why, count });
  }
  return hits;
}

const isWhite = (c) => /^(?:#fff(?:fff)?|white)$/i.test(c);

/** Style audit (advisory): distinct non-white stroke colors (target 1 ink) and stroke weights (target 3). */
export function styleAudit(svg) {
  const colors = new Set(), widths = new Set();
  for (const m of svg.matchAll(/\bstroke\s*=\s*"([^"]+)"/g)) if (m[1] !== "none" && !isWhite(m[1])) colors.add(m[1].toLowerCase());
  for (const m of svg.matchAll(/\bstroke-width\s*=\s*"([^"]+)"/g)) widths.add(String(+(+m[1]).toFixed(1)));
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
  const m = /<svg\b[^>]*>/.exec(svg);
  if (!m) return ["no <svg> root"];
  const attr = (n) => new RegExp(`\\s${n}="([^"]*)"`).exec(m[0])?.[1];
  const problems = [];
  if (Number(attr("width")) !== tile || Number(attr("height")) !== tile) problems.push(`width/height must be ${tile}, got ${attr("width")}x${attr("height")}`);
  const want = `${c * tile} ${r * tile} ${tile} ${tile}`;
  if ((attr("viewBox") ?? "").trim().replace(/[\s,]+/g, " ") !== want) problems.push(`viewBox must be "${want}", got "${attr("viewBox")}"`);
  return problems;
}

/** Reads the root width/height/viewBox of a face svg. */
export function faceRoot(svg) {
  const m = /<svg\b[^>]*>/.exec(svg);
  if (!m) return null;
  const attr = (n) => new RegExp(`\\s${n}="([^"]*)"`).exec(m[0])?.[1];
  return { width: Number(attr("width")), height: Number(attr("height")), viewBox: attr("viewBox") };
}
