/** Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
 * This generator is the editable source of the artwork: art data under CC BY-SA 4.0, not AGPL program code.
 * Halloween theme fork of the Pastel Garden generator ("Pastel Spooky-Sweet Halloween").
 * Shipped as scripts/build-halloween-art.mjs; `node scripts/build-halloween-art.mjs` rewrites the six whole faces in
 * public/playground-halloween/ (the playground cuts them into stickers at run time). Run
 * `node scripts/build-playground-theme.mjs halloween` afterwards to re-pin them.
 * Writes ONLY into this directory. Style guide + helpers are reused unchanged from the original.
 * Run: node gen.mjs
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = new URL("../public/playground-halloween/", import.meta.url);

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
// Smooth variant of edgeField: a fine grid of flat cells whose color is an inverse-distance blend of
// the four edge colors and the center, so no visible color boundaries remain. Cells overlap by 1px so
// no hairline seams appear when the texture is scaled. Flat rects only (no gradients or url()).
const smoothField = (e, center, cell = 16) => {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const sides = [["top", (x, y) => y], ["bottom", (x, y) => 320 - y], ["left", (x) => x], ["right", (x) => 320 - x]];
  let out = `<rect width="320" height="320" fill="${center}"/>`;
  for (let y = 0; y < 320; y += cell)
    for (let x = 0; x < 320; x += cell) {
      const cx = x + cell / 2, cy = y + cell / 2;
      let wsum = 30, acc = hex(center).map((v) => v * 30);
      for (const [k, d] of sides) {
        const w = 1 / (d(cx, cy) / 320 + 0.06) ** 2, c = hex(e[k]);
        wsum += w;
        acc = acc.map((v, i) => v + w * c[i]);
      }
      const col = "#" + acc.map((v) => Math.round(v / wsum).toString(16).padStart(2, "0")).join("");
      out += `<rect x="${x}" y="${y}" width="${cell + 1}" height="${cell + 1}" fill="${col}"/>`;
    }
  return out;
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

// ---- Halloween palette additions (all pastel) -------------------------------
H.pumpkin = { bg: "#ffe9d2", light: "#fbcfa6", mid: "#f7a468", dark: "#e5824c" };
H.plum = { bg: "#e9def8", light: "#cdb8e8", mid: "#a98fd4", dark: "#8468b3" };
const ellipse = (cx, cy, rx, ry, rot = 0) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""}/>`;

// ---- Story: dusk (L) -> lantern-lit patch (F) -> ghost party (R) -> midnight (B) ----
// Sky colors are defined at the face boundaries so shared edges match exactly.
const bnd = { BL: "#aa9bd9", LF: "#cc9fd2", FR: "#a086c9", RB: "#7a66b4" };
const bndG = { BL: 0.45, LF: 0.55, FR: 0.4, RB: 0.1 };
const bndN = { BL: 0.3, LF: 0.25, FR: 0.55, RB: 0.75 }; // night depth, drives sky darkening and ground tint
const skyDef = {
  L: { l: bnd.BL, c: "#dcb6dc", r: bnd.LF, gl: [bndG.BL, 0.6, bndG.LF], n: [bndN.BL, 0.1, bndN.LF] },
  F: { l: bnd.LF, c: "#c08fc8", r: bnd.FR, gl: [bndG.LF, 0.8, bndG.FR], n: [bndN.LF, 0.4, bndN.FR] },
  R: { l: bnd.FR, c: "#8e78c2", r: bnd.RB, gl: [bndG.FR, 0.25, bndG.RB], n: [bndN.FR, 0.65, bndN.RB] },
  B: { l: bnd.RB, c: "#5c4d9e", r: bnd.BL, gl: [bndG.RB, 0, bndG.BL], n: [bndN.RB, 0.9, bndN.BL] },
};
const sm = (t) => t * t * (3 - 2 * t);
const tri = (f, x, key) => {
  const d = skyDef[f], t = x / 320, k = t < 0.5 ? sm(t * 2) : sm((t - 0.5) * 2), a = d[key];
  return t < 0.5 ? a[0] + (a[1] - a[0]) * k : a[1] + (a[2] - a[1]) * k;
};
const skyColor = (f, x, y) => {
  const d = skyDef[f], t = x / 320;
  const k = t < 0.5 ? sm(t * 2) : sm((t - 0.5) * 2);
  let col = t < 0.5 ? mix(d.l, d.c, k) : mix(d.c, d.r, k);
  col = mix(col, "#7a66b4", 0.15 * Math.max(0, 1 - y / 190) ** 1.2);
  const hz = sm(Math.min(1, Math.max(0, (y - 90) / 140)));
  return mix(mix(col, "#fbd3b4", tri(f, x, "gl") * hz * 0.75), "#ffffff", 0.06);
};
const sky = (f) => {
  let out = `<rect width="320" height="320" fill="${skyColor(f, 160, 120)}"/>`;
  for (let y = 0; y < 250; y += 14)
    for (let x = 0; x < 320; x += 16) out += `<rect x="${x}" y="${y}" width="17" height="15" fill="${skyColor(f, x + 8, y + 7)}"/>`;
  return out;
};
// Ground tint by night depth (same function of x at every shared edge). Hills are drawn as flat strips under the curve.
const farHill = mix(H.green.light, H.plum.light, 0.5);
const nightInk = "#5a5aa0";
const groundTone = (f, x, base) => mix(base, nightInk, 0.5 * tri(f, x, "n"));
// Quadratic Bezier sampler for "M0 y0 Q cx cy 170? ..." style hills (second segment reflects the control point).
const hillY = (y0, c1x, c1y, mx, my, ey) => {
  const c2x = 2 * mx - c1x, c2y = 2 * my - c1y, pts = [];
  const q = (p0, c, p1) => { for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } };
  q([0, y0], [c1x, c1y], [mx, my]); q([mx, my], [c2x, c2y], [320, ey]);
  return (x) => { for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const [a, b] = [pts[i - 1], pts[i]]; return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1); } return pts[pts.length - 1][1]; };
};
const strips = (f, fy, base) => { let out = ""; for (let x = 0; x < 320; x += 8) out += `<path d="M${x} ${fy(x).toFixed(1)}L${x + 9} ${fy(x + 9).toFixed(1)}V320H${x}Z" fill="${groundTone(f, x + 4, base)}"/>`; return out; };
const belt = (f, dv = 0, mv = 0) => {
  const far = hillY(226, 80, 196 + dv, 170, 222 - dv / 2, 226), mid = hillY(262, 90, 236 + mv, 190, 260 - mv / 2, 262);
  return strips(f, far, farHill) + strips(f, mid, H.green.mid) + `<path d="M0 262Q90 ${236 + mv} 190 ${260 - mv / 2}T320 262" fill="none" stroke="${ink}" stroke-width="${W.outline}"/>`;
};
const gardenPath = `<path d="M0 302Q80 288 160 304T320 302" fill="none" stroke="${ink}" stroke-width="20"/><path d="M0 302Q80 288 160 304T320 302" fill="none" stroke="${H.peach.light}" stroke-width="14"/>`;

// ---- Halloween props ---------------------------------------------------------
const candyColors = [H.pink.mid, H.butter.mid, H.green.light, H.plum.mid];
const wrapped = (x, y, s = 1, c = H.pink.mid, rot = 0) =>
  g(x, y, s, `<g transform="rotate(${rot})"><path d="M-8 0L-16 -6V6ZM8 0L16 -6V6Z" fill="${c}" ${o} stroke-linejoin="round"/><ellipse rx="9" ry="6" fill="${c}" ${o}/><path d="M-3 -5Q0 0 -3 5" ${strokeW(1.6, "#fff")}/></g>`);
const lollipop = (x, y, s = 1, c = H.pink.mid, rot = 0) =>
  g(x, y, s, `<g transform="rotate(${rot})"><path d="M0 0V34" ${strokeW(3, H.peach.light)}/><circle r="12" fill="${c}" ${o}/><path d="M0 -2a3 3 0 1 1 3 3a6 6 0 1 1 -6 -6a9 9 0 1 1 9 9" ${strokeW(1.8, "#fff")}/></g>`);
const candyCorn = (x, y, s = 1) => {
  const w = (yy) => (11 * (yy + 16)) / 28;
  const band = (y0, y1, c) => `<path d="M${-w(y0)} ${y0}L${w(y0)} ${y0}L${w(y1)} ${y1}L${-w(y1)} ${y1}Z" fill="${c}"/>`;
  return g(x, y, s, `<path d="M0 -16L12 10Q0 15 -12 10Z" fill="${H.butter.mid}" ${o} stroke-linejoin="round"/>${band(-4, 4, H.pumpkin.mid)}<path d="M0 -16L${w(-4)} -4H${-w(-4)}Z" fill="${white}"/><path d="M0 -16L12 10Q0 15 -12 10Z" fill="none" ${o} stroke-linejoin="round"/>`);
};
const pumpkinS = (x, y, s = 1, c = H.pumpkin.mid) =>
  g(x, y, s, `<ellipse cx="-13" cy="0" rx="14" ry="17" fill="${c}" ${o}/><ellipse cx="13" cy="0" rx="14" ry="17" fill="${c}" ${o}/><ellipse cx="0" cy="0" rx="13" ry="19" fill="${H.pumpkin.light}" ${o}/><path d="M-6 -19Q-4 -28 2 -30Q8 -27 7 -19Z" fill="${H.green.dark}" ${o} stroke-linejoin="round"/><path d="M5 -26q8 -7 13 0" ${strokeW(W.fine, H.green.dark)}/>`);
const bow = (x, y, s = 1, c = H.pink.mid) =>
  g(x, y, s, `<path d="M0 0L-10 -6V6ZM0 0L10 -6V6Z" fill="${c}" ${o} stroke-linejoin="round"/><circle r="2.8" fill="${H.pink.dark}" ${o}/>`);
// Original tiny bat: round plum body, scalloped wings, pink bow.
const bat = (x, y, s = 1, flip = 1, bc = H.pink.mid, fill = "#f3e7fb") =>
  g(x, y, s, `<g transform="scale(${flip} 1)"><path d="M-6 -3C-14 -24 -38 -22 -50 -8Q-44 -8 -42 -2Q-36 -4 -33 3Q-27 1 -23 8Q-14 6 -6 6Z" fill="${fill}" ${o} stroke-linejoin="round"/><path d="M6 -3C14 -24 38 -22 50 -8Q44 -8 42 -2Q36 -4 33 3Q27 1 23 8Q14 6 6 6Z" fill="${fill}" ${o} stroke-linejoin="round"/><path d="M-9 -9L-7 -21L-1 -12ZM9 -9L7 -21L1 -12Z" fill="${fill}" ${o} stroke-linejoin="round"/><ellipse rx="10.5" ry="10" fill="${fill}" ${o}/><circle cx="-4" cy="-2" r="1.9" fill="${ink}"/><circle cx="4" cy="-2" r="1.9" fill="${ink}"/><path d="M-2 3Q0 5 2 3" ${strokeW(1.5)}/>${bow(-8, -14, 0.7, bc).replace("<g ", "<g ")}</g>`);
const web = (x, y, R, flipX = 1, flipY = 1) => {
  const ang = [0, 22.5, 45, 67.5, 90].map((a) => (a * Math.PI) / 180);
  const P = (r, a) => [(x + flipX * r * Math.cos(a)).toFixed(1), (y + flipY * r * Math.sin(a)).toFixed(1)];
  let d = ang.map((a) => `M${x} ${y}L${P(R, a).join(" ")}`).join("");
  for (const f of [0.36, 0.64, 0.92])
    for (let i = 0; i < 4; i++) d += `M${P(R * f, ang[i]).join(" ")}Q${P(R * f * 0.86, (ang[i] + ang[i + 1]) / 2).join(" ")} ${P(R * f, ang[i + 1]).join(" ")}`;
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${W.fine}" stroke-linecap="round" opacity=".55"/>`;
};
const hangLantern = (x, y, s = 1) =>
  `<circle cx="${x}" cy="${y + 14 * s}" r="${34 * s}" fill="${H.butter.mid}" opacity=".3"/>` +
  g(x, y, s, `<path d="M0 -16V-26" ${strokeW(W.fine)}/><rect x="-11" y="-16" width="22" height="5" rx="2" fill="${twig}" ${o}/><ellipse cy="4" rx="15" ry="14" fill="${H.pumpkin.light}" ${o}/><ellipse cy="4" rx="7" ry="14" fill="${H.butter.light}" ${o}/><rect x="-9" y="16" width="18" height="5" rx="2" fill="${twig}" ${o}/>`);
const fireflies = (pts) => pts.map(([x, y, r]) => glow(x, y, r)).join("");
const mushroomP = (x, y, s = 1) => mushroom(x, y, s, H.plum.mid);
// Candy trail dropped along the garden path: same spots at every shared edge.
const trail = [[10, 301, 0], [24, 297, 1], [296, 297, 2], [311, 302, 3]].map(([x, y, i]) => wrapped(x, y, 0.62, candyColors[i], (i * 40) % 70 - 30)).join("");

// ---- Characters -------------------------------------------------------------
// Glim: round pumpkin sprite with a curly vine; waves with one hand and carries a candle that lights the patch.
const glim = (() => {
  const body = ellipse(200, 234, 29, 50) + ellipse(172, 236, 27, 46) + ellipse(228, 236, 27, 46) + ellipse(152, 242, 19, 36) + ellipse(248, 242, 19, 36) + ellipse(178, 286, 16, 10) + ellipse(222, 286, 16, 10) + arm(140, 240, 50, 10, 16) + arm(262, 214, -35, 10, 16);
  const candle = `<circle cx="124" cy="208" r="32" fill="${H.butter.mid}" opacity=".35"/>` + g(124, 232, 1, `<ellipse cy="2" rx="12" ry="4" fill="${twig}" ${o}/><rect x="-5" y="-22" width="10" height="24" rx="2" fill="${white}" ${o}/><path d="M0 -24V-27" ${strokeW(W.fine)}/><path d="M0 -44Q-8 -34 0 -28Q8 -34 0 -44Z" fill="${H.butter.mid}" ${o} stroke-linejoin="round"/>`);
  const ribs = `<path d="M186 190Q175 236 186 282M214 190Q225 236 214 282M164 198Q148 244 163 280M236 198Q252 244 237 280" ${strokeW(2.5, H.pumpkin.dark)}/>`;
  const stem = `<path d="M192 190Q190 170 199 164Q210 168 210 190Z" fill="${H.green.dark}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/><path d="M208 170Q226 160 230 174Q224 184 216 176" ${strokeW(W.outline, H.green.dark)}/>`;
  return `<circle cx="200" cy="250" r="82" fill="${H.butter.mid}" opacity=".22"/>${stem}${leafShape(176, 192, -150, 0.4)}${shaded(body, H.pumpkin.mid, H.pumpkin.dark, shine(176, 204, 15, 8), [200, 238])}${ribs}${sparkleEye(185, 228)}${sparkleEye(215, 228)}${cheeks(200, 240, 28, H.pink.dark)}${smile(200, 238, 8)}${candle}${star(286, 188, 8, H.butter.mid)}`;
})();

// Boo: bedsheet-ghost kid with huge eyes; says "boo!" while holding a pumpkin pail of candy and waving.
const boo = (() => {
  let hem = "";
  for (let i = 0; i < 5; i++) hem += `a14 14 0 0 1 -28 0`;
  const sheet = `<path d="M252 266C264 190 232 148 182 148C132 148 100 190 112 266${hem.replace(/a14 14 0 0 1 -28 0/g, "")}Z"/>`;
  let d = `M252 268C266 190 236 146 182 146C128 146 98 190 112 268`;
  // scalloped hem running left to right
  for (let i = 0; i < 5; i++) d += `a14 14 0 0 0 28 0`;
  d += "Z";
  const body = `<path d="${d}"/>` + arm(106, 236, 70, 10, 16) + arm(262, 196, -40, 10, 17);
  const pail = g(80, 254, 1, `<path d="M-20 -6Q0 -48 20 -6" ${strokeW(W.outline)}/><circle r="22" fill="${H.pumpkin.mid}" ${o}/><path d="M-8 -20Q-12 0 -8 20M8 -20Q12 0 8 20" ${strokeW(2.2, H.pumpkin.dark)}/><ellipse cy="-16" rx="14" ry="5" fill="${H.pumpkin.dark}" ${o}/><circle cx="-6" cy="-21" r="5" fill="${H.pink.mid}" ${o}/><circle cx="6" cy="-22" r="5" fill="${H.green.light}" ${o}/><circle cx="0" cy="-27" r="4.5" fill="${H.butter.mid}" ${o}/>`);
  return `${shaded(body, white, H.lilac.light, shine(150, 176, 17, 9), [182, 220])}<path d="M148 164L152 156L158 164L168 160L160 168Z" fill="${H.butter.mid}" ${o} transform="translate(12 -2)"/>${eye(158, 202, 8.5)}${eye(206, 202, 8.5)}${cheeks(182, 218, 36, H.pink.dark)}${oMouth(182, 214)}${pail}${star(290, 160, 8, H.butter.mid)}`;
})();

// Mauve: lilac cat in a tiny star-banded witch hat; sits contentedly and licks a swirl lollipop.
const mauve = (() => {
  const body = ellipse(182, 256, 50, 40) + ellipse(160, 292, 17, 10) + ellipse(206, 292, 17, 10) + `<circle cx="182" cy="198" r="38"/><path d="M146 186L150 150L176 168ZM218 186L214 150L188 168Z"/>` + arm(142, 262, 18, 9, 17) + arm(222, 252, -20, 9, 17);
  const tail = `<path d="M228 280C266 282 274 244 254 228" fill="none" stroke="${ink}" stroke-width="16" stroke-linecap="round"/><path d="M228 280C266 282 274 244 254 228" fill="none" stroke="#f1e8fb" stroke-width="10" stroke-linecap="round"/>`;
  const hat = `<g transform="rotate(-12 184 160)"><path d="M160 164Q172 140 178 118Q184 104 202 106Q188 116 190 134Q196 150 210 164Z" fill="${H.plum.mid}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/><path d="M168 150Q188 154 204 152" ${strokeW(5, H.butter.mid)}/><ellipse cx="185" cy="166" rx="34" ry="8" fill="${H.plum.dark}" ${o}/>${star(181, 142, 5, H.butter.light)}</g>`;
  const whisk = `<path d="M146 204L130 200M146 210L130 214M218 204L234 200M218 210L234 214" ${strokeW(W.fine)}/>`;
  return `${tail}${shaded(body, "#f1e8fb", H.lilac.light, shine(160, 180, 13, 7), [182, 230])}<ellipse cx="182" cy="262" rx="24" ry="26" fill="${white}"/><path d="M153 168L156 158L166 166ZM211 168L208 158L198 166Z" fill="${H.pink.light}"/>${arcEye(166, 198)}${arcEye(198, 198)}<path d="M178 208L186 208L182 213Z" fill="${H.pink.dark}"/>${smile(182, 213, 5)}${cheeks(182, 212, 26, H.pink.dark)}${whisk}<path d="M156 230Q182 246 208 230" ${strokeW(9, H.green.light)}/><path d="M156 230Q182 246 208 230" fill="none" stroke="${ink}" stroke-width="1.6" opacity=".0"/>${hat}${lollipop(236, 244, 1.05, H.pink.mid, 12)}`;
})();

// Bibi: tiny bat with a bow, hanging by her feet from a branch, wings tucked, winking, with a sweet in one foot.
const bibi = (() => {
  const pale = "#f6e9f6", wings = ellipse(223, 116, 8, 16, 8) + ellipse(241, 116, 8, 16, -8);
  return `<g transform="translate(-109 -36) scale(1.4)"><path d="M224 90L224 102M240 90L240 102" ${strokeW(W.outline)}/>${shaded(ellipse(232, 114, 12, 17) + wings, pale, H.plum.light, "", [232, 114])}${shaded(`<circle cx="232" cy="146" r="19"/><path d="M216 156L212 172L226 164ZM248 156L252 172L238 164Z"/>`, pale, H.plum.light, shine(224, 138, 6, 3), [232, 146])}<path d="M217 158L215 167L223 162ZM247 158L249 167L241 162Z" fill="${H.pink.light}"/>${eye(224, 144, 3.8)}${arcEye(241, 145)}${cheeks(232, 152, 15, H.pink.dark)}${smile(232, 152, 4)}${bow(218, 130, 1.1, H.butter.mid)}</g>`;
})();

// Spindle: candy-collecting spiderling on a silk thread, four legs a side, a sweet lollipop held up high.
const spindle = (() => {
  const legs = [-1, 1].map((sd) => [0, 1, 2, 3].map((i) => `<path d="M${sd * 12} ${-6 + i * 5}Q${sd * 30} ${-20 + i * 9} ${sd * (34 - i * 2)} ${6 + i * 9}" ${strokeW(W.outline)}/>`).join("")).join("");
  return `<path d="M64 0V76" ${strokeW(W.fine)}/>${g(64, 100, 1.1, `${legs}${shaded(`<circle r="19"/>`, H.plum.mid, H.plum.dark, shine(-7, -8, 6, 3), [0, 0], 0.9, [-2, -2])}${eye(-7, -1, 3.8)}${eye(7, -1, 3.8)}${cheeks(0, 6, 12, H.pink.dark)}${smile(0, 5, 4)}${bow(-10, -17, 0.9, H.butter.mid)}${lollipop(34, -22, 0.75, H.green.light, 15)}`)}`;
})();

// ---- Faces ---------------------------------------------------------------------
const drawings = {};
// FRONT: lantern-lit pumpkin patch at dusk. TL bat+cloud, TR hanging lantern+star, BL pumpkin patch, BR Glim.
drawings.F =
  sky("F") + sparkles([[246, 40, 6], [296, 66, 4], [140, 30, 4]]) + cloud(98, 138, 0.75, H.lilac.bg) + cloud(214, 150, 0.4, H.lilac.bg) +
  bat(66, 74, 1.05, 1, H.butter.mid, H.plum.dark) +
  belt("F", 4, 0) + gardenPath +
  `<path d="M282 300V104Q282 78 258 78" ${strokeW(5, twig)}/>` + hangLantern(258, 90, 1.1) +
  pumpkinS(46, 276, 1.45) + pumpkinS(96, 292, 0.95, H.pumpkin.light) + pumpkinS(28, 230, 0.9, H.pumpkin.dark) +
  `<path d="M70 300Q110 284 130 294" ${strokeW(W.outline, H.green.dark)}/>` + leafShape(120, 296, -20, 0.45) +
  candyCorn(150, 300, 0.8) + candyCorn(300, 312, 0.7) + tuft(126, 314) + tuft(176, 312) +
  trail + glim;
// RIGHT: ghost party. TL twisty tree+fireflies, TR stars+cloud, BL pail (Boo's), BR lollipops. Boo says boo.
drawings.R =
  sky("R") + sparkles([[200, 30, 5], [270, 78, 6], [304, 34, 4], [150, 62, 4]]) + cloud(250, 120, 0.65, H.lilac.bg) + bat(236, 56, 0.8, -1, H.green.light) + star(296, 34, 9, H.butter.mid) +
  belt("R", 4, 0) + gardenPath + trail +
  `<path d="M24 262C20 204 44 166 36 112C34 90 42 74 56 62M36 150Q60 134 80 120M30 190Q10 176 6 156" ${strokeW(6, twig)}/>` +
  [[56, 62, -20], [82, 118, 10], [14, 150, 30], [44, 100, -40]].map(([x, y, r]) => leafShape(x, y, r, 0.38).replace(H.green.mid, H.pumpkin.light)).join("") +
  fireflies([[92, 70, 3], [110, 104, 2.5], [22, 120, 3]]) +
  lollipop(290, 262, 1.1, H.pink.mid, 8).replace(`M0 0V34`, `M0 0V44`) + lollipop(262, 280, 0.9, H.green.light, -10) +
  mushroomP(120, 304, 0.9) + tuft(26, 314) + tuft(282, 314) + g(14, 0, 1, boo);
// BACK: midnight. TL moon+shooting star, TR bare branch with Bibi, BL cottage, BR lantern post+candy.
drawings.B =
  sky("B") + sparkles([[130, 40, 6], [126, 104, 4], [20, 138, 5], [196, 150, 4], [300, 160, 5], [30, 36, 4]]) +
  `<circle cx="62" cy="68" r="56" fill="${H.butter.light}" opacity=".18"/>` + moonShaded(76, 22, 0.9) + sleepyEye(54, 76).replace("<path", "<path transform=\"translate(0 0)\"") + cheeks(52, 86, 8, H.pink.dark) +
  cloud(60, 160, 0.6, H.lilac.bg) +
  `<path d="M320 72Q290 62 250 84Q226 92 190 86M262 82Q258 66 268 52" ${strokeW(6, twig)}/>` + bibi + fireflies([[184, 120, 3], [298, 130, 3], [270, 190, 2.5]]) +
  `<path d="M40 232L96 176L140 226L196 184L250 232Z" fill="#6c5cab"/>` + belt("B", 0, 0) + gardenPath + trail +
  g(78, 268, 1, `<rect x="-34" y="-50" width="68" height="52" fill="${H.peach.light}" ${o}/><path d="M-42 -48L0 -90L42 -48Z" fill="${H.plum.dark}" ${o} stroke-linejoin="round"/><rect x="14" y="-84" width="12" height="20" fill="${H.peach.mid}" ${o}/><circle cx="-14" cy="-28" r="10" fill="${H.butter.light}" ${o}/><path d="M-14 -38V-18M-24 -28H-4" ${strokeW(W.fine)}/><rect x="6" y="-30" width="18" height="30" rx="9" fill="${H.pumpkin.mid}" ${o}/><circle cx="0" cy="-62" r="7" fill="${H.butter.light}" ${o}/>`) +
  `<circle cx="78" cy="244" r="46" fill="${H.butter.mid}" opacity=".18"/>` +
  `<path d="M282 300V214" ${strokeW(5, twig)}/>` + hangLantern(282, 214, 0.9).replace(`<path d="M0 -16V-26"`, `<path d="M0 -16V-26"`) + pumpkinS(232, 288, 1.1) + candyCorn(176, 300, 0.9) + wrapped(206, 296, 0.9, H.green.light, 20) + tuft(130, 312) + tuft(300, 314);
// LEFT: violet dusk. TL pink cloud+bat, TR evening stars, BL fence+mushroom, BR Mauve the cat.
drawings.L =
  sky("L") + sparkles([[292, 84, 5], [212, 96, 4], [120, 40, 4]]) + star(246, 52, 15, H.butter.mid) + bat(286, 120, 0.6, -1, H.green.light, H.plum.dark) +
  cloud(60, 130, 0.8, mix(white, H.pink.mid, 0.3)) + cloud(250, 150, 0.5, H.lilac.bg) + bat(100, 62, 0.9, -1, H.butter.mid, H.plum.dark) +
  belt("L", 8, 4) + gardenPath + trail +
  [14, 44, 74, 104].map((x) => `<path d="M${x - 8} 272V244Q${x} 232 ${x + 8} 244V272Z" fill="${white}" ${o} stroke-linejoin="round"/>`).join("") +
  `<path d="M6 252H112M6 266H112" ${strokeW(W.outline, ink)}/>` + pumpkinS(112, 240, 0.7) +
  mushroomP(40, 300, 1.05) + mushroom(66, 306, 0.7, H.peach.dark) + tuft(130, 312) + tuft(300, 308) +
  `<circle cx="186" cy="232" r="80" fill="${H.butter.light}" opacity=".5"/>` + mauve;
// UP: big sleepy moon with bats and drifting clouds.
const upTop = skyColor("B", 160, 0), upBottom = skyColor("F", 160, 0), upLeft = skyColor("L", 160, 0), upRight = skyColor("R", 160, 0);
drawings.U =
  smoothField({ top: upTop, bottom: upBottom, left: upLeft, right: upRight }, mix(upTop, upBottom, 0.4)) +
  cloudFar(30, 80, 0.6, H.lilac.light) + cloudFar(270, 220, 0.5) + cloudFar(110, 300, 0.5, mix(white, H.pink.mid, 0.3)) +
  sparkles([[40, 40, 7], [112, 24, 5], [286, 36, 6], [250, 120, 4], [24, 190, 5], [214, 296, 5], [296, 266, 4]]) +
  moonShaded(142, 70, 1.5) + sleepyEye(106, 158) + cheeks(102, 177, 11, H.pink.dark) + smile(108, 184, 5) +
  bat(64, 112, 1.1, 1, H.pink.mid) + bat(272, 168, 0.85, -1, H.butter.mid) + bat(250, 66, 0.6, -1, H.green.light) + cloudShaded(252, 124, 0.5, white, H.lilac.light) + miniFace(274, 100, "wink", 7) +
  cloud(40, 266, 0.85, mix(white, H.pink.mid, 0.25)) + cloud(216, 308, 0.7, H.lilac.bg) + cloudShaded(150, 296, 0.55, white, H.lilac.light) +
  miniFace(176, 270, "sleepy", 8) + bubble(214, 258, 4);

// ---- DOWN: pumpkin patch with candy and a cobweb corner (spiderling Spindle) ---------
const allGreen = { top: groundTone("F", 160, H.green.mid), right: groundTone("R", 160, H.green.mid), bottom: groundTone("B", 160, H.green.mid), left: groundTone("L", 160, H.green.mid) };
drawings.D =
  smoothField(allGreen, "#b6d4a4") + web(0, 0, 124) + spindle +
  sparkles([[130, 142, 4], [200, 190, 4]], H.pink.light) +
  wrapped(220, 40, 1.1, H.pink.mid, 20) + wrapped(268, 62, 1, H.green.light, -25) + wrapped(238, 92, 1, H.butter.mid, 10) +
  lollipop(292, 22, 0.9, H.plum.mid, 20) + candyCorn(176, 52, 1) + candyCorn(196, 76, 0.9) + candyCorn(294, 120, 0.9) +
  `<path d="M190 160Q150 190 100 176Q60 168 54 214" ${strokeW(W.outline, H.green.dark)}/>` +
  leafShape(150, 190, 30, 0.5) + leafShape(76, 182, -150, 0.45) +
  pumpkinS(60, 252, 1.9) + pumpkinS(128, 284, 1.0, H.pumpkin.light) + pumpkinS(30, 168, 0.85, H.pumpkin.dark) +
  g(236, 248, 1.2, `<g transform="rotate(-70)"><path d="M-20 -6Q0 -48 20 -6" ${strokeW(W.outline)}/><circle r="22" fill="${H.pumpkin.mid}" ${o}/><path d="M-8 -20Q-12 0 -8 20M8 -20Q12 0 8 20" ${strokeW(2.2, H.pumpkin.dark)}/><ellipse cy="-16" rx="14" ry="5" fill="${H.pumpkin.dark}" ${o}/></g>`) +
  wrapped(282, 232, 1, H.pink.mid, 20) + wrapped(296, 262, 1, H.butter.mid, -30) + candyCorn(270, 290, 0.9) + wrapped(250, 296, 0.9, H.green.light, 30) +
  lollipop(180, 270, 0.8, H.pink.mid, -20) + mushroomP(200, 306, 0.8) + tuft(16, 310) + tuft(160, 314) + tuft(300, 200);

// ---- Output ----------------------------------------------------------------------
for (const [face, shapes] of Object.entries(drawings)) {
  const svg = (viewBox, width) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${viewBox}">${shapes}</svg>\n`;
  writeFileSync(new URL(`${face}.svg`, dir), svg("0 0 320 320", 320));
}
