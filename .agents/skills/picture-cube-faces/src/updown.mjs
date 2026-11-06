/** Up/Down edge derivation: U and D take their border colors from the belt faces' top/bottom rows,
 * so all eight edges touching U or D match by construction (target: border difference ~0).
 * Positions s, t are fractions 0..1 along a side in canonical order (top/bottom: left to right,
 * left/right: top to bottom). The orientation of every shared edge follows geometry.mjs EDGES.
 */
import { clamp, smoothstep, mixRgb } from "./color.mjs";
import { buildGrid } from "./grid.mjs";

/** Border color functions of the Up face, read from the top rows (v = 0) of F, L, R, B. */
export function upBorders(belt) {
  return {
    bottom: (s) => belt.rgbAt(belt.u("F", s), 0),
    left: (t) => belt.rgbAt(belt.u("L", t), 0),
    right: (t) => belt.rgbAt(belt.u("R", 1 - t), 0),
    top: (s) => belt.rgbAt(belt.u("B", 1 - s), 0),
  };
}

/** Border color functions of the Down face, read from the bottom rows (v = 1) of F, L, R, B. */
export function downBorders(belt) {
  return {
    top: (s) => belt.rgbAt(belt.u("F", s), 1),
    left: (t) => belt.rgbAt(belt.u("L", 1 - t), 1),
    right: (t) => belt.rgbAt(belt.u("R", t), 1),
    bottom: (s) => belt.rgbAt(belt.u("B", 1 - s), 1),
  };
}

/**
 * Coons patch: a smooth surface whose four borders are exactly the given border functions.
 * Optional `center` (hex RGB array or null) pulls the interior toward a calm color without touching
 * the borders: weight = strength * smoothstep(distance-to-border / band).
 */
export function coons(b, s, t, center = null, band = 0.35, strength = 1) {
  const top = b.top(s), bottom = b.bottom(s), left = b.left(t), right = b.right(t);
  const c00 = b.top(0), c10 = b.top(1), c01 = b.bottom(0), c11 = b.bottom(1);
  const out = [0, 1, 2].map((k) =>
    (1 - t) * top[k] + t * bottom[k] + (1 - s) * left[k] + s * right[k] -
    ((1 - s) * (1 - t) * c00[k] + s * (1 - t) * c10[k] + (1 - s) * t * c01[k] + s * t * c11[k]));
  if (!center) return out;
  const d = Math.min(s, 1 - s, t, 1 - t);
  return mixRgb(out, center, strength * smoothstep(clamp(d / band)));
}

/** Background grid for U or D from border functions (see upBorders/downBorders). */
export function borderGrid(borders, M, opts = {}, step = 2) {
  return buildGrid(M, (s, t) => coons(borders, s, t, opts.center ?? null, opts.band ?? 0.35, opts.strength ?? 1), step);
}
