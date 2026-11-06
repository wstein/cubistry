/** Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
 * This generator is the editable source of the artwork: art data under CC BY-SA 4.0, not AGPL program code.
 * "Pastel Stadtmusikanten" (Bremen Town Musicians) picture-cube proposal in the style of Pastel Garden.
 * Shipped as scripts/build-bremen-art.mjs; `node scripts/build-bremen-art.mjs` rewrites the six whole faces in
 * public/playground-bremen/ (the playground cuts them into stickers at run time). Run
 * `node scripts/build-playground-theme.mjs bremen` afterwards to re-pin them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
const dir = new URL("../public/playground-bremen/", import.meta.url);
mkdirSync(dir, { recursive: true });

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
// Story: the sky is tinted by the face beside it: dawn peach toward the Left face, warm butter toward the

// ---- Time of day around the four side faces ---------------------------------
// Belt coordinate s runs L(0..320) F(320..640) R(640..960) B(960..1280) and wraps (B|L seam).
// Dawn is centered on L, day on F, evening on R, night on B; every color below is a smooth
// periodic function of s, so each shared edge gets the same color on both neighbors.
const STOPS = [
  { top: "#cddbf4", hor: "#fbd1ba", far: "#c6e4cd", mid: "#a2cd92", path: "#f6dcc0", cloud: "#fff0e6", tree: "#86bb8c" },
  { top: "#c2e1f3", hor: "#e8f5f1", far: "#bfe6d4", mid: "#9cc08a", path: "#f8d5b8", cloud: "#fffaf1", tree: "#79ad84" },
  { top: "#e8b8d0", hor: "#fbd8aa", far: "#cbd9a4", mid: "#a5b97e", path: "#f3c8a2", cloud: "#ffe3dc", tree: "#86a272" },
  { top: "#8d85c8", hor: "#c9b8e8", far: "#9cc3c8", mid: "#7ba9b0", path: "#d3c4d8", cloud: "#cdc2ee", tree: "#5f8794" },
];
const sm = (t) => t * t * (3 - 2 * t);
const todAt = (s) => {
  const u = (((s - 160) % 1280) + 1280) % 1280, i = Math.floor(u / 320), t = sm((u % 320) / 320);
  const a = STOPS[i % 4], b = STOPS[(i + 1) % 4], out = {};
  for (const k of Object.keys(a)) out[k] = mix(a[k], b[k], t);
  return out;
};
const S0 = { L: 0, F: 320, R: 640, B: 960 };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (a) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const skyAt = (s, y) => { const t = todAt(s); return mix(t.top, t.hor, Math.min(1, y / 232) ** 1.4); };

// Smooth sky for a side face as a fine grid of flat cells (no gradients).
const skyField = (face) => {
  let out = `<rect width="320" height="320" fill="${todAt(S0[face] + 160).hor}"/>`;
  for (let y = 0; y < 240; y += 6)
    for (let x = 0; x < 320; x += 8) out += `<rect x="${x}" y="${y}" width="9" height="7" fill="${skyAt(S0[face] + x + 4, y + 3)}"/>`;
  return out;
};
const hillFn = (base, a, b) => (x) => base - a * Math.sin((Math.PI * x) / 320) + b * Math.sin((2 * Math.PI * x) / 320);
const strips = (face, yOf, key, step = 8) => {
  let out = "";
  for (let x = 0; x < 320; x += step)
    out += `<path d="M${x} ${yOf(x).toFixed(1)}L${x + step + 1} ${yOf(x + step + 1).toFixed(1)}V320H${x}Z" fill="${todAt(S0[face] + x + step / 2)[key]}"/>`;
  return out;
};
const poly = (yOf, w, c, step = 4) =>
  `<path d="M0 ${yOf(0).toFixed(1)}${Array.from({ length: 320 / step }, (_, i) => `L${(i + 1) * step} ${yOf((i + 1) * step).toFixed(1)}`).join("")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const pathY = (x) => 302 - 5 * Math.sin((2 * Math.PI * x) / 320);
// Horizontal garden/forest path with color following the time of day.
const beltPath = (face) => {
  let fill = "";
  for (let x = 0; x < 320; x += 8) {
    const x1 = x + 8;
    fill += `<path d="M${x} ${pathY(x).toFixed(1)}L${x1} ${pathY(x1).toFixed(1)}" fill="none" stroke="${todAt(S0[face] + x + 4).path}" stroke-width="14" stroke-linecap="round"/>`;
  }
  return { ink: poly(pathY, 20, ink, 8), fill };
};
// Branch of the road that leaves the path toward the viewer: this is where the Down face's road begins/ends.
// It is cx +- 25 wide at y=320 (the Down face draws the same road, 50 wide, entering at that edge).
const spur = (face, cx) => {
  const hw = (y) => 9 + 16 * sm(Math.min(1, Math.max(0, (y - 284) / 36)));
  const mk = (extra) => {
    const ys = Array.from({ length: 13 }, (_, i) => 284 + i * 3);
    const cxOf = (y) => cx + (1 - sm((y - 284) / 36)) * 4;
    const L = ys.map((y) => `${(cxOf(y) - hw(y) - extra).toFixed(1)} ${y}`), R = ys.map((y) => `${(cxOf(y) + hw(y) + extra).toFixed(1)} ${y}`).reverse();
    return `M${L.join("L")}L${R.join("L")}Z`;
  };
  const s = S0[face] + cx;
  return { ink: `<path d="${mk(3)}" fill="${ink}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`, fill: `<path d="${mk(0)}" fill="${todAt(s).path}"/>` };
};
// Layered ground: far hill, mid hill (outlined), path (+ optional road spur).
const ground = (face, far, mid, spurCx = null) => {
  const p = beltPath(face), sp = spurCx == null ? { ink: "", fill: "" } : spur(face, spurCx);
  return strips(face, far, "far") + strips(face, mid, "mid") + poly(mid, 3, ink) + p.ink + sp.ink + p.fill + sp.fill;
};
const treeOn = (face, yOf, x, sc) => pine(x, yOf(x) + 6 - 34 * sc, sc, todAt(S0[face] + x).tree);

// ---- Music-note thread across the four sides ---------------------------------
// One dotted trail at y=104 on every shared edge; notes sit at x=40,120,200,280 on each face (spacing 80
// continues across edges), each face bows the trail differently around its characters.
const noteHead = (x, y, c, r = 1) => `<ellipse cx="${x}" cy="${y}" rx="${6.4 * r}" ry="${4.8 * r}" fill="${c}" stroke="${ink}" stroke-width="${W.fine}" transform="rotate(-22 ${x} ${y})"/>`;
const noteGlyph = (x, y, kind, c) => {
  const st = (px, py, h = 22) => `<path d="M${px + 5.6} ${py - 1}V${py - h}" ${strokeW(2.5)}/>`;
  if (kind === 0) return st(x, y) + noteHead(x, y, c);
  if (kind === 1) return st(x, y) + `<path d="M${x + 5.6} ${y - 22}Q${x + 14} ${y - 16} ${x + 12} ${y - 7}" ${strokeW(2.5)}/>` + noteHead(x, y, c);
  const x2 = x + 17;
  return st(x, y, 23) + st(x2, y - 3, 26) + `<path d="M${x + 5.6} ${y - 23}L${x2 + 5.6} ${y - 29}" ${strokeW(5)}/>` + noteHead(x, y, c) + noteHead(x2, y - 3, c);
};
const noteCols = [H.pink.mid, H.butter.mid, H.lilac.mid, H.peach.mid, H.sky.mid];
const noteTrail = (face, yOf) => {
  const k0 = { L: 0, F: 1, R: 2, B: 3 }[face];
  let out = "";
  for (let x = 6; x < 320; x += 10) {
    if ([40, 120, 200, 280].some((n) => Math.abs(x - n) < 14)) continue;
    out += `<circle cx="${x}" cy="${yOf(x).toFixed(1)}" r="1.9" fill="${H.pink.dark}" opacity=".7"/>`;
  }
  [40, 120, 200, 280].forEach((x, i) => { out += noteGlyph(x, yOf(x), (i + k0) % 3, noteCols[(i + k0 * 2) % 5]); });
  return out;
};
const trailFn = (b, a = 0) => (x) => 104 - b * Math.sin((Math.PI * x) / 320) + a * Math.sin((2 * Math.PI * x) / 320);

// ---- Small scenery for this set -------------------------------------------------
const sunLow = (x, y, r, mid, light, shade = mix(mid, H.pink.dark, 0.35)) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10;
    return `<path d="M${(x + Math.cos(a) * (r + 10)).toFixed(1)} ${(y + Math.sin(a) * (r + 10)).toFixed(1)}L${(x + Math.cos(a) * (r + 22)).toFixed(1)} ${(y + Math.sin(a) * (r + 22)).toFixed(1)}" ${strokeW(4, mid)}/>`;
  }).join("") + `<circle cx="${x}" cy="${y}" r="${r + 9}" fill="${light}" opacity=".55"/>` + shaded(`<circle cx="${x}" cy="${y}" r="${r}"/>`, mid, shade, shine(x - r * 0.4, y - r * 0.4, r * 0.3, r * 0.18), [x, y]);
const sleepyMoon = (x, y, s) => moonShaded(x, y, s) + sleepyEye(x - 8 * s, y + 20 * s) + cheeks(x - 6 * s, y + 31 * s, 5 * s, H.pink.dark);
const cloudT = (face, x, y, s) => cloud(x, y, s, todAt(S0[face] + x).cloud);
const fern = (x, y, s = 1, c = H.green.dark) =>
  g(x, y, s, `<path d="M0 0Q-4 -26 6 -52" ${strokeW(W.outline, c)}/>` + [8, 20, 32, 44].map((t, i) => `<ellipse cx="${-12 + i * 1.5}" cy="${-t}" rx="11" ry="4.2" fill="${H.green.mid}" ${o} transform="rotate(${-28 - i * 4} ${-6 + i * 3} ${-t})"/><ellipse cx="${14 - i * 1.5}" cy="${-t - 5}" rx="11" ry="4.2" fill="${H.green.mid}" ${o} transform="rotate(${28 + i * 4} ${6 - i * 3} ${-t - 5})"/>`).join(""));
const acorn = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-9 -2Q-9 12 0 14Q9 12 9 -2Z" fill="${H.peach.mid}" ${o}/><path d="M-11 -2Q-11 -14 0 -14Q11 -14 11 -2Z" fill="${twig}" ${o}/><path d="M0 -14V-19" ${strokeW(W.fine)}/>`);
const hay = (x, y, s = 1) => g(x, y, s, `<path d="M-14 0L-18 -14M-6 0L-6 -18M4 0L8 -16M14 0L20 -12" ${strokeW(3, H.butter.dark)}/>`);
const fireflyDot = (x, y, r = 3) => glow(x, y, r);

// ---- Original characters (the four town musicians) ----------------------------
const brown = "#c98a63";
// Biscuit: butter-peach pup with floppy brown ears, a patch over one eye, a lilac bandana and a pink drum.
const dog = (() => {
  const body = `<ellipse cx="190" cy="240" rx="54" ry="46"/><circle cx="190" cy="186" r="50"/><ellipse cx="248" cy="218" rx="9" ry="22" transform="rotate(32 248 218)"/>`;
  const ear = (x, r) => `<ellipse cx="${x}" cy="192" rx="16" ry="34" transform="rotate(${r} ${x} 192)"/>`;
  const drum = `<path d="M148 262V292Q190 308 232 292V262Z" fill="${H.pink.mid}" ${o} stroke-linejoin="round"/><path d="M152 268L168 296L186 270L204 298L220 270L229 290" ${strokeW(3, H.lilac.dark)}/><ellipse cx="190" cy="262" rx="42" ry="11" fill="${H.pink.light}" stroke="${ink}" stroke-width="${W.outline}"/><ellipse cx="190" cy="262" rx="30" ry="6.5" fill="#fff" opacity=".55"/>`;
  const paws = merged(arm(148, 258, 25, 11, 15) + arm(233, 252, -35, 11, 15), H.peach.light);
  const sticks = `<path d="M150 250L172 262" ${strokeW(5, ink)}/><path d="M150 250L172 262" ${strokeW(2.5, H.butter.mid)}/><path d="M236 244L254 216" ${strokeW(5, ink)}/><path d="M236 244L254 216" ${strokeW(2.5, H.butter.mid)}/><circle cx="255" cy="214" r="4.5" fill="${H.butter.mid}" ${o}/><circle cx="172" cy="262" r="4.5" fill="${H.butter.mid}" ${o}/>`;
  const bandana = `<path d="M152 228Q190 246 228 228L192 266Z" fill="${H.lilac.mid}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/><circle cx="182" cy="240" r="2.6" fill="#fff"/><circle cx="198" cy="244" r="2.6" fill="#fff"/><circle cx="190" cy="254" r="2.6" fill="#fff"/>`;
  const face = `<ellipse cx="212" cy="180" rx="17" ry="15" fill="${H.peach.mid}"/><ellipse cx="190" cy="206" rx="25" ry="19" fill="${white}" stroke="${ink}" stroke-width="${W.outline}"/>${sparkleEye(166, 182)}${sparkleEye(214, 182)}<ellipse cx="190" cy="197" rx="8" ry="5.5" fill="${ink}"/><ellipse cx="188" cy="195.5" rx="2.4" ry="1.4" fill="#fff"/><path d="M190 202V208M190 208Q184 216 178 208M190 208Q196 216 202 208" ${strokeW(2.5)}/><ellipse cx="193" cy="217" rx="5" ry="6.5" fill="${H.pink.mid}" stroke="${ink}" stroke-width="2"/>${cheeks(190, 200, 36)}`;
  return `${shaded(body, H.peach.light, H.peach.mid, shine(160, 160, 16, 9), [190, 215])}${merged(ear(138, 14) + ear(242, -14), H.peach.dark)}${face}${bandana}${drum}${paws}${sticks}`;
})();

// Gray(-lilac) donkey Lenz: tall ears, sleepy singing face, a small lute, standing by a signpost at dawn.
const trumpetShape = (m, b, w0, w1) => {
  const dx = b[0] - m[0], dy = b[1] - m[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  const pts = [[m[0] + nx * w0, m[1] + ny * w0], [b[0] + nx * w1, b[1] + ny * w1], [b[0] - nx * w1, b[1] - ny * w1], [m[0] - nx * w0, m[1] - ny * w0]];
  return { pts: pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L"), nx, ny, l, dx, dy };
};
const donkey = (() => {
  const dk = mix(H.lilac.light, H.sky.mid, 0.4), dkSh = mix(H.lilac.mid, H.sky.dark, 0.4);
  const ears = `<ellipse cx="88" cy="132" rx="16" ry="28" transform="rotate(-32 88 132)"/><ellipse cx="150" cy="126" rx="16" ry="28" transform="rotate(28 150 126)"/>`;
  const body = `${ears}<circle cx="116" cy="178" r="40"/><ellipse cx="150" cy="200" rx="33" ry="23"/><ellipse cx="124" cy="250" rx="48" ry="42"/><ellipse cx="100" cy="294" rx="17" ry="10"/><ellipse cx="148" cy="294" rx="17" ry="10"/><ellipse cx="70" cy="254" rx="9" ry="20" transform="rotate(20 70 254)"/>`;
  const inner = `<ellipse cx="89" cy="133" rx="8" ry="19" fill="${H.pink.light}" transform="rotate(-32 89 133)"/><ellipse cx="149" cy="127" rx="8" ry="19" fill="${H.pink.light}" transform="rotate(28 149 127)"/><ellipse cx="74" cy="112" rx="7" ry="8" fill="${H.lilac.dark}" transform="rotate(-32 74 112)"/><ellipse cx="164" cy="106" rx="7" ry="8" fill="${H.lilac.dark}" transform="rotate(28 164 106)"/>`;
  const mane = `<path d="M96 144Q108 128 118 142Q126 128 138 142Q132 154 118 152Q106 156 96 144Z" fill="${H.lilac.dark}" stroke="${ink}" stroke-width="${W.fine}" stroke-linejoin="round"/>`;
  const face = `<ellipse cx="160" cy="207" rx="18" ry="13" fill="#fff0e8" stroke="${ink}" stroke-width="${W.outline}"/><circle cx="153" cy="203" r="2.2" fill="${ink}"/><circle cx="167" cy="203" r="2.2" fill="${ink}"/>${arcEye(104, 174)}${arcEye(134, 171)}${cheeks(119, 190, 30)}<path d="M152 211Q160 219 168 211" ${strokeW(2.5)}/>`;
  const lute = `<path d="M158 242L212 192" ${strokeW(13, ink)}/><path d="M158 242L212 192" ${strokeW(8.5, H.peach.dark)}/><path d="M212 192L222 183" ${strokeW(15, ink)}/><circle cx="215" cy="190" r="2.2" fill="${H.butter.light}"/><circle cx="222" cy="184" r="2.2" fill="${H.butter.light}"/>` + `<ellipse cx="148" cy="268" rx="27" ry="33" transform="rotate(-38 148 268)" fill="${H.peach.mid}" stroke="${ink}" stroke-width="${W.outline}"/><ellipse cx="148" cy="268" rx="18" ry="23" transform="rotate(-38 148 268)" fill="none" stroke="${H.peach.dark}" stroke-width="2"/><circle cx="150" cy="266" r="8" fill="${ink}"/><path d="M155 261L214 192M159 264L218 196" ${strokeW(1.6, white)}/><path d="M134 288L146 280" ${strokeW(3, H.peach.dark)}/>`;
  const paws = merged(arm(188, 218, -38, 10, 14) + arm(130, 276, 70, 10, 14), dk);
  return `${shaded(body, dk, dkSh, shine(98, 160, 14, 8), [118, 220])}${inner}${mane}${face}${lute}${paws}`;
})();
const signpost = (() => {
  const board = (pts, c) => `<path d="M${pts}Z" fill="${c}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/>`;
  return `<rect x="257" y="146" width="12" height="156" rx="3" fill="${twig}" stroke="${ink}" stroke-width="${W.outline}"/>${star(263, 136, 11, H.butter.mid)}${board("230 168L286 168L300 181L286 194L230 194", H.peach.light)}<circle cx="246" cy="181" r="2.8" fill="${ink}"/><circle cx="258" cy="181" r="2.8" fill="${ink}"/>${board("296 206L246 206L232 219L246 232L296 232", H.sky.mid)}${heart(278, 219, 6)}`;
})();
function heart(x, y, r) { return `<path d="M${x} ${y + r}C${x - r * 2} ${y - r * 0.2} ${x - r * 0.6} ${y - r * 1.4} ${x} ${y - r * 0.4}C${x + r * 0.6} ${y - r * 1.4} ${x + r * 2} ${y - r * 0.2} ${x} ${y + r}Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2"/>`; }

// Mimi: peach tabby cat with tambourine, sitting on a stone wall in the evening.
const cat = (() => {
  const earsP = `<path d="M112 150L112 108L146 132Z"/><path d="M154 132L188 108L188 150Z"/>`;
  const body = `${earsP}<circle cx="150" cy="170" r="42"/><ellipse cx="152" cy="228" rx="40" ry="38"/><ellipse cx="128" cy="262" rx="14" ry="8"/><ellipse cx="174" cy="262" rx="14" ry="8"/>`;
  const tail = `<path d="M188 244Q246 252 240 204Q238 190 226 194" ${strokeW(17, ink)}/><path d="M188 244Q246 252 240 204Q238 190 226 194" ${strokeW(11, H.peach.light)}/><path d="M233 240L241 232M243 226L251 218" ${strokeW(3, H.peach.dark)}/>`;
  const earIn = `<path d="M120 142L119 122L136 133Z" fill="${H.pink.mid}"/><path d="M164 133L181 122L180 142Z" fill="${H.pink.mid}"/>`;
  const stripes = `<path d="M150 131V143M140 133L142 144M160 133L158 144M110 168L120 170M110 178L121 177M190 168L180 170M190 178L179 177" ${strokeW(3, H.peach.dark)}/>`;
  const face = `${arcEye(134, 170)}${arcEye(166, 170)}${cheeks(150, 184, 31)}<path d="M145 180L155 180L150 186Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/><path d="M150 186Q144 193 137 187M150 186Q156 193 163 187" ${strokeW(2.2)}/><path d="M119 183L96 179M119 189L96 194M181 183L204 179M181 189L204 194" ${strokeW(1.8)}/>`;
  const jingles = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 8 + 0.3;
    return `<circle cx="${(106 + Math.cos(a) * 25).toFixed(1)}" cy="${(220 + Math.sin(a) * 25).toFixed(1)}" r="4.2" fill="${H.butter.light}" stroke="${ink}" stroke-width="2"/>`;
  }).join("");
  const tam = `<circle cx="106" cy="220" r="27" fill="${H.lilac.mid}" stroke="${ink}" stroke-width="${W.outline}"/><circle cx="106" cy="220" r="19" fill="${H.pink.light}" stroke="${ink}" stroke-width="2"/>${jingles}<path d="M96 214Q106 206 116 214" ${strokeW(2, "#fff")}/>`;
  const paws = merged(arm(130, 240, 70, 10, 13) + arm(86, 196, -25, 10, 13), H.peach.light);
  return `${tail}${shaded(body, H.peach.light, H.peach.mid, shine(124, 148, 14, 8), [150, 205])}${earIn}${stripes}${face}${tam}${paws}`;
})();
const wall = (face) => {
  const cols = [H.lilac.light, H.peach.light, H.pink.light, H.lilac.light, H.peach.light];
  return `<rect x="50" y="262" width="250" height="30" rx="10" fill="${ink}"/>` + cols.map((c, i) => `<rect x="${52 + i * 50}" y="264" width="46" height="26" rx="9" fill="${c}" stroke="${ink}" stroke-width="2.5"/>`).join("") + `<path d="M58 262Q62 254 70 262M262 262Q268 252 276 262" ${strokeW(3, H.green.dark)}/>`;
};

// Gockel: cream rooster with a pink comb and a golden trumpet, crowing at the moon from a hay bale.
const rooster = (() => {
  const trumpet = (() => {
    const m = [138, 164], b = [92, 114], t = trumpetShape(m, b, 4, 15);
    const rim = `<ellipse cx="${b[0]}" cy="${b[1]}" rx="9" ry="19" transform="rotate(${(Math.atan2(t.dy, t.dx) * 180) / Math.PI} ${b[0]} ${b[1]})" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>`;
    const valves = [0.4, 0.55, 0.7].map((f) => { const x = m[0] + t.dx * f + t.nx * 9, y = m[1] + t.dy * f + t.ny * 9; return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(t.nx * 9).toFixed(1)} ${(t.ny * 9).toFixed(1)}" ${strokeW(3, ink)}/><circle cx="${(x + t.nx * 10).toFixed(1)}" cy="${(y + t.ny * 10).toFixed(1)}" r="3.6" fill="${H.pink.mid}" ${o}/>`; }).join("");
    return `<path d="M${t.pts}Z" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/>${rim}${valves}`;
  })();
  const fan = [[88, H.pink.mid], [62, H.lilac.mid], [36, H.sky.mid], [10, H.butter.mid]].map(([r, c]) => `<ellipse cx="214" cy="170" rx="11" ry="40" fill="${c}" stroke="${ink}" stroke-width="${W.outline}" transform="rotate(${r} 214 214)"/>`).join("");
  const comb = `<g fill="${H.pink.dark}" stroke="${ink}" stroke-width="${W.outline}"><circle cx="150" cy="128" r="8"/><circle cx="162" cy="123" r="9"/><circle cx="175" cy="129" r="8"/></g>`;
  const body = `<circle cx="162" cy="156" r="28"/><ellipse cx="180" cy="204" rx="38" ry="40"/>`;
  const wing = `<ellipse cx="190" cy="212" rx="21" ry="26" fill="${H.lilac.light}" stroke="${ink}" stroke-width="${W.outline}" transform="rotate(-18 190 212)"/><path d="M180 206Q192 214 200 230M174 216Q184 222 190 236" ${strokeW(2, H.lilac.dark)}/>`;
  const face = `${arcEye(160, 150)}<ellipse cx="168" cy="168" rx="8" ry="5.5" fill="${H.pink.dark}" opacity=".55"/><ellipse cx="146" cy="176" rx="6" ry="10" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2"/>`;
  const legs = `<path d="M168 244V252M192 244V252" ${strokeW(4, H.peach.dark)}/><path d="M160 254H176M184 254H200" ${strokeW(4, H.peach.dark)}/>`;
  const bale = shaded(`<rect x="132" y="244" width="96" height="56" rx="18"/>`, H.butter.mid, H.butter.dark, shine(150, 256, 12, 5), [180, 272], 0.92) + `<path d="M156 246V298M204 246V298" ${strokeW(3, H.peach.dark)}/><path d="M142 262H150M162 270H198M210 260H220M140 284H150M212 286H222" ${strokeW(2, H.butter.dark)}/>${hay(136, 304, 0.8)}${hay(224, 304, 0.8)}<path d="M128 252L122 244M232 252L238 244" ${strokeW(3, H.butter.dark)}/>`;
  return `${fan}${bale}${shaded(body, white, "#f1dcdc", shine(152, 142, 10, 6), [175, 190])}${comb}${wing}${face}${legs}${trumpet}`;
})();

// Tiny pyramid of the four friends (donkey, dog, cat, rooster), peeking at the lit window.
const pyramid = (x, y, s = 1) =>
  g(x, y, s, `${merged(`<ellipse cx="0" cy="-12" rx="30" ry="18"/><ellipse cx="-14" cy="-34" rx="5" ry="12"/><ellipse cx="14" cy="-34" rx="5" ry="12"/><circle cx="0" cy="-30" r="14"/>`, H.lilac.light)}${merged(`<ellipse cx="0" cy="-54" rx="21" ry="13"/><circle cx="0" cy="-66" r="11"/><ellipse cx="-12" cy="-64" rx="5" ry="9"/><ellipse cx="12" cy="-64" rx="5" ry="9"/>`, H.peach.mid)}${merged(`<ellipse cx="0" cy="-86" rx="14" ry="11"/><circle cx="0" cy="-98" r="9"/><path d="M-8 -104L-9 -118L0 -108ZM8 -104L9 -118L0 -108Z"/>`, H.peach.light)}${merged(`<ellipse cx="0" cy="-118" rx="9" ry="8"/><circle cx="2" cy="-128" r="6.5"/>`, white)}<g fill="${H.pink.dark}" stroke="${ink}" stroke-width="1.6"><circle cx="-2" cy="-136" r="3.2"/><circle cx="3" cy="-137" r="3.4"/><circle cx="8" cy="-134" r="3"/></g><g fill="${ink}"><circle cx="-5" cy="-31" r="1.7"/><circle cx="5" cy="-31" r="1.7"/><circle cx="-4" cy="-66" r="1.6"/><circle cx="4" cy="-66" r="1.6"/><circle cx="-3" cy="-98" r="1.5"/><circle cx="3" cy="-98" r="1.5"/><circle cx="5" cy="-128" r="1.4"/></g>`);

// ---- Faces ------------------------------------------------------------------
const farL = hillFn(226, 30, 8), midL = hillFn(262, 8, -5);
const farF = hillFn(226, 16, -6), midF = hillFn(262, 6, 4);
const farR = hillFn(226, 26, 10), midR = hillFn(262, 8, 5);
const farB = hillFn(226, 22, -8), midB = hillFn(262, 7, -4);
const stars = (face, pts) => pts.map(([x, y, r]) => star(x, y, r, H.butter.light)).join("");
const cottage = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-16 0V-22H16V0Z" fill="${white}" ${o}/><path d="M-22 -22L0 -42L22 -22Z" fill="${H.pink.mid}" ${o} stroke-linejoin="round"/><rect x="8" y="-44" width="7" height="12" fill="${H.peach.mid}" ${o}/><rect x="-5" y="-17" width="10" height="9" rx="2" fill="${H.butter.light}" ${o}/><circle cy="-13" r="9" fill="${H.butter.mid}" opacity=".35"/>`);

const drawings = {
  // LEFT (dawn): Lenz the donkey strums his lute at a signpost; the sun climbs behind the hills.
  L: skyField("L") + sunLow(44, 196, 19, H.peach.mid, H.butter.light) + cloudT("L", 214, 72, 0.7) + cloudT("L", 70, 52, 0.55) + stars("L", [[24, 22, 6], [100, 30, 5]]) +
    ground("L", farL, midL) + [[196, 1.0], [232, 0.8]].map(([x, sc]) => treeOn("L", farL, x, sc)).join("") +
    noteTrail("L", trailFn(24)) + signpost + donkey + mushroom(34, 296, 1.0) + tuft(70, 312) + tuft(296, 308) + dot(184, 304, 4, H.pink.mid) + dot(198, 311, 3.5, H.butter.mid) + bird(224, 134, H.peach.mid, 0.8, -1),
  // FRONT (day, hero): Biscuit the dog drums on the forest road at the junction; the road leads toward the viewer (Down face).
  F: skyField("F") + sunLow(244, 44, 20, H.butter.mid, H.butter.light, H.butter.dark) + cloudT("F", 78, 58, 0.8) + cloudT("F", 258, 128, 0.45) + bird(30, 140, H.pink.mid, 0.85, 1) +
    ground("F", farF, midF, 200) + treeOn("F", farF, 40, 1.15) + treeOn("F", farF, 80, 0.8) + treeOn("F", farF, 292, 0.9) +
    noteTrail("F", trailFn(14)) + dog + mushroom(30, 298, 1.1) + mushroom(54, 306, 0.7, H.peach.dark) + tuft(100, 312) + tuft(284, 310) + snail(272, 296, 0.8) + butterfly(46, 220, H.sky.mid, H.lilac.light, 0.8),
  // RIGHT (evening): Mimi the cat shakes her tambourine on the stone wall; lights come on in the far cottage.
  R: skyField("R") + sunLow(266, 204, 24, H.peach.dark, H.pink.light) + cloudT("R", 100, 62, 0.8) + cloudT("R", 256, 74, 0.5) + stars("R", [[290, 20, 5], [226, 38, 4], [30, 28, 4]]) +
    ground("R", farR, midR) + cottage(34, farR(34) + 6, 1) +
    noteTrail("R", trailFn(10)) + wall("R") + cat + tuft(40, 312) + tuft(300, 310) + dot(236, 306, 4, H.pink.mid) + dot(250, 312, 3.5, H.butter.mid) + bird(246, 120, H.lilac.mid, 0.8, -1),
  // BACK (night): Gockel the rooster blows his trumpet at the moon from a hay bale; fireflies glow.
  B: skyField("B") + stars("B", [[40, 28, 6], [136, 22, 5], [208, 34, 7], [292, 24, 5], [250, 80, 4], [20, 150, 4], [300, 150, 5]]) + sleepyMoon(60, 20, 0.72) + cloudT("B", 252, 66, 0.55) +
    ground("B", farB, midB, 120) + treeOn("B", farB, 40, 1.1) + treeOn("B", farB, 288, 0.9) + treeOn("B", farB, 84, 0.7) +
    noteTrail("B", trailFn(8, 6)) + rooster + fireflyDot(34, 204) + fireflyDot(96, 236, 2.6) + fireflyDot(292, 190, 3) + fireflyDot(240, 246, 2.4) + mushroom(44, 300, 0.9) + tuft(76, 312) + tuft(296, 310),
};

// ---- Up and Down: Coons-patch blends so every edge starts in exactly the neighbor's color -------------
const coonsField = (T, Bt, Lf, Rt, extra = null, cell = 6) => {
  const c = (f, t) => rgb(f(t)), corner = (a, b) => a.map((v, i) => (v + b[i]) / 2);
  const T0 = c(T, 0), T1 = c(T, 1), B0 = c(Bt, 0), B1 = c(Bt, 1);
  let out = `<rect width="320" height="320" fill="${hex(corner(T0, B1))}"/>`;
  for (let y = 0; y < 320; y += cell)
    for (let x = 0; x < 320; x += cell) {
      const u = (x + cell / 2) / 320, v = (y + cell / 2) / 320;
      const t = c(T, u), b = c(Bt, u), l = c(Lf, v), r = c(Rt, v);
      let col = t.map((_, i) => (1 - v) * t[i] + v * b[i] + (1 - u) * l[i] + u * r[i] - ((1 - u) * (1 - v) * T0[i] + u * (1 - v) * T1[i] + (1 - u) * v * B0[i] + u * v * B1[i]));
      if (extra) col = extra(col, u, v);
      out += `<rect x="${x}" y="${y}" width="${cell + 1}" height="${cell + 1}" fill="${hex(col)}"/>`;
    }
  return out;
};
const bump = (u, v) => 16 * u * (1 - u) * v * (1 - v);
const whiten = (k) => (col, u, v) => col.map((x, i) => x + (rgb(white)[i] - x) * k * bump(u, v));
const topAt = (s) => todAt(s).top, midAt = (s) => todAt(s).mid;
const upField = coonsField((u) => topAt(1280 - u * 320), (u) => topAt(320 + u * 320), (v) => topAt(v * 320), (v) => topAt(960 - v * 320), whiten(0.3));
const downField = coonsField((u) => midAt(320 + u * 320), (u) => midAt(1280 - u * 320), (v) => midAt(320 - v * 320), (v) => midAt(640 + v * 320), (c, u, v) => c.map((x, i) => x + (rgb("#bfdcab")[i] - x) * 0.18 * bump(u, v)));

// UP: the robbers' cottage is just a warm, lit cottage; seen from above on a little meadow in the sky.
const upArt = (() => {
  const island = shaded(`<ellipse cx="170" cy="200" rx="134" ry="92"/><circle cx="76" cy="168" r="40"/><circle cx="262" cy="170" r="42"/><circle cx="130" cy="124" r="36"/>`, H.green.light, H.green.mid, shine(108, 150, 22, 9), [170, 200], 0.94, [-4, -5]);
  const steps = [[146, 290, 8], [156, 270, 10], [170, 252, 6]].map(([x, y, r], i) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="7.5" fill="${H.peach.light}" ${o} transform="rotate(${i * 24 - 20} ${x} ${y})"/>`).join("");
  const shadow = `<ellipse cx="204" cy="238" rx="74" ry="46" fill="${H.green.dark}" opacity=".3"/>`;
  const roofUp = `<path d="M132 204L148 168H258L274 204Z" fill="${H.pink.light}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/>`;
  const roofDown = `<path d="M132 204H274L284 244H122Z" fill="${H.pink.mid}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/>`;
  const tiles = [[154, 182, 252], [142, 194, 266]].map(([x0, y, x1]) => `<path d="M${x0} ${y}H${x1}" ${strokeW(W.fine, H.pink.dark)}/>`).join("") + [[132, 218, 276], [128, 232, 280]].map(([x0, y, x1]) => `<path d="M${x0} ${y}H${x1}" ${strokeW(W.fine, H.pink.dark)}/>`).join("");
  const ridge = `<path d="M130 204H276" ${strokeW(6, ink)}/><path d="M130 204H276" ${strokeW(3, H.peach.light)}/>`;
  const chimney = `<rect x="228" y="172" width="22" height="22" fill="${H.peach.mid}" stroke="${ink}" stroke-width="${W.outline}"/><rect x="224" y="168" width="30" height="9" rx="2" fill="${H.peach.light}" stroke="${ink}" stroke-width="${W.outline}"/><ellipse cx="239" cy="170" rx="9" ry="2.6" fill="${ink}" opacity=".6"/>`;
  const dormer = `<circle cx="190" cy="228" r="34" fill="${H.butter.light}" opacity=".6"/><circle cx="190" cy="228" r="24" fill="${H.butter.mid}" opacity=".5"/><path d="M168 244V224L190 208L212 224V244Z" fill="${white}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/><rect x="180" y="224" width="20" height="18" rx="9" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.fine}"/><path d="M190 224V242M180 233H200" ${strokeW(W.fine)}/><path d="M164 226L190 202L216 226" ${strokeW(W.outline)}/>`;
  const smoke = [[238, 156, 8], [246, 138, 10], [238, 116, 12], [252, 92, 14]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${white}" stroke="${ink}" stroke-width="${W.fine}"/>`).join("") + noteGlyph(268, 66, 1, H.pink.mid) + `<path d="M262 74Q250 76 254 90" fill="none" stroke="${white}" stroke-width="0"/>`;
  const sparkle = [[268, 54, 4]];
  const trees = pine(78, 214, 0.8, H.green.mid) + pine(104, 250, 0.55, H.green.dark);
  const moon = sleepyMoon(56, 44, 0.9);
  return upField + moon + stars("U", [[30, 26, 5], [118, 30, 6], [26, 116, 4], [120, 98, 4], [300, 24, 5], [300, 190, 4]]) + cloudFar(22, 150, 0.5, "#ffffff") + cloudFar(268, 296, 0.45, "#ffffff") + cloud(32, 306, 0.5, "#f1ecfb") +
    island + `<path d="M40 214Q60 206 74 214" ${strokeW(W.fine, H.green.dark)}/>` + steps + shadow + roofUp + roofDown + tiles + ridge + chimney + dormer + trees + smoke +
    pyramid(240, 296, 0.6) + mushroom(70, 262, 0.7) + tuft(118, 284) + fireflyDot(46, 236, 3) + fireflyDot(300, 130, 3) + bird(150, 40, H.pink.mid, 0.8, -1);
})();

// DOWN: the road from the Front face winds through the forest toward the cottage; the four friends' prints go along it.
const rx = (y) => 200 - 70 * Math.sin((Math.PI * y) / 320) ** 2 + 30 * Math.sin((2 * Math.PI * y) / 320) * Math.sin((Math.PI * y) / 320);
const roadArt = (() => {
  const N = 88, hwI = 25;
  const c = Array.from({ length: N + 1 }, (_, i) => { const y = -16 + i * 4; return [rx(Math.min(320, Math.max(0, y))), y]; });
  const nrm = c.map((p, i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(N, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dy / l, -dx / l]; });
  const side = (i, k, sg) => [(c[i][0] + sg * nrm[i][0] * k).toFixed(1), (c[i][1] + sg * nrm[i][1] * k).toFixed(1)].join(" ");
  const band = (i0, i1, k) => `M${Array.from({ length: i1 - i0 + 1 }, (_, j) => side(i0 + j, k, 1)).join("L")}L${Array.from({ length: i1 - i0 + 1 }, (_, j) => side(i1 - j, k, -1)).join("L")}Z`;
  let out = `<path d="${band(0, N, hwI + 3)}" fill="${ink}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="${band(0, N, hwI)}" fill="${todAt(800).path}"/>`;
  for (let i = 0; i < N; i += 4) out += `<path d="${band(i, Math.min(N, i + 5), hwI)}" fill="${todAt(520 + (560 * Math.min(320, Math.max(0, -16 + (i + 2.5) * 4))) / 320).path}"/>`;
  const pc = (s) => mix(todAt(s).path, ink, 0.3);
  const paw = (col) => `<g fill="${col}"><ellipse cx="0" cy="3" rx="6.5" ry="5.5"/><circle cx="-7" cy="-4" r="2.8"/><circle cx="-2.4" cy="-8" r="2.8"/><circle cx="2.4" cy="-8" r="2.8"/><circle cx="7" cy="-4" r="2.8"/></g>`;
  const hoof = (col) => `<g fill="${col}"><path d="M-10 -9Q-3 -11 -2 -2Q-2 8 -10 9Q-13 0 -10 -9Z"/><path d="M10 -9Q3 -11 2 -2Q2 8 10 9Q13 0 10 -9Z"/></g>`;
  const pad = (col) => `<g fill="${col}"><ellipse cx="0" cy="2" rx="4.6" ry="3.8"/><circle cx="-5" cy="-3" r="2.1"/><circle cx="-1.8" cy="-6" r="2.1"/><circle cx="1.8" cy="-6" r="2.1"/><circle cx="5" cy="-3" r="2.1"/></g>`;
  const claw = (col) => `<g ${strokeW(2.6, col)}><path d="M0 4V-10M0 4L-8 -7M0 4L8 -7"/></g>`;
  const fns = [hoof, paw, pad, claw];
  for (let i = 0; i < 8; i++) {
    const y = 28 + i * 37, e = 0.5, dxdy = (rx(y + e) - rx(y - e)) / (2 * e), l = Math.hypot(1, dxdy), sg = i % 2 ? -1 : 1;
    const th = (Math.atan2(-dxdy, 1) * 180) / Math.PI;
    out += g(rx(y) + (sg * 10) / l, y - (sg * 10 * dxdy) / l, 1, `<g transform="rotate(${th.toFixed(1)})">${fns[i % 4](pc(520 + (560 * y) / 320))}</g>`);
  }
  return out;
})();
const leaf = (x, y, rot, c, s = 0.5) => leafShape(x, y, rot, s).replace(H.green.mid, c);
const stump = (x, y, s = 1) =>
  g(x, y, s, shaded(`<path d="M-26 -4Q-30 18 -22 28H22Q30 18 26 -4Z"/>`, twig, mix(twig, ink, 0.25), "", [0, 12], 0.9, [-3, -2]) + `<ellipse cy="-4" rx="27" ry="10" fill="${H.peach.light}" stroke="${ink}" stroke-width="${W.outline}"/><ellipse cy="-4" rx="16" ry="5.5" fill="none" stroke="${H.peach.dark}" stroke-width="2"/>`);
const bush = (x, y, sc) =>
  shaded(g(x, y, sc, `<circle cx="-24" cy="8" r="22"/><circle cx="4" cy="-10" r="30"/><circle cx="32" cy="8" r="22"/><ellipse cx="4" cy="22" rx="46" ry="14"/>`), H.green.mid, H.green.dark, shine(x - 14 * sc, y - 24 * sc, 14 * sc, 7 * sc), [x, y]);
const berryBush = (x, y, s) => bush(x, y, s) + [[-18, -4], [4, -16], [20, 0], [-4, 6], [12, 12]].map(([dx, dy]) => dot(x + dx * s, y + dy * s, 3.6 * s + 0.6, H.pink.dark)).join("");
const downArt = downField +
  `<ellipse cx="60" cy="60" rx="46" ry="26" fill="${H.green.dark}" opacity=".16"/><ellipse cx="270" cy="270" rx="44" ry="26" fill="${H.green.dark}" opacity=".16"/>` +
  roadArt +
  leaf(36, 74, -30, H.peach.mid) + leaf(60, 90, 40, H.butter.dark, 0.45) + leaf(24, 100, 10, H.pink.mid, 0.4) + fern(100, 126, 0.9) + fern(34, 76, 0.75) + tuft(120, 34) +
  mushroom(262, 86, 0.95) + mushroom(286, 112, 0.65, H.peach.dark) + mushroom(240, 118, 0.6) + acorn(284, 50, 1) + tuft(290, 150) +
  stump(52, 242, 0.9) + mushroom(94, 270, 0.8, H.peach.dark) + mushroom(24, 276, 0.6) + snail(120, 306, 0.8) + tuft(20, 190) + leaf(112, 220, 20, H.butter.dark, 0.4) +
  berryBush(274, 262, 0.72) + ladybug(236, 214, 1.0) + tuft(240, 300) + leaf(268, 196, -40, H.peach.mid, 0.42) + butterfly(70, 170, H.lilac.mid, H.pink.light, 0.9);
// ---- Round 3: compact Up face (merged flat runs instead of one rect per cell) ----
const coonsAt = (T, Bt, Lf, Rt, extra) => {
  const c = (f, t) => rgb(f(t)), T0 = c(T, 0), T1 = c(T, 1), B0 = c(Bt, 0), B1 = c(Bt, 1);
  return (x, y) => {
    const u = x / 320, v = y / 320, t = c(T, u), b = c(Bt, u), l = c(Lf, v), r = c(Rt, v);
    const col = t.map((_, i) => (1 - v) * t[i] + v * b[i] + (1 - u) * l[i] + u * r[i] - ((1 - u) * (1 - v) * T0[i] + u * (1 - v) * T1[i] + (1 - u) * v * B0[i] + u * v * B1[i]));
    return extra ? extra(col, u, v) : col;
  };
};
const compactField = (colorAt, cell = 6) => {
  const q = (a) => hex(a.map((v) => Math.round(v / 2) * 2)), groups = new Map();
  for (let y = 0; y < 320; y += cell) {
    let x = 0;
    while (x < 320) {
      const col = q(colorAt(x + cell / 2, y + cell / 2));
      let x2 = x + cell;
      while (x2 < 320 && q(colorAt(x2 + cell / 2, y + cell / 2)) === col) x2 += cell;
      if (!groups.has(col)) groups.set(col, []);
      groups.get(col).push(`M${x} ${y}h${x2 - x + 1}v${cell + 1}h${-(x2 - x + 1)}z`);
      x = x2;
    }
  }
  return `<rect width="320" height="320" fill="${hex(colorAt(160, 160))}"/>` + [...groups].map(([c, d]) => `<path fill="${c}" d="${d.join("")}"/>`).join("");
};
const upAt = coonsAt((u) => topAt(1280 - u * 320), (u) => topAt(320 + u * 320), (v) => topAt(v * 320), (v) => topAt(960 - v * 320), whiten(0.3));
const upSky = compactField(upAt);
// Rescale stroke widths so a shrunken character keeps the normal line weights.
const stripSc = (str, sc) => str.replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${(+w / sc).toFixed(2)}"`);
const mini = (str, cx0, base, x, y, sc) => g(x - cx0 * sc, y - base * sc, sc, stripSc(str, sc));
const upC = (() => {
  // Note ribbon: chain of cubic segments drifting up across the sky, fading out into sparkles at both ends.
  const seg = [[[24, 262], [100, 276], [112, 198], [172, 192]], [[172, 192], [240, 186], [226, 100], [290, 64]]];
  const pt = (k, t) => { const [p0, p1, p2, p3] = seg[k], u = 1 - t; return [0, 1].map((i) => u ** 3 * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t ** 3 * p3[i]); };
  const rib = `M${seg[0][0].join(" ")}${seg.map(([, a, b, c]) => `C${a.join(" ")} ${b.join(" ")} ${c.join(" ")}`).join("")}`;
  const ribbon = `<path d="${rib}" ${strokeW(15, ink)}/><path d="${rib}" ${strokeW(10, white)}/>`;
  const on = [[0, 0.3, 0, H.pink.mid], [0, 0.78, 2, H.butter.mid], [1, 0.3, 0, H.sky.mid], [1, 0.62, 1, H.lilac.mid], [1, 0.9, 2, H.peach.mid]];
  const notes = on.map(([k, t, kind, c]) => { const [x, y] = pt(k, t); return noteGlyph(x - 3, y + 2, kind, c); }).join("");
  const dots = [[0, 0.05], [0, 0.12], [1, 0.98]].map(([k, t]) => { const [x, y] = pt(k, t); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${white}" stroke="${ink}" stroke-width="${W.fine}"/>`; }).join("");
  const tiny = (x, y) => `<path d="M${x} ${y}q4-6 8 0q4-6 8 0" ${strokeW(W.fine)}/>`;
  const kid = cloudShaded(226, 292, 0.78, white, H.lilac.light) + sleepyEye(256, 264) + sleepyEye(276, 264) + cheeks(266, 274, 14, H.pink.dark);
  return upSky +
    cloudFar(8, 130, 0.9, "#ffffff") + cloudFar(190, 74, 0.75, "#ffffff") + cloudFar(120, 300, 0.8, "#ffffff") + cloudFar(240, 190, 0.55, "#ffffff") +
    stars("U", [[30, 30, 6], [104, 22, 5], [150, 56, 4], [214, 26, 5], [300, 22, 5], [296, 118, 4], [22, 130, 4], [90, 150, 4], [200, 140, 4], [150, 270, 5], [36, 214, 4], [300, 200, 5]]) +
    sleepyMoon(60, 40, 0.8) + cloud(190, 100, 0.45, "#f6f0fb") + cloud(24, 206, 0.5, "#f6f0fb") +
    ribbon + notes + dots + tiny(120, 100) + tiny(250, 40) + tiny(40, 160) + bird(170, 250, H.pink.mid, 0.8, -1) +
    cloudShaded(30, 312, 0.78, white, H.lilac.light) + kid;
})();
drawings.U = upC;
drawings.D = downArt;

// ---- Output -----------------------------------------------------------------
for (const [face, shapes] of Object.entries(drawings)) {
  const svg = (viewBox, width) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${viewBox}">${shapes}</svg>\n`;
  writeFileSync(new URL(`${face}.svg`, dir), svg("0 0 320 320", 320));
}
console.log("wrote the six faces");
