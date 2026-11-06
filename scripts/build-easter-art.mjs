/** Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
 * This generator is the editable source of the artwork: art data under CC BY-SA 4.0, not AGPL program code.
 * EASTER theme proposal, forked from Pastel Garden (build-pastel-garden-art.mjs).
 * Shipped as scripts/build-easter-art.mjs; `node scripts/build-easter-art.mjs` rewrites the six whole faces in
 * public/playground-easter/ (the playground cuts them into stickers at run time). Run
 * `node scripts/build-playground-theme.mjs easter` afterwards to re-pin them.
 * Original characters: Bun (bunny kid), Peep (hatching chick), Fluff (lamb cloud), Dew (snail with watering can).
 * Flat vector, one ink color, three line weights, no gradients/filters/clipPath/url()/text.
 */
import { writeFileSync } from "node:fs";
const dir = new URL("../public/playground-easter/", import.meta.url);
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
// ---- Story pass: one day-night cycle around the four side faces ------------
// Net reading order F -> R -> B -> L -> (F): dawn (L), day (F and R), night (B).
// All four share the same ground profile and garden path at every shared edge
// (far hill y=226, mid hill y=262, path y=302), so the scene is continuous when assembled.
const belt = (farFill, midFill, dv = 0, mv = 0) =>
  hill(`M0 226Q80 ${196 + dv} 170 ${222 - dv / 2}T320 226V320H0Z`, farFill) +
  hill(`M0 262Q90 ${236 + mv} 190 ${260 - mv / 2}T320 262V320H0Z`, midFill, true);
const gardenPath = `<path d="M0 302Q80 288 160 304T320 302" fill="none" stroke="${ink}" stroke-width="20"/><path d="M0 302Q80 288 160 304T320 302" fill="none" stroke="${H.peach.light}" stroke-width="14"/>`;
const sunDisc = (x, y, r, c) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * i) / 4;
    return `<path d="M${(x + Math.cos(a) * (r + 5)).toFixed(1)} ${(y + Math.sin(a) * (r + 5)).toFixed(1)}L${(x + Math.cos(a) * (r + 11)).toFixed(1)} ${(y + Math.sin(a) * (r + 11)).toFixed(1)}" ${strokeW(3, c)}/>`;
  }).join("") + `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ink}" stroke-width="${W.outline}"/>`;
