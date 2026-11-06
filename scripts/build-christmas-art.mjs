/** Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
 * This generator is the editable source of the artwork: art data under CC BY-SA 4.0, not AGPL program code.
 * Christmas "Pastel Winter Night" picture-cube proposal. Original characters (Floe, Dew, Bruno, Crumb, Wick). Forked helpers from build-pastel-garden-art.mjs. Writes only into this directory.
 * Shipped as scripts/build-christmas-art.mjs; `node scripts/build-christmas-art.mjs` rewrites the six whole faces in
 * public/playground-christmas/ (the playground cuts them into stickers at run time). Run
 * `node scripts/build-playground-theme.mjs christmas` afterwards to re-pin them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
const dir = new URL("../public/playground-christmas/", import.meta.url);
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

// ---- Christmas additions: new hues (four tones each) ------------------------
Object.assign(H, {
  berry: { bg: "#fbd9d9", light: "#f6b9b9", mid: "#ee8f8f", dark: "#d96565" },
  pine: { bg: "#d9ebe0", light: "#a9d1bb", mid: "#6fa68a", dark: "#4f8a73" },
  gold: { bg: "#fff1c9", light: "#ffe9a0", mid: "#f7d268", dark: "#e8b73c" },
  night: { bg: "#dfe3f6", light: "#b9c3ec", mid: "#8f9ddc", dark: "#6b79c0" },
  ginger: { bg: "#f6e3cc", light: "#e9bd8f", mid: "#d29a66", dark: "#b87a47" },
  snow: { bg: "#f6f9ff", light: "#e8f0fb", mid: "#cddcf0", dark: "#aebfe0" },
});
const sunDisc = (x, y, r, c) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * i) / 4;
    return `<path d="M${(x + Math.cos(a) * (r + 5)).toFixed(1)} ${(y + Math.sin(a) * (r + 5)).toFixed(1)}L${(x + Math.cos(a) * (r + 11)).toFixed(1)} ${(y + Math.sin(a) * (r + 11)).toFixed(1)}" ${strokeW(3, c)}/>`;
  }).join("") + `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ink}" stroke-width="${W.outline}"/>`;
const snowW = "#fdfeff";

const flake = (x, y, r, c = "#fff", w = 2.6) =>
  `<g transform="translate(${x} ${y})" ${strokeW(w, c)}>` +
  [0, 60, 120].map((a) => `<g transform="rotate(${a})"><path d="M0 ${-r}V${r}M${-r * 0.3} ${-r * 0.7}L0 ${-r * 0.4}L${r * 0.3} ${-r * 0.7}M${-r * 0.3} ${r * 0.7}L0 ${r * 0.4}L${r * 0.3} ${r * 0.7}"/></g>`).join("") + `</g>`;
const holly = (x, y, rot = 0, s = 1) =>
  g(x, y, s, `<g transform="rotate(${rot})"><path d="M0 0C8-16 26-16 34 0C26 16 8 16 0 0Z" fill="${H.pine.mid}" ${o} transform="rotate(-25)"/><path d="M0 0C8-16 26-16 34 0C26 16 8 16 0 0Z" fill="${H.pine.mid}" ${o} transform="rotate(35)"/><circle cx="-4" cy="2" r="5" fill="${H.berry.dark}" ${o}/><circle cx="5" cy="5" r="5" fill="${H.berry.dark}" ${o}/><circle cx="1" cy="-4" r="4.5" fill="${H.berry.mid}" ${o}/></g>`);
const gift = (x, y, w, h, c, rib, bow = true) =>
  `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" rx="3" fill="${c}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M${x} ${y - h}V${y}M${x - w / 2} ${y - h * 0.5}H${x + w / 2}" ${strokeW(5, rib)}/><path d="M${x} ${y - h}V${y}M${x - w / 2} ${y - h * 0.5}H${x + w / 2}" fill="none" stroke="${ink}" stroke-width=".01"/>` +
  (bow ? `<ellipse cx="${x - 8}" cy="${y - h - 5}" rx="9" ry="6" fill="${rib}" ${o} transform="rotate(-20 ${x - 8} ${y - h - 5})"/><ellipse cx="${x + 8}" cy="${y - h - 5}" rx="9" ry="6" fill="${rib}" ${o} transform="rotate(20 ${x + 8} ${y - h - 5})"/><circle cx="${x}" cy="${y - h - 3}" r="3.5" fill="${rib}" ${o}/>` : "");
const candyCane = (x, y, s = 1) =>
  g(x, y, s, `<path d="M0 0V-46A11 11 0 0 1 22 -46" fill="none" stroke="${ink}" stroke-width="11" stroke-linecap="round"/><path d="M0 0V-46A11 11 0 0 1 22 -46" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M-3 -6L3 -10M-3 -18L3 -22M-3 -30L3 -34M-1 -44L5 -50M14 -55L18 -49" fill="none" stroke="${H.berry.dark}" stroke-width="3.2" stroke-linecap="round"/>`);
const snowPine = (x, y, s = 1, c = H.pine.mid, lights = false) =>
  g(x, y, s, `<rect x="-4" y="22" width="8" height="12" fill="${twig}" ${o}/><path d="M0 -52L-16 -24H-8L-22 -2H-10L-26 22H26L10 -2H22L8 -24H16Z" fill="${c}" ${o} stroke-linejoin="round"/>` +
    `<path d="M0 -50L-9 -33Q-3 -30 0 -34Q4 -29 9 -33Z" fill="${snowW}" ${o} stroke-linejoin="round"/><path d="M-12 -12L-19 -2Q-12 0 -8 -4Q-2 0 4 -3Q9 1 13 -4L9 -12Z" fill="${snowW}" opacity=".95"/><path d="M-20 14L-24 21Q-14 24 -9 19Q0 24 8 19Q16 24 24 21L20 14Z" fill="${snowW}" opacity=".95"/>` +
    (lights ? [[-8, -16], [8, -6], [-14, 8], [4, 12], [16, 16]].map(([a, b], i) => `<circle cx="${a}" cy="${b}" r="2.8" fill="${[H.gold.mid, H.berry.mid, H.gold.light][i % 3]}" stroke="${ink}" stroke-width="1.4"/>`).join("") : ""));
const frostStar = (x, y, r, c = H.gold.light) => star(x, y, r, c);
const sled = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-52 10Q-62 10 -60 -4M52 10Q62 10 60 -4" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><path d="M-52 10H52" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><path d="M-52 10Q-62 10 -60 -4M52 10Q62 10 60 -4M-52 10H52" fill="none" stroke="${H.ginger.light}" stroke-width="3.4" stroke-linecap="round"/><rect x="-46" y="-6" width="92" height="12" rx="5" fill="${H.ginger.mid}" ${o}/><path d="M-38 0H38" ${strokeW(1.5, H.ginger.dark)}/>`);
const glowTag = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff0e6" opacity=".6"/><circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="#fff3ea" opacity=".6"/>`;

// ---- Original characters ------------------------------------------------------
// Floe: round snowkid in a berry beanie and pine scarf; waves with one twig arm, holds a little gold star.
const floe = (() => {
  const body = `<circle cx="236" cy="168" r="50"/><ellipse cx="212" cy="216" rx="17" ry="10"/><ellipse cx="262" cy="216" rx="17" ry="10"/>`;
  const arms = `<path d="M188 168L166 138M172 146L162 148M170 142L174 130" ${strokeW(4, twig)}/><path d="M284 170L304 152" ${strokeW(4, twig)}/>`;
  const hat = `<g transform="rotate(-8 236 130)"><path d="M202 132Q202 96 236 94Q270 96 270 132Z" fill="${H.berry.mid}" ${o}/><rect x="198" y="126" width="76" height="14" rx="7" fill="${snowW}" stroke="${ink}" stroke-width="3"/><circle cx="236" cy="91" r="8" fill="${snowW}" stroke="${ink}" stroke-width="3"/></g>`;
  const scarf = `<path d="M196 182Q236 202 278 180L282 196Q238 216 192 198Z" fill="${H.pine.mid}" ${o} stroke-linejoin="round"/><path d="M214 190L218 205M232 195L236 210M252 193L256 207M268 188L272 200" ${strokeW(2.4, H.gold.light)}/><path d="M262 198L272 232L252 236L250 204Z" fill="${H.pine.mid}" ${o} stroke-linejoin="round"/><path d="M257 224L267 222" ${strokeW(2.4, H.gold.light)}/>`;
  return arms + shaded(body, snowW, H.snow.mid, shine(212, 140, 16, 9), [236, 168]) + `<circle cx="236" cy="212" r="0" fill="none"/>` + hat +
    eye(222, 153, 4.2) + eye(252, 153, 4.2) + cheeks(237, 164, 24, H.pink.dark) + `<path d="M236 158L255 164L236 168Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/>` + smile(237, 172, 7) + scarf +
    `<circle cx="236" cy="213" r="4" fill="${H.berry.dark}" ${o}/>` + star(306, 138, 13, H.gold.mid) + `<path d="M306 150L304 152" ${strokeW(3, twig)}/>`;
})();
// Dew: small winter deer with twig antlers and a jingle bell; tiptoes along carrying a glowing lantern.
const dew = (() => {
  const body = `<ellipse cx="176" cy="226" rx="48" ry="36"/>`;
  const leg = (x, y, L, f) => `<path d="M${x - 6} ${y}L${x - 5} ${y + L}Q${x} ${y + L + 5} ${x + 5} ${y + L}L${x + 6} ${y}Z" fill="${f}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M${x - 5} ${y + L - 5}H${x + 5}L${x + 5} ${y + L}Q${x} ${y + L + 5} ${x - 5} ${y + L}Z" fill="${H.ginger.dark}"/>`;
  const legs = leg(146, 246, 28, H.peach.mid) + leg(172, 250, 26, H.peach.mid) + leg(200, 250, 26, H.peach.light) + leg(222, 246, 28, H.peach.light);
  const head = `<circle cx="232" cy="186" r="30"/><ellipse cx="206" cy="160" rx="9" ry="17" transform="rotate(-35 206 160)"/><ellipse cx="258" cy="160" rx="9" ry="17" transform="rotate(35 258 160)"/>`;
  const lantern = `<circle cx="278" cy="236" r="28" fill="#fff0e6" opacity=".6"/>` + g(278, 236, 1, `<path d="M-8 -12Q0 -26 8 -12" ${strokeW(W.fine)}/><rect x="-9" y="-13" width="18" height="5" rx="2" fill="${twig}" ${o}/><rect x="-9" y="-8" width="18" height="20" rx="4" fill="${H.gold.light}" ${o}/><rect x="-9" y="10" width="18" height="5" rx="2" fill="${twig}" ${o}/><circle cy="2" r="3.5" fill="${H.gold.dark}"/>`);
  const spots = [[150, 208], [172, 200], [196, 206], [160, 224]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${snowW}"/>`).join("");
  return `<path d="M222 160Q216 134 202 126M219 144L206 146M242 160Q250 134 264 126M246 144L260 144" ${strokeW(3.4, twig)}/>` +
    legs + shaded(body, H.peach.light, H.peach.mid, shine(150, 214, 14, 8), [176, 226]) + spots +
    `<path d="M226 244L250 240" ${strokeW(10, ink)}/><path d="M226 244L250 240" ${strokeW(5, H.peach.mid)}/>` +
    shaded(head, H.peach.light, H.peach.mid, shine(216, 170, 10, 6), [232, 186]) +
    `<ellipse cx="206" cy="160" rx="4" ry="9" fill="${H.pink.light}" transform="rotate(-35 206 160)"/><ellipse cx="258" cy="160" rx="4" ry="9" fill="${H.pink.light}" transform="rotate(35 258 160)"/>` +
    `<ellipse cx="232" cy="200" rx="13" ry="9" fill="${snowW}" ${o}/><ellipse cx="232" cy="196" rx="3.8" ry="2.8" fill="${ink}"/>` +
    eye(220, 182, 3.8) + eye(244, 182, 3.8) + cheeks(232, 194, 24, H.pink.dark) + smile(232, 203, 4) +
    `<path d="M212 214Q220 222 232 218" ${strokeW(5, H.berry.mid)}/><circle cx="232" cy="219" r="5" fill="${H.gold.mid}" ${o}/>` + lantern;
})();
// Bruno: sleepy-eyed bear cub, tongue out in concentration, wrapping a half-finished present; bow on one ear.
const bruno = (() => {
  const body = `<ellipse cx="136" cy="252" rx="54" ry="42"/><ellipse cx="100" cy="292" rx="16" ry="10"/><ellipse cx="172" cy="292" rx="16" ry="10"/>`;
  const head = `<circle cx="136" cy="200" r="42"/><circle cx="102" cy="168" r="15"/><circle cx="170" cy="168" r="15"/>`;
  const wrapped = `<rect x="204" y="250" width="30" height="46" fill="${H.lilac.light}" stroke="${ink}" stroke-width="3"/><rect x="234" y="250" width="34" height="46" fill="${H.ginger.light}" stroke="${ink}" stroke-width="3"/><circle cx="214" cy="262" r="2.6" fill="#fff"/><circle cx="224" cy="276" r="2.6" fill="#fff"/><circle cx="216" cy="288" r="2.6" fill="#fff"/>${star(222, 270, 0.1)}<path d="M240 258H262M240 268H258" ${strokeW(1.6, H.ginger.dark)}/><path d="M234 250V296" ${strokeW(5, H.berry.mid)}/>`;
  return shaded(body, H.ginger.light, H.ginger.mid, shine(104, 240, 16, 9), [136, 252]) +
    `<ellipse cx="136" cy="262" rx="30" ry="24" fill="${H.ginger.bg}"/>` + wrapped +
    shaded(head, H.ginger.light, H.ginger.mid, shine(114, 180, 13, 7), [136, 200]) +
    `<circle cx="102" cy="168" r="7" fill="${H.pink.light}"/><circle cx="170" cy="168" r="7" fill="${H.pink.light}"/>` +
    `<ellipse cx="136" cy="212" rx="18" ry="13" fill="${H.ginger.bg}" ${o}/><ellipse cx="136" cy="206" rx="5" ry="3.6" fill="${ink}"/>` +
    eye(118, 194, 4.2) + eye(154, 194, 4.2) + cheeks(136, 208, 38, H.pink.dark) + `<path d="M128 217Q136 223 144 217" ${strokeW(2.4)}/><path d="M132 220Q136 232 140 220Z" fill="${H.pink.dark}" ${o}/>` +
    // ribbon bow on the left ear and a ribbon end held in a paw
    `<ellipse cx="94" cy="158" rx="9" ry="5.5" fill="${H.berry.mid}" ${o} transform="rotate(-30 94 158)"/><ellipse cx="108" cy="154" rx="9" ry="5.5" fill="${H.berry.mid}" ${o} transform="rotate(25 108 154)"/><circle cx="101" cy="157" r="3.4" fill="${H.berry.dark}" ${o}/>` +
    `<path d="M170 258Q196 276 206 240Q214 226 240 232" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M170 258Q196 276 206 240Q214 226 240 232" fill="none" stroke="${H.berry.light}" stroke-width="3" stroke-linecap="round"/>` +
    merged(arm(176, 262, -70, 10, 16), H.ginger.light) + merged(arm(102, 262, 60, 10, 16), H.ginger.light);
})();
// Crumb: gingerbread sprite with icing zigzag collar and gumdrop buttons; waves, holding a candy cane.
const crumb = (() => {
  const body = `<circle cx="140" cy="150" r="34"/><ellipse cx="140" cy="214" rx="38" ry="44"/><ellipse cx="108" cy="266" rx="16" ry="14"/><ellipse cx="172" cy="266" rx="16" ry="14"/><ellipse cx="96" cy="196" rx="13" ry="20" transform="rotate(50 96 196)"/><ellipse cx="186" cy="200" rx="13" ry="20" transform="rotate(-35 186 200)"/>`;
  const icing = `<path d="M84 206Q80 200 86 196M176 188Q186 178 196 186M98 278Q108 284 118 278M162 278Q172 284 182 278" fill="none" stroke="${snowW}" stroke-width="4" stroke-linecap="round"/><path d="M108 182L116 190L124 182L132 190L140 182L148 190L156 182L164 190L172 182" fill="none" stroke="${ink}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M108 182L116 190L124 182L132 190L140 182L148 190L156 182L164 190L172 182" fill="none" stroke="${snowW}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const buttons = [[140, 208, H.berry.mid], [140, 228, H.pine.mid], [140, 248, H.gold.mid]].map(([x, y, c]) => dot(x, y, 6, c)).join("");
  return shaded(body, H.ginger.light, H.ginger.mid, shine(120, 130, 14, 8), [140, 210]) + icing + buttons +
    sparkleEye(126, 148) + sparkleEye(154, 148) + cheeks(140, 158, 25, H.pink.dark) + `<path d="M130 160Q140 170 150 160" ${strokeW(2.5)}/>` +
    `<path d="M118 124Q124 116 132 124M148 124Q156 116 162 124" fill="none" stroke="${snowW}" stroke-width="3.6" stroke-linecap="round"/>` + candyCane(196, 210, 0.9);
})();
// Wick: a candle in a little glass lantern; sleepy-warm, nursing a sprig of holly.
const wick = (() => {
  const frame = `<g>
    <circle cx="0" cy="0" r="66" fill="#fff0e6" opacity=".6"/><circle cx="0" cy="0" r="44" fill="#fff3ea" opacity=".6"/>
    <path d="M-12 -56Q0 -78 12 -56" ${strokeW(3)}/>
    <path d="M-26 -42L-20 -52H20L26 -42Z" fill="${twig}" ${o} stroke-linejoin="round"/>
    <rect x="-26" y="-42" width="52" height="76" rx="6" fill="${H.gold.bg}" stroke="${ink}" stroke-width="3"/>
    <rect x="-32" y="34" width="64" height="12" rx="5" fill="${twig}" ${o}/>
    <rect x="-17" y="-16" width="34" height="50" rx="8" fill="${snowW}" ${o}/>
    <path d="M17 -4Q23 6 17 14" fill="${H.gold.light}" stroke="none"/>
    <path d="M0 -42Q-9 -30 0 -22Q9 -30 0 -42Z" fill="${H.gold.mid}" ${o} transform="translate(0 6)"/>
    <path d="M0 -24V-17" ${strokeW(2, ink)}/>
    <path d="M-26 -42V34M26 -42V34" ${strokeW(2, H.gold.dark)}/>
    <path d="M-20 -34V26" ${strokeW(2.5, "#fff")} opacity=".7"/>
    ${arcEye(-7, 2)}${arcEye(7, 2)}${cheeks(0, 10, 10, H.pink.dark)}${smile(0, 9, 3.4)}
    <path d="M-28 12Q-40 18 -42 8" ${strokeW(4, ink)}/>
  </g>`;
  return (x, y, s) => g(x, y, s, frame + holly(-42, 10, 200, 0.55));
})();

// ---- Sky: continuous dusk -> evening -> night -> midnight (cyclic) --------------
const skyTop = ["#b9aee3", "#a2b0e6", "#8d9cdb", "#7d8bc8"];
const skyHor = ["#f1c6cc", "#d6c2ec", "#b1b7e8", "#a3a9de"];
const skyAt = (t, x, y, hmax) => {
  const tt = ((t % 4) + 4) % 4, i = Math.floor(tt) % 4, j = (i + 1) % 4, f = tt - Math.floor(tt);
  const v = Math.min(1, y / hmax) ** 1.3;
  const top = mix(skyTop[i], skyTop[j], f), hor = mix(skyHor[i], skyHor[j], f);
  return mix(top, hor, v);
};
const skyFace = (i, hmax = 232) => {
  let out = "";
  for (let y = 0; y < 248; y += 8)
    for (let x = 0; x < 320; x += 4) {
      const t = i + ((x + 2) / 320 - 0.5);
      out += `<rect x="${x}" y="${y}" width="5" height="9" fill="${skyAt(t, x, y + 4, hmax)}"/>`;
    }
  return out;
};
// Exact edge-matched field for Up (edges = the neighboring skies' top rows) and Down (snow).
const hexv = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const edgeBlend = (edgeFns, center, cell = 8, ctrW = 5) => {
  let out = "";
  for (let y = 0; y < 320; y += cell)
    for (let x = 0; x < 320; x += cell) {
      const cx = x + cell / 2, cy = y + cell / 2;
      const ds = { top: cy, bottom: 320 - cy, left: cx, right: 320 - cx };
      let wsum = ctrW, acc = hexv(center).map((v) => v * ctrW);
      for (const k of Object.keys(ds)) {
        const w = 1 / (ds[k] / 320 + 0.012) ** 2, c = hexv(edgeFns[k](cx, cy));
        wsum += w; acc = acc.map((v, i) => v + w * c[i]);
      }
      out += `<rect x="${x}" y="${y}" width="${cell + 1}" height="${cell + 1}" fill="#${acc.map((v) => Math.round(v / wsum).toString(16).padStart(2, "0")).join("")}"/>`;
    }
  return out;
};
const snowBelt = (dv = 0, mv = 0) =>
  hill(`M0 226Q80 ${196 + dv} 170 ${222 - dv / 2}T320 226V320H0Z`, H.snow.mid) +
  hill(`M0 262Q90 ${236 + mv} 190 ${260 - mv / 2}T320 262V320H0Z`, H.snow.bg, true);
const trackD = "M0 302Q80 288 160 304T320 302";
const sledPath =
  `<path d="${trackD}" fill="none" stroke="${H.snow.light}" stroke-width="20"/>` +
  `<path d="${trackD}" fill="none" stroke="${H.snow.dark}" stroke-width="2.6" transform="translate(0 -5)"/><path d="${trackD}" fill="none" stroke="${H.snow.dark}" stroke-width="2.6" transform="translate(0 5)"/>`;
const twinkles = (pts, c = H.gold.light) => pts.map(([x, y, r]) => star(x, y, r, c)).join("");
const dots = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".85"/>`).join("");

// cottage with warm lit windows; origin = base center
const cottage = (x, y, s = 1) =>
  g(x, y, s, `<rect x="26" y="-124" width="16" height="40" fill="${H.berry.dark}" ${o}/><path d="M24 -124H44L42 -130H26Z" fill="${snowW}" ${o}/>` +
    `<circle cx="-24" cy="-38" r="40" fill="#fff0e6" opacity=".6"/>` +
    `<rect x="-52" y="-68" width="104" height="68" fill="${H.peach.bg}" stroke="${ink}" stroke-width="3"/>` +
    `<path d="M-64 -64L0 -114L64 -64Z" fill="${H.berry.mid}" ${o} stroke-linejoin="round"/>` +
    `<path d="M-28 -90L0 -114L28 -90Q18 -82 8 -90Q-4 -80 -14 -88Q-22 -82 -28 -90Z" fill="${snowW}" ${o} stroke-linejoin="round"/>` +
    `<rect x="-40" y="-54" width="30" height="28" rx="4" fill="${H.gold.light}" stroke="${ink}" stroke-width="3"/><path d="M-25 -54V-26M-40 -40H-10" ${strokeW(2)}/>` +
    `<rect x="12" y="-36" width="26" height="36" rx="12" fill="${H.pine.mid}" ${o}/><circle cx="31" cy="-18" r="2.4" fill="${H.gold.dark}"/>` +
    `<circle cx="25" cy="-46" r="8" fill="none" stroke="${H.pine.dark}" stroke-width="4"/><circle cx="25" cy="-54" r="2.6" fill="${H.berry.dark}"/>`);

// ---- Faces --------------------------------------------------------------------
const drawings = {
  // FRONT (cozy evening): TL moon + chimney smoke, TR Floe waves with a star, BL cottage with lit window and pine, BR sled with gifts.
  F:
    skyFace(1) + twinkles([[124, 30, 5], [20, 118, 4], [150, 140, 4]]) +
    `<path transform="translate(-92 10) scale(0.7)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z" fill="${H.gold.light}" stroke="${ink}" stroke-width="${W.outline + 1}"/>` +
    snowBelt(4, 0) + sledPath +
    `<ellipse cx="90" cy="236" rx="70" ry="10" fill="#fff0e6" opacity=".6"/>` + snowPine(30, 226, 1.2, H.pine.dark, true) + cottage(98, 244, 0.95) +
    [[148, 94, 5], [160, 80, 7], [150, 60, 9]].map(([a, b, r]) => `<circle cx="${a - 6}" cy="${b + 4}" r="${r}" fill="#fff" opacity=".75"/>`).join("") +
    gift(246, 292, 40, 26, H.lilac.mid, H.gold.mid) + sled(222, 298, 0.85) +
    snowPine(300, 244, 0.9, H.pine.mid) + g(0, 18, 1, floe),
  // BACK (midnight): TL snow cloud + shooting star, TR the big gold star, BL decorated pine, BR Bruno wrapping a gift.
  B:
    skyFace(3) + twinkles([[40, 62, 6], [100, 24, 4], [24, 150, 5], [196, 28, 4], [290, 140, 5], [210, 122, 4]]) +
    `<path d="M128 22Q106 38 76 76" ${strokeW(W.outline, H.gold.mid)}/>` + star(72, 82, 8, H.gold.light) + cloud(90, 140, 0.55, H.night.bg) +
    `<circle cx="252" cy="70" r="46" fill="#fff3ea" opacity=".6"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (Math.PI * i) / 4; return `<path d="M${(252 + Math.cos(a) * 30).toFixed(1)} ${(70 + Math.sin(a) * 30).toFixed(1)}L${(252 + Math.cos(a) * 42).toFixed(1)} ${(70 + Math.sin(a) * 42).toFixed(1)}" ${strokeW(3, H.gold.mid)}/>`; }).join("") + star(252, 70, 26, H.gold.light) + eye(246, 72, 2.6) + eye(258, 72, 2.6) + smile(252, 77, 3.4) +
    snowBelt(0, 0) + sledPath + glowTag(314, 198, 8) +
    snowPine(34, 238, 1.1, H.pine.dark, true) + snowPine(290, 250, 0.7, H.pine.dark) + bruno,
  // RIGHT (night): TL snowfall + shooting flake, TR tall pine with gold lights, BL lamp post, BR Dew tiptoes with a lantern.
  R:
    skyFace(2) + twinkles([[30, 40, 5], [110, 70, 4], [200, 30, 5]]) + flake(60, 100, 11) + flake(130, 40, 8) + dots([[24, 70, 2.5], [88, 130, 2.5], [150, 110, 2.5], [104, 20, 2.5]]) +
    snowBelt(6, 2) + sledPath +
    snowPine(280, 196, 1.45, H.pine.dark, true) + star(280, 108, 10, H.gold.mid) +
    g(0, 0, 1, `<rect x="52" y="148" width="7" height="116" fill="${twig}" stroke="${ink}" stroke-width="2.5"/><circle cx="55" cy="140" r="30" fill="#fff0e6" opacity=".6"/><rect x="45" y="126" width="21" height="26" rx="5" fill="${H.gold.light}" ${o}/><path d="M42 126L55 112L69 126Z" fill="${H.berry.mid}" ${o} stroke-linejoin="round"/><path d="M44 264H66" ${strokeW(5, ink)}/>`) +
    dew,
  // LEFT (dusk): TL holly branch with a bird, TR first star, BL Crumb waves with a candy cane, BR sun setting between pines.
  L:
    skyFace(0) + sunDisc(298, 226, 24, H.peach.mid) + twinkles([[196, 44, 8], [250, 86, 4]]) + cloud(236, 130, 0.6, H.pink.bg) +
    snowBelt(8, 4) + snowPine(250, 246, 1.6, H.pine.light) + snowPine(38, 250, 1.1, H.pine.light) + sledPath +
    `<path d="M-10 92Q80 82 150 28" ${strokeW(4.5, twig)}/>` + holly(40, 82, -20, 1) + holly(100, 70, 30, 1) + holly(144, 40, -30, 0.9) +
    `<path d="M10 100Q40 92 70 98Q50 88 10 90Z" fill="${snowW}" ${o}/>` +
    bird(64, 56, H.night.mid, 1.1, -1) +
    glowTag(6, 198, 8) + crumb +
    dot(284, 296, 5, H.berry.mid) + dot(298, 304, 4, H.gold.mid),
  U: null, D: null,
};

// UP: a calm snowy sky: the aurora ribbon sweeps under one big smiling gold star; two cloud kids rest below.
// Edge colors are computed from the neighboring faces' sky rows, so the seams match exactly.
const topOf = (t) => skyAt(t, 0, 0, 232);
const upEdges = {
  bottom: (x) => topOf(1 + (x / 320 - 0.5)),
  top: (x) => topOf(3 + ((320 - x) / 320 - 0.5)),
  left: (x, y) => topOf(0 + (y / 320 - 0.5)),
  right: (x, y) => topOf(2 + ((320 - y) / 320 - 0.5)),
};
const ribbon = (dy, c, op) =>
  `<path transform="translate(0 ${dy})" d="M26 104C72 48 120 100 172 106S268 126 296 140C268 178 230 190 172 164C114 138 66 104 26 104Z" fill="${c}" opacity="${op}"/>`;
const halo = (x, y, r) => [1.9, 1.5, 1.2].map((k, i) => `<circle cx="${x}" cy="${y}" r="${r * k}" fill="#ffece0" opacity="${[0.22, 0.3, 0.42][i]}"/>`).join("");
drawings.U =
  edgeBlend(upEdges, "#c3cbf0") +
  cloudFar(64, 250, 0.7, "#fff") + cloudFar(238, 178, 0.55, "#fff") + cloudFar(150, 56, 0.4, "#fff") +
  ribbon(-10, H.pine.light, 0.85) + ribbon(4, H.lilac.light, 0.75) + ribbon(20, H.pink.light, 0.6) +
  `<path d="M34 94C76 44 120 92 172 98S268 118 290 130" fill="none" stroke="#fff" stroke-width="2.4" opacity=".5" stroke-linecap="round"/>` +
  twinkles([[42, 36, 5], [118, 24, 4], [20, 190, 4], [292, 240, 5]]) +
  halo(236, 82, 36) + star(236, 82, 36, H.gold.light) + miniFace(236, 86, "happy", 10.5) + twinkles([[292, 30, 4], [190, 40, 3]]) +
  cloudShaded(14, 282, 0.85, snowW, H.night.bg) + miniFace(55, 258, "sleepy", 12) + flake(36, 212, 10) +
  cloud(214, 296, 0.62, snowW) + miniFace(240, 278, "wink", 9) + bird(252, 218, H.berry.mid, 1, -1) +
  flake(128, 232, 7) + flake(172, 292, 6) + dots([[100, 200, 2.4], [160, 250, 2.4], [300, 196, 2.4]]);

// DOWN: frosted ground. Wick the candle-lantern is the focal glow; footprints lead from a pine sapling to it,
// a sled track runs down to a sledful of presents, and a lost mitten sits in a drift. All edges are plain snow.
const sledTrack = (d) => `<path d="${d}" fill="none" stroke="${H.snow.light}" stroke-width="22"/><path d="${d}" fill="none" stroke="${H.snow.dark}" stroke-width="2.6" transform="translate(-5 0)"/><path d="${d}" fill="none" stroke="${H.snow.dark}" stroke-width="2.6" transform="translate(5 0)"/>`;
const foot = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse cx="-5" cy="0" rx="4" ry="6.5" fill="${H.snow.dark}" opacity=".6"/><ellipse cx="6" cy="9" rx="4" ry="6.5" fill="${H.snow.dark}" opacity=".6"/></g>`;
const drift = (d) => `<path d="${d}" fill="${H.snow.bg}" stroke="${ink}" stroke-width="${W.fine}" stroke-linejoin="round"/>`;
drawings.D =
  edgeBlend({ top: () => H.snow.bg, bottom: () => H.snow.bg, left: () => H.snow.bg, right: () => H.snow.bg }, "#c9d8f2", 8, 60) +
  `<ellipse cx="102" cy="150" rx="92" ry="74" fill="#fff0c8" opacity=".5"/><ellipse cx="102" cy="150" rx="64" ry="52" fill="#fff8e2" opacity=".6"/>` +
  `<path d="M36 196Q44 176 104 176Q164 176 172 196Q160 204 104 204Q48 204 36 196Z" fill="${H.snow.bg}" stroke="${ink}" stroke-width="${W.outline}" stroke-linejoin="round"/>` +
  flake(160, 26, 8, H.snow.dark, 2.2) + flake(304, 300, 7, H.snow.dark, 2.2) + flake(20, 262, 7, H.snow.dark, 2) + dots([[200, 120, 2.5], [246, 150, 2.5], [136, 270, 2.5]]) +
  sledTrack("M262 -10C252 70 192 110 198 190S190 258 160 292") +
  foot(70, 292, -30) + foot(84, 262, -15) + foot(106, 236, -5) +
  wick(100, 128, 1.3) +
  snowPine(40, 286, 1.0, H.pine.mid, true) + star(40, 224, 9, H.gold.mid) +
  `<ellipse cx="300" cy="62" rx="9" ry="14" fill="${H.berry.mid}" ${o} transform="rotate(35 300 62)"/><path d="M252 86L250 52Q252 28 272 28Q292 28 292 52L290 86Z" fill="${H.berry.mid}" ${o} stroke-linejoin="round"/><path d="M262 40Q262 54 266 60M272 38V62" ${strokeW(2.2, H.berry.dark)}/>` +
  `<path d="M222 98Q228 70 262 74Q300 66 316 98Z" fill="${snowW}" ${o}/>` +
  sled(214, 300, 1.05) + gift(190, 288, 46, 38, H.berry.mid, H.gold.mid) + gift(238, 286, 40, 30, H.pine.mid, H.lilac.light) + gift(212, 252, 34, 28, H.night.light, H.berry.mid) +
  holly(284, 290, -30, 0.8) + candyCane(298, 306, 0.5);

// ---- Output --------------------------------------------------------------------
const svgDoc = (inner, viewBox, w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="${viewBox}">${inner}</svg>\n`;
for (const [face, shapes] of Object.entries(drawings)) {
  writeFileSync(new URL(`${face}.svg`, dir), svgDoc(shapes, "0 0 320 320", 320));
}
