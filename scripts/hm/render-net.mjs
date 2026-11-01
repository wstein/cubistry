// Deterministic sticker net of the H/M print (m3-SH): the six faces of the
// solved (source) pose as a cross, each sticker carrying its existing glyph
// artwork turned to its print-up vector. Pure vector output, no fonts, no
// raster data and no external references; the glyphs are the unchanged H/S/M
// symbol and counter digit SVGs, embedded verbatim.
import { createHash } from "node:crypto";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const CELL = 256,
  GAP = 32,
  FACE = 2 * CELL,
  PAD = 32;
/**
 * Outside view of each face in the net: its normal, the net's up and right
 * directions on that face, and the face's slot in the cross (column, row).
 */
export const FACES = [
  { face: "U", n: [0, 1, 0], up: [0, 0, -1], right: [1, 0, 0], at: [1, 0] },
  { face: "L", n: [-1, 0, 0], up: [0, 1, 0], right: [0, 0, 1], at: [0, 1] },
  { face: "F", n: [0, 0, 1], up: [0, 1, 0], right: [1, 0, 0], at: [1, 1] },
  { face: "R", n: [1, 0, 0], up: [0, 1, 0], right: [0, 0, -1], at: [2, 1] },
  { face: "B", n: [0, 0, -1], up: [0, 1, 0], right: [-1, 0, 0], at: [3, 1] },
  { face: "D", n: [0, -1, 0], up: [0, 0, 1], right: [1, 0, 0], at: [1, 2] },
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Glyph artwork files, relative to the repository root. */
export const glyphPath = (image) =>
  /^[HM]$/.test(image)
    ? `public/assets/hsm/${image}.svg`
    : `public/assets/digits/${image}.svg`;

/**
 * Lay out every sticker. `read(path)` returns a glyph SVG's text. Returns the
 * SVG text and the provenance record (inputs, per-sticker placement, output).
 */
export function renderNet(printing, read, { label, source }) {
  const inputs = {};
  const placements = printing.map((s) => {
    const f = FACES.find((x) => same(x.n, s.n));
    if (!f) throw Error(`sticker ${s.id}: no face`);
    const column = dot(f.right, s.p) > 0 ? 1 : 0,
      row = dot(f.up, s.p) > 0 ? 0 : 1;
    // Clockwise screen rotation that turns the glyph's top to its up vector.
    const rotation = same(s.up, f.up)
      ? 0
      : same(s.up, f.right)
        ? 90
        : same(s.up, f.up.map((v) => -v + 0))
          ? 180
          : same(s.up, f.right.map((v) => -v + 0))
            ? 270
            : null;
    if (rotation === null) throw Error(`sticker ${s.id}: up not on its face`);
    return {
      id: s.id,
      cubie: s.cubie,
      face: f.face,
      row,
      column,
      glyph: s.image === "" ? "blank" : s.image,
      rotation,
      x: PAD + f.at[0] * (FACE + GAP) + column * CELL,
      y: PAD + f.at[1] * (FACE + GAP) + row * CELL,
    };
  });
  const width = 2 * PAD + 4 * FACE + 3 * GAP,
    height = 2 * PAD + 3 * FACE + 2 * GAP;
  const body = placements.map((p) => {
    if (p.glyph === "blank")
      return `<rect x="${p.x}" y="${p.y}" width="${CELL}" height="${CELL}" fill="#fffdf6"/>`;
    const path = glyphPath(p.glyph),
      text = read(path);
    inputs[path] = sha256(text);
    const inner = text
      .trim()
      .replace(
        /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="256" height="256" viewBox="0 0 256 256">/,
        `<svg x="${p.x}" y="${p.y}" width="${CELL}" height="${CELL}" viewBox="0 0 256 256">`,
      );
    if (inner === text.trim()) throw Error(`${path}: unexpected SVG header`);
    const c = [p.x + CELL / 2, p.y + CELL / 2];
    return p.rotation
      ? `<g transform="rotate(${p.rotation} ${c[0]} ${c[1]})">${inner}</g>`
      : inner;
  });
  const outlines = FACES.map((f) => {
    const x = PAD + f.at[0] * (FACE + GAP),
      y = PAD + f.at[1] * (FACE + GAP);
    return `<path d="M${x} ${y}h${FACE}v${FACE}h${-FACE}ZM${x + CELL} ${y}v${FACE}M${x} ${y + CELL}h${FACE}" fill="none" stroke="#8a8f98" stroke-width="2"/>`;
  });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<title>H/M one-cube counter print ${label}: sticker net, solved source pose</title>` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    body.join("") +
    outlines.join("") +
    `</svg>\n`;
  const provenance = {
    schema: "cubistry.hm-sticker-net",
    version: 1,
    label,
    source,
    generator: "scripts/hm/render-net.mjs",
    license: "AGPL-3.0-or-later (project artwork; no fonts, no raster data)",
    layout:
      "Cross net of the solved source pose, outside view of each face: U above F; L, F, R, B in a row; D below F. Each face is a 2x2 grid; rotation is the clockwise turn of the glyph art so that its top points along the sticker's print-up vector.",
    faces: FACES.map(({ face, n, up, right }) => ({ face, n, up, right })),
    inputs: Object.fromEntries(Object.entries(inputs).sort()),
    stickers: placements.map(({ x, y, ...rest }) => rest),
    output: { path: "public/assets/hm/m3-sh-net.svg", sha256: sha256(svg) },
  };
  return { svg, provenance };
}