// Dotted butterfly trail as explicit dots along a quadratic curve (the validator allows no
// stroke-dasharray). F ends at (320,104) and R starts at (0,104).
const dotted = (p0, c, p1, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="${H.peach.dark}"/>`;
  }).join("");
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
const bloom = (x, y, r, c, cc = H.butter.mid, n = 5) =>
  g(x, y, 1, Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `<circle cx="${(Math.cos(a) * r * 0.8).toFixed(1)}" cy="${(Math.sin(a) * r * 0.8).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${c}" ${o}/>`;
  }).join("") + `<circle r="${(r * 0.45).toFixed(1)}" fill="${cc}" ${o}/>`);
const bloomPalette = [H.pink.mid, H.peach.mid, H.butter.mid, H.lilac.mid, "#ffffff", H.sky.mid];
const scatterBlooms = (seed, cols, rows, skip = () => false, r0 = 7, r1 = 11) => {
  const r = rng(seed), out = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.2 + 0.6 * r()) * (320 / cols), y = (j + 0.2 + 0.6 * r()) * (320 / rows);
      const rad = r0 + r() * (r1 - r0), c = bloomPalette[Math.floor(r() * bloomPalette.length)];
      if (!skip(x, y)) out.push({ x, y, rad, c });
    }
  return out.sort((a, b) => a.y - b.y).map((b) => bloom(b.x, b.y, b.rad, b.c, b.c === H.butter.mid ? H.peach.mid : H.butter.mid)).join("");
};
const kite = (x, y, s = 1, c = H.pink.mid) =>
  g(x, y, s, `<path d="M0 26Q-10 40 0 52T0 80" ${strokeW(W.fine)}/><circle cy="44" r="3" fill="${H.butter.mid}" ${o}/><circle cy="62" r="3" fill="${H.sky.mid}" ${o}/><polygon points="0,-26 17,0 0,28 -17,0" fill="${c}" ${o} stroke-linejoin="round"/><path d="M0 -26V28M-17 0H17" ${strokeW(W.fine)}/>`);
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
// Layered, shaded picnic meadow: bush corners (far), blanket and flower beds (mid), grass tufts (near).
const bush = (x, y, sc) =>
  shaded(g(x, y, sc, `<circle cx="-24" cy="8" r="22"/><circle cx="4" cy="-10" r="30"/><circle cx="32" cy="8" r="22"/><ellipse cx="4" cy="22" rx="46" ry="14"/>`), H.green.mid, H.green.dark, shine(x - 14 * sc, y - 24 * sc, 14 * sc, 7 * sc), [x, y]);

// ==== EASTER additions ======================================================
// Story: Easter morning in the meadow. Sunrise on L, the egg hunt on F, the chick hatches on R,
// the lamb-cloud dozes in the evening glow on B, then dawn again on L. Blossom sky above, painted
// egg meadow below. Concept: "Bun and friends find the last egg before bedtime."

// ---- Painted eggs, patterns drawn from geometry (no clipPath) ---------------
const hw = (y) => 20 * Math.sqrt(Math.max(0, 1 - ((y - 4) / 26) ** 2)) * (1 + (0.12 * (y - 4)) / 26);
const ptsStr = (list) => list.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");
// band polygon between y1 and y2 following the egg outline (scaled by s)
const eggBand = (y1, y2, s, fill) => {
  const ys = [];
  for (let y = y1; y <= y2 + 0.01; y += 1.5) ys.push(y);
  const left = ys.map((y) => [-hw(y) * s, y * s]);
  const right = ys.map((y) => [hw(y) * s, y * s]).reverse();
  return `<path d="M${ptsStr([...left, ...right])}Z" fill="${fill}"/>`;
};
// pattern: stripes | dots | zigzag | flowers | bands. cols=[base, accent, accent2]
const eggPattern = (type, s, cols, yMin = -22, yMax = 30) => {
  const [c1, c2, c3] = cols;
  const inside = (x, y, pad = 4) => y >= yMin + 3 && y <= yMax - 3 && Math.abs(x) < hw(y) - pad;
  let out = "";
  if (type === "stripes") {
    for (const [a, b, c] of [[-12, -5, c2], [1, 5, c3], [9, 15, c2], [19, 22, c3]]) if (a >= yMin + 2 && b <= yMax) out += eggBand(a, b, s, c);
  } else if (type === "dots") {
    for (const [x, y] of [[-6, -10], [7, -5], [-9, 5], [4, 9], [-3, 18], [10, 17], [-12, 17], [0, -1]])
      if (inside(x, y, 3)) out += `<circle cx="${x * s}" cy="${y * s}" r="${2.6 * s}" fill="${c2}"/>`;
    for (const [x, y] of [[3, 24], [-4, 2]]) if (inside(x, y, 3)) out += `<circle cx="${x * s}" cy="${y * s}" r="${1.8 * s}" fill="${c3}"/>`;
  } else if (type === "zigzag") {
    for (const y0 of [-6, 8, 21]) {
      if (y0 < yMin + 4 || y0 > yMax - 4) continue;
      const w = hw(y0) - 3, n = 5, p = [];
      for (let i = 0; i <= n; i++) p.push([(-w + (2 * w * i) / n) * s, (y0 + (i % 2 ? 3.2 : -3.2)) * s]);
      out += `<path d="M${ptsStr(p)}" ${strokeW(2.4 * Math.min(1, s + 0.2), y0 === 8 ? c3 : c2)}/>`;
    }
  } else if (type === "flowers") {
    for (const [x, y] of [[-6, -6], [6, 6], [-4, 18]]) if (inside(x, y, 3))
      out += Array.from({ length: 5 }, (_, i) => `<circle cx="${(x + Math.cos((i * 2 * Math.PI) / 5) * 3.2) * s}" cy="${(y + Math.sin((i * 2 * Math.PI) / 5) * 3.2) * s}" r="${2 * s}" fill="${c2}"/>`).join("") + `<circle cx="${x * s}" cy="${y * s}" r="${1.5 * s}" fill="${c3}"/>`;
    for (const [x, y] of [[8, -10], [-9, 6], [8, 21]]) if (inside(x, y, 3)) out += `<circle cx="${x * s}" cy="${y * s}" r="${1.1 * s}" fill="${c3}"/>`;
  }
  return out;
};
const eggOutlinePts = (s, y1 = -22, y2 = 30) => {
  const ys = [];
  for (let y = y1; y <= y2 + 0.01; y += 1.5) ys.push(y);
  return [...ys.map((y) => [hw(y) * s, y * s]), ...ys.map((y) => [-hw(y) * s, y * s]).reverse()];
};
// egg(): centered on (x,y) at scale s, optionally rotated. Constant ink width regardless of s.
const egg = (x, y, s, rot, type, cols, shine_ = true) => {
  const sw = s >= 0.8 ? W.outline : W.fine;
  const d = `M${ptsStr(eggOutlinePts(s))}Z`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="${d}" fill="${cols[0]}"/>${eggPattern(type, s, cols)}${shine_ ? `<ellipse cx="${-7 * s}" cy="${-8 * s}" rx="${3.2 * s}" ry="${6 * s}" fill="#fff" opacity=".5" transform="rotate(18 ${-7 * s} ${-8 * s})"/>` : ""}<path d="${d}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/></g>`;
};
// A shell half with a zigzag crack: top=true gives the cap, otherwise the bowl.
const crackPts = (s, n = 6) => {
  const w = hw(2) * s, p = [];
  for (let i = 0; i <= n; i++) p.push([-w + (2 * w * i) / n, (2 + (i % 2 ? 4 : -2)) * s]);
  return p;
};
const shellHalf = (x, y, s, rot, top, type, cols) => {
  const zig = crackPts(s);
  const ys = [];
  for (let yy = top ? -22 : 3; yy <= (top ? 0 : 30); yy += 1.5) ys.push(yy);
  const left = ys.map((yy) => [-hw(yy) * s, yy * s]), right = ys.map((yy) => [hw(yy) * s, yy * s]);
  // cap: tip -> down the left edge -> zigzag -> up the right edge; bowl: zigzag -> down right -> bottom -> up left
  const outline = top ? [...left, ...zig, ...right.reverse()] : [...zig, ...right, ...left.reverse()];
  const d = `M${ptsStr(outline)}Z`;
  const sw = s >= 0.8 ? W.outline : W.fine;
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="${d}" fill="${cols[0]}"/>${eggPattern(type, s, cols, top ? -22 : 9, top ? -4 : 30)}<path d="${d}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/></g>`;
};
const col = (a, b, c) => [H[a[0]][a[1]], H[b[0]][b[1]], H[c[0]][c[1]]];
const eggs = {
  a: col(["pink", "light"], ["pink", "mid"], ["butter", "mid"]),
  b: col(["butter", "light"], ["peach", "mid"], ["pink", "mid"]),
  c: col(["sky", "light"], ["sky", "dark"], ["butter", "mid"]),
  d: col(["lilac", "light"], ["lilac", "dark"], ["pink", "mid"]),
  e: col(["green", "light"], ["green", "dark"], ["pink", "light"]),
  g: col(["lilac", "bg"], ["lilac", "mid"], ["butter", "light"]),
  f: col(["peach", "light"], ["pink", "dark"], ["butter", "light"]),
};

