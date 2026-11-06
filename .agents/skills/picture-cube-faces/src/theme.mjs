/** Scene API: an agent writes only scene code.
 *
 *   export default defineTheme({
 *     name: "demo", size: 420, // face px; 420 is divisible by every N from 2 to 7
 *     belt: createBelt({ sky: [...], ground: [...] }),
 *     faces: { L: (ctx) => "<svg fragment>", F: ..., R: ..., B: ..., U: ..., D: ... },
 *   });
 *
 * Each callback draws ON TOP of an automatic background (belt panorama for L F R B, derived borders for U and D)
 * and returns an svg fragment string, a list of strings / {svg, bbox} items, or {art, bg} (bg: rects, or false for none).
 * Coordinates are face pixels (0..S). Keep the outer ~3 % rim of every face free of art so the seams stay clean.
 */
import { writeFileSync } from "node:fs";
import { FACE_NAMES, BELT, DEFAULT_FACE_SIZE } from "./geometry.mjs";
import { cellsPerFace } from "./grid.mjs";
import { gridToRects } from "./compact.mjs";
import { upBorders, downBorders, borderGrid } from "./updown.mjs";
import { writeFaceSet, eachSticker, stickerFrame, roundedField } from "./svg.mjs";
import { styleKit, INK, HUES, WHITE } from "./style.mjs";
import { blockText, glyphPath } from "./glyphs.mjs";
import { archiveCurrent } from "./versions.mjs";

export function defineTheme({ name, size = DEFAULT_FACE_SIZE, belt = null, up = {}, down = {}, ink = INK, cell = 7, step = 4, faces }) {
  if (!name) throw new Error("theme needs a name");
  const S = size, k = S / 320, M = cellsPerFace(S, cell);

  function context(face) {
    return {
      name, face, S, k, M, belt, ink, HUES, WHITE,
      s: styleKit(k, ink),
      /** Fractions of the face to pixels. */
      at: (fx, fy) => [fx * S, fy * S],
      /** Belt position of pixel column x on this belt face. */
      u: (x) => belt.u(face, x / S),
      /** Horizon y (px) at pixel column x of a belt face. */
      horizonY: (x) => belt.horizonAt(belt.u(face, x / S)) * S,
      horizonPath: () => belt.horizonPath(face, S),
      /** Sticker helpers for letter/number themes: only valid when the theme fixes one N (then say so in the brief). */
      stickers: (n, fn) => eachSticker(n, S / n, fn),
      stickerFrame: (n, field) => stickerFrame(S / n, field),
      roundedField,
      blockText: (str, cx, cy, w, h, sw, field) => blockText(str, cx, cy, w, h, sw, field, { ink }),
      glyphPath,
    };
  }

  function autoBackground(face) {
    if (!belt) return [];
    if (BELT.includes(face)) return gridToRects(belt.grid(face, M, step), S);
    const opts = face === "U" ? up : down;
    return gridToRects(borderGrid(face === "U" ? upBorders(belt) : downBorders(belt), M, opts, step), S);
  }

  function compose() {
    const out = {};
    for (const face of FACE_NAMES) {
      const draw = faces[face];
      if (typeof draw !== "function") throw new Error(`theme ${name}: faces.${face} must be a function(ctx)`);
      const res = draw(context(face));
      const spec = typeof res === "string" || Array.isArray(res) ? { art: res } : { ...res };
      out[face] = { art: spec.art ?? "", bg: spec.bg === false ? [] : spec.bg ?? autoBackground(face) };
    }
    return out;
  }

  return {
    name, size: S, S, k, belt,
    context,
    /** Writes the six faces + net into dir (rebuild in place; archive:true keeps old files in vN/). previewN writes tile previews. */
    build(dir, { archive = false, compact = true, previewN = [] } = {}) {
      const archived = archive ? archiveCurrent(dir) : null;
      const manifest = writeFaceSet(dir, { size: S, faces: compose() }, { compact, previewN });
      const warnings = belt?.warnings ?? [];
      for (const w of warnings) console.warn(`WARN theme ${name}: ${w}`);
      const report = { theme: name, archived, ...manifest, warnings, builtWith: "picture-cube-faces" };
      writeFileSync(`${dir}/build-report.json`, JSON.stringify(report, null, 2) + "\n");
      return report;
    },
  };
}
