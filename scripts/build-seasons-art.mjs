/** Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
 * This generator is the editable source of the artwork: art data under CC BY-SA 4.0, not AGPL program code.
 * Four Seasons ("Pastel Four Seasons") proposal: forked from the Pastel Garden generator.
 * Shipped as scripts/build-seasons-art.mjs; `node scripts/build-seasons-art.mjs` rewrites the six whole faces in
 * public/playground-seasons/ (the playground cuts them into stickers at run time). Run
 * `node scripts/build-playground-theme.mjs seasons` afterwards to re-pin them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";


// ---- Style guide ---------------------------------------------------------
// One ink color, three line weights, and six hues with four tones each.
// Flat vector only: no blur filters or gradients, so print output stays predictable.
const ink = "#4a3a38"; // soft brown line work
const W = { outline: 3, fine: 2, body: 6 }; // body = merged outline (half is covered, 3 shows)
const H = {
  butter: { bg: "#fdf1cf", light: "#fff4c2", mid: "#fbe08a", dark: "#f0c45a" },
  peach: { bg: "#fbe0c8", light: "#f8d5b8", mid: "#f6b98c", dark: "#e79c6c" },
  pink: { bg: "#fbdde4", light: "#f9c6d3", mid: "#f4a9bd", dark: "#e8788f" },
  green: { bg: "#e2efd9", light: "#bfe6d4", mid: "#9cc08a", dark: "#6f9f6b" },
  sky: { bg: "#d6ecf5", light: "#c9dcf2", mid: "#a9c1e6", dark: "#8fb0dd", aqua: "#cfeaee", water: "#a9dcdf", waterDk: "#8ccdd3" },
  lilac: { bg: "#ece4f8", light: "#d8ccf2", mid: "#b9a8e2", dark: "#9a86d0" },
};
const white = "#fffaf1";
const twig = "#8a6a4f";
const strokeW = (w = W.outline, c = ink) =>
  `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const stroke = strokeW();
const petals = (cx, cy, r, n, fill, rot = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (360 / n) * i;
    return `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.45}" ry="${r * 0.8}" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join("");
const leafShape = (x, y, rot, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C14-30 46-30 62 0C46 30 14 30 0 0Z" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M4 0H54" ${strokeW(W.fine)}/></g>`;
const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ink}" stroke-width="${W.outline}"/>`;

// merged(): outline all shapes, then fill, so overlapping parts read as one flat body.
const merged = (shapes, fill) =>
  `<g stroke="${ink}" stroke-width="${W.body}" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${fill}">${shapes}</g>`;
// shaded(): merged body plus a two-tone shadow crescent (lower right) and a soft highlight.
// Clip-free (the playground SVG validator allows no clipPath/url()): a shade-colored body is
// covered by a slightly smaller, up-left-shifted copy in the base color, scaled about the
// body center c so it stays inside the silhouette.
const shaded = (shapes, base, shade, hl = "", c = [160, 200], k = 0.9, off = [-5, -5]) =>
  `<g stroke="${ink}" stroke-width="${W.body}" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${shade}">${shapes}</g><g fill="${base}" transform="translate(${(c[0] - k * c[0] + off[0]).toFixed(1)} ${(c[1] - k * c[1] + off[1]).toFixed(1)}) scale(${k})">${shapes}</g>${hl}`;
const shine = (x, y, rx = 12, ry = 7, rot = -35) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".5" transform="rotate(${rot} ${x} ${y})"/>`;

// Faces: shared helpers for expressions.
const eye = (x, y, r = 4.5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${x + 1.5}" cy="${y - 1.5}" r="${r * 0.3}" fill="#fff"/>`;
const sleepyEye = (x, y) => `<path d="M${x - 7} ${y}Q${x} ${y + 7} ${x + 7} ${y}" ${strokeW(2.5)}/>`;
const smile = (x, y, w = 8) => `<path d="M${x - w} ${y}Q${x} ${y + w} ${x + w} ${y}" ${strokeW(2.5)}/>`;
const cheeks = (x, y, gap, c = H.pink.dark) =>
  `<ellipse cx="${x - gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".55"/><ellipse cx="${x + gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".55"/>`;
const happy = (x, y) => eye(x - 17, y) + eye(x + 17, y) + cheeks(x, y + 10, 27) + smile(x, y + 8);
const sleepy = (x, y) => sleepyEye(x - 17, y) + sleepyEye(x + 17, y) + cheeks(x, y + 10, 27) + smile(x, y + 10, 6);

// ---- Scenery and small critters (original, flat vector) -------------------
const g = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const o = `stroke="${ink}" stroke-width="${W.fine}"`;
const butterfly = (x, y, c1, c2, s = 1) =>
  g(x, y, s, `<ellipse cx="-9" cy="-6" rx="10" ry="8" fill="${c1}" ${o} transform="rotate(-25 -9 -6)"/><ellipse cx="9" cy="-6" rx="10" ry="8" fill="${c1}" ${o} transform="rotate(25 9 -6)"/><ellipse cx="-7" cy="7" rx="7" ry="6" fill="${c2}" ${o}/><ellipse cx="7" cy="7" rx="7" ry="6" fill="${c2}" ${o}/><path d="M0 -9V10" ${strokeW(3)}/><path d="M0 -9Q-4 -17 -8 -17M0 -9Q4 -17 8 -17" ${strokeW(W.fine)}/>`);
const bee = (x, y, s = 1) =>
  g(x, y, s, `<ellipse cx="-4" cy="-9" rx="6" ry="4" fill="#fff" ${o} transform="rotate(-25 -4 -9)"/><ellipse cx="5" cy="-9" rx="6" ry="4" fill="#fff" ${o} transform="rotate(25 5 -9)"/><ellipse rx="12" ry="8" fill="${H.butter.mid}" ${o}/><path d="M-3 -7V7M4 -7V7" ${strokeW(2.5)}/><circle cx="-8" cy="-1" r="1.7" fill="${ink}"/>`);
const ladybug = (x, y, s = 1) =>
  g(x, y, s, `<circle r="9" fill="${H.pink.dark}" ${o}/><path d="M-6 -7a8 8 0 0 1 12 0Z" fill="${ink}"/><path d="M0 -7V9" ${strokeW(W.fine)}/><circle cx="-4" cy="1" r="1.8" fill="${ink}"/><circle cx="4" cy="2" r="1.8" fill="${ink}"/>`);
const mushroom = (x, y, s = 1, cap = H.pink.dark) =>
  g(x, y, s, `<path d="M-7 0V-14H7V0Q0 4 -7 0Z" fill="${white}" ${o}/><path d="M-20 -14A20 16 0 0 1 20 -14Z" fill="${cap}" ${o}/><circle cx="-8" cy="-22" r="3" fill="#fff"/><circle cx="6" cy="-26" r="2.5" fill="#fff"/><circle cx="12" cy="-19" r="2" fill="#fff"/>`);
const snail = (x, y, s = 1, shell = H.lilac.mid) =>
  g(x, y, s, `<ellipse cx="2" cy="-5" rx="24" ry="6" fill="${H.peach.light}" ${o}/><path d="M24 -8V-20M29 -8L34 -18" ${strokeW(W.fine)}/><circle cx="-4" cy="-16" r="13" fill="${shell}" ${o}/><path d="M-4 -16a4 4 0 1 1 4 4a8 8 0 1 1-8-8" ${strokeW(W.fine)}/>`);
const bird = (x, y, c, s = 1, flip = 1) =>
  g(x, y, s, `<g transform="scale(${flip} 1)"><path d="M-10 0L-20 -5L-18 4Z" fill="${c}" ${o}/><ellipse rx="12" ry="8.5" fill="${c}" ${o}/><circle cx="9" cy="-6" r="6.5" fill="${c}" ${o}/><path d="M14 -7L21 -4L14 -2Z" fill="${H.peach.dark}" ${o}/><ellipse cx="-2" cy="2" rx="6" ry="4" fill="${H.pink.light}" ${o} opacity=".8"/><circle cx="10" cy="-7" r="1.6" fill="${ink}"/></g>`);
const fish = (x, y, s = 1, c = H.peach.mid) =>
  g(x, y, s, `<path d="M-13 0L-25 -8V8Z" fill="${c}" ${o}/><ellipse rx="15" ry="9" fill="${c}" ${o}/><path d="M-2 -8Q4 -15 8 -8" fill="${H.peach.dark}" ${o}/><circle cx="8" cy="-2" r="2" fill="${ink}"/><path d="M13 3Q10 5 8 4" ${strokeW(W.fine)}/>`);
const dragonfly = (x, y, s = 1) =>
  g(x, y, s, `<ellipse cx="-4" cy="-8" rx="13" ry="4.5" fill="#fff" opacity=".8" ${o} transform="rotate(-18 -4 -8)"/><ellipse cx="-4" cy="6" rx="13" ry="4.5" fill="#fff" opacity=".8" ${o} transform="rotate(18 -4 6)"/><path d="M-14 0H20" ${strokeW(4, H.lilac.dark)}/><circle cx="22" cy="0" r="4" fill="${H.lilac.dark}" ${o}/>`);
const balloon = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-12 24L-8 42M12 24L8 42" ${strokeW(W.fine)}/><rect x="-10" y="42" width="20" height="13" rx="3" fill="${H.peach.mid}" ${o}/><circle r="26" fill="${H.pink.mid}" ${o}/><path d="M0 -26C-14 -10 -14 10 0 26C14 10 14 -10 0 -26Z" fill="${H.butter.mid}" ${o}/>`);
const pine = (x, y, s = 1, c = H.green.mid) =>
  g(x, y, s, `<rect x="-4" y="22" width="8" height="12" fill="${twig}" ${o}/><path d="M0 -52L-16 -24H-8L-22 -2H-10L-26 22H26L10 -2H22L8 -24H16Z" fill="${c}" ${o} stroke-linejoin="round"/>`);
const reeds = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-10 0Q-12 -30 -9 -58M2 0Q4 -34 1 -72M13 0Q16 -26 13 -50" ${strokeW(W.outline, H.green.dark)}/><ellipse cx="-9" cy="-60" rx="4.5" ry="11" fill="${twig}" ${o}/><ellipse cx="1" cy="-74" rx="4.5" ry="11" fill="${twig}" ${o}/><ellipse cx="13" cy="-52" rx="4.5" ry="10" fill="${twig}" ${o}/>`);
const house = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-14 0V-26H14V0Z" fill="${white}" ${o}/><path d="M-30 -26A30 24 0 0 1 30 -26Z" fill="${H.pink.mid}" ${o}/><circle cx="-12" cy="-38" r="3.5" fill="#fff"/><circle cx="10" cy="-42" r="3" fill="#fff"/><rect x="-6" y="-20" width="12" height="12" rx="6" fill="${H.butter.mid}" ${o}/>`);
const plane = (x, y, s = 1) =>
  g(x, y, s, `<path d="M0 0L46 -14L20 12Z" fill="${white}" ${o} stroke-linejoin="round"/><path d="M0 0L20 12L16 2Z" fill="${H.sky.mid}" ${o} stroke-linejoin="round"/>`);
const tulip = (x, y, s = 1, c = H.pink.mid) =>
  g(x, y, s, `<path d="M0 0V-34" ${strokeW(W.outline)}/><path d="M-9 -34C-10 -48 -4 -54 0 -58C4 -54 10 -48 9 -34Q0 -28 -9 -34Z" fill="${c}" ${o}/>`);
const tuft = (x, y, c = H.green.dark) =>
  `<path d="M${x} ${y}q-4-14-10-18M${x} ${y}q0-18 2-24M${x} ${y}q4-14 12-16" ${strokeW(W.outline, c)}/>`;
const star = (x, y, r, c = H.butter.light) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / 5, d = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}`;
  });
  return `<path d="M${pts.join("L")}Z" fill="${c}" stroke="${ink}" stroke-width="${W.fine}" stroke-linejoin="round"/>`;
};
const cloud = (x, y, s = 1, fill = white) =>
  g(x, y, s, `<path transform="translate(-30 -80)" d="M30 80Q14 50 48 48Q58 18 88 36Q118 30 124 58Q148 74 122 82H46Q32 86 30 80Z" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}"/>`);
const hill = (d, fill, line = false) =>
  `<path d="${d}" fill="${fill}"${line ? ` stroke="${ink}" stroke-width="${W.outline}"` : ""}/>`;
const glow = (x, y, r = 4) => `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${H.butter.mid}" opacity=".35"/><circle cx="${x}" cy="${y}" r="${r}" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.fine}"/>`;

// More expressions for personality.
const arcEye = (x, y) => `<path d="M${x - 6} ${y + 3}Q${x} ${y - 6} ${x + 6} ${y + 3}" ${strokeW(2.5)}/>`;
const laugh = (x, y) =>
  `<path d="M${x - 10} ${y}Q${x} ${y + 2} ${x + 10} ${y}Q${x} ${y + 18} ${x - 10} ${y}Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
const oMouth = (x, y) => `<ellipse cx="${x}" cy="${y + 4}" rx="4.5" ry="6" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2.5"/>`;
const sparkleEye = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="6.5" fill="${ink}"/><circle cx="${x + 2}" cy="${y - 2.5}" r="2.4" fill="#fff"/><circle cx="${x - 2}" cy="${y + 2}" r="1.2" fill="#fff"/>`;
const bubble = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".6" stroke="${ink}" stroke-width="${W.fine}"/><path d="M${x - r * 0.55} ${y - r * 0.1}a${r * 0.55} ${r * 0.55} 0 0 1 ${r * 0.45} -${r * 0.45}" ${strokeW(1.5, "#fff")}/>`;
const arm = (x, y, rot, rx = 11, ry = 18) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})"/>`;
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const bloom = (x, y, r, c, cc = H.butter.mid, n = 5) =>
  g(x, y, 1, Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `<circle cx="${(Math.cos(a) * r * 0.8).toFixed(1)}" cy="${(Math.sin(a) * r * 0.8).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${c}" ${o}/>`;
  }).join("") + `<circle r="${(r * 0.45).toFixed(1)}" fill="${cc}" ${o}/>`);
const sparkles = (pts, c = H.butter.light) => pts.map(([x, y, r]) => star(x, y, r, c)).join("");
const cloudPath = "M30 80Q14 50 48 48Q58 18 88 36Q118 30 124 58Q148 74 122 82H46Q32 86 30 80Z";
const cloudFar = (x, y, s, fill = "#ffffff") =>
  `<path transform="translate(${x} ${y}) scale(${s}) translate(-30 -80)" d="${cloudPath}" fill="${fill}" opacity=".55"/>`;
const cloudShaded = (x, y, s, base = white, shade = H.lilac.bg) =>
  shaded(`<path transform="translate(${x} ${y}) scale(${s}) translate(-30 -80)" d="${cloudPath}"/>`, base, shade, shine(x + 28 * s, y - 46 * s, 14 * s, 7 * s), [x + 51 * s, y - 28 * s]);
const moonShaded = (x, y, s) =>
  shaded(`<path transform="translate(${x} ${y}) scale(${s}) translate(-215 -45)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z"/>`, H.butter.light, H.butter.mid, shine(x - 22 * s, y + 20 * s, 9 * s, 5 * s), [x + 2 * s, y + 38 * s]);
const sunShaded = (x, y, r) =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 12;
    return `<path d="M${(x + Math.cos(a) * (r + 12)).toFixed(1)} ${(y + Math.sin(a) * (r + 12)).toFixed(1)}L${(x + Math.cos(a) * (r + 30)).toFixed(1)} ${(y + Math.sin(a) * (r + 30)).toFixed(1)}" ${strokeW(5, H.butter.mid)}/>`;
  }).join("") + `<circle cx="${x}" cy="${y}" r="${r + 10}" fill="${H.butter.light}" opacity=".6"/>` + shaded(`<circle cx="${x}" cy="${y}" r="${r}"/>`, H.butter.mid, H.butter.dark, shine(x - r * 0.4, y - r * 0.4, r * 0.35, r * 0.2), [x, y]);
// Small faces for sky characters: moods are "happy", "sleepy" and "wink".
const miniFace = (x, y, mood = "happy", gap = 11) =>
  (mood === "sleepy" ? sleepyEye(x - gap, y) + sleepyEye(x + gap, y) : mood === "wink" ? eye(x - gap, y, 3.4) + arcEye(x + gap, y) : eye(x - gap, y, 3.4) + eye(x + gap, y, 3.4)) +
  cheeks(x, y + 7, gap + 7, H.pink.dark) + smile(x, y + 5, 5);
const root = fileURLToPath(new URL("../public/playground-seasons/", import.meta.url));
// ====================================================================================
// FOUR SEASONS round 3: one 1280-px panorama (L F R B, wrapping B -> L). Sky strips, hills and the
// path are shared by every variant, so the top/bottom rows of the side faces (and therefore the
// Up/Down edges) never change; only the scenes on top differ.
// ====================================================================================
const P = 1280, STEP = 8;
const wrap = (x) => ((x % P) + P) % P;
const hexA = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const smooth = (t) => t * t * (3 - 2 * t);
const ramp = (tbl) => (gx) => {
  const f = wrap(gx) / 160, i = Math.floor(f) % 8, t = smooth(f - Math.floor(f));
  const a = hexA(tbl[i]), b = hexA(tbl[(i + 1) % 8]);
  return toHex(a.map((v, k) => v + (b[k] - v) * t));
};
// anchors every 160 px: 0 thaw seam B|L, 1 spring, 2 L|F, 3 summer, 4 F|R, 5 autumn, 6 R|B, 7 winter
const skyTopC = ramp(["#e6e4f6", "#d6ecfa", "#cce9f8", "#bfe3f7", "#d6e5f1", "#fadfd0", "#ead9ee", "#cdd6f2"]);
const skyHorC = ramp(["#fde6ea", "#fdeee8", "#f6f5e4", "#f0f9ef", "#fbf0d6", "#fdeec4", "#fbe4d2", "#eae6f8"]);
const farC = ramp(["#e2eee4", "#cdeab6", "#bfe5ae", "#b1e0a2", "#cfe0a0", "#f0d890", "#f0e2c8", "#fbfdff"]);
const midC = ramp(["#cde6c2", "#a9d79a", "#98cf8b", "#86c382", "#bfcd7c", "#e8b86a", "#ecd0b0", "#d3e3f6"]);
const hedgeC = ramp(["#b8dcc4", "#9fd18d", "#8cca85", "#78b87a", "#b3c070", "#e7a85c", "#d9b996", "#7fb3ab"]);
const pathC = ramp(["#f3e9dd", "#f8d5b8", "#f5d2b0", "#f2cfa6", "#f6d7a8", "#f6d8b6", "#f7e6d8", "#fbfdff"]);
const SKY_ROWS = 12, ROW_H = 20;
const skyCell = (gx, r) => mix(skyTopC(gx), skyHorC(gx), smooth((r + 0.5) / SKY_ROWS));
const q = (gx) => Math.floor(wrap(gx) / STEP) * STEP + STEP / 2;
const edgeSky = (gx) => skyCell(q(gx), 0);
const edgeMid = (gx) => midC(q(gx));
const W4 = (gx) => [0, 1, 2, 3].map((k) => {
  let d = Math.abs(wrap(gx) - (160 + 320 * k)); d = Math.min(d, P - d);
  return d >= 320 ? 0 : Math.cos((Math.PI * d) / 640) ** 2;
});
const thawW = (gx) => { let d = Math.abs(wrap(gx)); d = Math.min(d, P - d); return d >= 190 ? 0 : Math.cos((Math.PI * d) / 380) ** 2; };
const sin = Math.sin, TAU = Math.PI * 2;
const farY = (x) => 226 + 9 * sin((TAU * x) / 640 + 0.8) + 5 * sin((TAU * x) / 256 + 2.0);
const midY = (x) => 262 + 8 * sin((TAU * 3 * x) / P + 1.2) + 4 * sin((TAU * 7 * x) / P + 0.3);
const pathY = (x) => 300 + 3.5 * sin((TAU * 2 * x) / P + 2.4) + 2.5 * sin((TAU * 6 * x) / P);

const layers = {};
const order = ["sky", "skydeco", "far", "hedge", "mid", "path", "water", "decor", "tree", "chars", "fg"];
const resetLayers = () => order.forEach((n) => (layers[n] = []));
const put = (layer, x0, x1, markup) => layers[layer].push({ x0, x1, markup });
const OFF = { L: 0, F: 320, R: 640, B: 960 };
const putLocal = (face, layer, lx0, lx1, markup) => { const off = OFF[face]; put(layer, off + lx0, off + lx1, `<g transform="translate(${off} 0)">${markup}</g>`); };
const putAt = (face, layer, lx, w, markup) => putLocal(face, layer, lx - w, lx + w, markup);
const renderSide = (face) => {
  const off = OFF[face];
  let out = "";
  for (const n of order)
    for (const s of [-P, 0, P]) {
      const parts = layers[n].filter((it) => it.x1 + s > off - 2 && it.x0 + s < off + 322).map((it) => it.markup);
      if (parts.length) out += `<g transform="translate(${s - off} 0)">${parts.join("")}</g>`;
    }
  return `<rect width="320" height="320" fill="${H.sky.bg}"/>` + out;
};
const f1 = (n) => n.toFixed(1);
const gy = (f, lx, d = 28) => midY(OFF[f] + lx) + d; // standing height of characters on a face

const baseStrips = () => {
  for (let x = 0; x < P; x += STEP) {
    let m = "";
    for (let r = 0; r < SKY_ROWS; r++) m += `<rect x="${x}" y="${r * ROW_H}" width="${STEP + 1}" height="${ROW_H + 1}" fill="${skyCell(x + STEP / 2, r)}"/>`;
    put("sky", x, x + STEP + 1, m);
    const hill = (yf, cf) => `<path d="M${x} ${f1(yf(x))}L${x + STEP + 1} ${f1(yf(x + STEP + 1))}V321H${x}Z" fill="${cf(x + STEP / 2)}"/>`;
    put("far", x, x + STEP + 1, hill(farY, farC));
    put("mid", x, x + STEP + 1, hill(midY, midC));
  }
  const poly = (yf, x0, x1, st = 6) => Array.from({ length: Math.ceil((x1 - x0) / st) + 1 }, (_, i) => `${i ? "L" : "M"}${f1(x0 + i * st)} ${f1(yf(x0 + i * st))}`).join("");
  put("mid", -20, P + 20, `<path d="${poly(midY, -20, P + 20)}" ${strokeW(W.outline)}/>`);
  put("path", -20, P + 20, `<path d="${poly(pathY, -20, P + 20)}" fill="none" stroke="${ink}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (let x = -20; x < P + 20; x += 10)
    put("path", x, x + 12, `<path d="M${x} ${f1(pathY(x))}L${x + 11} ${f1(pathY(x + 11))}" stroke="${pathC(x + 5)}" stroke-width="14" stroke-linecap="round"/>`);
};

// ---- Shared small props -------------------------------------------------------------
const petal = (x, y, rot, s = 1, c = H.pink.light) => `<ellipse cx="${x}" cy="${y}" rx="${f1(5 * s)}" ry="${f1(3 * s)}" fill="${c}" ${o} transform="rotate(${rot} ${x} ${y})"/>`;
const leafSmall = (x, y, rot, s, c) => g(x, y, s, `<g transform="rotate(${rot})"><path d="M-9 0C-4-9 6-9 10 0C6 9-4 9-9 0Z" fill="${c}" ${o}/><path d="M-9 0H8" ${strokeW(1.5)}/></g>`);
const flake = (x, y, s = 1) => `<path d="${[0, 60, 120].map((a) => { const dx = Math.cos((a * Math.PI) / 180) * 7 * s, dy = Math.sin((a * Math.PI) / 180) * 7 * s; return `M${f1(x - dx)} ${f1(y - dy)}L${f1(x + dx)} ${f1(y + dy)}`; }).join("")}" ${strokeW(2, H.sky.dark)}/><circle cx="${x}" cy="${y}" r="${f1(2 * s)}" fill="#fff"/>`;
const localX = (x) => wrap(x) % 320;
const roulette = (w, r) => { const s = w.reduce((a, b) => a + b, 0); let t = r * s; for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return i; } return w.length - 1; };
const ptumpkin = (x, y, s) => g(x, y, s, `<path d="M0 -14Q2 -22 7 -23" ${strokeW(2.5, twig)}/><ellipse cx="-8" rx="9" ry="12" cy="-6" fill="${H.peach.mid}" ${o}/><ellipse cx="8" rx="9" ry="12" cy="-6" fill="${H.peach.mid}" ${o}/><ellipse rx="9" ry="13" cy="-6" fill="${H.peach.dark}" ${o}/>`);
const mound = (x, y, s) => g(x, y, s, `<path d="M-22 0Q-18 -16 0 -17Q18 -16 22 0Z" fill="#fff" ${o}/><path d="M-12 -6Q-6 -11 2 -11" ${strokeW(1.5, H.sky.mid)}/>`);
const crocus = (x, y, s, c) => g(x, y, s, `<path d="M0 0V-10M-3 0Q-6 -9 -8 -14M3 0Q6 -9 8 -14" ${strokeW(2, H.green.dark)}/><path d="M-6 -10C-8 -20 -2 -24 0 -26C2 -24 8 -20 6 -10Q0 -6 -6 -10Z" fill="${c}" ${o}/>`);
const crocusSnow = (x, y, s, c) => crocus(x, y, s, c) + `<path d="M${x - 14 * s} ${y + 1}Q${x} ${y - 6 * s} ${x + 14 * s} ${y + 1}Z" fill="#fff" ${o}/>`;
const daisy = (x, y, s) => g(x, y, s, `<path d="M0 0V-14" ${strokeW(2, H.green.dark)}/>` + petals(0, -18, 5, 7, "#fff") + `<circle cy="-18" r="3.5" fill="${H.butter.mid}" ${o}/>`);
const cl = (x, y, s, mood) => cloudShaded(x, y, s) + (mood ? miniFace(x + 53 * s, y - 20 * s, mood, 8 * s + 3) : "");

// ---- shared background: hedge row, drifters, decor (variant controls what is blocked) ----
const addBackground = (blocksSky, blocksGround) => {
  const r = rng(41);
  for (let i = 0; i < 16; i++) {
    const x = i * 80, sz = 0.8 + r() * 0.5, y = farY(x) + 8;
    const col = hedgeC(x), w = W4(x), th = thawW(x);
    let m = shaded(g(x, y, sz, `<circle cx="-22" cy="6" r="18"/><circle cx="4" cy="-8" r="25"/><circle cx="28" cy="6" r="18"/><ellipse cx="4" cy="16" rx="42" ry="10"/>`), col, mix(col, ink, 0.18), "", [x, y]);
    r();
    const dots = [[-18, -4], [8, -20], [26, -2], [-2, 4], [16, -8]];
    const pick = w[0] > 0.45 ? [H.pink.light, "#fff"] : w[1] > 0.45 ? [H.butter.mid, "#fff"] : w[2] > 0.45 ? [H.pink.dark, H.peach.dark] : null;
    if (pick) dots.forEach(([dx, dy], k) => (m += `<circle cx="${f1(x + dx * sz)}" cy="${f1(y + dy * sz)}" r="${f1(3.2 * sz)}" fill="${pick[k % 2]}" ${o}/>`));
    const snow = Math.max(0, w[3] * 1.15 - 0.1) * (1 - 0.7 * th);
    if (snow > 0.3) m += `<ellipse cx="${f1(x + 2 * sz)}" cy="${f1(y - 27 * sz)}" rx="${f1(17 * sz)}" ry="${f1(7 * sz)}" fill="#fff" ${o}/><ellipse cx="${f1(x - 24 * sz)}" cy="${f1(y - 8 * sz)}" rx="${f1(9 * sz)}" ry="${f1(4.5 * sz)}" fill="#fff" ${o}/><ellipse cx="${f1(x + 30 * sz)}" cy="${f1(y - 8 * sz)}" rx="${f1(9 * sz)}" ry="${f1(4.5 * sz)}" fill="#fff" ${o}/>`;
    put("hedge", x - 60, x + 60, m);
  }
  const rd = rng(7);
  for (let x = 20; x < P; x += 58) {
    const px = x + (rd() - 0.5) * 24, py = 22 + rd() * 170, k = roulette(W4(px), rd()), rot = rd() * 180, tint = rd();
    if (blocksSky(localX(px), py, wrap(px))) continue;
    const m = k === 0 ? petal(px, py, rot, 1.1, tint > 0.5 ? H.pink.light : "#fff") + petal(px + 12, py + 10, rot + 70, 0.9, H.pink.mid)
      : k === 1 ? (tint > 0.4 ? butterfly(px, py, [H.pink.mid, H.sky.mid, H.lilac.mid][Math.floor(tint * 3) % 3], H.butter.light, 0.8) : dragonfly(px, py, 0.7))
      : k === 2 ? leafSmall(px, py, rot, 1.2, [H.peach.mid, H.butter.dark, H.pink.dark][Math.floor(tint * 3) % 3]) + leafSmall(px + 14, py + 14, rot + 50, 0.9, H.peach.dark)
      : flake(px, py, 1.3) + flake(px + 14, py + 12, 0.8);
    put("skydeco", px - 30, px + 30, m);
  }
  put("skydeco", 200, 440, `<g fill="none">${["pink", "butter", "green", "sky"].map((k, i) => `<path d="M${320 - 100 + i * 9} 232A${100 - i * 9} ${100 - i * 9} 0 0 1 ${320 + 100 - i * 9} 232" stroke="${H[k].mid}" stroke-width="9"/>`).join("")}</g>`);
  [[0, 96, 0.78], [640, 84, 0.86], [960, 112, 0.8], [320, 148, 0.7]].forEach(([x, y, s]) => put("skydeco", x - 90, x + 90, cloudShaded(x - 59 * s, y, s)));
  ["L", "F", "R", "B"].forEach((f, i) => putLocal(f, "skydeco", 20, 170, cloudShaded(60, 74, 0.78) + miniFace(106, 58, ["happy", "wink", "happy", "sleepy"][i], 9)));
  const rg = rng(23);
  for (let x = 6; x < P; x += 17) {
    const px = x + rg() * 10, py = midY(px) + 10 + rg() * (308 - midY(px) - 10);
    const w = W4(px), th = thawW(px), ww = [...w, th * 1.5];
    if (rg() > 0.45 || blocksGround(localX(px), py, wrap(px)) || localX(px) < 10 || localX(px) > 310 || py > 312) { rg(); continue; }
    const k = roulette(ww, rg()), pk = Math.max(0.55, Math.min(1.1, ww[k] + 0.35)), tint = rg();
    let m;
    if (k === 0) m = tint > 0.5 ? bloom(px, py, 7 * pk, [H.pink.mid, "#fff", H.lilac.mid][Math.floor(tint * 5) % 3]) : tulip(px, py, 0.5 * pk, [H.pink.mid, H.butter.mid, H.lilac.mid][Math.floor(tint * 7) % 3]);
    else if (k === 1) m = tint > 0.35 ? daisy(px, py, pk) : tuft(px, py, H.green.dark);
    else if (k === 2) m = tint > 0.55 ? ptumpkin(px, py, 0.9 * pk) : tint > 0.25 ? mushroom(px, py, 0.7 * pk, H.pink.dark) : leafSmall(px, py - 4, tint * 300, 1.3, tint > 0.12 ? H.peach.mid : H.butter.dark);
    else if (k === 3) m = tint > 0.3 ? mound(px, py, pk * 0.9) : flake(px, py - 10, 1);
    else m = crocusSnow(px, py, pk, [H.lilac.mid, H.butter.mid, "#fff"][Math.floor(tint * 3) % 3]);
    put("decor", px - 30, px + 30, m);
  }
};

// ---- new original characters and scenery (feet at the origin, facing right) --------------
const cream = "#fff1d9";
const feetXY = (a) => a.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="4.5"/>`).join("");
// Fluff the lamb: cloud-wool body, flower crown
const lamb = () => {
  const wool = `<circle cx="-20" cy="-36" r="18"/><circle cx="-2" cy="-48" r="21"/><circle cx="18" cy="-38" r="18"/><circle cx="-8" cy="-26" r="20"/><circle cx="12" cy="-24" r="17"/>`;
  return merged(`<ellipse cx="-12" cy="-7" rx="6.5" ry="11"/><ellipse cx="16" cy="-7" rx="6.5" ry="11"/>`, H.peach.mid) +
    shaded(wool, "#fffaf1", H.lilac.light, "", [0, -36], 0.9, [-3, -3]) +
    merged(`<ellipse cx="22" cy="-36" rx="9" ry="5" transform="rotate(40 22 -36)"/>`, H.peach.mid) +
    merged(`<ellipse cx="34" cy="-40" rx="17" ry="15"/>`, H.peach.light) +
    eye(31, -43, 3.6) + eye(43, -43, 3.6) + `<ellipse cx="49" cy="-37" rx="3.4" ry="2.6" fill="${H.pink.dark}"/>` +
    `<ellipse cx="27" cy="-34" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/>` + `<path d="M38 -33Q42 -28 47 -32" ${strokeW(2)}/>` +
    bloom(24, -57, 4.5, H.pink.mid) + bloom(34, -61, 4, "#fff") + bloom(44, -57, 4.5, H.butter.mid);
};
const chick = () => `<path d="M-5 -2V-8M5 -2V-8" ${strokeW(2, H.peach.dark)}/><circle cy="-16" r="13" fill="${H.butter.mid}" ${o}/><path d="M-3 -29Q0 -36 3 -29M2 -30Q7 -34 7 -28" ${strokeW(2)}/><ellipse cx="-6" cy="-13" rx="5" ry="7" fill="${H.butter.dark}" ${o}/><path d="M11 -18L19 -15L11 -12Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/><circle cx="6" cy="-20" r="2.2" fill="${ink}"/><ellipse cx="6" cy="-12" rx="3.6" ry="2.4" fill="${H.pink.dark}" opacity=".5"/>`;
// Quack the duck: swim ring, happy
const duck = (ring = true, big = true) => {
  let out = merged(`<ellipse cx="0" cy="-12" rx="26" ry="16"/><path d="M-22 -16L-36 -28L-26 -6Z"/><circle cx="20" cy="-34" r="13"/>`, "#fff4c2");
  out += `<ellipse cx="-4" cy="-15" rx="12" ry="8" fill="${H.butter.mid}" ${o} transform="rotate(-12 -4 -15)"/>`;
  out += `<ellipse cx="34" cy="-31" rx="9" ry="5" fill="${H.peach.dark}" ${o}/><path d="M26 -30H42" ${strokeW(1.5)}/>`;
  out += eye(22, -38, big ? 3.8 : 3) + `<ellipse cx="16" cy="-30" rx="4" ry="2.6" fill="${H.pink.dark}" opacity=".5"/>`;
  if (ring) out += `<ellipse cx="0" cy="-5" rx="29" ry="10" fill="none" stroke="${ink}" stroke-width="11"/><ellipse cx="0" cy="-5" rx="29" ry="10" fill="none" stroke="${H.pink.mid}" stroke-width="6"/>` + [[-24, -2], [0, 5], [24, -2]].map(([x, y]) => `<path d="M${x - 5} ${y}h10" ${strokeW(4, "#fff")}/>`).join("");
  return out;
};
// Russet the fox kid, jumping up out of a leaf pile
const fox = () => {
  const c = H.peach.dark, tip = twig;
  let out = merged(`<ellipse cx="-46" cy="-30" rx="28" ry="13" transform="rotate(-28 -46 -30)"/>`, c) + `<ellipse cx="-68" cy="-44" rx="10" ry="8" fill="${white}" ${o} transform="rotate(-28 -68 -44)"/>`;
  out += merged(`<ellipse cx="0" cy="-34" rx="26" ry="26"/>`, c) + `<ellipse cx="4" cy="-30" rx="15" ry="19" fill="${cream}"/>`;
  out += merged(arm(-30, -56, -40, 8, 16) + arm(34, -58, 40, 8, 16), c) + `<ellipse cx="-39" cy="-72" rx="6" ry="6" fill="${cream}"/><ellipse cx="43" cy="-74" rx="6" ry="6" fill="${cream}"/>`;
  out += merged(`<ellipse cx="2" cy="-78" rx="27" ry="22"/><path d="M-22 -90L-28 -116L-6 -98Z"/><path d="M26 -90L32 -116L10 -98Z"/>`, c);
  out += `<path d="M-23 -108L-27 -116L-12 -105ZM27 -108L31 -116L16 -105Z" fill="${tip}"/>`;
  out += `<path d="M-24 -74Q2 -54 28 -74Q22 -60 2 -58Q-18 -60 -24 -74Z" fill="${cream}"/>`;
  out += arcEye(-8, -82) + arcEye(14, -82) + `<ellipse cx="3" cy="-72" rx="4.5" ry="3.4" fill="${ink}"/>` + laugh(3, -66);
  out += `<ellipse cx="-16" cy="-72" rx="5" ry="3.4" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="22" cy="-72" rx="5" ry="3.4" fill="${H.pink.dark}" opacity=".5"/>`;
  return out + leafSmall(8, -102, -30, 1.4, H.pink.dark) + leafSmall(-52, -88, 40, 1.5, H.butter.dark) + leafSmall(58, -92, -20, 1.4, H.peach.mid);
};
const leafPile = () => {
  const r = rng(5), cols = [H.peach.mid, H.pink.dark, H.butter.dark, H.peach.dark, H.butter.mid];
  let out = `<path d="M-92 2Q-80 -34 -40 -44Q0 -62 40 -44Q82 -34 92 2Z" fill="${H.butter.dark}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
  for (let i = 0; i < 18; i++) {
    const x = -80 + r() * 160, y = -4 - r() * 44 * Math.max(0.15, 1 - Math.abs(x) / 100);
    out += leafSmall(x, y, r() * 360, 1.5 + r() * 0.5, cols[i % 5]);
  }
  return out;
};
const scarecrow = () => `<path d="M0 0V-104" ${strokeW(6, ink)}/><path d="M0 0V-104" ${strokeW(3, twig)}/><path d="M-44 -70H44" ${strokeW(6, ink)}/><path d="M-44 -70H44" ${strokeW(3, twig)}/>` +
  `<path d="M-48 -70l-9 -5M-48 -70l-10 3M-48 -70l-8 9M48 -70l9 -5M48 -70l10 3M48 -70l8 9" ${strokeW(2.5, H.butter.dark)}/>` +
  `<path d="M-24 -78L24 -78L18 -34H-18Z" fill="${H.pink.light}" ${o} stroke-linejoin="round"/><rect x="-10" y="-62" width="12" height="12" fill="${H.sky.light}" ${o}/><path d="M-10 -56h12M-4 -62v12" ${strokeW(1.2)}/><path d="M-18 -34L-22 -14M18 -34L22 -14" ${strokeW(5, H.sky.mid)}/>` +
  `<circle cy="-92" r="16" fill="${H.butter.light}" ${o}/>${eye(-6, -94, 2.8)}${eye(6, -94, 2.8)}<path d="M-6 -86Q0 -80 6 -86" ${strokeW(2)}/><path d="M-5 -85v3M0 -83v3M5 -85v3" ${strokeW(1.2)}/>` + `<ellipse cx="-10" cy="-88" rx="3.5" ry="2.4" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="10" cy="-88" rx="3.5" ry="2.4" fill="${H.pink.dark}" opacity=".5"/>` +
  `<ellipse cy="-103" rx="26" ry="5" fill="${H.peach.mid}" ${o}/><path d="M-14 -104Q0 -128 14 -104Z" fill="${H.peach.mid}" ${o}/><path d="M-14 -108H14" ${strokeW(4, H.pink.dark)}/>`;
// Skater the penguin kid
const penguin = () => {
  const navy = H.lilac.dark;
  let out = `<path d="M-14 3h22M8 -3h20" ${strokeW(3, H.sky.dark)}/><ellipse cx="-4" cy="-1" rx="9" ry="4.5" fill="${H.peach.dark}" ${o}/><ellipse cx="20" cy="-6" rx="9" ry="4.5" fill="${H.peach.dark}" ${o} transform="rotate(-15 20 -6)"/>`;
  out += merged(`<ellipse cx="0" cy="-40" rx="24" ry="32"/>` + arm(-26, -40, 50, 7.5, 16) + arm(26, -44, -55, 7.5, 16), navy);
  out += `<ellipse cx="3" cy="-34" rx="16" ry="23" fill="#fff" ${o}/>`;
  out += `<path d="M-14 -56Q4 -46 22 -57" ${strokeW(11, ink)}/><path d="M-14 -56Q4 -46 22 -57" ${strokeW(7, H.pink.dark)}/><path d="M-16 -54l-10 14" ${strokeW(11, ink)}/><path d="M-16 -54l-10 14" ${strokeW(7, H.pink.dark)}/>`;
  out += eye(-6, -63, 3.8) + eye(12, -63, 3.8) + `<path d="M0 -57L9 -55L0 -51Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/>` + `<ellipse cx="-12" cy="-55" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".6"/><ellipse cx="17" cy="-55" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".6"/>`;
  out += `<path d="M-14 -72C-14 -92 18 -92 18 -72Z" fill="${H.sky.mid}" ${o}/><path d="M-16 -73H20" ${strokeW(5, "#fff")}/><circle cx="2" cy="-91" r="6" fill="#fff" ${o}/>`;
  return out;
};
const cottage = () => `<rect x="30" y="-96" width="14" height="30" fill="${H.peach.light}" ${o}/><ellipse cx="37" cy="-98" rx="10" ry="4" fill="#fff" ${o}/><circle cx="40" cy="-112" r="5" fill="#fff" opacity=".8" ${o}/><circle cx="48" cy="-124" r="7" fill="#fff" opacity=".8" ${o}/>` +
  `<path d="M-40 0V-42H40V0Z" fill="${H.pink.light}" ${o} stroke-linejoin="round"/><path d="M-50 -40L0 -84L50 -40Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>` +
  `<path d="M-46 -41L0 -80L46 -41L40 -40Q30 -50 20 -42Q10 -54 0 -46Q-12 -56 -20 -44Q-32 -52 -40 -40Z" fill="#fff" ${o} stroke-linejoin="round"/>` +
  `<path d="M-30 0V-24Q-30 -32 -22 -32Q-14 -32 -14 -24V0Z" fill="${twig}" ${o}/><rect x="6" y="-30" width="22" height="18" rx="3" fill="${H.butter.mid}" ${o}/><path d="M17 -30V-12M6 -21H28" ${strokeW(2)}/>`;
const fir = (s = 1) => g(0, 0, s, `<rect x="-5" y="-6" width="10" height="12" fill="${twig}" ${o}/><path d="M0 -92L-24 -50H-14L-32 -20H-18L-38 6H38L18 -20H32L14 -50H24Z" fill="#6aa89a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M0 -92L-10 -72Q0 -68 10 -72ZM-24 -50L-12 -40Q-2 -48 14 -42L24 -50Q0 -60 -24 -50ZM-32 -20L-20 -10Q-4 -16 12 -10L32 -20Q0 -30 -32 -20Z" fill="#fff" ${o} stroke-linejoin="round"/>`);
const snowman = () => merged(`<circle cy="-22" r="26"/><circle cy="-62" r="20"/><circle cy="-92" r="15"/>`, "#fff") +
  `<path d="M-36 -64L-62 -84M-62 -84l-8 -6M-62 -84l-2 -10" ${strokeW(3, twig)}/><path d="M36 -64L60 -78M60 -78l8 -2M60 -78l0 -10" ${strokeW(3, twig)}/>` +
  eye(-6, -95, 2.6) + eye(6, -95, 2.6) + `<path d="M0 -90L16 -87L0 -84Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/>` + `<path d="M-6 -82q6 5 12 0" ${strokeW(1.8)}/>` + `<ellipse cx="-11" cy="-88" rx="3.4" ry="2.4" fill="${H.pink.dark}" opacity=".6"/><ellipse cx="11" cy="-88" rx="3.4" ry="2.4" fill="${H.pink.dark}" opacity=".6"/>` +
  `<path d="M-16 -78Q0 -70 16 -78" ${strokeW(9, ink)}/><path d="M-16 -78Q0 -70 16 -78" ${strokeW(5.5, H.pink.mid)}/><path d="M10 -75l6 18" ${strokeW(9, ink)}/><path d="M10 -75l6 18" ${strokeW(5.5, H.pink.mid)}/>` +
  `<path d="M-14 -102C-14 -126 14 -126 14 -102Z" fill="${H.sky.mid}" ${o}/><path d="M-17 -104H17" ${strokeW(5, "#fff")}/><circle cy="-126" r="6" fill="${H.pink.light}" ${o}/>` + [[0, -66], [0, -56], [0, -24], [0, -12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${ink}"/>`).join("");
const sled = () => `<path d="M-30 4H26Q36 4 36 -6" ${strokeW(4, ink)}/><path d="M-26 -8V4M10 -8V4" ${strokeW(3, ink)}/><rect x="-30" y="-14" width="56" height="9" rx="3" fill="${H.peach.mid}" ${o}/><rect x="-14" y="-34" width="22" height="20" rx="3" fill="${H.lilac.mid}" ${o}/><path d="M-3 -34V-14M-14 -24H8" ${strokeW(3, H.pink.light)}/><path d="M-3 -34Q-12 -44 -6 -42M-3 -34Q6 -44 0 -42" ${strokeW(2.5, H.pink.light)}/>`;
// Bun the bunny kid with an egg basket
const bunny = () => {
  const fur = "#fffaf1";
  let out = merged(`<ellipse cx="-4" cy="-30" rx="23" ry="26"/><ellipse cx="-14" cy="-4" rx="11" ry="6"/><ellipse cx="14" cy="-4" rx="11" ry="6"/><circle cx="-26" cy="-22" r="8"/>`, fur);
  out += merged(`<ellipse cx="-8" cy="-100" rx="7" ry="22" transform="rotate(-10 -8 -100)"/><ellipse cx="14" cy="-100" rx="7" ry="22" transform="rotate(12 14 -100)"/><circle cx="2" cy="-66" r="21"/>`, fur);
  out += `<ellipse cx="-8" cy="-100" rx="3.4" ry="15" fill="${H.pink.light}" transform="rotate(-10 -8 -100)"/><ellipse cx="14" cy="-100" rx="3.4" ry="15" fill="${H.pink.light}" transform="rotate(12 14 -100)"/>`;
  out += eye(-5, -69, 3.8) + eye(11, -69, 3.8) + `<ellipse cx="3" cy="-62" rx="3.4" ry="2.5" fill="${H.pink.dark}"/><path d="M3 -60v3M-3 -56Q3 -51 9 -56" ${strokeW(2)}/>` + `<ellipse cx="-12" cy="-61" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="18" cy="-61" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/>`;
  out += g(22, -24, 1, `<path d="M-16 -4Q0 -30 16 -4" ${strokeW(2.5)}/><path d="M-18 -6H18L14 14H-14Z" fill="${H.peach.mid}" ${o} stroke-linejoin="round"/><ellipse cx="-6" cy="-8" rx="5" ry="6.5" fill="${H.pink.mid}" ${o}/><ellipse cx="5" cy="-9" rx="5" ry="6.5" fill="${H.sky.mid}" ${o}/><path d="M-12 4H12" ${strokeW(1.6, H.peach.dark)}/>`) + merged(arm(10, -26, 40, 6, 9), fur);
  return out;
};
const sunflower = (h, s = 1, face = true) => g(0, 0, s, `<path d="M0 0V${-h}" ${strokeW(9, ink)}/><path d="M0 0V${-h}" ${strokeW(5, H.green.dark)}/>` + leafShape(0, -h * 0.35, -35, 0.5).replace(/#9cc08a/, H.green.mid) + leafShape(0, -h * 0.5, 215, 0.45) +
  petals(0, -h, 26, 12, H.butter.mid) + `<circle cy="${-h}" r="17" fill="#c98a5a" ${o}/>` + (face ? eye(-6, -h - 3, 2.8) + eye(6, -h - 3, 2.8) + `<path d="M-5 ${-h + 5}Q0 ${-h + 10} 5 ${-h + 5}" ${strokeW(2)}/>` + `<ellipse cx="-11" cy="${-h + 3}" rx="3.2" ry="2.2" fill="${H.pink.dark}" opacity=".6"/><ellipse cx="11" cy="${-h + 3}" rx="3.2" ry="2.2" fill="${H.pink.dark}" opacity=".6"/>` : `<circle cy="${-h}" r="8" fill="${H.peach.dark}"/>`));
const beeKid = () => `<ellipse cx="-12" cy="-30" rx="12" ry="7" fill="#fff" ${o} transform="rotate(-30 -12 -30)"/><ellipse cx="10" cy="-30" rx="12" ry="7" fill="#fff" ${o} transform="rotate(30 10 -30)"/>` +
  `<path d="M-6 -42Q-10 -52 -16 -50M6 -42Q10 -52 16 -50" ${strokeW(2.5)}/>` + merged(`<ellipse cx="0" cy="-14" rx="26" ry="22"/>`, H.butter.mid) + `<path d="M-10 -34V6M4 -35V7" ${strokeW(6, H.peach.dark)}/>` +
  eye(-8, -20, 3.8) + eye(10, -20, 3.8) + `<path d="M-2 -12Q3 -6 8 -12" ${strokeW(2.2)}/><ellipse cx="-15" cy="-13" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="17" cy="-13" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/>` +
  g(30, -4, 1, `<path d="M-9 -12H9L12 10Q0 16 -12 10Z" fill="${H.peach.mid}" ${o} stroke-linejoin="round"/><rect x="-10" y="-17" width="20" height="6" rx="2" fill="${twig}" ${o}/><path d="M-6 -2H6" ${strokeW(2, H.butter.light)}/>`) + merged(arm(22, -10, 50, 6, 9), H.butter.mid);
const pumpkinHouse = () => {
  const bodyShapes = `<ellipse cx="-34" cy="-42" rx="30" ry="42"/><ellipse cx="34" cy="-42" rx="30" ry="42"/><ellipse cx="0" cy="-44" rx="30" ry="46"/>`;
  return `<path d="M0 -86Q4 -104 18 -108" ${strokeW(6, ink)}/><path d="M0 -86Q4 -104 18 -108" ${strokeW(3, twig)}/>` + leafSmall(28, -104, -20, 2, H.green.mid) +
    shaded(bodyShapes, H.peach.mid, H.peach.dark, shine(-28, -70, 14, 8), [0, -42], 0.9, [-4, -4]) +
    `<path d="M-12 -2V-26Q-12 -44 0 -44Q12 -44 12 -26V-2Z" fill="${twig}" ${o}/><circle cx="6" cy="-20" r="2" fill="${H.butter.mid}"/>` +
    `<circle cx="-40" cy="-48" r="12" fill="${ink}"/><circle cx="-40" cy="-48" r="9.5" fill="${H.butter.mid}"/>` +
    // mouse kid peeking from the round window
    `<circle cx="-47" cy="-57" r="5.5" fill="${H.lilac.light}" ${o}/><circle cx="-33" cy="-57" r="5.5" fill="${H.lilac.light}" ${o}/><circle cx="-40" cy="-47" r="8.4" fill="${H.lilac.light}" ${o}/>` + eye(-43.5, -48, 1.9) + eye(-36.5, -48, 1.9) + `<ellipse cx="-40" cy="-43" rx="2" ry="1.5" fill="${H.pink.dark}"/>` +
    `<circle cx="36" cy="-60" r="9" fill="${ink}"/><circle cx="36" cy="-60" r="6.6" fill="${H.butter.mid}"/>`;
};
const tuftB = (x, y) => tuft(x, y, H.green.dark);

const trunkShape = `<path d="M-13 6C-9 -30 -8 -60 -6 -96L7 -96C9 -60 10 -30 14 6Z"/><path d="M-4 -70C-24 -80 -34 -92 -40 -112L-30 -116C-26 -100 -16 -90 0 -82Z"/><path d="M4 -76C22 -86 34 -98 40 -118L30 -120C26 -104 16 -94 2 -86Z"/>`;
const crownBlobs = `<circle cx="-34" cy="-122" r="25"/><circle cx="34" cy="-124" r="25"/><circle cx="0" cy="-146" r="31"/><circle cx="-12" cy="-112" r="28"/><circle cx="18" cy="-108" r="27"/>`;
const tree = (s) => {
  const trunk = merged(trunkShape, twig) + `<path d="M-6 -20Q-2 -40 -3 -60" ${strokeW(1.5, mix(twig, ink, 0.4))}/>`;
  if (s === 3) {
    // winter: bare branches carrying snow, a few red berries
    const twigs = `<path d="M-30 -116L-44 -138M-30 -116L-18 -140M30 -120L42 -144M30 -120L18 -144M-2 -92L-2 -128M-2 -128L-12 -152M-2 -128L10 -152" ${strokeW(5, ink)}/><path d="M-30 -116L-44 -138M-30 -116L-18 -140M30 -120L42 -144M30 -120L18 -144M-2 -92L-2 -128M-2 -128L-12 -152M-2 -128L10 -152" ${strokeW(2.5, twig)}/>`;
    const snow = [[-34, -118, 15, 7], [34, -122, 15, 7], [-2, -94, 12, 6], [-15, -150, 9, 5], [11, -154, 9, 5], [-45, -140, 7, 4], [43, -146, 7, 4]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" ${o}/>`).join("");
    const berries = [[-24, -130], [24, -132], [6, -138], [-8, -100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${H.pink.dark}" ${o}/>`).join("");
    return trunk + twigs + snow + berries + `<path d="M-26 8Q-20 -8 -6 -6Q0 -12 10 -6Q24 -8 30 8Z" fill="#fff" ${o}/>`;
  }
  const pal = [[H.pink.light, H.pink.mid], [H.green.light, H.green.mid], [H.butter.mid, H.peach.mid]][s];
  const crown = shaded(crownBlobs, pal[0], pal[1], shine(-24, -150, 13, 7), [0, -126], 0.88, [-5, -6]);
  let dots = "";
  const pts = [[-40, -118], [-22, -138], [0, -160], [24, -140], [40, -118], [-4, -118], [16, -104], [-24, -100], [32, -136], [-12, -144]];
  if (s === 0) dots = pts.map(([x, y], i) => bloom(x, y, 5, i % 3 ? "#fff" : H.pink.dark, H.butter.mid)).join("") + [[-52, -20, 20], [-30, 6, -40], [46, -4, 30]].map(([x, y, r]) => petal(x, y, r, 1.1)).join("");
  if (s === 1) dots = pts.slice(0, 7).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${H.pink.dark}" ${o}/><path d="M${x} ${y - 5.5}v-3" ${strokeW(1.5)}/>`).join("");
  if (s === 2) dots = pts.map(([x, y], i) => leafSmall(x, y, i * 47, 1.1, i % 2 ? H.pink.dark : H.peach.dark)).join("") + [[-50, -8, 20], [-36, 6, 100], [44, 2, 60], [52, -10, 140]].map(([x, y, r], i) => leafSmall(x, y, r, 1.1, i % 2 ? H.butter.dark : H.peach.mid)).join("");
  return trunk + crown + dots;
};


const acornShape = (x, y, sc = 1, c = H.butter.dark) => g(x, y, sc, `<path d="M-9 -8Q0 -16 9 -8Z" fill="${twig}" ${o}/><path d="M-9 -8Q0 -17 9 -8Z" ${strokeW(1.2)}/><path d="M-8 -7Q-9 8 0 12Q9 8 8 -7Z" fill="${c}" ${o}/>`);

const piep = (s) => {
  const c = H.sky.mid, rr = s === 3 ? 1.18 : 1;
  let out = g(0, 0, rr, `<path d="M-10 0L-22 -6L-20 4Z" fill="${c}" ${o}/><ellipse rx="13" ry="10" fill="${c}" ${o}/><circle cx="9" cy="-8" r="8" fill="${c}" ${o}/><ellipse cx="-1" cy="3" rx="7" ry="5" fill="${H.sky.light}" ${o}/>`);
  const beak = s === 0 ? `<path d="M15 -9L24 -12L17 -6ZM15 -6L24 -3L16 -3Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/>` : `<path d="M15 -8L23 -5L15 -3Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/>`;
  out += beak;
  out += s === 1 ? `<circle cx="9" cy="-9" r="4.4" fill="${ink}"/><circle cx="18" cy="-9" r="4.4" fill="${ink}"/><path d="M12 -9h3" ${strokeW(1.6)}/><path d="M2 -12L5 -10" ${strokeW(1.6)}/>` : `<circle cx="11" cy="-9" r="1.9" fill="${ink}"/>`;
  if (s === 0) out += `<path d="M24 -26C22 -30 17 -28 19 -24Q21 -20 24 -18Q27 -20 29 -24C31 -28 26 -30 24 -26Z" fill="${H.pink.dark}" ${o} stroke-linejoin="round"/>`;
  if (s === 2) out += leafSmall(8, -17, -30, 1, H.peach.dark);
  if (s === 3) out += `<path d="M2 -2Q12 4 22 -4" ${strokeW(6, ink)}/><path d="M2 -2Q12 4 22 -4" ${strokeW(3.5, H.pink.mid)}/><path d="M2 -16Q9 -22 16 -16Q9 -13 2 -16Z" fill="#fff" ${o}/>`;
  return out + `<path d="M-3 9v6M4 9v6" ${strokeW(2, H.peach.dark)}/>`;
};

// ======================= SIDE-BELT VARIANTS ======================================
const water = (c = H.sky.water) => c;
const waterBand = (pts, w) => { const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(""); return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w + 6}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${H.sky.water}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`; };
const ellip = (cx, cy, rx, ry, fill) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}"/>`;
const lilyPad = (x, y, s = 1, flower = false) => g(x, y, s, `<ellipse rx="16" ry="6" fill="${H.green.mid}" ${o}/><path d="M0 0L14 -3" ${strokeW(1.5)}/>` + (flower ? petals(0, -6, 7, 5, H.pink.light) + `<circle cy="-6" r="2.6" fill="${H.butter.mid}"/>` : ""));
const umbrella = () => `<path d="M0 0V-62" ${strokeW(6, ink)}/><path d="M0 0V-62" ${strokeW(3, "#fff")}/><path d="M-40 -58A40 30 0 0 1 40 -58Z" fill="${H.pink.mid}" ${o} stroke-linejoin="round"/><path d="M-20 -58Q-24 -76 -8 -86L0 -58ZM20 -58Q24 -76 8 -86L0 -58Z" fill="#fff" ${o} stroke-linejoin="round"/>`;
const sunflowerRow = () => "";

const buildSides = (variant) => {
  resetLayers();
  baseStrips();
  const blockS = [], blockG = [];
  const inBox = (boxes) => (lx, y) => boxes.some(([x0, x1, y0, y1]) => lx > x0 && lx < x1 && y > y0 && y < y1);
  const sky = (lx, y) => (lx > 40 && lx < 170 && y > 18 && y < 100) || lx < 14 || lx > 306 || inBox(skyBoxes[variant])(lx, y);
  const skyBoxes = { a: [[0, 320, 120, 215]], b: [[0, 320, 100, 215]] };
  // ground blockers (local x ranges below the hill line)
  const grd = (lx, y) => lx < 10 || lx > 310 || (lx > 10 && lx < 310 && y > 200);
  addBackground(sky, (lx, y, gx) => thawW(gx) < 0.85 && lx > 14 && lx < 300 && y > 236);
  if (variant === "a") {
    // ---- L spring: Fluff the lamb with a chick, a brook with a plank bridge that flows into the summer lake
    const sy = (x) => 276 + 4 * sin(x / 18);
    const pts = [[150, 248], [175, 262], [205, 272], [240, 276], [280, 280], [320, 284], [352, 286]];
    put("water", 140, 360, waterBand(pts, 15));
    putLocal("L", "water", 200, 270, `<path d="M-18 8Q0 -10 18 8" transform="translate(236 272)" ${strokeW(10, ink)}/><path d="M-18 8Q0 -10 18 8" transform="translate(236 272)" ${strokeW(6, twig)}/>`);
    putLocal("L", "chars", 10, 230, g(92, gy("L", 92, 32), 1.65, lamb()) + g(282, gy("L", 282, 40), 1.4, chick()) + tulip(206, gy("L", 206, 24), 0.8, H.pink.mid) + tulip(216, gy("L", 216, 30), 0.65, H.butter.mid));
    putLocal("L", "tree", 230, 320, bloom(262, 238, 8, H.pink.mid) + bloom(290, 246, 7, "#fff") + tulip(214, 248, 0.6, H.lilac.mid));
    // ---- F summer: duck family on the lake (the brook opens into it)
    put("water", 330, 600, ellip(470, 288, 124, 26, H.sky.water) + `<ellipse cx="440" cy="283" rx="40" ry="5" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/><ellipse cx="520" cy="296" rx="30" ry="4" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>`);
    putLocal("F", "chars", 100, 270, lilyPad(76, 296, 1, true) + lilyPad(236, 282, 0.9) + g(168, 294, 1.75, duck(true)) + g(84, 290, 0.75, duck(false, false)) + g(44, 284, 0.6, duck(false, false)));
    putLocal("F", "tree", 250, 320, reeds(262, 292, 1) + g(298, gy("F", 298, 22), 1, umbrella()) + dot(270, 300, 7, H.sky.mid));
    putLocal("F", "chars", 0, 80, dragonfly(40, 190, 1) + butterfly(120, 140, H.pink.mid, H.butter.light, 1));
    // ---- R autumn: Russet the fox kid in a leaf pile, a scarecrow keeps watch
    putLocal("R", "chars", 20, 200, g(112, gy("R", 112, 36), 1.3, fox()) + g(112, gy("R", 112, 38), 1.2, leafPile()));
    putLocal("R", "tree", 230, 320, g(268, gy("R", 268, 28), 1.2, scarecrow()) + ptumpkin(228, gy("R", 228, 36), 1.1) + mushroom(300, gy("R", 300, 34), 0.7, H.pink.dark));
    // ---- B winter: Skater the penguin on a frozen pond, a snug cottage, snowy firs
    put("water", 990, 1230, ellip(1090, 290, 110, 20, "#f1f8ff") + `<path d="M1020 288q30 -6 60 -2M1110 296q30 -6 60 -4" fill="none" stroke="${H.sky.dark}" stroke-width="2.5" stroke-linecap="round"/>`);
    putLocal("B", "tree", 190, 320, g(242, farY(OFF.B + 242) + 18, 1.15, cottage()) + g(294, farY(OFF.B + 294) + 14, 0.85, fir()));
    putLocal("B", "chars", 20, 240, g(104, 292, 1.6, penguin()) + flake(36, 262, 1.3) + flake(180, 270, 1.1));
    putLocal("B", "tree", 0, 60, g(26, farY(OFF.B + 26) + 18, 1, fir()));
  } else {
    // ---- s-b: one hero object per landscape
    // L spring: a blossom hill with a big blossom tree and Bun the bunny
    putLocal("L", "tree", 150, 320, g(230, midY(230) + 10, 1.35, tree(0)));
    putLocal("L", "chars", 30, 150, g(86, gy("L", 86, 30), 1.2, bunny()));
    putLocal("L", "chars", 150, 200, g(160, gy("L", 160, 38), 0.9, chick()));
    // F summer: sunflower field and Buzz the bee kid
    putLocal("F", "tree", 20, 320, [[48, 150, 1.05], [108, 128, 1], [262, 140, 1.1], [296, 96, 0.8]].map(([x, h, s]) => g(x, midY(OFF.F + x) + 26, 1, sunflower(h * s, 1, h > 130))).join(""));
    putLocal("F", "chars", 130, 220, g(184, 150, 1.5, beeKid()) + ladybug(176, 297, 1.2));
    // R autumn: pumpkin patch, a pumpkin house with a mouse kid
    putLocal("R", "tree", 60, 320, g(196, gy("R", 196, 34), 1.15, pumpkinHouse()) + ptumpkin(58, gy("R", 58, 38), 1.7) + ptumpkin(104, gy("R", 104, 40), 1.2) + ptumpkin(296, gy("R", 296, 36), 1.3) + ptumpkin(112, gy("R", 112, 40), 0.7));
    putLocal("R", "chars", 20, 140, leafSmall(30, 292, 20, 1.6, H.pink.dark) + leafSmall(150, 300, 100, 1.5, H.butter.dark) + mushroom(272, gy("R", 272, 40), 0.9, H.pink.dark));
    // B winter: Frosty the snowman with a bluebird, firs and a sled with a gift
    putLocal("B", "tree", 0, 320, g(40, farY(OFF.B + 40) + 16, 1, fir(1.1)) + g(300, farY(OFF.B + 300) + 14, 1, fir(0.9)) + g(262, farY(OFF.B + 262) + 20, 0.7, fir()));
    putLocal("B", "chars", 40, 320, g(120, gy("B", 120, 36), 1.45, snowman()) + g(236, gy("B", 236, 38), 0.95, sled()) + g(160, gy("B", 120, 36) - 140, 0.8, `<g transform="scale(-1 1)">${piep(3)}</g>`) + mound(60, 302, 1) + flake(60, 120, 1.4) + flake(260, 100, 1.2));
  }
  return { L: renderSide("L"), F: renderSide("F"), R: renderSide("R"), B: renderSide("B") };
};

// ======================= UP / DOWN VARIANTS =======================================
// Adjacency: U bottom = F top, U left = L top (U y = L x), U right = R top (R x = 320-y), U top = B top (B x = 320-x).
// D top = F bottom, D left = L bottom (L x = 320-y), D right = R bottom (R x = y), D bottom = B bottom (B x = 320-x).
const SEG = 8;
const shepherd = (cell, edgeAt, center, cs) => {
  const cx = cell.x + SEG / 2, cy = cell.y + SEG / 2;
  const es = [[cy, edgeAt.top(cx)], [320 - cy, edgeAt.bottom(cx)], [cx, edgeAt.left(cy)], [320 - cx, edgeAt.right(cy)]];
  let wsum = (1 / (160 * 160)) * cs, acc = hexA(center).map((v) => (v * cs) / (160 * 160));
  for (const [d, c] of es) { const w = 1 / (d * d); wsum += w; const a = hexA(c); acc = acc.map((v, i) => v + w * a[i]); }
  return toHex(acc.map((v) => v / wsum));
};
const upEdge = { top: (x) => edgeSky(1280 - x), bottom: (x) => edgeSky(320 + x), left: (y) => edgeSky(y), right: (y) => edgeSky(960 - y) };
const dnEdge = { top: (x) => edgeMid(320 + x), bottom: (x) => edgeMid(1280 - x), left: (y) => edgeMid(320 - y), right: (y) => edgeMid(640 + y) };
const rectS = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const grid = (fn) => { let m = ""; for (let y = 0; y < 320; y += SEG) for (let x = 0; x < 320; x += SEG) { const c = fn({ x, y }); if (c) m += rectS(x, y, SEG + 1, SEG + 1, c); } return m; };
const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const sunDisc = (cx, cy, r, halo = true) =>
  (halo ? `<circle cx="${cx}" cy="${cy}" r="${r + 18}" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>` + `<circle cx="${cx}" cy="${cy}" r="${r + 9}" fill="none" stroke="${H.butter.mid}" stroke-width="4"/>` : "") +
  shaded(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`, H.butter.mid, H.butter.dark, shine(cx - r * 0.4, cy - r * 0.4, r * 0.3, r * 0.18), [cx, cy], 0.9, [-4, -4]) +
  eye(cx - 15, cy - 6, 4.4) + eye(cx + 15, cy - 6, 4.4) + cheeks(cx, cy + 8, 24, H.pink.dark) + smile(cx, cy + 6, 9);
const seasonColor = (deg) => { // direction -> blended leaf color (left spring, bottom summer, right autumn, top winter)
  const cols = ["#a9dc90", "#6fca7e", "#f7b05a", "#7cc8c4"]; // spring(180) summer(90) autumn(0) winter(270)
  const centers = [180, 90, 360, 270];
  const w = centers.map((c) => { let d = Math.abs(((deg - c) % 360 + 540) % 360 - 180); return d >= 70 ? 0 : Math.cos((Math.PI * d) / 140) ** 2; });
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return toHex([0, 1, 2].map((k) => w.reduce((a, wv, i) => a + wv * hexA(cols[i])[k], 0) / s));
};
const upCorners = () =>
  cl(14, 78, 0.62, "happy") + cl(236, 78, 0.62, "wink") + cl(14, 312, 0.55) + cl(232, 312, 0.55, "sleepy") + sparkles([[96, 40, 5], [226, 38, 4], [88, 284, 5], [246, 262, 4]]);
const UA = () => {
  const field = grid((c) => shepherd(c, upEdge, "#fff6dc", 2.2));
  // four seasonal badges on the sides: blossom (left), sunflower (bottom), leaf (right), snowflake (top)
  const badge = (x, y, fill, inner) => `<circle cx="${x}" cy="${y}" r="38" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}"/><circle cx="${x}" cy="${y}" r="31" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>` + inner;
  const flakeBig = (x, y) => `<path d="${[0, 60, 120].map((a) => { const [dx, dy] = polar(0, 0, 22, a); return `M${f1(x - dx)} ${f1(y - dy)}L${f1(x + dx)} ${f1(y + dy)}`; }).join("")}" ${strokeW(4, H.sky.dark)}/>` + [0, 60, 120, 180, 240, 300].map((a) => { const [px, py] = polar(x, y, 15, a); return `<circle cx="${f1(px)}" cy="${f1(py)}" r="3.4" fill="#fff" ${o}/>`; }).join("") + `<circle cx="${x}" cy="${y}" r="5" fill="#fff" ${o}/>`;
  const bits = badge(54, 160, H.pink.light, bloom(54, 160, 20, H.pink.mid, H.butter.mid, 5)) +
    badge(160, 266, H.green.light, petals(160, 266, 15, 12, H.butter.mid) + `<circle cx="160" cy="266" r="13" fill="#c98a5a" ${o}/>`) +
    badge(266, 160, H.peach.light, leafSmall(266, 160, -35, 3.2, H.peach.dark) + leafSmall(270, 166, 60, 1.4, H.butter.dark)) +
    badge(160, 54, H.sky.light, flakeBig(160, 54));
  return field + sunDisc(160, 160, 46) + bits + upCorners();
};
const UB = () => {
  const field = grid((c) => shepherd(c, upEdge, "#fff6dc", 2.2));
  let ring = `<circle cx="160" cy="160" r="90" fill="none" stroke="${ink}" stroke-width="38"/><circle cx="160" cy="160" r="90" fill="none" stroke="${mix("#8cc784", "#ffffff", 0.0)}" stroke-width="32" opacity="0"/>`;
  // base ring in blended season colors: many short arcs
  for (let a = 0; a < 360; a += 5) { const [x0, y0] = polar(160, 160, 90, a), [x1, y1] = polar(160, 160, 90, a + 6); ring += `<path d="M${f1(x0)} ${f1(y0)}A90 90 0 0 1 ${f1(x1)} ${f1(y1)}" fill="none" stroke="${seasonColor(a + 3)}" stroke-width="32" stroke-linecap="butt"/>`; }
  let leaves = "";
  for (let i = 0; i < 36; i++) {
    const a = i * 10 + (i % 2) * 3, [x, y] = polar(160, 160, 90 + (i % 2 ? 7 : -7), a);
    leaves += leafSmall(f1(x), f1(y), a + 90 + (i % 2 ? 35 : -35), 1.9, mix(seasonColor(a), "#ffffff", i % 3 === 0 ? 0.25 : 0));
  }
  let flowers = "";
  for (let i = 0; i < 12; i++) {
    const a = i * 30 + 15, [x, y] = polar(160, 160, 90, a);
    const season = a > 135 && a < 225 ? 0 : a >= 45 && a <= 135 ? 1 : a > 225 && a < 315 ? 3 : 2;
    flowers += season === 0 ? bloom(x, y, 11, i % 2 ? "#fff" : H.pink.mid, H.butter.mid) : season === 1 ? petals(x, y, 13, 10, H.butter.mid) + `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="#c98a5a" ${o}/>` : season === 2 ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="8" fill="${H.pink.dark}" ${o}/>` : `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="#fff" ${o}/><circle cx="${f1(x + 8)}" cy="${f1(y + 4)}" r="4" fill="${H.pink.dark}" ${o}/>`;
  }
  return field + ring + leaves + flowers + sunDisc(160, 160, 40) + sparkles([[160, 262, 0]].slice(0, 0)) + upCorners().replace(/cl\(/g, "cl(");
};
const dFrame = (frameW = 24) => grid((c) => (Math.min(c.x, c.y, 312 - c.x, 312 - c.y) < frameW ? shepherd(c, dnEdge, "#ffffff", 0) : null));
const dCorners = () => daisy(14, 40, 0.9) + g(306, 20, 1, leafSmall(0, 0, 40, 1.2, H.peach.mid)) + flake(306, 306, 1.3) + crocus(14, 308, 0.8, H.lilac.mid);
const DA = () => {
  let m = dFrame(24);
  const oct = (pts) => pts.map((p) => p.join(",")).join(" ");
  const wedge = (pts, fill) => `<polygon points="${oct(pts)}" fill="${fill}"/>`;
  m += `<polygon points="${oct([[36, 24], [284, 24], [296, 36], [296, 284], [284, 296], [36, 296], [24, 284], [24, 36]])}" fill="${ink}" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`;
  m += wedge([[24, 36], [36, 24], [284, 24], [296, 36], [160, 160]], "#b1e0a2") + wedge([[24, 36], [24, 284], [160, 160]], "#cdeab6") + wedge([[296, 36], [296, 284], [160, 160]], "#f0d890") + wedge([[24, 284], [36, 296], [284, 296], [296, 284], [160, 160]], "#f4f7fc");
  // diagonal paths + round season medallion
  const pth = (x, y) => `<path d="M${x} ${y}L160 160" ${strokeW(22, ink)}/><path d="M${x} ${y}L160 160" ${strokeW(16, H.peach.light)}/>`;
  m += pth(32, 32) + pth(288, 32) + pth(32, 288) + pth(288, 288);
  m += `<circle cx="160" cy="160" r="30" fill="${ink}"/>` + [["#cdeab6", 180], ["#b1e0a2", 270], ["#f0d890", 0], ["#f4f7fc", 90]].map(([c, a]) => { const [x0, y0] = polar(160, 160, 26, a - 45), [x1, y1] = polar(160, 160, 26, a + 45); return `<path d="M160 160L${f1(x0)} ${f1(y0)}A26 26 0 0 1 ${f1(x1)} ${f1(y1)}Z" fill="${c}"/>`; }).join("") + `<circle cx="160" cy="160" r="7" fill="${H.pink.mid}" ${o}/>`;
  // left = spring beds
  m += [[56, 120, H.lilac.mid], [46, 160, H.butter.mid], [58, 202, "#fff"]].map(([x, y, c]) => crocus(x, y, 1.5, c)).join("") + tulip(92, 140, 0.8, H.pink.mid) + tulip(100, 180, 0.8, H.butter.mid) + tulip(84, 164, 0.7, H.pink.light) + bloom(112, 160, 6, "#fff");
  // top = summer sunflowers
  m += [[96, 78, 28], [160, 70, 38], [226, 78, 30]].map(([x, y, h]) => g(x, y + 20, 0.62, sunflower(h * 1.3, 1, true))).join("") + bee(124, 108, 1) + daisy(190, 112, 1);
  // right = autumn leaves
  m += [[244, 122, 20, H.peach.mid], [262, 160, 110, H.pink.dark], [244, 200, 60, H.butter.dark], [214, 140, 160, H.peach.dark], [222, 182, 220, H.pink.dark]].map(([x, y, r, c]) => leafSmall(x, y, r, 2, c)).join("") + mushroom(268, 216, 0.8, H.pink.dark) + ptumpkin(256, 112, 1.0);
  // bottom = winter snow
  m += g(160, 262, 0.55, snowman()) + mound(100, 270, 1.4) + mound(226, 276, 1.3) + flake(120, 226, 1.4) + flake(206, 222, 1.3) + flake(160, 214, 1);
  return m + dCorners();
};
const DB = () => {
  let m = dFrame(400);
  const cx = 160, cy = 160, R = 118;
  m += `<circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="${ink}"/>`;
  const sector = (a0, a1, fill) => { const [x0, y0] = polar(cx, cy, R, a0), [x1, y1] = polar(cx, cy, R, a1); return `<path d="M${cx} ${cy}L${f1(x0)} ${f1(y0)}A${R} ${R} 0 0 1 ${f1(x1)} ${f1(y1)}Z" fill="${fill}"/>`; };
  // left spring (135..225), top summer (225..315), right autumn (315..45), bottom winter (45..135)
  m += sector(135, 225, "#b8e4e0") + sector(225, 315, "#8ccdd3") + sector(315, 405, "#aacfc2") + sector(45, 135, "#eef6fd");
  // rim stones
  for (let a = 0; a < 360; a += 12) { const [x, y] = polar(cx, cy, R + 9, a); m += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="9" ry="6.5" fill="${a > 40 && a < 140 ? "#fff" : H.peach.light}" ${o} transform="rotate(${a + 90} ${f1(x)} ${f1(y)})"/>`; }
  // spring: small pads, petals
  m += lilyPad(80, 130, 0.9) + lilyPad(66, 196, 0.8) + petal(100, 160, 20, 1.3) + petal(118, 186, 80, 1.2, "#fff") + petal(86, 164, 140, 1.1, H.pink.mid) + bubble(104, 110, 5) + duckSmall();
  // summer: big pads, lotus, frog
  m += lilyPad(130, 66, 1.4, true) + lilyPad(204, 84, 1.2) + g(196, 78, 1, frog()) + lilyPad(160, 52, 0.8);
  // autumn: floating leaves
  m += [[236, 130, 30, H.peach.mid], [250, 168, 120, H.pink.dark], [226, 190, 200, H.butter.dark], [208, 150, 70, H.peach.dark]].map(([x, y, r, c]) => leafSmall(x, y, r, 1.9, c)).join("");
  // winter: ice cracks, a sleeping fish, snowflakes
  m += `<path d="M110 230L140 214L160 226L196 208L214 224M160 226L168 252M140 214L132 196" fill="none" stroke="${H.sky.dark}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` + g(176, 246, 0.8, `<g opacity=".8">${fish(0, 0, 1, H.sky.mid)}</g>`) + flake(120, 250, 1.4) + flake(206, 244, 1.2);
  // center lotus
  m += petals(160, 160, 15, 8, H.pink.light) + `<circle cx="160" cy="160" r="9" fill="${H.butter.mid}" ${o}/>`;
  m += reeds(30, 304, 0.6) + reeds(292, 306, 0.6);
  return m + dCorners();
};
const duckSmall = () => g(92, 226, 0.5, "") + "";
const frog = () => `<ellipse cy="-8" rx="15" ry="11" fill="${H.green.light}" ${o}/><circle cx="-8" cy="-20" r="6" fill="${H.green.light}" ${o}/><circle cx="8" cy="-20" r="6" fill="${H.green.light}" ${o}/>${eye(-8, -20, 2.6)}${eye(8, -20, 2.6)}<path d="M-6 -9Q0 -4 6 -9" ${strokeW(1.8)}/><ellipse cx="-12" cy="-9" rx="3" ry="2" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="12" cy="-9" rx="3" ry="2" fill="${H.pink.dark}" opacity=".5"/>`;


// ======================= ROUND 4: UP c/d, DOWN c/d ===================================
const bigRainbow = (cx, cy, r0) => {
  const cols = [H.pink.mid, H.butter.mid, H.green.mid, H.sky.mid], w = 11, mid = r0 - 1.5 * w, wTot = 4 * w + 6;
  const arc = (r, sw, c) => `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
  return arc(mid, wTot, ink) + cols.map((c, i) => arc(r0 - w / 2 - i * w, w + 0.6, c)).join("");
};
const UC = () => {
  const field = grid((c) => shepherd(c, upEdge, "#fff6dc", 2.2));
  const rb = bigRainbow(160, 236, 134);
  const clouds = cl(26, 258, 0.92, "happy") + cl(200, 258, 0.92, "wink");
  const sun = sunDisc(160, 188, 42);
  const left = petal(26, 104, 30, 1.4) + petal(44, 134, 100, 1.2, "#fff") + petal(24, 164, 10, 1.3, H.pink.mid) + petal(48, 192, 60, 1.2);
  const top = flake(70, 40, 1.5) + flake(130, 26, 1.2) + flake(198, 44, 1.5) + flake(250, 30, 1.2) + flake(160, 70, 1);
  const right = leafSmall(292, 112, 40, 1.8, H.peach.mid) + leafSmall(274, 148, 110, 1.5, H.pink.dark) + leafSmall(296, 184, 20, 1.5, H.butter.dark);
  const bottom = butterfly(70, 296, H.pink.mid, H.butter.light, 1.2) + dragonfly(250, 292, 1) + butterfly(160, 298, H.lilac.mid, H.sky.light, 1);
  return field + rb + clouds + sun + left + top + right + bottom + sparkles([[110, 130, 4], [214, 126, 4], [90, 230, 0]].slice(0, 2));
};
// peeking animal heads (head center at the origin, facing the viewer)
const waveArm = (c, side = 1) => merged(arm(side * 38, 10, side * -25, 7.5, 13), c);
const headLamb = () => merged(`<circle cx="-22" cy="-10" r="16"/><circle cx="0" cy="-24" r="18"/><circle cx="22" cy="-10" r="16"/>`, "#fffaf1") +
  merged(`<ellipse cx="-30" cy="4" rx="12" ry="7" transform="rotate(-25 -30 4)"/><ellipse cx="30" cy="4" rx="12" ry="7" transform="rotate(25 30 4)"/>`, H.peach.mid) + merged(`<ellipse cx="0" cy="6" rx="24" ry="22"/>`, H.peach.light) +
  eye(-9, 2, 3.8) + eye(9, 2, 3.8) + `<ellipse cx="0" cy="12" rx="4" ry="3" fill="${H.pink.dark}"/><path d="M-5 17Q0 22 5 17" ${strokeW(2)}/><ellipse cx="-16" cy="12" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="16" cy="12" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/>` +
  bloom(-10, -30, 5, H.pink.mid) + bloom(2, -34, 4.5, "#fff") + bloom(14, -30, 5, H.butter.mid) + waveArm(H.peach.light, 1);
const headDuck = () => merged(`<circle r="30"/>`, "#fff4c2") + `<path d="M-4 -30Q-2 -40 3 -36M3 -30Q8 -40 10 -32" ${strokeW(2.2)}/>` + eye(-11, -4, 3.8) + eye(11, -4, 3.8) +
  `<ellipse cx="0" cy="11" rx="15" ry="8" fill="${H.peach.dark}" ${o}/><path d="M-13 11H13" ${strokeW(1.5)}/><ellipse cx="-20" cy="6" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="20" cy="6" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/>` + waveArm(H.butter.mid, -1);
const headFox = () => merged(`<ellipse cx="0" cy="0" rx="32" ry="26"/><path d="M-26 -14L-32 -44L-8 -24Z"/><path d="M26 -14L32 -44L8 -24Z"/>`, H.peach.dark) + `<path d="M-27 -36L-31 -44L-16 -30ZM27 -36L31 -44L16 -30Z" fill="${twig}"/>` +
  `<path d="M-30 4Q0 30 30 4Q22 22 0 24Q-22 22 -30 4Z" fill="${cream}"/>` + arcEye(-11, -4) + arcEye(11, -4) + `<ellipse cx="0" cy="9" rx="5" ry="3.6" fill="${ink}"/><path d="M-5 15Q0 21 5 15" ${strokeW(2)}/><ellipse cx="-19" cy="8" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="19" cy="8" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".5"/>` + waveArm(H.peach.dark, 1);
const headPenguin = () => merged(`<circle r="30"/>`, H.lilac.dark) + `<ellipse cx="0" cy="6" rx="19" ry="17" fill="#fff"/>` + eye(-9, 0, 3.8) + eye(9, 0, 3.8) + `<path d="M-5 8L5 8L0 15Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/><ellipse cx="-17" cy="8" rx="4" ry="2.8" fill="${H.pink.dark}" opacity=".6"/><ellipse cx="17" cy="8" rx="4" ry="2.8" fill="${H.pink.dark}" opacity=".6"/>` +
  `<path d="M-26 -14C-26 -48 26 -48 26 -14Z" fill="${H.sky.mid}" ${o}/><path d="M-28 -16H28" ${strokeW(6, "#fff")}/><circle cx="0" cy="-46" r="7" fill="${H.pink.light}" ${o}/>` + waveArm(H.lilac.dark, -1);
const UD = () => {
  const field = grid((c) => shepherd(c, upEdge, "#fff6dc", 2.2));
  const peek = (head, tint, shade, rot) => `<g transform="rotate(${rot} 160 160)">${g(160, 246, 0.85, head())}${shaded(g(160, 290, 0.85, `<circle cx="-54" cy="4" r="22"/><circle cx="-18" cy="-6" r="28"/><circle cx="24" cy="-4" r="27"/><circle cx="58" cy="6" r="21"/><ellipse cx="0" cy="12" rx="84" ry="14"/>`), tint, shade, "", [160, 290], 0.92, [-3, -3])}</g>`;
  const sun = sunDisc(160, 160, 32);
  return field + sun + peek(headLamb, "#fff0f3", H.pink.light, 45) + peek(headDuck, "#f4fbee", H.green.light, 315) + peek(headFox, "#fff3e4", H.peach.light, 225) + peek(headPenguin, "#f2f6ff", H.sky.light, 135) + sparkles([[160, 52, 5], [160, 268, 4], [52, 160, 4], [270, 160, 5]]);
};
// DOWN c: a big tree crown seen from above; the four quadrants carry the four seasons
const DC = () => {
  let m = dFrame(400);
  const cx = 160, cy = 160;
  // soft ground shadow
  m += `<ellipse cx="${cx + 8}" cy="${cy + 12}" rx="126" ry="122" fill="${H.green.dark}" opacity=".25"/>`;
  const quad = (deg) => { const d = ((deg % 360) + 360) % 360; return d >= 225 && d < 315 ? 1 : d >= 315 || d < 45 ? 2 : d >= 45 && d < 135 ? 3 : 0; }; // left spring, top summer, right autumn, bottom winter
  const pal = [[H.pink.light, H.pink.mid], ["#c7ebcf", H.green.mid], [H.butter.mid, H.peach.mid], ["#fbfdff", "#cfe0f4"]];
  const circles = [];
  for (let i = 0; i < 16; i++) { const a = 11.25 + i * 22.5, [x, y] = polar(cx, cy, 90, a); circles.push([x, y, 34, quad(a), 1]); }
  for (let i = 0; i < 8; i++) { const a = 22.5 + i * 45, [x, y] = polar(cx, cy, 54, a); circles.push([x, y, 32, quad(a), 0]); }
  circles.push([cx, cy, 40, quad(0), 0]);
  m += `<g stroke="${ink}" stroke-width="${W.body}" fill="${ink}">${circles.map(([x, y, r]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}"/>`).join("")}</g>`;
  circles.forEach(([x, y, r, k, t], i) => { m += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${pal[k][t]}"/>`; });
  // one seasonal mark per outer blob, a smaller one per inner blob
  circles.slice(0, 24).forEach(([x, y, r, k, t], i) => {
    const sc = t ? 1 : 0.8;
    m += k === 0 ? bloom(x, y, 7 * sc, i % 2 ? "#fff" : H.pink.dark, H.butter.mid) : k === 1 ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="${6.5 * sc}" fill="${H.pink.dark}" ${o}/><path d="M${f1(x)} ${f1(y - 6.5 * sc)}v-4" ${strokeW(1.6)}/>` : k === 2 ? leafSmall(f1(x), f1(y), i * 53, 1.7 * sc, [H.pink.dark, H.peach.dark, H.butter.dark][i % 3]) : `<ellipse cx="${f1(x)}" cy="${f1(y - 6)}" rx="${12 * sc}" ry="${6 * sc}" fill="#fff" ${o}/>`;
  });
  // a bird's nest at the heart of the crown (sits on the quadrant seam)
  m += `<ellipse cx="${cx}" cy="${cy}" rx="30" ry="26" fill="${twig}" ${o}/><ellipse cx="${cx}" cy="${cy}" rx="22" ry="18" fill="${H.peach.light}" ${o}/>` + [[-9, -3, H.sky.light], [8, -5, H.pink.light], [0, 7, H.butter.light]].map(([dx, dy, c]) => `<ellipse cx="${cx + dx}" cy="${cy + dy}" rx="7.5" ry="9.5" fill="${c}" ${o}/>`).join("");
  return m + dCorners();
};
// DOWN d: a calm round footpath around a tree stump; the four animals' footprints walk around it
const DD = () => {
  let m = dFrame(400);
  const cx = 160, cy = 160, Rp = 104, pw = 40;
  m += `<ellipse cx="${cx + 6}" cy="${cy + 10}" rx="${Rp + 24}" ry="${Rp + 22}" fill="${H.green.dark}" opacity=".22"/>`;
  m += `<circle cx="${cx}" cy="${cy}" r="${Rp + pw / 2 + 3}" fill="${ink}"/>`;
  m += `<circle cx="${cx}" cy="${cy}" r="${Rp + pw / 2}" fill="${H.peach.light}"/>`;
  m += `<circle cx="${cx}" cy="${cy}" r="${Rp - pw / 2 + 3}" fill="${ink}"/>`;
  const sector = (a0, a1, r, fill) => { const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1); return `<path d="M${cx} ${cy}L${f1(x0)} ${f1(y0)}A${r} ${r} 0 0 1 ${f1(x1)} ${f1(y1)}Z" fill="${fill}"/>`; };
  const ri = Rp - pw / 2;
  m += sector(135, 225, ri, "#cdeab6") + sector(225, 315, ri, "#b1e0a2") + sector(315, 405, ri, "#f0d890") + sector(45, 135, ri, "#f4f7fc");
  // stepping-stone speckles on the path
  const pr = rng(3);
  for (let i = 0; i < 26; i++) { const a = pr() * 360, d = Rp + (pr() - 0.5) * 22, [x, y] = polar(cx, cy, d, a); m += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="3" ry="2" fill="${H.peach.mid}" opacity=".7"/>`; }
  // footprints: lamb (left), duck (top), fox (right), penguin (bottom), walking clockwise
  const printCol = mix(H.peach.dark, ink, 0.3);
  const pad = (kind) => kind === "lamb" ? `<ellipse cx="-3" cy="0" rx="2.8" ry="5.5"/><ellipse cx="3" cy="0" rx="2.8" ry="5.5"/>` : kind === "duck" ? `<path d="M0 6L-9 -5L0 -2L9 -5Z"/><path d="M-9 -5L-11 -1M9 -5L11 -1M0 -2V-6" stroke="${printCol}" stroke-width="2"/>` : kind === "fox" ? `<ellipse cx="0" cy="3" rx="5" ry="4.2"/><circle cx="-6" cy="-3" r="2.3"/><circle cx="-2" cy="-6" r="2.3"/><circle cx="2" cy="-6" r="2.3"/><circle cx="6" cy="-3" r="2.3"/>` : `<ellipse cx="0" cy="3" rx="4.5" ry="5.5"/><circle cx="-5" cy="-4" r="2.3"/><circle cx="0" cy="-7" r="2.3"/><circle cx="5" cy="-4" r="2.3"/>`;
  [["lamb", 180], ["duck", 270], ["fox", 0], ["penguin", 90]].forEach(([k, base]) => {
    for (let j = 0; j < 4; j++) { const a = base - 33 + j * 22, d = Rp + (j % 2 ? 6 : -6), [x, y] = polar(cx, cy, d, a); m += `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a + 90}) scale(1.35)" fill="${printCol}">${pad(k)}</g>`; }
  });
  // central stump with growth rings and a sprout
  m += `<circle cx="${cx}" cy="${cy}" r="48" fill="${ink}"/><circle cx="${cx}" cy="${cy}" r="43" fill="${twig}"/><circle cx="${cx}" cy="${cy}" r="37" fill="${H.peach.mid}" stroke="${ink}" stroke-width="${W.fine}"/>`;
  m += [28, 19, 10].map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${i % 2 ? H.peach.mid : H.peach.light}" stroke="${mix(ink, H.peach.mid, 0.4)}" stroke-width="2"/>`).join("");
  m += `<path d="M${cx} ${cy + 2}V${cy - 22}" ${strokeW(3, H.green.dark)}/>` + leafSmall(cx - 8, cy - 14, -150, 1.3, H.green.mid) + leafSmall(cx + 8, cy - 18, -30, 1.3, H.green.light) + bloom(cx, cy - 28, 6, H.pink.mid, H.butter.mid);
  // small seasonal tufts in the four meadow sectors
  m += crocus(104, 160, 1.3, H.lilac.mid) + daisy(160, 100, 1.2) + leafSmall(222, 160, 30, 1.6, H.peach.mid) + mound(160, 226, 1.1);
  return m + dCorners();
};

// ======================= ROUND 5: DOWN e/f ===========================================
const chord = (cx, cy, r, d, vertical) => { const h = Math.sqrt(r * r - d * d); return vertical ? `M${cx + d} ${cy - h}V${cy + h}` : `M${cx - h} ${cy + d}H${cx + h}`; };
const tartTop = () => { let m = merged(Array.from({ length: 14 }, (_, i) => { const [x, y] = polar(0, 0, 25, i * (360 / 14)); return `<circle cx="${f1(x)}" cy="${f1(y)}" r="6"/>`; }).join("") + `<circle r="25"/>`, H.peach.mid); m += `<circle r="19" fill="${cream}" ${o}/>`;
  [[0, 0], [10, -4], [-9, -7], [-4, 10], [8, 9], [-13, 5]].forEach(([x, y]) => (m += `<circle cx="${x}" cy="${y}" r="5.2" fill="${H.pink.dark}" ${o}/><path d="M${x - 2} ${y - 4}l2 -2l2 2" ${strokeW(1.5, H.green.dark)}/>`)); return m; };
const melonTop = () => `<path d="M-32 10A32 32 0 0 1 32 10Z" fill="${H.green.mid}" stroke="${ink}" stroke-linejoin="round" stroke-width="3"/><path d="M-27 10A27 27 0 0 1 27 10Z" fill="#e6f5d8"/><path d="M-23 10A23 23 0 0 1 23 10Z" fill="${H.pink.mid}"/>` + [[-12, 0], [0, -8], [12, 0], [-5, 3], [6, 4]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="3.4" fill="${ink}"/>`).join("") + `<path d="M-32 10H32" ${strokeW(3)}/>`;
const pieTop = () => { let m = `<circle r="29" fill="${H.peach.mid}" stroke="${ink}" stroke-width="3"/><circle r="24" fill="${H.butter.mid}" ${o}/>`; m += `<path d="${[-12, 0, 12].map((d) => chord(0, 0, 22, d, false) + chord(0, 0, 22, d, true)).join("")}" ${strokeW(5, H.peach.dark)}/>`; return m + leafSmall(0, 0, 40, 1.3, H.green.mid) + `<circle cx="-10" cy="-10" r="3" fill="${H.pink.dark}" ${o}/><circle cx="12" cy="10" r="3" fill="${H.pink.dark}" ${o}/>`; };
const mugTop = () => `<path d="M17 -9Q34 -9 34 0Q34 9 17 9" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><path d="M17 -9Q34 -9 34 0Q34 9 17 9" fill="none" stroke="${H.sky.mid}" stroke-width="4.5" stroke-linecap="round"/><circle r="23" fill="${H.sky.mid}" stroke="${ink}" stroke-width="3"/><circle r="17" fill="${mix(twig, H.peach.dark, 0.3)}" ${o}/>` + [[-6, -5], [6, -2], [-2, 7]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="5" fill="#fff" ${o}/>`).join("");
const basketTop = () => `<path d="M-19 0Q0 -32 19 0" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/><path d="M-19 0Q0 -32 19 0" fill="none" stroke="${twig}" stroke-width="4" stroke-linecap="round"/><circle r="17" fill="${H.peach.mid}" stroke="${ink}" stroke-width="3"/><path d="M-12 -8H12M-15 0H15M-12 8H12M-8 -12V12M0 -16V16M8 -12V12" ${strokeW(1.6, H.peach.dark)}/>` + bloom(0, 0, 6.5, H.pink.mid, H.butter.mid);
const DF = () => {
  let m = dFrame(400);
  const S = 196, x0 = 160 - S / 2, cell = S / 7;
  let check = `<rect x="${x0}" y="${x0}" width="${S}" height="${S}" fill="#fffaf1"/>`;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2 === 0) check += `<rect x="${f1(x0 + i * cell)}" y="${f1(x0 + j * cell)}" width="${f1(cell)}" height="${f1(cell)}" fill="${H.pink.light}"/>`;
  m += `<g transform="rotate(-8 160 160)"><rect x="${x0 + 9}" y="${x0 + 11}" width="${S}" height="${S}" fill="${H.green.dark}" opacity=".28"/>${check}<rect x="${x0}" y="${x0}" width="${S}" height="${S}" fill="none" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/>` +
    g(160 - 58, 160, 0.92, tartTop()) + g(160, 160 - 58, 0.92, melonTop()) + g(160 + 58, 160, 0.92, pieTop()) + g(160, 160 + 56, 0.9, mugTop()) + g(160, 160, 0.9, basketTop()) + `</g>`;
  const peek = (head, rot) => `<g transform="rotate(${rot} 160 160)">${g(160, 285, 0.8, head())}</g>`;
  m += peek(headLamb, 90) + peek(headDuck, 180) + peek(headFox, 270) + peek(headPenguin, 0);
  return m + tuft(30, 66, H.green.dark) + tuft(296, 66, H.green.dark) + tuft(34, 300, H.green.dark) + tuft(292, 300, H.green.dark);
};
const DE = () => {
  let m = dFrame(400);
  const patch = (cx, cy, rx, ry, fill) => `<ellipse cx="${cx + 4}" cy="${cy + 6}" rx="${rx}" ry="${ry}" fill="${H.green.dark}" opacity=".25"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}"/>`;
  // left: spring meadow with the brook and Fluff
  m += patch(54, 160, 42, 54, "#dff3c8") + `<ellipse cx="52" cy="196" rx="24" ry="13" fill="${H.sky.water}" stroke="${ink}" stroke-width="${W.outline}"/><ellipse cx="46" cy="194" rx="10" ry="2.5" fill="none" stroke="#fff" stroke-width="2.5"/>` + g(62, 168, 0.46, lamb()) + bloom(34, 130, 5, H.pink.mid) + bloom(76, 124, 4.5, "#fff") + lilyPad(62, 198, 0.6, true);
  // top: summer lake with Quack
  m += patch(160, 54, 56, 42, H.sky.water) + `<ellipse cx="146" cy="40" rx="22" ry="4" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>` + g(158, 66, 0.78, duck(true)) + lilyPad(122, 70, 0.8, true) + lilyPad(204, 48, 0.7);
  // right: autumn leaf pile with Russet
  m += patch(266, 160, 42, 54, "#f6dc9a") + g(266, 194, 0.3, leafPile()) + g(266, 194, 0.42, fox()) + g(266, 194, 0.32, leafPile());
  // bottom: winter ice pond with Skater
  m += patch(160, 266, 56, 42, "#f4f9ff") + `<path d="M118 262q18 -6 36 -2M176 282q14 -4 30 -2" fill="none" stroke="${H.sky.dark}" stroke-width="2.5" stroke-linecap="round"/>` + g(160, 282, 0.5, penguin()) + flake(206, 252, 1.2);
  // the big happy sunflower in the middle
  m += `<ellipse cx="164" cy="168" rx="70" ry="68" fill="${H.green.dark}" opacity=".25"/>` + petals(160, 160, 32, 14, H.butter.mid) + `<circle cx="160" cy="160" r="34" fill="${ink}"/><circle cx="160" cy="160" r="31.5" fill="#c98a5a"/>` + [[0, 0], [1, 1]].map(() => "").join("") + eye(146, 154, 4.6) + eye(174, 154, 4.6) + cheeks(160, 168, 26, H.pink.dark) + smile(160, 166, 9) + `<circle cx="160" cy="120" r="0"/>`;
  return m;
};

// ======================= ROUND 6: DOWN g (picnic, no animals, larger blanket) ========
const posyTop = () => `<circle r="21" fill="${H.sky.light}" stroke="${ink}" stroke-width="3"/><circle r="15" fill="${H.green.mid}" ${o}/>` + [[0, -9, H.pink.mid], [9, -3, H.butter.mid], [5, 8, "#ffffff"], [-7, 7, H.lilac.mid], [-9, -4, H.pink.light]].map(([x, y, c]) => bloom(x, y, 6.5, c, c === H.butter.mid ? H.peach.mid : H.butter.mid)).join("") + `<circle r="3.2" fill="${H.butter.mid}" ${o}/>`;
const DG = () => {
  let m = dFrame(400);
  const S = 222, x0 = 160 - S / 2, cell = S / 7;
  let check = `<rect x="${x0}" y="${x0}" width="${S}" height="${S}" fill="#fffaf1"/>`;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2 === 0) check += `<rect x="${f1(x0 + i * cell)}" y="${f1(x0 + j * cell)}" width="${f1(cell)}" height="${f1(cell)}" fill="${H.pink.light}"/>`;
  const d = 68, k = 1.12;
  m += `<g transform="rotate(-8 160 160)"><rect x="${x0 + 10}" y="${x0 + 12}" width="${S}" height="${S}" fill="${H.green.dark}" opacity=".28"/>${check}<rect x="${x0}" y="${x0}" width="${S}" height="${S}" fill="none" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/>` +
    g(160 - d, 160, k, tartTop()) + g(160, 160 - d, k, melonTop()) + g(160 + d, 160, k, pieTop()) + g(160, 160 + d - 2, k * 0.98, mugTop()) + g(160, 160, 1, posyTop()) + `</g>`;
  return m + tuft(30, 66, H.green.dark) + tuft(296, 66, H.green.dark) + tuft(34, 300, H.green.dark) + tuft(292, 300, H.green.dark);
};
// ======================= OUTPUT ===================================================
const sidesA = buildSides("a");
const faceSets = {
  // The shipped set: side belt a, Up face C, Down face G (the other variants were drafts).
  "d-g": { ...sidesA, U: UC(), D: DG() },
};
for (const [name, drawings] of Object.entries(faceSets)) {
  const d = root;
  mkdirSync(d, { recursive: true });
  for (const [face, shapes] of Object.entries(drawings)) {
    const svg = (viewBox, width) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${viewBox}">${shapes}</svg>\n`;
    writeFileSync(d + `${face}.svg`, svg("0 0 320 320", 320));
  }
}
console.log("written", Object.keys(faceSets).join(" "));