// ---- Spring props -----------------------------------------------------------
const blossom = (x, y, r = 7, c = H.pink.light) => bloom(x, y, r, c, H.butter.mid, 5);
const branch = (d, blooms) => `<path d="${d}" ${strokeW(4, twig)}/>` + blooms.map(([x, y, r, c]) => blossom(x, y, r, c)).join("");
const crocus = (x, y, s = 1, c = H.lilac.mid) =>
  g(x, y, s, `<path d="M0 0V-14M-6 0L-9 -12M6 0L9 -12" ${strokeW(W.outline, H.green.dark)}/><path d="M-9 -14Q-10 -28 0 -32Q10 -28 9 -14Q0 -9 -9 -14Z" fill="${c}" ${o}/><path d="M0 -31V-14" ${strokeW(1.5, "#fff")}/>`);
const eggFlag = (x, y, s, fill) => `<ellipse cx="${x}" cy="${y}" rx="${7 * s}" ry="${9 * s}" fill="${fill}" ${o}/>`;
const carrot = (x, y, s = 1) => g(x, y, s, `<path d="M-6 0L0 22L6 0Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/><path d="M-5 0Q-8 -10 -2 -12M0 0Q0 -12 3 -14M5 0Q9 -8 5 -11" ${strokeW(W.outline, H.green.dark)}/>`);

