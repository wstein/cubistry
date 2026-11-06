/** Synthetic "demo" theme: a tooling test, NOT art. It shows the scene API; the six faces are independent of the cube size N.
 *  - Belt story: dawn (L) -> day (F) -> evening (R) -> night (B) -> dawn again, one continuous panorama.
 *  - One dominating hero per face (about a third of the face), friendly face, flat vector, one ink color.
 *  - Texture anchors: a seeded scatter of small asymmetric marks (stars in the sky, grass tufts on the ground) so that
 *    even the 1/49 tiles of a 7x7 cube contain something to place and to orient. Real themes should use story-bearing
 *    anchors (clouds, birds, flowers) instead of a uniform scatter.
 * Verified claim: none for art. Output at N > 2 is a synthetic test of the tooling.
 */
import { defineTheme, createBelt, shade, HUES, WHITE } from "../src/index.mjs";

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
const r1 = (v) => +v.toFixed(1);

function heroShapes(kind, cx, cy, R) {
  const circle = (x, y, r) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/>`;
  switch (kind) {
    case "sun": {
      const rays = Array.from({ length: 8 }, (_, i) => {
        const [x, y] = polar(cx, cy, R * 1.12, (i * Math.PI) / 4);
        return circle(x, y, R * 0.16);
      }).join("");
      return circle(cx, cy, R) + rays;
    }
    case "cloud":
      return circle(cx, cy, R * 0.72) + circle(cx - R * 0.62, cy + R * 0.18, R * 0.5) + circle(cx + R * 0.62, cy + R * 0.18, R * 0.5) +
        `<rect x="${r1(cx - R * 1.1)}" y="${r1(cy + R * 0.2)}" width="${r1(R * 2.2)}" height="${r1(R * 0.5)}" rx="${r1(R * 0.25)}"/>`;
    case "moon":
      return circle(cx, cy, R);
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? R * 0.62 : R * 1.12, -Math.PI / 2 + (i * Math.PI) / 5).map(r1).join(" "));
      return `<path d="M${pts.join("L")}Z" stroke-linejoin="round"/>`;
    }
    default: { // flower
      const petals = Array.from({ length: 6 }, (_, i) => {
        const [x, y] = polar(cx, cy, R * 0.72, (i * Math.PI) / 3);
        return circle(x, y, R * 0.42);
      }).join("");
      return petals + circle(cx, cy, R * 0.6);
    }
  }
}

const SKY = [
  [[0, "#f7c5d6"], [1, "#fde7c6"]], // L dawn
  [[0, "#a9d4f2"], [1, "#e2f2fb"]], // F day
  [[0, "#e9a9c5"], [1, "#fbd1a8"]], // R evening
  [[0, "#5a5fa8"], [1, "#a9a3d6"]], // B night
];
const GROUND = [
  [[0, "#bfe0b0"], [1, "#9cc08a"]],
  [[0, "#b4dca4"], [1, "#8fbb86"]],
  [[0, "#c6cf9c"], [1, "#a3ae80"]],
  [[0, "#7f9fa6"], [1, "#6a8590"]],
];

/** @param {{size?: number}} opts */
export function demoTheme({ size = 420 } = {}) {
  const belt = createBelt({
    sky: SKY, ground: GROUND,
    horizon: (u) => 0.74 + 0.025 * Math.sin(u * Math.PI), // period 2, so it is periodic over the belt of 4
  });

  const hero = (ctx, kind, fill, cx = 0.5, cy = 0.46, mood = "happy") => {
    const h = ctx.s, k = ctx.k;
    const [x, y] = ctx.at(cx, cy), R = ctx.S * 0.3;
    const eyes = mood === "sleepy"
      ? [-1, 1].map((d) => `<path d="M${r1(x + d * 17 * k - 7 * k)} ${r1(y)}Q${r1(x + d * 17 * k)} ${r1(y + 7 * k)} ${r1(x + d * 17 * k + 7 * k)} ${r1(y)}" ${h.stroke(h.W.fine)}/>`).join("") +
        h.cheeks(x, y + 10 * k, 27 * k) + h.smile(x, y + 10 * k, 6 * k)
      : h.happy(x, y);
    return h.merged(heroShapes(kind, x, y, R), fill) + eyes;
  };

  /** Seeded jittered scatter: 17 x 17 cells; stars above the horizon, tufts below; skips the hero and the 3 % rim. */
  const anchors = (ctx, seed, heroCx, heroCy) => {
    const rnd = rng(seed), out = [], G = 17, cs = ctx.S / G, h = ctx.s, m = ctx.S * 0.03;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const x = (i + 0.2 + rnd() * 0.6) * cs, y = (j + 0.2 + rnd() * 0.6) * cs, a = rnd() * 360, kind = rnd();
      if (x < m || y < m || x > ctx.S - m || y > ctx.S - m) continue;
      if (Math.hypot(x - heroCx * ctx.S, y - heroCy * ctx.S) < ctx.S * 0.345) continue;
      const belt = ctx.face !== "U" && ctx.face !== "D";
      const sky = ctx.face === "U" || (belt && y < ctx.horizonY(x) - cs * 0.4);
      const ground = ctx.face === "D" || (belt && y > ctx.horizonY(x) + cs * 0.4);
      if (!sky && !ground) continue;
      const r = cs * 0.34;
      const body = sky
        ? `<path d="M0 ${-r}L${r * 0.3} ${-r * 0.3}L${r} ${-r * 0.2}L${r * 0.45} ${r * 0.25}L${r * 0.6} ${r}L0 ${r * 0.5}L${-r * 0.6} ${r}L${-r * 0.45} ${r * 0.25}L${-r} ${-r * 0.2}L${-r * 0.3} ${-r * 0.3}Z" fill="${kind < 0.5 ? HUES.butter.light : WHITE}" stroke="${ctx.ink}" stroke-width="${r1(h.W.fine)}" stroke-linejoin="round"/>`
        : `<path d="M${-r} ${r * 0.6}Q${-r * 0.4} ${-r * 0.2} ${-r * 0.5} ${-r}M0 ${r * 0.6}Q${r * 0.1} ${-r * 0.4} ${r * 0.4} ${-r * 1.1}M${r * 0.8} ${r * 0.6}Q${r * 0.7} ${-r * 0.1} ${r * 1.1} ${-r * 0.6}" fill="none" stroke="${ctx.ink}" stroke-width="${r1(h.W.fine)}" stroke-linecap="round"/>`;
      out.push({ svg: `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(a * 0.25 - 12)})">${body}</g>`, bbox: [x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8] });
    }
    return out;
  };

  /** Texture inside the hero (spots with a tick) so that hero tiles are not flat fill at 7x7 granularity. */
  const freckles = (ctx, seed, fill, cx, cy) => {
    const rnd = rng(seed), out = [], G = 12, R = ctx.S * 0.3, cs = (R * 1.7) / G, k = ctx.k;
    const tint = shade(fill, 0.8);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const x = ctx.S * cx - R * 0.85 + (i + 0.2 + rnd() * 0.6) * cs, y = ctx.S * cy - R * 0.85 + (j + 0.2 + rnd() * 0.6) * cs, a = rnd() * 360;
      if (Math.hypot(x - ctx.S * cx, y - ctx.S * cy) > R * 0.78 || Math.hypot(x - ctx.S * cx, y - (ctx.S * cy + 8 * k)) < R * 0.28) continue; // keep the face clear
      const r = cs * 0.3;
      out.push({ svg: `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(a)})" fill="${tint}"><ellipse rx="${r1(r)}" ry="${r1(r * 0.55)}"/><circle cx="${r1(r * 1.1)}" cy="${r1(-r * 0.5)}" r="${r1(r * 0.3)}"/></g>`, bbox: [x - r * 2, y - r * 2, r * 4, r * 4] });
    }
    return out;
  };

  const ridge = (ctx) => `<path d="${ctx.horizonPath()}" ${ctx.s.stroke(3 * ctx.k)}/>`;
  const beltFace = (kind, fill, mood, seed) => (ctx) => [...anchors(ctx, seed, 0.5, 0.46), ridge(ctx), hero(ctx, kind, fill, 0.5, 0.46, mood), ...freckles(ctx, seed + 1, fill, 0.5, 0.46)];

  return defineTheme({
    name: "demo", size, belt, cell: 7, step: 4,
    up: { center: [250, 235, 250], band: 0.4, strength: 0.9 },
    down: { center: [190, 220, 170], band: 0.4, strength: 0.7 },
    faces: {
      L: beltFace("sun", HUES.butter.mid, "happy", 11),
      F: beltFace("flower", HUES.pink.light, "happy", 26),
      R: beltFace("cloud", WHITE, "happy", 33),
      B: beltFace("moon", HUES.lilac.light, "sleepy", 44),
      U: (ctx) => [...anchors(ctx, 55, 0.5, 0.5), hero(ctx, "star", HUES.butter.light, 0.5, 0.5), ...freckles(ctx, 56, HUES.butter.light, 0.5, 0.5)],
      D: (ctx) => [...anchors(ctx, 66, 0.5, 0.5), hero(ctx, "flower", HUES.peach.light, 0.5, 0.5), ...freckles(ctx, 67, HUES.peach.light, 0.5, 0.5)],
    },
  });
}

export default demoTheme;
