/** SVG writers: face, tile (viewBox crop of the face), net (standard cross), sticker frames. Node ESM, no dependencies. */
import { mkdirSync, writeFileSync } from "node:fs";
import { FACE_NAMES, NET_POS, assertSupportedN, tileId, tileViewBox } from "./geometry.mjs";
import { rectsToSvg, cropRects, compactSvg, compactStats } from "./compact.mjs";
import { shade } from "./color.mjs";

const NS = "http://www.w3.org/2000/svg";
export const svgDoc = (w, h, viewBox, inner) => `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="${viewBox}">${inner}</svg>\n`;

/**
 * Face art is a string, or a list of strings and {svg, bbox: [x, y, w, h]} items. A bbox (stroke included)
 * lets the tile writer drop items that lie outside a tile's crop, which keeps tile files small.
 */
export function artFor(art, crop = null) {
  if (typeof art === "string") return art;
  return (art ?? [])
    .filter((it) => typeof it === "string" || !it.bbox || !crop ||
      (it.bbox[0] < crop[0] + crop[2] && it.bbox[0] + it.bbox[2] > crop[0] && it.bbox[1] < crop[1] + crop[3] && it.bbox[1] + it.bbox[3] > crop[1]))
    .map((it) => (typeof it === "string" ? it : it.svg))
    .join("");
}

const faceInner = (face, crop, compact) => {
  const rects = crop ? cropRects(face.bg ?? [], crop) : face.bg ?? [];
  const art = artFor(face.art, crop);
  return (rects.length ? rectsToSvg(rects) : "") + (compact ? compactSvg(art) : art);
};

/** Standard cross net (nested svg elements clip to their box by default, so no `overflow` attribute is needed): U above F; L F R B in a row; D below F. `inners` maps face name to its inner svg. */
export function netSvg(inners, S, { gap = 10, bg = "#f5f3eb", ink = "#4a3a38" } = {}) {
  const cell = S + gap;
  const body = FACE_NAMES.map((f) => {
    const [c, r] = NET_POS[f];
    return `<svg x="${c * cell + gap}" y="${r * cell + gap}" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${inners[f]}<rect width="${S}" height="${S}" fill="none" stroke="${ink}" stroke-width="2"/></svg>`;
  }).join("");
  const W = 4 * cell + gap, H = 3 * cell + gap;
  return `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>\n`;
}

/** Writes tile previews of one face set for cube size n into dir (F_r_c.svg, viewBox crops of the face). */
export function writeTiles(dir, S, n, faceInners) {
  assertSupportedN(n);
  if (!Number.isInteger(S / n)) throw new RangeError(`face size ${S} px is not divisible by N = ${n}: tile files need integer width/height (the app's SVG validator rejects fractions)`);
  mkdirSync(dir, { recursive: true });
  const tile = S / n, sizes = [];
  for (const f of FACE_NAMES) {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const crop = [c * tile, r * tile, tile, tile];
      const text = svgDoc(tile, tile, tileViewBox(r, c, tile), faceInner(faceInners[f], crop, faceInners.compact));
      writeFileSync(`${dir}/${tileId(f, r, c)}.svg`, text);
      sizes.push(Buffer.byteLength(text));
    }
  }
  return { n, tile, count: sizes.length, max: Math.max(...sizes), mean: Math.round(sizes.reduce((x, y) => x + y, 0) / sizes.length) };
}

/**
 * Writes the DELIVERABLE: <dir>/{U,L,F,R,B,D}.svg (S x S px each) and net.svg.
 * Tile files are NOT part of a theme: the app slices the faces at runtime. With `previewN` (e.g. [2, 7]) tile previews
 * are written to <dir>/tiles/n<N>/ for checking and review only.
 * @param {{size:number, faces:Record<string,{bg?:object[], art?:any}>}} spec
 */
export function writeFaceSet(dir, spec, { compact = true, net = true, previewN = [] } = {}) {
  const { size: S, faces } = spec;
  if (!Number.isInteger(S) || S < 1 || S > 1024) throw new RangeError(`face size must be an integer from 1 to 1024 (the app's SVG validator), got ${S}`);
  mkdirSync(dir, { recursive: true });
  const files = {};
  const write = (name, text) => { writeFileSync(`${dir}/${name}`, text); files[name] = Buffer.byteLength(text); };
  const inners = {};
  let artBefore = 0, artAfter = 0;
  for (const f of FACE_NAMES) {
    const face = faces[f];
    if (!face) throw new Error(`missing face ${f}`);
    const rawArt = artFor(face.art);
    const stats = compactStats(rawArt, compactSvg(rawArt));
    artBefore += stats.before; artAfter += stats.after;
    inners[f] = faceInner(face, null, compact);
    write(`${f}.svg`, svgDoc(S, S, `0 0 ${S} ${S}`, inners[f]));
  }
  if (net) write("net.svg", netSvg(inners, S));
  const previews = previewN.map((n) => writeTiles(`${dir}/tiles/n${n}`, S, n, Object.fromEntries([...FACE_NAMES.map((f) => [f, faces[f]]), ["compact", compact]])));
  const fb = FACE_NAMES.map((f) => files[`${f}.svg`]);
  return {
    size: S, files,
    faceBytes: { max: Math.max(...fb), mean: Math.round(fb.reduce((x, y) => x + y, 0) / fb.length) },
    totalBytes: Object.values(files).reduce((x, y) => x + y, 0),
    artCompaction: { before: artBefore, after: artAfter },
    tilePreviews: previews,
  };
}

// ---- sticker helpers (letter and number cubes) -----------------------------------------------------

/** Rounded rectangle field. */
export const roundedField = (x, y, w, h, r, fill, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra}/>`;

/** Pastel sticker frame for one sticker of `size` px: flat field, white rim line, darker inner line. */
export function stickerFrame(size, field) {
  const k = size / 320, f = (v) => +(v * k).toFixed(2);
  return `<rect width="${size}" height="${size}" fill="${field}"/>` +
    `<rect x="${f(11)}" y="${f(11)}" width="${f(298)}" height="${f(298)}" rx="${f(44)}" fill="none" stroke="#fff" stroke-width="${f(6)}"/>` +
    `<rect x="${f(18)}" y="${f(18)}" width="${f(284)}" height="${f(284)}" rx="${f(38)}" fill="none" stroke="${shade(field, 0.86)}" stroke-width="${f(2)}"/>`;
}

/** Calls fn(r, c) for every sticker of an N x N face; its svg is drawn in 0..tile coordinates of that sticker. */
export function eachSticker(n, tile, fn) {
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const svg = fn(r, c);
    if (svg) out.push({ svg: `<g transform="translate(${c * tile} ${r * tile})">${svg}</g>`, bbox: [c * tile, r * tile, tile, tile] });
  }
  return out;
}