// ---- Characters --------------------------------------------------------------
// Bun: cream bunny kid, one ear up and one floppy, carries a basket of eggs, delighted.
const bun = (() => {
  const ear = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})"/>`;
  const earUp = ear(160, 158, 14, 40, -8), earFlop = ear(232, 190, 13, 31, -55);
  const body = `<ellipse cx="180" cy="236" rx="56" ry="50"/><ellipse cx="150" cy="284" rx="19" ry="10"/><ellipse cx="212" cy="284" rx="19" ry="10"/>${earUp}${earFlop}${arm(238, 244, -38, 10, 18)}`;
  const inner = `<ellipse cx="161" cy="160" rx="7" ry="28" fill="${H.pink.light}" transform="rotate(-8 161 160)"/><ellipse cx="232" cy="190" rx="6.5" ry="21" fill="${H.pink.light}" transform="rotate(-55 232 190)"/>`;
  const basket = g(90, 274, 1.3, `${egg(-12, -36, 0.72, -14, "stripes", eggs.c)}${egg(10, -38, 0.7, 12, "dots", eggs.a)}` + shaded(`<path d="M-30 -22H30L24 14Q0 20 -24 14Z"/>`, H.peach.mid, H.peach.dark, shine(-14, -12, 8, 4), [0, -4]) + `<path d="M-27 -10H27M-25 2H25" ${strokeW(W.fine, H.peach.dark)}/><path d="M-26 -20Q-26 -82 26 -20" ${strokeW(W.outline, twig)}/>`);
  return `${shaded(body, white, H.lilac.bg, shine(150, 205, 15, 9), [180, 236])}${inner}${blossom(150, 138, 6, H.pink.mid)}${sparkleEye(160, 226)}${sparkleEye(200, 226)}${cheeks(180, 240, 31)}<ellipse cx="180" cy="236" rx="4.5" ry="3.2" fill="${H.pink.dark}"/>${laugh(180, 244)}${basket}${merged(arm(126, 238, 20, 9, 14), white)}`;
})();
// Peep: butter chick popping out of a patterned egg, wearing half the shell as a tilted hat.
const peepAt = (x, y, k = 1, type = "zigzag", cols = eggs.a) => {
  const S = 2.5;
  const body = `<circle cx="0" cy="-20" r="44"/>${arm(-44, -10, 50, 10, 17)}${arm(46, -30, -35, 10, 17)}`;
  const shellBowl = shellHalf(0, 6, S, 0, false, type, cols);
  const cap = shellHalf(18, -66, 1.5, 24, true, type, cols);
  const hair = `<path d="M-4 -64q-3-10-9-12M2 -64q1-12 4-16M8 -63q6-8 12-8" ${strokeW(W.outline, H.butter.dark)}/>`;
  return g(x, y, k, `${shaded(body, H.butter.light, H.butter.mid, shine(-18, -44, 13, 8), [0, -20])}${hair}${eye(-16, -26)}${eye(16, -26)}${cheeks(0, -14, 26)}<path d="M-6 -17L6 -17L0 -9Z" fill="${H.peach.dark}" ${o} stroke-linejoin="round"/>${smile(0, -6, 7)}${shellBowl}${cap}`);
};
// Fluff: lamb-like cloud with a flower crown, asleep and hugging an egg.
const fluff = (() => {
  const wool = `<circle cx="126" cy="226" r="34"/><circle cx="170" cy="204" r="46"/><circle cx="216" cy="226" r="34"/><circle cx="144" cy="250" r="30"/><circle cx="198" cy="250" r="30"/><ellipse cx="170" cy="244" rx="68" ry="30"/>`;
  const ears = `<ellipse cx="128" cy="214" rx="9" ry="17" fill="${H.peach.mid}" ${o} transform="rotate(60 128 214)"/><ellipse cx="212" cy="214" rx="9" ry="17" fill="${H.peach.mid}" ${o} transform="rotate(-60 212 214)"/>`;
  const face = `<ellipse cx="170" cy="226" rx="31" ry="27" fill="${H.peach.light}" ${o}/>`;
  const crown = [[148, 182, 6, H.pink.mid], [164, 176, 7, H.butter.light], [182, 177, 6, H.lilac.light], [198, 184, 6, H.pink.light]].map(([x, y, r, c]) => blossom(x, y, r, c)).join("");
  return `${shaded(wool, white, H.lilac.light, shine(140, 190, 18, 9), [170, 232])}${ears}${face}${sleepyEye(158, 224)}${sleepyEye(182, 224)}${cheeks(170, 235, 22)}${smile(170, 235, 5)}${crown}${egg(170, 270, 1.15, 0, "stripes", eggs.f)}${merged(arm(140, 266, 80, 9, 15) + arm(200, 266, -80, 9, 15), white)}<ellipse cx="136" cy="292" rx="12" ry="7" fill="${H.peach.mid}" ${o}/><ellipse cx="206" cy="292" rx="12" ry="7" fill="${H.peach.mid}" ${o}/>${bubble(234, 190, 5)}${bubble(248, 168, 7)}${bubble(268, 140, 10)}`;
})();
// Dew: a snail whose shell is a painted egg ring pattern; a tiny watering can rides on the shell and waters a crocus.
const dew = (() => {
  const shell = `<circle cx="-6" cy="-22" r="18" fill="${H.pink.light}" ${o}/><circle cx="-6" cy="-22" r="12.5" fill="${H.lilac.light}" stroke="${ink}" stroke-width="1.5"/><circle cx="-6" cy="-22" r="7" fill="${H.butter.light}" stroke="${ink}" stroke-width="1.5"/><circle cx="-6" cy="-22" r="2.2" fill="${H.pink.mid}"/>`;
  const head = `<path d="M-30 -2Q-28 -10 -10 -10H26Q36 -10 36 -18Q36 -30 26 -30Q18 -30 16 -22Q10 -12 4 -10" fill="none"/>`;
  const bodyShape = `<ellipse cx="0" cy="-5" rx="32" ry="8"/><ellipse cx="25" cy="-13" rx="12" ry="12"/>`;
  const face = `${eye(21, -14, 3.2)}${eye(33, -14, 3.2)}<ellipse cx="27" cy="-6" rx="3.5" ry="2" fill="${H.pink.dark}" opacity=".55"/><path d="M24 -8Q27 -4 31 -8" ${strokeW(1.6)}/>`;
  const can = `<g transform="translate(-8 -49) rotate(22)"><path d="M10 0L30 -8" ${strokeW(4)}/><ellipse cx="33" cy="-7" rx="3" ry="6" fill="${H.sky.dark}" ${o} transform="rotate(-25 33 -7)"/><path d="M-10 -8Q-22 -4 -10 6" ${strokeW(W.outline)}/><rect x="-11" y="-10" width="22" height="18" rx="4" fill="${H.sky.mid}" ${o}/><path d="M-6 -4H6" ${strokeW(W.fine, "#fff")}/></g>`;
  const drops = [[146, 238, 3], [152, 254, 2.8], [158, 270, 2.5], [163, 286, 2.2]].map(([x, y, r]) => `<path d="M${x} ${y - r * 1.8}Q${x + r} ${y} ${x} ${y + r}Q${x - r} ${y} ${x} ${y - r * 1.8}Z" fill="${H.sky.mid}" ${o}/>`).join("");
  return g(84, 300, 1.8, `${shaded(bodyShape, H.peach.light, H.peach.mid, "", [10, -8], 0.92, [-1, -1])}${shell}${face}${can}`) + drops;
})();

