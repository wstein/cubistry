/** Lossless SVG compaction. Merging never changes a single pixel of the rendering (numbers keep 12 significant digits;
 *  a rect is only merged when ALL of its attributes were parsed, i.e. written as name="value" with double quotes):
 *  - gridToRects: runs of equal-colored cells become one rect (rows first, then identical stacked rows);
 *  - compactSvg: touching consecutive <rect> elements with equal style are merged, inter-tag whitespace dropped.
 */
const trim = (v) => String(+v.toPrecision(12));

/** Merges a color grid (see grid.mjs) into rects {x, y, w, h, fill} in face pixels (cell = S / M). */
export function gridToRects(grid, S) {
  const { M, colors } = grid;
  const cell = S / M;
  // 1. horizontal runs per row
  const rows = colors.map((row) => {
    const runs = [];
    for (let i = 0; i < M; ) {
      let k = i + 1;
      while (k < M && row[k] === row[i]) k++;
      runs.push({ i0: i, i1: k, fill: row[i] });
      i = k;
    }
    return runs;
  });
  // 2. stack identical runs of consecutive rows
  const rects = [];
  let open = new Map();
  for (let j = 0; j <= M; j++) {
    const next = new Map();
    for (const r of j < M ? rows[j] : []) {
      const key = `${r.i0}:${r.i1}:${r.fill}`;
      const prev = open.get(key);
      if (prev) { prev.j1 = j + 1; next.set(key, prev); } else next.set(key, { ...r, j0: j, j1: j + 1 });
    }
    for (const [key, r] of open) if (!next.has(key)) rects.push(r);
    open = next;
  }
  return rects.map((r) => ({ x: r.i0 * cell, y: r.j0 * cell, w: (r.i1 - r.i0) * cell, h: (r.j1 - r.j0) * cell, fill: r.fill }));
}

export const rectSvg = (r) => `<rect x="${trim(r.x)}" y="${trim(r.y)}" width="${trim(r.w)}" height="${trim(r.h)}" fill="${r.fill}"/>`;

/** Rects intersecting the crop [x, y, w, h]; the rest cannot show in a viewBox crop. */
export const cropRects = (rects, [x, y, w, h]) =>
  rects.filter((r) => r.x < x + w && r.x + r.w > x && r.y < y + h && r.y + r.h > y);

/**
 * Background rects, plain: no wrapper and no `shape-rendering` (the app's SVG allowlist rejects that attribute).
 * Cells sit on whole pixels at the face size (420 / 60 = 7 px), so no hairlines show at native size; at fractional zoom
 * a faint seam between equal-colored neighbors is possible, which is why rects are merged into as few as possible.
 */
export const rectsToSvg = (rects) => rects.map(rectSvg).join("");

const RECT = /<rect\b([^>]*?)\/>/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;
const parseAttrs = (s) => Object.fromEntries([...s.matchAll(ATTR)].map((m) => [m[1], m[2]]));
const GEOM = ["x", "y", "width", "height"];

/** True when every attribute of the attribute string was parsed (double-quoted name="value" pairs only). */
const fullyParsed = (s) => s.replace(ATTR, "").trim() === "";

function mergeable(a, b) {
  if (!fullyParsed(a) || !fullyParsed(b)) return null;
  const A = parseAttrs(a), B = parseAttrs(b);
  if (!GEOM.every((k) => k in A && k in B && Number.isFinite(+A[k]) && Number.isFinite(+B[k]))) return null;
  // Only plain filled rects may merge: rx/ry/stroke/transform would change the shape.
  const SAFE = new Set(["fill", "opacity", "fill-opacity"]);
  if (![...Object.keys(A), ...Object.keys(B)].every((k) => GEOM.includes(k) || SAFE.has(k))) return null;
  const restA = Object.keys(A).filter((k) => !GEOM.includes(k)).sort().map((k) => `${k}=${A[k]}`).join(";");
  const restB = Object.keys(B).filter((k) => !GEOM.includes(k)).sort().map((k) => `${k}=${B[k]}`).join(";");
  if (restA !== restB) return null;
  const eq = (p, q) => Math.abs(p - q) < 1e-6;
  const [ax, ay, aw, ah, bx, by, bw, bh] = [A.x, A.y, A.width, A.height, B.x, B.y, B.width, B.height].map(Number);
  const rest = Object.keys(A).filter((k) => !GEOM.includes(k)).map((k) => ` ${k}="${A[k]}"`).join("");
  const build = (x, y, w, h) => ` x="${trim(x)}" y="${trim(y)}" width="${trim(w)}" height="${trim(h)}"${rest}`;
  if (eq(ay, by) && eq(ah, bh) && eq(ax + aw, bx)) return build(ax, ay, aw + bw, ah);
  if (eq(ax, bx) && eq(aw, bw) && eq(ay + ah, by)) return build(ax, ay, aw, ah + bh);
  return null;
}

/** Merges touching consecutive rects of equal style; drops whitespace between tags. Pixel-identical. */
export function compactSvg(svg) {
  let out = svg.replace(/>\s+</g, "><");
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    out = out.replace(/(?:<rect\b[^>]*?\/>){2,}/g, (run) => {
      const list = [...run.matchAll(RECT)].map((m) => m[1]);
      const merged = [];
      for (const attrs of list) {
        const last = merged.length - 1;
        const m = last >= 0 ? mergeable(merged[last], attrs) : null;
        if (m) { merged[last] = m; changed = true; } else merged.push(attrs);
      }
      return merged.map((a) => `<rect${a}/>`).join("");
    });
    if (!changed) break;
  }
  return out;
}

/** Measured before/after report for one string. */
export function compactStats(before, after) {
  const b = Buffer.byteLength(before), a = Buffer.byteLength(after);
  return { before: b, after: a, saved: b - a, ratio: b ? +(a / b).toFixed(3) : 1 };
}
