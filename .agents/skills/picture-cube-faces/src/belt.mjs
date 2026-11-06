/** Belt panorama sampler: L | F | R | B form ONE continuous picture that wraps around.
 *
 * Position around the belt is u in [0, 4): face index + x / S (L = 0, F = 1, R = 2, B = 3).
 * Sky and ground are given as four keyframes (one per belt face, placed at the face center) and are
 * blended cyclically with a smoothstep, so B wraps back into L. The horizon is a function of u.
 * Because every color is a pure function of (u, v), all four vertical edges match by construction;
 * Up and Down derive their border colors from the neighbors' top and bottom rows (see updown.mjs).
 */
import { BELT } from "./geometry.mjs";
import { smoothstep, stopsAt, mixRgb, toHex, quantize } from "./color.mjs";
import { buildGrid } from "./grid.mjs";

const wrap = (u) => ((u % 4) + 4) % 4;

/**
 * @param {object} cfg
 * @param {Array} cfg.sky      four stop lists (L, F, R, B): [[v, "#hex"], ...] with v 0 (top) .. 1 (horizon)
 * @param {Array} cfg.ground   four stop lists (L, F, R, B): v 0 (horizon) .. 1 (bottom edge)
 * @param {number|((u:number)=>number)} [cfg.horizon=0.72]  horizon height as a fraction of the face
 */
export function createBelt({ sky, ground, horizon = 0.72 }) {
  if (sky?.length !== 4 || ground?.length !== 4) throw new Error("belt needs 4 sky and 4 ground keyframes (L, F, R, B)");
  const horizonAt = (u) => (typeof horizon === "function" ? horizon(wrap(u)) : horizon);

  // Cyclic keyframe blend: keyframe k sits at u = k + 0.5, neighbors blend with smoothstep.
  const blend = (keys, u, v) => {
    const w = wrap(u - 0.5);
    const j = Math.floor(w);
    const t = smoothstep(w - j);
    return mixRgb(stopsAt(keys[j % 4], v), stopsAt(keys[(j + 1) % 4], v), t);
  };

  /** Float RGB at belt position u and vertical fraction v (0 top .. 1 bottom). */
  function rgbAt(u, v) {
    const h = horizonAt(u);
    return v < h ? blend(sky, u, h === 0 ? 0 : v / h) : blend(ground, u, h === 1 ? 1 : (v - h) / (1 - h));
  }

  return {
    rgbAt,
    colorAt: (u, v, step = 2) => toHex(quantize(rgbAt(u, v), step)),
    horizonAt,
    /** Belt position of fraction p (0..1) across belt face `face`. */
    u: (face, p) => BELT.indexOf(face) + p,
    /** Background grid of a belt face (M x M cells). */
    grid(face, M, step = 2) {
      const k = BELT.indexOf(face);
      if (k < 0) throw new Error(`${face} is not a belt face`);
      return buildGrid(M, (s, t) => rgbAt(k + s, t), step);
    },
    /** SVG path (in face pixels) following the horizon of a belt face: ink it as a ridge line. */
    horizonPath(face, S, samples = 24) {
      const k = BELT.indexOf(face);
      const pts = Array.from({ length: samples + 1 }, (_, i) => `${((i / samples) * S).toFixed(1)} ${(horizonAt(k + i / samples) * S).toFixed(1)}`);
      return `M${pts.join("L")}`;
    },
  };
}