// ---- Layout helpers ----------------------------------------------------------
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Multi-stop horizontal sky blends. Seam colors are shared constants, so every face edge pair is identical.
const seam = { BL: "#f1dfee", LF: "#fdf0d8", FR: "#e6f3e6", RB: "#fbe4dc" };
const stops = {
  L: [seam.BL, "#f8dfdc", "#fbe3cc", "#fdebd0", seam.LF],
  F: [seam.LF, "#eaf3e0", H.sky.bg, "#dcefec", seam.FR],
  R: [seam.FR, "#f2f3d6", H.butter.bg, "#fdeacf", seam.RB],
  B: [seam.RB, "#f2d9e8", H.lilac.light, "#e8d6ee", seam.BL],
};
const skyAt = (face, x) => {
  const s = stops[face], t = Math.min(1, Math.max(0, x / 320)) * (s.length - 1), k = Math.min(s.length - 2, Math.floor(t));
  return mix(s[k], s[k + 1], t - k);
};
const sky = (face) => {
  let out = "";
  for (let x = 0; x < 320; x += 4) out += `<rect x="${x}" y="0" width="5" height="320" fill="${skyAt(face, x === 316 ? 320 : x)}"/>`;
  return out;
};
// Up face: every side takes the exact color of the neighboring face's top edge (U top=B reversed, left=L, right=R reversed, bottom=F).
const edgeCol = { top: (p) => skyAt("B", 320 - p), left: (p) => skyAt("L", p), right: (p) => skyAt("R", 320 - p), bottom: (p) => skyAt("F", p) };
const upField = (center, cell = 10) => {
  const hx = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  let out = `<rect width="320" height="320" fill="${center}"/>`;
  for (let y = 0; y < 320; y += cell) for (let x = 0; x < 320; x += cell) {
    const cx = x + cell / 2, cy = y + cell / 2;
    const sides = [["top", cy, cx], ["bottom", 320 - cy, cx], ["left", cx, cy], ["right", 320 - cx, cy]];
    let ws = 40, acc = hx(center).map((v) => v * 40);
    for (const [k, d, p] of sides) { const w = 1 / (d / 320 + 0.05) ** 2, c = hx(edgeCol[k](p)); ws += w; acc = acc.map((v, i) => v + w * c[i]); }
    out += `<rect x="${x}" y="${y}" width="${cell + 1}" height="${cell + 1}" fill="#${acc.map((v) => Math.round(v / ws).toString(16).padStart(2, "0")).join("")}"/>`;
  }
  for (let p = 0; p < 320; p += 4) {
    out += `<rect x="${p}" y="0" width="5" height="3" fill="${edgeCol.top(p)}"/><rect x="${p}" y="317" width="5" height="3" fill="${edgeCol.bottom(p)}"/><rect x="0" y="${p}" width="3" height="5" fill="${edgeCol.left(p)}"/><rect x="317" y="${p}" width="3" height="5" fill="${edgeCol.right(p)}"/>`;
  }
  return out;
};
const meadow = (far, mid, dv, mv) => belt(far, mid, dv, mv) + gardenPath;
const tint = (c, t, k) => mix(c, t, k);
const sunBall = (x, y, r) => sunDisc(x, y, r, H.butter.mid);
const eggInGrass = (x, y, s, rot, type, cols) => egg(x, y, s, rot, type, cols) + tuft(x - 16 * s, y + 24 * s, H.green.dark) + tuft(x + 14 * s, y + 26 * s, H.green.dark);
const pennant = (x, y, c) => `<path d="M${x} ${y}l9 18l9-18Z" fill="${c}" ${o} stroke-linejoin="round"/>`;
const eggBalloon = (x, y, s, type, cols) => g(x, y, s, `<path d="M0 36Q-7 52 3 66T0 88" ${strokeW(W.fine)}/>` + egg(0, 0, 1.4, 0, type, cols));

