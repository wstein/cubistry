/** Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
 * This generator is the editable source of the artwork: art data under CC BY-SA 4.0, not AGPL program code.
 * "Laternenumzug" (lantern parade) picture-cube proposal, forked from the Pastel Garden generator.
 * Shipped as scripts/build-martin-art.mjs; `node scripts/build-martin-art.mjs` rewrites the six whole faces in
 * public/playground-martin/ (the playground cuts them into stickers at run time). Run
 * `node scripts/build-playground-theme.mjs martin` afterwards to re-pin them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
const dir = new URL("../public/playground-martin/", import.meta.url);
mkdirSync(dir, { recursive: true });

// ---- Style guide (kept from Pastel Garden) -------------------------------
const ink = "#4a3a38";
const W = { outline: 3, fine: 2, body: 6 };
const H = {
  butter: { bg: "#fdf1cf", light: "#fff4c2", mid: "#fbe08a", dark: "#f0c45a" },
  peach: { bg: "#fbe0c8", light: "#f8d5b8", mid: "#f6b98c", dark: "#e79c6c" },
  pink: { bg: "#fbdde4", light: "#f9c6d3", mid: "#f4a9bd", dark: "#e8788f" },
  green: { bg: "#e2efd9", light: "#bfe6d4", mid: "#9cc08a", dark: "#6f9f6b" },
  sky: { bg: "#d6ecf5", light: "#c9dcf2", mid: "#a9c1e6", dark: "#8fb0dd", aqua: "#cfeaee", water: "#a9dcdf", waterDk: "#8ccdd3" },
  lilac: { bg: "#ece4f8", light: "#d8ccf2", mid: "#b9a8e2", dark: "#9a86d0" },
  // autumn additions, same four tones, kept pastel
  amber: { bg: "#fdeccb", light: "#fde2a8", mid: "#f8c978", dark: "#ecaa55" },
  rust: { bg: "#f9dccd", light: "#f6c3a6", mid: "#ee9f7c", dark: "#dc7f5f" },
  plum: { bg: "#ead9ee", light: "#d9bfe3", mid: "#b99ad0", dark: "#9575b8" },
  deep: { bg: "#d4daf2", light: "#b6c0ea", mid: "#8f9cd8", dark: "#6f7dc4" },
};
const white = "#fffaf1";
const twig = "#8a6a4f";
const warm = "#ffd27a"; // lantern light
const strokeW = (w = W.outline, c = ink) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const stroke = strokeW();
const g = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const o = `stroke="${ink}" stroke-width="${W.fine}"`;
const o3 = `stroke="${ink}" stroke-width="${W.outline}"`;
const merged = (shapes, fill) =>
  `<g stroke="${ink}" stroke-width="${W.body}" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${fill}">${shapes}</g>`;
const shaded = (shapes, base, shade, hl = "", c = [160, 200], k = 0.9, off = [-5, -5]) =>
  `<g stroke="${ink}" stroke-width="${W.body}" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${shade}">${shapes}</g><g fill="${base}" transform="translate(${(c[0] - k * c[0] + off[0]).toFixed(1)} ${(c[1] - k * c[1] + off[1]).toFixed(1)}) scale(${k})">${shapes}</g>${hl}`;
const shine = (x, y, rx = 12, ry = 7, rot = -35) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".5" transform="rotate(${rot} ${x} ${y})"/>`;
const eye = (x, y, r = 4.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${x + 1.5}" cy="${y - 1.5}" r="${r * 0.3}" fill="#fff"/>`;
const smile = (x, y, w = 8) => `<path d="M${x - w} ${y}Q${x} ${y + w} ${x + w} ${y}" ${strokeW(2.5)}/>`;
const cheeks = (x, y, gap, c = H.pink.dark) =>
  `<ellipse cx="${x - gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".55"/><ellipse cx="${x + gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".55"/>`;
const arcEye = (x, y) => `<path d="M${x - 6} ${y + 3}Q${x} ${y - 6} ${x + 6} ${y + 3}" ${strokeW(2.5)}/>`;
const sleepyEye = (x, y) => `<path d="M${x - 7} ${y}Q${x} ${y + 7} ${x + 7} ${y}" ${strokeW(2.5)}/>`;
const laugh = (x, y) =>
  `<path d="M${x - 10} ${y}Q${x} ${y + 2} ${x + 10} ${y}Q${x} ${y + 18} ${x - 10} ${y}Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
const oMouth = (x, y) => `<ellipse cx="${x}" cy="${y + 4}" rx="4.5" ry="6" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2.5"/>`;
const sparkleEye = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="6.5" fill="${ink}"/><circle cx="${x + 2}" cy="${y - 2.5}" r="2.4" fill="#fff"/><circle cx="${x - 2}" cy="${y + 2}" r="1.2" fill="#fff"/>`;
const arm = (x, y, rot, rx = 11, ry = 18) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})"/>`;
const star = (x, y, r, c = H.butter.light, w = W.fine) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / 5, d = i % 2 ? r * 0.5 : r;
    return `${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}`;
  });
  return `<path d="M${pts.join("L")}Z" fill="${c}" stroke="${ink}" stroke-width="${w}" stroke-linejoin="round"/>`;
};
const cloud = (x, y, s = 1, fill = white) =>
  g(x, y, s, `<path transform="translate(-30 -80)" d="M30 80Q14 50 48 48Q58 18 88 36Q118 30 124 58Q148 74 122 82H46Q32 86 30 80Z" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}"/>`);
const mushroom = (x, y, s = 1, cap = H.pink.dark) =>
  g(x, y, s, `<path d="M-7 0V-14H7V0Q0 4 -7 0Z" fill="${white}" ${o}/><path d="M-20 -14A20 16 0 0 1 20 -14Z" fill="${cap}" ${o}/><circle cx="-8" cy="-22" r="3" fill="#fff"/><circle cx="6" cy="-26" r="2.5" fill="#fff"/><circle cx="12" cy="-19" r="2" fill="#fff"/>`);
const tuft = (x, y, c = H.green.dark) => `<path d="M${x} ${y}q-4-14-10-18M${x} ${y}q0-18 2-24M${x} ${y}q4-14 12-16" ${strokeW(W.outline, c)}/>`;
const bubble = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".6" stroke="${ink}" stroke-width="${W.fine}"/>`;
const halo = (x, y, r, op = 0.35) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${warm}" opacity="${op}"/>`;
const glow = (x, y, r = 4) => halo(x, y, r * 2.6, 0.32) + `<circle cx="${x}" cy="${y}" r="${r}" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.fine}"/>`;
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- Color model: the whole belt is ONE continuous function of u ---------
// u runs L(0..320) F(320..640) R(640..960) B(960..1280) and wraps (B|L seam == u 0).
// Every sky band, hill, lane and light-trail dot is sampled from this function, so each seam
// matches by construction. Time of day: late golden hour (L) -> dusk (F) -> moonrise (R) -> night (B)
// -> a soft rosy glow that melts back into the golden hour.
const P = 1280;
const hexv = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const x = hexv(a), y = hexv(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const smooth = (t) => t * t * (3 - 2 * t);
const stops = [
  { u: 0, top: "#d9b6d6", hor: "#f7c3a0", far: "#d6a1b0", mid: "#b78aa8", lane: "#ecc6c4" },
  { u: 150, top: "#fce2b4", hor: "#f9c88a", far: "#eab27a", mid: "#d9956a", lane: "#f6d9a6" },
  { u: 470, top: "#d9b4d6", hor: "#f7b8a0", far: "#c99bc0", mid: "#a98ab8", lane: "#f4cdbf" },
  { u: 780, top: "#9d9fd9", hor: "#e6b3cf", far: "#a396d0", mid: "#7f79b8", lane: "#d6c4e8" },
  { u: 1100, top: "#7d86c9", hor: "#b79fd6", far: "#7f82c6", mid: "#5f66ab", lane: "#b3b0e0" },
];
const S = (u, key) => {
  u = ((u % P) + P) % P;
  let i = stops.length - 1;
  for (let k = 0; k < stops.length; k++) if (stops[k].u <= u) i = k;
  const a = stops[i], b = stops[(i + 1) % stops.length];
  const ub = b.u <= a.u ? b.u + P : b.u;
  const t = smooth((u - a.u) / (ub - a.u));
  return mix(a[key], b[key], t);
};
const skyAt = (u, y) => mix(S(u, "top"), S(u, "hor"), Math.min(1, y / 250) ** 1.15);
// ground profiles (periodic in P)
const sn = (k, u, ph) => Math.sin((2 * Math.PI * k * u) / P + ph);
const yFar = (u) => 214 + 9 * sn(2, u, 0.6) + 5 * sn(5, u, 1.9);
const yMid = (u) => 256 + 7 * sn(3, u, 2.2) + 4 * sn(6, u, 0.3);
const yLane = (u) => 288 + 4 * sn(4, u, 1.0);
// light trail: a winding row of lantern dots; one hump rises over the bridge on the R face.
const yTrail = (u) => {
  const d = (((u - 770 + P / 2) % P) + P) % P - P / 2;
  return 238 + 16 * sn(2, u, -0.752) - 22 * Math.exp(-((d / 38) ** 2));
};
const TRAIL_STEP = 20;

// ---- Belt painters ---------------------------------------------------------
const colsX = Array.from({ length: 40 }, (_, i) => (i === 0 ? 0 : i === 39 ? 320 : i * 8 + 4));
const runs = (cells, cs = 8) => {
  let out = "", i = 0;
  while (i < cells.length) {
    let j = i;
    while (j + 1 < cells.length && cells[j + 1].c === cells[i].c) j++;
    out += `<rect x="${i * cs}" y="${cells.y}" width="${(j - i + 1) * cs + 1}" height="${cs + 1}" fill="${cells[i].c}"/>`;
    i = j + 1;
  }
  return out;
};
const skyField = (f) => {
  let out = `<rect width="320" height="320" fill="${skyAt(320 * f, 0)}"/>`;
  for (let j = 0; j < 38; j++) {
    const ys = j === 0 ? 0 : j * 8 + 4;
    const cells = colsX.map((x) => ({ c: skyAt(320 * f + x, ys) }));
    cells.y = j * 8;
    out += runs(cells);
  }
  return out;
};
const strips = (f, yfn, key) =>
  colsX.map((xs, i) => {
    const x0 = i * 8, x1 = x0 + 9;
    return `<path d="M${x0} ${yfn(320 * f + x0).toFixed(1)}L${x1} ${yfn(320 * f + x1).toFixed(1)}V320H${x0}Z" fill="${S(320 * f + xs, key)}"/>`;
  }).join("");
const edgeLine = (f, yfn) =>
  `<path d="M${Array.from({ length: 81 }, (_, i) => `${i * 4} ${yfn(320 * f + i * 4).toFixed(1)}`).join("L")}" ${strokeW(W.outline)}/>`;
const belt = (f, between = "") =>
  skyField(f) + between + strips(f, yFar, "far") + strips(f, yMid, "mid") + edgeLine(f, yMid) + strips(f, yLane, "lane") + edgeLine(f, yLane);
const trail = (f) => {
  let out = "";
  for (let k = (320 * f) / TRAIL_STEP; k <= (320 * (f + 1)) / TRAIL_STEP; k++) {
    const u = k * TRAIL_STEP, x = u - 320 * f, kk = ((k % (P / TRAIL_STEP)) + P / TRAIL_STEP) % (P / TRAIL_STEP);
    const r = kk % 4 === 0 ? 4.6 : 3.4;
    const ho = 0.26 + 0.17 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (u - 150)) / P));
    const y = yTrail(u);
    out += halo(x, y, r * 2.7, ho) + `<circle cx="${x}" cy="${y.toFixed(1)}" r="${r}" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.fine}"/>`;
  }
  return out;
};

// ---- Props -----------------------------------------------------------------
const leaf = (x, y, rot, s, c, maple = true) =>
  g(x, y, s, `<g transform="rotate(${rot})">` + (maple
    ? `<path d="M0 -13L3 -7L9 -9L6 -2L12 0L5 4L7 10L0 7L-7 10L-5 4L-12 0L-6 -2L-9 -9L-3 -7Z" fill="${c}" ${o} stroke-linejoin="round"/><path d="M0 7V15" ${strokeW(W.fine)}/>`
    : `<path d="M0 -13Q10 -4 0 12Q-10 -4 0 -13Z" fill="${c}" ${o}/><path d="M0 -8V9" ${strokeW(1.5)}/>`) + `</g>`);
const leafCols = [H.rust.mid, H.amber.mid, H.plum.mid, H.rust.light, H.amber.dark, H.pink.mid];
const sunFace = (x, y, r, c) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10;
    return `<path d="M${(x + Math.cos(a) * (r + 7)).toFixed(1)} ${(y + Math.sin(a) * (r + 7)).toFixed(1)}L${(x + Math.cos(a) * (r + 15)).toFixed(1)} ${(y + Math.sin(a) * (r + 15)).toFixed(1)}" ${strokeW(4, c)}/>`;
  }).join("");
const moonDisc = (x, y, r, face = true) =>
  halo(x, y, r * 1.7, 0.28) + `<circle cx="${x}" cy="${y}" r="${r}" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>` +
  `<circle cx="${x - r * 0.35}" cy="${y + r * 0.35}" r="${r * 0.2}" fill="${H.butter.mid}"/><circle cx="${x + r * 0.45}" cy="${y - r * 0.3}" r="${r * 0.13}" fill="${H.butter.mid}"/>` +
  (face ? `<path d="M${x - r * 0.5} ${y - r * 0.05}q${r * 0.2} ${r * 0.18} ${r * 0.4} 0M${x + r * 0.1} ${y - r * 0.05}q${r * 0.2} ${r * 0.18} ${r * 0.4} 0" ${strokeW(2.5)}/>${cheeks(x - r * 0.02, y + r * 0.22, r * 0.5, H.pink.dark)}${smile(x - r * 0.02, y + r * 0.2, r * 0.14)}` : "");
// Lanterns, all flat paper shapes with an inner glow.
const lanternStar = (x, y, r) =>
  halo(x, y, r * 1.9) + star(x, y, r, H.butter.mid, W.outline) + star(x, y, r * 0.55, "#fffbe6", 0).replace('stroke-width="0"', 'stroke-width="0" opacity=".9"') +
  `<circle cx="${x}" cy="${y + 1}" r="${r * 0.14}" fill="${H.amber.mid}"/><path d="M${x} ${y + r * 0.95}v${r * 0.3}" ${strokeW(W.fine)}/><circle cx="${x}" cy="${y + r * 1.3}" r="${r * 0.1}" fill="${H.rust.mid}" ${o}/>`;
const moonPath = "M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z";
const lanternMoon = (x, y, s) =>
  halo(x - 4, y, 52 * s, 0.3) + g(x, y, s, `<g transform="translate(-215 -85)"><path d="${moonPath}" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline / s}" stroke-linejoin="round"/></g>`);
const lanternFish = (x, y, s = 1) =>
  halo(x, y, 40 * s, 0.32) + g(x, y, s, `<path d="M-18 0L-34 -13Q-30 0 -34 13Z" fill="${H.pink.mid}" ${o3} stroke-linejoin="round"/><path d="M-6 -13Q2 -26 12 -14Z" fill="${H.pink.dark}" ${o} stroke-linejoin="round"/><ellipse rx="26" ry="16" fill="${H.pink.mid}" ${o3}/><ellipse cx="2" rx="19" ry="10" fill="#ffe9ef" opacity=".85"/><path d="M-8 -9Q-3 0 -8 9M0 -10Q5 0 0 10" ${strokeW(1.5, H.pink.dark)}/><circle cx="15" cy="-3" r="3" fill="${ink}"/><path d="M24 4Q20 7 17 5" ${strokeW(1.8)}/><path d="M-4 -16V-26" ${strokeW(W.fine)}/>`);
const lanternPumpkin = (x, y, s = 1) =>
  halo(x, y, 34 * s, 0.32) + g(x, y, s, `<path d="M0 -17Q3 -24 8 -24" ${strokeW(W.fine, H.green.dark)}/><ellipse rx="21" ry="17" fill="#f5ad6a" ${o3}/><ellipse rx="10" ry="16" fill="#f8c08a" ${o}/><path d="M-13 -13Q-18 0 -13 13M13 -13Q18 0 13 13" ${strokeW(1.5, "#d98a4c")}/><path d="M-9 -4L-5 -9L-1 -4ZM1 -4L5 -9L9 -4Z" fill="${H.butter.light}"/><path d="M-8 4Q0 12 8 4Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>`);
const lanternHedge = (x, y, s = 1) =>
  halo(x, y, 32 * s, 0.34) + g(x, y, s, `<path d="M-17 2L-16 -8L-11 -7L-9 -15L-3 -11L0 -18L4 -11L10 -14L11 -7L16 -8L17 2Z" fill="#d09a80" ${o} stroke-linejoin="round"/><ellipse cy="5" rx="14" ry="11" fill="#fff0d4" ${o}/><circle cx="-5" cy="2" r="2" fill="${ink}"/><circle cx="5" cy="2" r="2" fill="${ink}"/><circle cy="7" r="2" fill="${ink}"/><ellipse cx="-9" cy="7" rx="3" ry="2" fill="${H.pink.dark}" opacity=".5"/><ellipse cx="9" cy="7" rx="3" ry="2" fill="${H.pink.dark}" opacity=".5"/>`);
const pole = (x, y0, y1, hookTo) =>
  `<path d="M${x} ${y0}V${y1}" ${strokeW(6, ink)}/><path d="M${x} ${y0}V${y1}" ${strokeW(3, twig)}/>` +
  `<path d="M${x} ${y1}Q${x} ${y1 - 10} ${hookTo} ${y1 - 10}" ${strokeW(6, ink)}/><path d="M${x} ${y1}Q${x} ${y1 - 10} ${hookTo} ${y1 - 10}" ${strokeW(3, twig)}/>`;
const string = (x, y0, y1) => `<path d="M${x} ${y0}V${y1}" ${strokeW(W.fine)}/>`;
const cottage = (x, baseY, s, wall = "#d9cdf0", roof = "#d9959f") =>
  g(x, baseY, s, `<rect x="9" y="-52" width="7" height="16" fill="${H.rust.light}" ${o}/><rect x="-18" y="-26" width="36" height="26" fill="${wall}" ${o}/><path d="M-24 -26L0 -48L24 -26Z" fill="${roof}" ${o} stroke-linejoin="round"/>` +
    `${halo(-8, -15, 14, 0.4)}<rect x="-13" y="-20" width="10" height="11" rx="2" fill="${H.butter.light}" ${o}/><path d="M-8 -20V-9M-13 -14.5H-3" ${strokeW(1.2)}/>${halo(9, -14, 12, 0.35)}<rect x="5" y="-18" width="8" height="18" rx="4" fill="${H.butter.mid}" ${o}/>`);
const goose = (x, y, s = 1, flap = 1) =>
  g(x, y, s, `<path d="M-6 -3Q${-8 * flap} ${-16 * flap} ${-20 * flap} ${-19 * flap}Q-14 -8 2 0Z" fill="${H.plum.light}" ${o} stroke-linejoin="round"/><ellipse rx="13" ry="5.5" fill="${H.plum.light}" ${o}/><path d="M-12 -1L-19 1L-12 3Z" fill="${H.plum.light}" ${o} stroke-linejoin="round"/><path d="M10 -1Q17 -4 18 -9" ${strokeW(5, ink)}/><path d="M10 -1Q17 -4 18 -9" ${strokeW(2, H.plum.light)}/><circle cx="19" cy="-10" r="3.6" fill="${H.plum.light}" ${o}/><path d="M22 -10L27 -8.5L22 -7.5Z" fill="${H.amber.dark}" ${o} stroke-linejoin="round"/><path d="M-2 -1Q${2 * flap} ${-15 * flap} ${-8 * flap} ${-20 * flap}Q8 -9 6 1Z" fill="${H.plum.mid}" ${o} stroke-linejoin="round"/>`);

// ---- Characters -----------------------------------------------------------
// Kid (F): knit-hat child, laughing, raising a star lantern on a stick.
const kid = (() => {
  const boots = `<ellipse cx="86" cy="306" rx="17" ry="9" fill="${H.deep.mid}" ${o3}/><ellipse cx="124" cy="306" rx="17" ry="9" fill="${H.deep.mid}" ${o3}/>`;
  const body = `<ellipse cx="104" cy="260" rx="38" ry="42"/>${arm(64, 254, 14, 10, 20)}${arm(143, 234, 52, 10, 23)}`;
  const hair = `<circle cx="62" cy="176" r="12" fill="#c99a76" ${o3}/><circle cx="146" cy="176" r="12" fill="#c99a76" ${o3}/>`;
  const head = shaded(`<circle cx="104" cy="168" r="44"/>`, H.peach.light, H.peach.mid, "", [104, 168]);
  const hat = `<path d="M60 160A44 44 0 0 1 148 160Z" fill="${H.plum.mid}" ${o3} stroke-linejoin="round"/><path d="M72 150Q82 126 100 120M122 124Q132 132 138 146" ${strokeW(2, H.plum.light)}/><rect x="56" y="150" width="96" height="18" rx="9" fill="${H.plum.light}" ${o3}/><path d="M70 152V166M84 152V166M98 152V166M112 152V166M126 152V166M140 152V166" ${strokeW(1.5, H.plum.mid)}/><circle cx="104" cy="114" r="12" fill="${white}" ${o3}/>`;
  const face = eye(88, 180) + eye(120, 180) + cheeks(104, 192, 30) + laugh(104, 190);
  const scarf = `<ellipse cx="104" cy="216" rx="30" ry="11" fill="${H.butter.mid}" ${o3}/><path d="M118 220Q128 238 120 252" ${strokeW(9, ink)}/><path d="M118 220Q128 238 120 252" ${strokeW(5, H.butter.mid)}/>`;
  const buttons = `<circle cx="104" cy="248" r="3" fill="${white}"/><circle cx="104" cy="264" r="3" fill="${white}"/>`;
  const hand = `<circle cx="172" cy="208" r="9" fill="${H.peach.light}" ${o3}/>`;
  return boots + shaded(body, H.rust.mid, H.rust.dark, shine(86, 242, 12, 7), [104, 260]) + buttons + hair + head + hat + face + scarf + pole(172, 214, 94, 188) + hand + string(188, 84, 100) + lanternStar(188, 130, 31);
})();
// Hedgehog (F): shy and round, carries a pumpkin lantern.
const hedge = (() => {
  const cx = 258, cy = 271;
  const pts = Array.from({ length: 26 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 26, R = i % 2 ? 40 : 52;
    return `${(cx + Math.cos(a) * R * 0.9).toFixed(1)} ${(cy - 2 + Math.sin(a) * R * 0.8).toFixed(1)}`;
  });
  const spines = `<path d="M${pts.join("L")}Z" stroke-linejoin="round"/>`;
  const feet = `<ellipse cx="${cx - 14}" cy="305" rx="13" ry="7" fill="#f2d3b4" ${o3}/><ellipse cx="${cx + 18}" cy="305" rx="13" ry="7" fill="#f2d3b4" ${o3}/>`;
  const faceShape = `<ellipse cx="${cx}" cy="${cy + 8}" rx="31" ry="25"/><ellipse cx="${cx + 22}" cy="${cy - 6}" rx="7" ry="8"/>`;
  return feet + shaded(spines, "#c58a74", "#a46d5c", "", [cx, cy]) + shaded(faceShape, "#fff0d4", "#f2d3b4", "", [cx, cy + 6], 0.92) +

    eye(cx - 14, cy + 2, 4) + eye(cx + 14, cy + 2, 4) + cheeks(cx, cy + 12, 21, H.pink.dark) + `<ellipse cx="${cx}" cy="${cy + 10}" rx="4.4" ry="3.2" fill="${ink}"/>` + smile(cx, cy + 14, 5) +
    pole(222, 292, 196, 234) + string(234, 186, 198) + lanternPumpkin(234, 218, 0.95) +
    merged(arm(230, 288, 35, 8, 14), "#fff0d4") + merged(arm(286, 296, -20, 8, 13), "#fff0d4");
})();
// Fox kid (L): proud, eyes closed, walks right carrying a fish lantern.
const fox = (() => {
  const cx = 212;
  const tail = shaded(`<ellipse cx="172" cy="270" rx="13" ry="30" transform="rotate(-48 172 270)"/>`, H.rust.mid, H.rust.dark, "", [172, 270]) + `<ellipse cx="150" cy="251" rx="9" ry="11" fill="${white}" ${o} transform="rotate(-48 150 251)"/>`;
  const legs = `<ellipse cx="${cx - 12}" cy="304" rx="14" ry="8" fill="#b9806b" ${o3}/><ellipse cx="${cx + 18}" cy="304" rx="14" ry="8" fill="#b9806b" ${o3}/>`;
  const body = `<ellipse cx="${cx}" cy="256" rx="30" ry="40"/>${arm(cx - 34, 258, 14, 9, 19)}${arm(cx + 36, 238, 42, 9, 19)}`;
  const ears = `<path d="M184 172L184 134L208 156Z" fill="${H.rust.mid}" ${o3} stroke-linejoin="round"/><path d="M240 172L240 134L216 156Z" fill="${H.rust.mid}" ${o3} stroke-linejoin="round"/><path d="M189 158L189 144L199 154Z" fill="${H.plum.light}"/><path d="M235 158L235 144L225 154Z" fill="${H.plum.light}"/>`;
  const head = shaded(`<ellipse cx="${cx}" cy="186" rx="40" ry="33"/>`, H.rust.mid, H.rust.dark, "", [cx, 186], 0.92);
  const cheekFur = `<path d="M172 192L164 202L180 206ZM252 192L260 202L244 206Z" fill="${white}" ${o} stroke-linejoin="round"/><path d="M174 200Q${cx} 226 250 200Q240 188 ${cx} 190Q184 188 174 200Z" fill="${white}" ${o}/>`;
  const face = arcEye(198, 184) + arcEye(226, 184) + `<ellipse cx="${cx}" cy="196" rx="5" ry="3.6" fill="${ink}"/>` + smile(cx, 199, 6) + cheeks(cx, 192, 31, H.pink.dark);
  const scarf = `<ellipse cx="${cx}" cy="222" rx="28" ry="10" fill="${H.butter.mid}" ${o3}/><path d="M200 226Q196 246 204 258" ${strokeW(9, ink)}/><path d="M200 226Q196 246 204 258" ${strokeW(5, H.butter.mid)}/>`;
  const paw = `<circle cx="258" cy="216" r="8.5" fill="#b9806b" ${o3}/>`;
  return tail + legs + shaded(body, H.plum.mid, H.plum.dark, shine(196, 244, 10, 6), [cx, 256]) + ears + head + cheekFur + face + scarf + pole(258, 222, 88, 274) + paw + string(274, 78, 94) + lanternFish(274, 112, 0.95);
})();
// Pony (R): sleepy-content, a moon lantern strapped to its saddle blanket.
const pony = (() => {
  const base = "#fde6cf", sh = "#f2c6a2";
  const tail = shaded(`<ellipse cx="170" cy="262" rx="9" ry="26" transform="rotate(24 170 262)"/><ellipse cx="164" cy="280" rx="8" ry="14" transform="rotate(24 164 280)"/>`, H.plum.mid, H.plum.dark, "", [168, 268], 0.88);
  const shapes = `<ellipse cx="210" cy="256" rx="42" ry="25"/><ellipse cx="248" cy="238" rx="16" ry="18"/><circle cx="262" cy="218" r="23"/><ellipse cx="281" cy="228" rx="12" ry="9.5"/><ellipse cx="251" cy="198" rx="5.5" ry="10" transform="rotate(-15 251 198)"/><ellipse cx="273" cy="196" rx="5.5" ry="10" transform="rotate(15 273 196)"/><ellipse cx="190" cy="286" rx="9" ry="19"/><ellipse cx="205" cy="288" rx="9" ry="17"/><ellipse cx="236" cy="286" rx="9" ry="19"/><ellipse cx="251" cy="288" rx="9" ry="17"/>`;
  const hooves = [190, 205, 236, 251].map((x) => `<ellipse cx="${x}" cy="305" rx="9.5" ry="5" fill="${H.plum.dark}" ${o}/>`).join("");
  const mane = merged(`<circle cx="240" cy="212" r="9"/><circle cx="236" cy="228" r="9"/><circle cx="238" cy="244" r="8.5"/><circle cx="258" cy="198" r="8"/>`, H.plum.mid);
  const blanket = `<path d="M178 240Q212 226 246 240L244 262Q238 270 232 262Q226 270 220 262Q214 270 208 262Q202 270 196 262Q190 270 184 262Z" fill="${H.sky.water}" ${o3} stroke-linejoin="round"/><circle cx="198" cy="250" r="3" fill="#fff"/><circle cx="214" cy="246" r="3" fill="#fff"/><circle cx="230" cy="250" r="3" fill="#fff"/>`;
  const face = arcEye(268, 214) + `<ellipse cx="266" cy="229" rx="6.5" ry="4" fill="${H.pink.dark}" opacity=".55"/><circle cx="288" cy="226" r="1.7" fill="${ink}"/><path d="M281 234Q286 237 291 233" ${strokeW(2)}/><path d="M258 202Q264 198 270 201" ${strokeW(2, white)}/>`;
  return tail + hooves + shaded(shapes, base, sh, shine(222, 244, 14, 6), [212, 260]) + mane + blanket + face + pole(204, 240, 100, 218) + string(218, 90, 106) + lanternMoon(218, 132, 0.5);
})();
// Owl (B): wide-eyed, perched on a branch, looks at the small hedgehog lantern.
const owl = (() => {
  const cx = 114, cy = 150;
  const wings = `<ellipse cx="${cx - 33}" cy="${cy + 8}" rx="11" ry="25" transform="rotate(10 ${cx - 33} ${cy + 8})"/><ellipse cx="${cx + 33}" cy="${cy + 8}" rx="11" ry="25" transform="rotate(-10 ${cx + 33} ${cy + 8})"/>`;
  const feet = `<ellipse cx="${cx - 11}" cy="${cy + 42}" rx="9" ry="5" fill="${H.amber.dark}" ${o}/><ellipse cx="${cx + 11}" cy="${cy + 42}" rx="9" ry="5" fill="${H.amber.dark}" ${o}/>`;
  const bodyShapes = `<ellipse cx="${cx}" cy="${cy}" rx="34" ry="42"/><path d="M${cx - 30} ${cy - 30}L${cx - 30} ${cy - 54}L${cx - 10} ${cy - 40}ZM${cx + 30} ${cy - 30}L${cx + 30} ${cy - 54}L${cx + 10} ${cy - 40}Z"/>`;
  const belly = `<ellipse cx="${cx}" cy="${cy + 20}" rx="21" ry="24" fill="#fff1dc"/><path d="M${cx - 12} ${cy + 12}q4 6 8 0M${cx} ${cy + 12}q4 6 8 0M${cx - 6} ${cy + 24}q4 6 8 0M${cx + 6} ${cy + 24}q4 6 8 0M${cx - 14} ${cy + 33}q4 6 8 0M${cx + 2} ${cy + 33}q4 6 8 0" ${strokeW(1.5, H.peach.dark)}/>`;
  const eyes = [cx - 15, cx + 15].map((x, i) => `<circle cx="${x}" cy="${cy - 12}" r="15" fill="${H.rust.light}" ${o}/><circle cx="${x}" cy="${cy - 12}" r="11" fill="#fff" ${o}/><circle cx="${x + 2}" cy="${cy - 13}" r="6.5" fill="${ink}"/><circle cx="${x + 4}" cy="${cy - 15.5}" r="2.3" fill="#fff"/>`).join("");
  const beak = `<path d="M${cx - 5} ${cy - 3}L${cx + 5} ${cy - 3}L${cx} ${cy + 7}Z" fill="${H.amber.dark}" ${o} stroke-linejoin="round"/>`;
  return feet + shaded(wings, H.rust.mid, H.rust.dark, "", [cx, cy]) + shaded(bodyShapes, H.peach.mid, H.peach.dark, shine(cx - 18, cy - 30, 9, 5), [cx, cy]) + belly + eyes + beak + cheeks(cx, cy + 5, 28, H.pink.dark);
})();

// ---- Scenery --------------------------------------------------------------
const treeL = (() => {
  const trunk = `<path d="M54 296Q60 230 60 168L84 168Q84 230 92 296Z"/><path d="M70 200Q96 190 112 164" fill="none" stroke="${ink}" stroke-width="16" stroke-linecap="round"/>`;
  const crown = `<circle cx="68" cy="116" r="32"/><circle cx="38" cy="130" r="24"/><circle cx="100" cy="128" r="26"/><circle cx="70" cy="88" r="26"/><circle cx="104" cy="94" r="20"/><circle cx="40" cy="98" r="20"/>`;
  return merged(trunk, twig) + `<path d="M70 200Q96 190 112 164" fill="none" stroke="${twig}" stroke-width="10" stroke-linecap="round"/><path d="M68 190V270M78 210V280" ${strokeW(1.5, "#6f523d")}/>` +
    shaded(crown, H.amber.mid, H.amber.dark, shine(54, 94, 14, 8), [70, 116]) +
    `<circle cx="52" cy="124" r="11" fill="${H.rust.mid}"/><circle cx="92" cy="110" r="9" fill="${H.rust.mid}"/><circle cx="74" cy="76" r="8" fill="${H.rust.light}"/><circle cx="110" cy="136" r="7" fill="${H.rust.light}"/><circle cx="34" cy="100" r="7" fill="${H.rust.mid}"/>` +
    leaf(56, 168, 25, 0.9, H.rust.mid) + leaf(102, 160, -20, 0.8, H.amber.dark);
})();
const bridgeX0 = 78, bridgeX1 = 182;
const bridgeR = (() => {
  const T = (x) => yTrail(640 + x) + 9;
  const top = Array.from({ length: 27 }, (_, i) => { const x = bridgeX0 + (i * (bridgeX1 - bridgeX0)) / 26; return `${x.toFixed(1)} ${T(x).toFixed(1)}`; });
  const stone = `<path d="M${top.join("L")}V274H${bridgeX0}Z" fill="#ece0f2" ${o3} stroke-linejoin="round"/>`;
  const archOpen = `<path d="M104 274Q104 252 130 252Q156 252 156 274Z" fill="#8f9fd2" ${o}/>`;
  const rail = Array.from({ length: 6 }, (_, i) => { const x = bridgeX0 + 8 + (i * (bridgeX1 - bridgeX0 - 16)) / 5; return `<path d="M${x.toFixed(1)} ${(T(x) + 3).toFixed(1)}v6" ${strokeW(1.5, "#c9b4d8")}/>`; }).join("");
  const pond = `<ellipse cx="130" cy="276" rx="96" ry="13" fill="#b4c6ee" ${o3}/><path d="M60 278q8 -4 16 0M190 276q8 -4 16 0M96 284q8 -4 16 0" ${strokeW(1.5, "#fff")}/>`;
  return pond + stone + archOpen + rail;
})();
const lanePatches = (f, pts) => pts.map(([x, y, r, s, c, m]) => leaf(x, y, r, s, c, m)).join("");

// ---- Faces ------------------------------------------------------------------
const drawings = {};
// L: late-afternoon golden hour. Autumn tree, a low smiling sun, the fox kid with a fish lantern.
drawings.L =
  belt(0, `${halo(128, 194, 54, 0.3)}${sunFace(128, 194, 24, H.amber.mid)}<circle cx="128" cy="194" r="24" fill="${H.amber.light}" ${o3}/>${eye(120, 190, 3.4)}${eye(138, 190, 3.4)}${cheeks(129, 198, 14, H.pink.dark)}${smile(129, 197, 5)}${cloud(206, 52, 0.6, "#fff0d6")}`) +
  trail(0) + treeL + fox +
  lanePatches(0, [[38, 303, 20, 0.8, H.rust.mid, true], [64, 306, -30, 0.7, H.amber.dark, true], [120, 300, 40, 0.8, H.plum.mid, false], [292, 302, 10, 0.8, H.rust.mid, true], [150, 306, -20, 0.6, H.amber.mid, false]]) +
  leaf(150, 66, 30, 1, H.rust.mid) + leaf(196, 110, -25, 0.8, H.amber.dark) + leaf(120, 150, 70, 0.7, H.rust.light, false) + leaf(300, 190, 20, 0.7, H.amber.mid) +
  mushroom(284, 296, 0.9, H.rust.mid) + tuft(18, 312);
// F: dusk hero face. The kid with the star lantern and the hedgehog with a pumpkin lantern.
drawings.F =
  belt(1, `${cloud(52, 58, 0.7, "#f9e4e8")}${cloud(262, 82, 0.45, "#f6dbe6")}${star(270, 40, 6)}${star(34, 100, 4)}${star(238, 40, 3.5)}`) +
  trail(1) + kid + hedge +
  lanePatches(1, [[30, 301, 15, 0.8, H.rust.mid, true], [160, 300, -10, 0.7, H.amber.mid, false], [186, 308, 25, 0.6, H.plum.mid, true], [298, 310, -15, 0.5, H.amber.dark, true]]) +
  leaf(236, 150, -30, 0.8, H.rust.mid) + leaf(28, 150, 30, 0.7, H.amber.mid) + tuft(188, 312, H.plum.dark);
// R: moonrise. The parade crosses the little bridge (the light trail hops over it); the pony follows.
drawings.R =
  belt(2, `${halo(88, 190, 62, 0.28)}<circle cx="88" cy="190" r="34" fill="${H.butter.light}" ${o3}/>${eye(78, 186, 3.4)}${eye(98, 186, 3.4)}${cheeks(88, 196, 15, H.pink.dark)}${smile(88, 195, 5)}${cloud(200, 54, 0.6, "#e6dcf6")}${star(40, 52, 5)}${star(236, 30, 4)}${star(296, 82, 4)}${star(142, 88, 3.5)}`) +
  bridgeR + trail(2) + pony +
  lanePatches(2, [[40, 302, 25, 0.8, H.rust.mid, true], [120, 304, -20, 0.7, H.amber.mid, false], [150, 300, 35, 0.7, H.plum.mid, true], [296, 306, 15, 0.6, H.rust.light, true]]) +
  mushroom(70, 300, 0.9, H.pink.dark) + mushroom(90, 306, 0.6, H.peach.dark) + leaf(40, 140, 40, 0.7, H.amber.dark) + tuft(12, 310, H.plum.dark);
// B: night. Owl on a branch above a small hedgehog lantern, distant cottages with lit windows.
drawings.B =
  belt(3, `${cloud(228, 118, 0.5, "#a9a6dd")}${[[184, 36, 6], [236, 58, 4.5], [276, 28, 5], [300, 92, 4], [150, 72, 3.5], [212, 92, 3.5], [32, 24, 4]].map(([x, y, r]) => star(x, y, r)).join("")}`) +
  merged(`<path d="M32 300Q40 210 40 110L66 110Q66 210 76 300Z"/>`, "#8d6e63") + `<path d="M62 206Q112 202 182 190" ${strokeW(14, ink)}/><path d="M62 206Q112 202 182 190" ${strokeW(10, "#8d6e63")}/>` +
  shaded(`<circle cx="52" cy="62" r="28"/><circle cx="26" cy="86" r="20"/><circle cx="78" cy="82" r="22"/><circle cx="48" cy="96" r="20"/>`, H.rust.mid, H.rust.dark, "", [52, 80]) + `<circle cx="42" cy="64" r="8" fill="${H.rust.light}"/><circle cx="82" cy="86" r="6" fill="${H.rust.light}"/>` +
  trail(3) + [[222, 262, 0.95, "#d9cdf0", "#d9959f"], [262, 266, 1.15, "#e8d9ee", "#c6a0cf"], [300, 258, 0.8, "#d4daf2", "#e0a09a"]].map(([x, y, s, w, r]) => cottage(x, yMid(960 + x) + 7, s, w, r)).join("") +
  owl + string(166, 192, 208) + lanternHedge(166, 226, 1) +
  lanePatches(3, [[40, 304, 25, 0.8, H.rust.mid, true], [100, 302, -20, 0.7, H.plum.mid, false], [196, 304, 35, 0.7, H.amber.mid, true], [260, 306, 10, 0.6, H.rust.light, true]]) +
  leaf(210, 156, -20, 0.6, H.rust.mid) + mushroom(250, 300, 0.8, H.pink.dark) + tuft(300, 310, H.plum.dark);

// ---- Up and Down: conic fields whose borders are the belt's top / bottom rows ----
// Up: perimeter = belt sky colors (bottom = F top, left = L top, right = R top, top = B top).
// Down: perimeter = belt lane colors, so each border pixel continues the neighboring face.
const fieldFace = (kind, center) => {
  const edgeU = kind === "U"
    ? { left: (xh, yh) => yh, right: (xh, yh) => 960 - yh, bottom: (xh) => 320 + xh, top: (xh) => 1280 - xh }
    : { left: (xh, yh) => 320 - yh, right: (xh, yh) => 640 + yh, top: (xh) => 320 + xh, bottom: (xh) => 1280 - xh };
  const key = kind === "U" ? "top" : "lane";
  let out = `<rect width="320" height="320" fill="${center}"/>`;
  const N = 64, cs = 320 / N, hc = 160 - cs / 2;
  for (let j = 0; j < N; j++) {
    const cells = [];
    for (let i = 0; i < N; i++) {
      const cx = i * cs + cs / 2, cy = j * cs + cs / 2, dx = cx - 160, dy = cy - 160, ax = Math.abs(dx), ay = Math.abs(dy);
      let u;
      if (ax >= ay) { const yh = 160 + (dy * 160) / ax; u = (dx > 0 ? edgeU.right : edgeU.left)(0, yh); }
      else { const xh = 160 + (dx * 160) / ay; u = (dy > 0 ? edgeU.bottom : edgeU.top)(xh, 0); }
      const d = Math.max(0, (hc - Math.max(ax, ay)) / hc);
      cells.push({ c: mix(S(u, key), center, smooth(Math.min(1, d / 0.85))) });
    }
    cells.y = j * cs;
    out += runs(cells, cs);
  }
  return out;
};
drawings.U =
  fieldFace("U", "#d9bfe3") +
  `${halo(220, 130, 74, 0.14)}` + g(226, 128, 1.25, `<g transform="translate(-215 -85)"><path d="${moonPath}" fill="${H.butter.light}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="194" cy="92" r="6" fill="${H.butter.mid}"/><circle cx="187" cy="72" r="3.5" fill="${H.butter.mid}"/><circle cx="200" cy="108" r="3" fill="${H.butter.mid}"/><path d="M182 84q5 5 10 0" ${strokeW(2)}/><ellipse cx="190" cy="98" rx="4.5" ry="3" fill="${H.pink.dark}" opacity=".55"/></g>`) + star(268, 134, 7, H.butter.light) + cloud(70, 196, 0.6, "#f1e4f4") + cloud(250, 232, 0.4, "#ead9ee") +
  [[50, 52, 5], [176, 48, 4], [270, 60, 4.5], [30, 120, 3.5], [292, 128, 3.5], [140, 150, 3.5]].map(([x, y, r]) => star(x, y, r)).join("") +
  [[148, 72, 1.1, 1], [116, 52, 1.05, 0.7], [116, 92, 1.05, 1.1], [84, 34, 1, 1], [84, 112, 1, 0.8]].map(([x, y, s, fl]) => goose(x, y, s, fl)).join("") +
  leaf(60, 250, 40, 1.1, H.rust.mid) + leaf(110, 226, -25, 0.9, H.amber.dark) + leaf(36, 178, 70, 0.8, H.rust.light, false) + leaf(150, 270, 10, 0.8, H.plum.mid, false) + leaf(90, 290, -50, 0.7, H.amber.mid) +
  [[258, 270, 5.5], [226, 250, 4.2], [270, 226, 4.6], [236, 206, 3.4], [284, 188, 3.2], [212, 224, 3]].map(([x, y, r]) => glow(x, y, r)).join("");
// Down: leaf-covered lane, a puddle that holds the lantern light, mushrooms, tiny paw prints.
const acorn = (x, y, s = 1) =>
  g(x, y, s, `<ellipse cy="2" rx="9" ry="11" fill="${H.amber.dark}" ${o}/><path d="M-11 -4Q0 -18 11 -4Q0 0 -11 -4Z" fill="${twig}" ${o} stroke-linejoin="round"/><path d="M0 -12V-17" ${strokeW(W.fine)}/>`);
const paw = (x, y, r) =>
  g(x, y, 1, `<g transform="rotate(${r})"><ellipse cy="3" rx="5" ry="4" fill="${H.plum.dark}" opacity=".55"/><circle cx="-5" cy="-3" r="1.9" fill="${H.plum.dark}" opacity=".55"/><circle cx="-1.7" cy="-6" r="1.9" fill="${H.plum.dark}" opacity=".55"/><circle cx="1.7" cy="-6" r="1.9" fill="${H.plum.dark}" opacity=".55"/><circle cx="5" cy="-3" r="1.9" fill="${H.plum.dark}" opacity=".55"/></g>`);
const dLeaves = (() => {
  const r = rng(21), out = [];
  for (let i = 0; i < 20; i++) {
    const x = 22 + r() * 276, y = 22 + r() * 276, rot = r() * 360, s = 0.6 + r() * 0.55, c = leafCols[Math.floor(r() * leafCols.length)], m = r() > 0.35;
    if (((x - 104) / 84) ** 2 + ((y - 228) / 52) ** 2 < 1) continue;
    if (Math.hypot(x - 70, y - 78) < 46 || Math.hypot(x - 250, y - 96) < 40) continue;
    out.push(leaf(x, y, rot, s, c, m));
  }
  return out.join("");
})();
drawings.D =
  fieldFace("D", "#f3cdbb") + dLeaves +
  // BL: puddle with star + moon reflections
  `<ellipse cx="104" cy="228" rx="68" ry="34" fill="#b4c6ee" ${o3}/><ellipse cx="96" cy="234" rx="52" ry="22" fill="#cfd8f5" opacity=".7"/>` +
  `${halo(92, 230, 34, 0.35)}${star(92, 230, 17, H.butter.mid, 2)}${halo(140, 220, 12, 0.35)}<circle cx="140" cy="220" r="4.5" fill="${H.butter.light}" ${o}/>` +
  `<path d="M52 246q10 5 20 0M120 246q10 5 20 0M64 214q8 -4 16 0" ${strokeW(1.5, "#fff")}/>` +
  // TL mushrooms
  mushroom(66, 86, 1.3, H.pink.dark) + mushroom(98, 104, 0.9, H.peach.dark) + mushroom(44, 112, 0.7, H.pink.mid) + tuft(116, 80, H.plum.dark) +
  // TR leaf heap and acorn
  leaf(240, 100, 20, 1.5, H.rust.mid) + leaf(262, 90, -35, 1.3, H.amber.mid) + leaf(250, 116, 70, 1.2, H.rust.light, false) + leaf(228, 82, 100, 1.2, H.plum.mid) + acorn(284, 128, 1.1) +
  // BR paw prints (the hedgehog went this way) and an acorn cap
  [[196, 196, 20], [214, 214, -10], [232, 232, 25], [250, 250, -5], [270, 268, 25]].map(([x, y, r]) => paw(x, y, r)).join("") + acorn(214, 288, 0.9);

// ---- Output ---------------------------------------------------------------
for (const [face, shapes] of Object.entries(drawings)) {
  const svg = (viewBox, width) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${viewBox}">${shapes}</svg>\n`;
  writeFileSync(new URL(`${face}.svg`, dir), svg("0 0 320 320", 320));
}
console.log("written", Object.keys(drawings).join(" "));