// ---- The six faces -------------------------------------------------------------
const drawings = {};
// FRONT (morning, Bun): TL rainbow+cloud+bird, TR sun+kite string of pennants, BL hidden dotted egg+tulips, BR striped egg+ladybug stem.
drawings.F =
  sky("F") +
  ["pink", "butter", "green", "sky"].map((k, i) => `<path d="M${14 + i * 7} 150A${50 - i * 7} ${50 - i * 7} 0 0 1 ${114 - i * 7} 150" fill="none" stroke="${H[k].mid}" stroke-width="7"/>`).join("") +
  cloud(60, 62, 0.9) + bird(124, 100, H.pink.mid, 1.2, -1) + cloud(262, 128, 0.5, H.sky.light) + sunBall(262, 50, 20) + dotted([170, 204], [270, 190], [320, 104], 14) +
  meadow(H.green.light, H.green.mid, 4, 0) +
  eggInGrass(22, 276, 0.95, -14, "dots", eggs.b) + tulip(86, 296, 0.7, H.butter.mid) + tulip(20, 304, 0.55, H.lilac.mid) +
  eggInGrass(292, 252, 0.9, 16, "stripes", eggs.c) + ladybug(300, 306, 0.9) + tuft(268, 312) +
  bun;
// RIGHT (afternoon, Peep): TL flower+bee+butterfly (the trail from F ends here), TR cloud+kite, BL carrot patch, BR snail.
drawings.R =
  sky("R") +
  cloud(176, 60, 0.55) + kite(258, 56, 0.7, H.lilac.mid) + cloud(256, 150, 0.4, H.sky.light) +
  meadow(H.green.light, H.green.mid, 4, 0) +
  `<path d="M90 150V290" ${stroke}/>` + leafShape(90, 285, -140, 1) + petals(90, 105, 36, 6, H.peach.light, 15) + `<circle cx="90" cy="105" r="14" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.outline}"/>` +
  bee(36, 52, 1.1) + dotted([0, 104], [14, 106], [34, 104], 4) + butterfly(50, 106, H.pink.mid, H.peach.mid, 1) +
  carrot(40, 288, 0.9) + carrot(64, 296, 0.7) + tuft(24, 312) + tuft(300, 308) +
  peepAt(196, 268, 1, "dots", eggs.g) + snail(286, 300, 0.9);
// BACK (evening, Fluff): TL egg tree with lantern glow, TR sleepy moon, BL egg tree, BR cottage.
drawings.B =
  sky("B") +
  star(60, 62, 12) + star(110, 100, 7) + star(28, 118, 5) + cloud(70, 140, 0.6, H.pink.bg) +
  `<path transform="translate(40 -20)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>` + sleepyEye(262, 78) + cheeks(258, 90, 6, H.pink.dark) + star(204, 60, 7) + star(292, 150, 5) +
  meadow(H.green.light, H.green.mid, 4, 0) +
  // egg tree (left)
  `<path d="M52 270V210" ${strokeW(5, twig)}/>` + `<circle cx="52" cy="196" r="36" fill="${H.green.mid}" ${o}/>` +
  egg(36, 190, 0.5, -10, "dots", eggs.a, false) + egg(66, 196, 0.5, 12, "stripes", eggs.c, false) + egg(50, 214, 0.5, 0, "zigzag", eggs.b, false) +
  glow(18, 160, 3) + glow(96, 214, 3) + glow(314, 198, 3) +
  house(284, 296, 0.75) + fluff;
// LEFT (dawn, Dew): TL blossom branch+ladybug, TR bird+hanging egg, BL snail with can, BR sunrise and crocus.
drawings.L =
  sky("L") +
  sunDisc(298, 222, 26, H.peach.mid) + pine(250, 238, 1.5, H.green.light) +
  meadow(H.green.light, H.green.mid, 8, 4) +
  branch("M-10 90Q90 70 210 22", [[26, 82, 8, H.pink.light], [58, 76, 7, H.butter.light], [92, 66, 8, H.pink.mid], [130, 52, 7, H.pink.light], [170, 36, 8, H.pink.mid]]) +
  `<path d="M120 58V90" ${strokeW(W.fine)}/>` + egg(120, 106, 0.6, 0, "stripes", eggs.d, false) + ladybug(30, 68, 0.9) + bird(222, 22, H.peach.mid, 1.1, -1) + `<path d="M222 28V60" ${strokeW(W.fine)}/>` + egg(222, 74, 0.55, 8, "flowers", eggs.f, false) +
  glow(6, 198, 3) + mushroom(272, 300, 1.0) + tuft(236, 312) + crocus(172, 300, 1.15, H.lilac.mid) + crocus(198, 306, 0.9, H.butter.mid) + crocus(150, 310, 0.7, H.pink.mid) + dew +
  dot(240, 292, 5, H.pink.mid) + tulip(20, 306, 0.6, H.pink.mid);
// UP (blossom sky): TL branch+bird, TR gentle sun, BL kite+clouds, BR egg balloon+branch.
drawings.U =
  upField("#f2f9fc") +
  cloudFar(30, 120, 0.5, H.lilac.light) + cloudFar(150, 150, 0.5) + cloudFar(250, 250, 0.45) +
  sunShaded(250, 74, 28) + miniFace(250, 74, "happy", 10) + cloud(236, 130, 0.55, white) +
  branch("M-10 70Q60 96 130 56", [[14, 62, 9, H.pink.light], [44, 84, 8, H.pink.mid], [80, 90, 9, H.pink.light], [110, 70, 8, H.butter.light], [132, 50, 9, H.pink.mid]]) +
  bird(150, 24, H.pink.mid, 1, -1) +
  kite(70, 190, 1, H.pink.mid) + cloud(28, 280, 0.8) + cloud(120, 292, 0.55, H.sky.light) +
  eggBalloon(160, 112, 1.15, "stripes", eggs.d) +
  branch("M330 250Q260 284 196 262", [[300, 262, 9, H.pink.light], [270, 280, 8, H.pink.mid], [232, 276, 9, H.pink.light], [206, 262, 8, H.lilac.light]]) +
  bee(150, 268, 1) + sparkles([[40, 30, 6], [90, 140, 4], [300, 160, 4], [160, 304, 5]]) +
  cloudShaded(214, 220, 0.5, white, H.lilac.bg);
// DOWN (painted-egg meadow): TL tulips+striped egg, TR bush+zigzag egg, BL flower bed+dotted egg, BR basket, Peep on the stepping stones.
const stones2 = Array.from({ length: 5 }, (_, i) => {
  const t = i / 4, u = 1 - t;
  const x = u * u * 240 + 2 * u * t * 252 + t * t * 190, y = u * u * 8 + 2 * u * t * 70 + t * t * 130;
  return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="13" ry="8.5" fill="${H.peach.light}" ${o} transform="rotate(${(i * 31) % 50 - 25} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
}).join("");
const nest = (x, y, s) => g(x, y, s, shaded(`<ellipse cx="0" cy="8" rx="52" ry="24"/>`, twig, mix(twig, ink, 0.3), "", [0, 8]) + `<path d="M-40 6Q0 22 40 6M-34 16Q0 30 34 16" ${strokeW(W.fine, H.peach.light)}/>` + egg(-18, -6, 0.9, -10, "dots", eggs.a) + egg(14, -8, 0.9, 10, "stripes", eggs.c) + egg(0, 0, 0.8, 0, "flowers", eggs.f));
drawings.D =
  smoothField({ top: H.green.mid, right: H.green.mid, bottom: H.green.mid, left: H.green.mid }, "#c4e0b2") + [`<rect width="320" height="3" fill="${H.green.mid}"/>`,`<rect y="317" width="320" height="3" fill="${H.green.mid}"/>`,`<rect width="3" height="320" fill="${H.green.mid}"/>`,`<rect x="317" width="3" height="320" fill="${H.green.mid}"/>`].join("") +
  bush(10, 20, 0.9) + bush(316, 296, 0.95) +
  `<path d="M284 0C292 70 270 130 276 200" fill="none" stroke="${H.peach.light}" stroke-width="4" stroke-linecap="round" opacity=".75"/>` + stones2 +
  scatterBlooms(4, 4, 4, (x, y) => Math.hypot(x - 20, y - 20) < 56 || Math.hypot(x - 316, y - 296) < 56 || (x > 70 && x < 250 && y > 150 && y < 260) || Math.hypot(x-250,y-60)<44 || Math.hypot(x-60,y-84)<44 || Math.hypot(x-54,y-268)<44 || (x>200&&y<140&&x<300), 6, 9) +
  eggInGrass(60, 84, 1.0, -12, "stripes", eggs.d) +
  eggInGrass(260, 62, 0.9, 14, "zigzag", eggs.e) + butterfly(214, 40, H.lilac.mid, H.pink.light, 1.1) +
  eggInGrass(54, 268, 1.1, 10, "dots", eggs.c) +
  nest(176, 214, 1.15) + peepAt(120, 160, 0.42, "dots", eggs.g) + tuft(200, 312) + tuft(296, 120);

// ---- Output -------------------------------------------------------------------
for (const [face, shapes] of Object.entries(drawings)) {
  const svg = (viewBox, width) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${viewBox}">${shapes}</svg>\n`;
  writeFileSync(new URL(`${face}.svg`, dir), svg("0 0 320 320", 320));
}
