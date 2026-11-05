/** Original "Pastel Garden" vector illustrations and original characters, copyright 2026 Cubistry contributors.
 * Distributed under the repository's AGPL-3.0-or-later license. No fonts, characters,
 * third-party images or trademarked assets; every shape is drawn here.
 * Rebuild: node scripts/build-pastel-garden-art.mjs
 * Characters (Pip, Nimbo, Tulia, Moss, Sunny, Plop) are original inventions, deliberately not
 * modeled on any licensed character. Draft artwork: not wired into the playground and not a physical-feasibility claim.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = new URL("../public/playground-pastel/", import.meta.url);
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
const shaded = (id, shapes, base, shade, hl = "") =>
  `<g stroke="${ink}" stroke-width="${W.body}" stroke-linejoin="round" fill="${ink}">${shapes}</g><clipPath id="${id}">${shapes}</clipPath><g clip-path="url(#${id})"><rect width="320" height="320" fill="${shade}"/><g transform="translate(-8 -8)" fill="${base}">${shapes}</g>${hl}</g>`;
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

// ---- Original characters -------------------------------------------------
// Pip: round peach sprout-sprite with two leaf ears.
const pip = (() => {
  const body = `<ellipse cx="190" cy="222" rx="68" ry="58"/><ellipse cx="156" cy="276" rx="20" ry="12"/><ellipse cx="224" cy="276" rx="20" ry="12"/><ellipse cx="124" cy="214" rx="14" ry="22" transform="rotate(25 124 214)"/>`;
  return `${leafShape(168, 176, -125, 0.55)}${leafShape(212, 176, -55, 0.55)}${shaded("pip", body, H.peach.light, H.peach.mid, shine(160, 190, 16, 9))}${happy(190, 212)}`;
})();
// Nimbo: lilac cloud-puff with a star antenna.
const nimbo = (() => {
  const body = `<circle cx="130" cy="215" r="38"/><circle cx="178" cy="196" r="50"/><circle cx="224" cy="218" r="36"/><ellipse cx="177" cy="236" rx="76" ry="30"/>`;
  return `<path d="M178 150V122" ${stroke}/><path d="M178 100l6 13 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>${shaded("nimbo", body, H.lilac.light, H.lilac.mid, shine(150, 170, 18, 9))}${sleepy(178, 205)}`;
})();
// Tulia: mint round creature wearing a tulip bud.
const tulia = (() => {
  const body = `<circle cx="160" cy="222" r="62"/><ellipse cx="124" cy="282" rx="18" ry="11"/><ellipse cx="196" cy="282" rx="18" ry="11"/>`;
  return `${shaded("tulia", body, H.green.light, H.green.mid, shine(130, 185, 16, 9))}<path d="M138 156C136 132 150 120 160 112C170 120 184 132 182 156Q160 170 138 156Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="${W.outline}"/>${happy(160, 218)}`;
})();
// Moss: butter bean with twig antlers and soft ears.
const moss = (() => {
  const body = `<ellipse cx="172" cy="214" rx="54" ry="76"/><ellipse cx="136" cy="296" rx="18" ry="10"/><ellipse cx="208" cy="296" rx="18" ry="10"/><ellipse cx="124" cy="176" rx="12" ry="22" transform="rotate(-35 124 176)"/><ellipse cx="220" cy="176" rx="12" ry="22" transform="rotate(35 220 176)"/>`;
  return `<path d="M152 140Q146 112 128 98M148 118L168 100M192 140Q198 112 216 98M196 118L176 100" ${strokeW(4, twig)}/>${shaded("moss", body, H.butter.mid, H.butter.dark, shine(150, 170, 14, 9))}${happy(172, 196)}`;
})();
// Sunny: sunshine puff with petal rays.
const sunny = (() => {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10;
    return `<circle cx="${160 + Math.cos(a) * 62}" cy="${170 + Math.sin(a) * 62}" r="15"/>`;
  }).join("");
  return `${shaded("sunny", rays + `<circle cx="160" cy="170" r="52"/>`, H.butter.mid, H.butter.dark, shine(135, 142, 18, 9))}${happy(160, 166)}`;
})();
// Plop: pink pond-sprite peeking out of the water with a lily-pad hat.
const plop = (() => {
  const body = `<circle cx="160" cy="205" r="56"/><ellipse cx="92" cy="226" rx="12" ry="18" transform="rotate(-30 92 226)"/><ellipse cx="228" cy="226" rx="12" ry="18" transform="rotate(30 228 226)"/>`;
  return `${shaded("plop", body, H.pink.mid, H.pink.dark, shine(135, 170, 14, 8))}<ellipse cx="160" cy="152" rx="36" ry="12" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M160 152l14-6" ${strokeW(W.fine)}/>${eye(143, 196)}${eye(177, 196)}${cheeks(160, 206, 27, H.pink.dark)}${smile(160, 204)}<path d="M0 238Q40 220 80 238T160 238T240 238T320 238V320H0Z" fill="${H.sky.water}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M0 280Q50 262 100 280T200 280T320 276V320H0Z" fill="${H.sky.waterDk}"/>`;
})();

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

const drawings = {
  // FRONT: sunny garden. TL bee+flower, TR butterfly+cloud, BL mushroom, BR snail.
  F: `<rect width="320" height="320" fill="${H.butter.bg}"/>${cloud(225, 52, 0.6)}${hill("M0 232Q80 196 170 224T320 210V320H0Z", H.green.light)}${hill("M0 266Q90 236 190 262T320 256V320H0Z", H.green.mid, true)}<path d="M90 150V290" ${stroke}/>${leafShape(90, 285, -140, 1)}${petals(90, 105, 36, 6, H.peach.mid, 15)}<circle cx="90" cy="105" r="14" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${bee(34, 52, 1.1)}${butterfly(268, 112, H.pink.mid, H.peach.mid, 1.1)}${mushroom(36, 300, 1.1)}${tuft(60, 312)}${tuft(300, 308)}${pip}${snail(284, 304, 0.9)}`,
  // BACK: starry night. TL shooting star, TR moon, BL pine+fireflies, BR mushroom house.
  B: `<rect width="320" height="320" fill="${H.sky.light}"/>${star(60, 66, 15)}<path d="M120 40Q96 56 70 92" ${strokeW(W.outline, H.butter.mid)}/>${star(40, 130, 6)}${cloud(78, 124, 0.7, H.lilac.bg)}${star(118, 98, 9)}${star(26, 92, 5)}<path transform="translate(40 -20)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>${star(210, 60, 7)}${star(290, 150, 5)}${hill("M0 232L70 168L130 224L200 152L270 224L320 190V320H0Z", H.sky.mid)}${hill("M0 270Q80 246 160 268T320 256V320H0Z", H.sky.dark, true)}${pine(40, 258, 0.9, H.sky.dark)}${pine(78, 272, 0.6, H.sky.dark)}${glow(30, 188)}${glow(96, 214, 3)}${house(288, 296, 0.75)}${nimbo}`,
  // RIGHT: tulip meadow. TL blue butterfly, TR bluebird, BL bee+tulip row, BR ladybug.
  R: `<rect width="320" height="320" fill="${H.pink.bg}"/>${hill("M0 220Q80 190 170 214T320 200V320H0Z", H.lilac.light)}${hill("M0 266Q90 238 190 262T320 254V320H0Z", H.green.mid, true)}<path d="M40 320V210M285 320V190" ${stroke}/>${leafShape(40, 295, -60, 0.9)}${leafShape(285, 290, -120, 0.9)}<path d="M20 210C18 175 32 160 40 152C50 160 62 175 60 210Q40 224 20 210Z" fill="${H.peach.light}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M265 190C263 155 277 140 285 132C295 140 307 155 305 190Q285 204 265 190Z" fill="${H.pink.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${butterfly(70, 74, H.sky.mid, H.lilac.light, 1.2)}${bird(262, 76, H.sky.mid, 1.1, -1)}${dot(255, 126, 5, H.butter.mid)}${tulip(92, 304, 0.7, H.butter.mid)}${tulip(236, 308, 0.7, H.lilac.mid)}${bee(80, 196, 1)}${tulia}${ladybug(282, 296, 1.1)}`,
  // LEFT: forest edge. TL ladybug leaf, TR bird on branch, BL mushrooms, BR stones+clover.
  L: `<rect width="320" height="320" fill="${H.green.bg}"/>${pine(250, 238, 1.5, H.green.light)}${pine(30, 250, 1.2, H.green.light)}${hill("M0 240Q80 214 170 236T320 224V320H0Z", H.green.light)}<path d="M-10 90Q90 70 200 20" ${stroke}/>${leafShape(30, 82, -75, 0.8)}${leafShape(90, 70, 60, 0.8)}${leafShape(150, 50, -70, 0.8)}${ladybug(44, 56, 1.1)}${bird(214, 22, H.peach.mid, 1.1, -1)}${dot(285, 120, 7, H.butter.mid)}${dot(60, 160, 6, H.pink.mid)}${hill("M0 300Q90 270 190 298T320 290V320H0Z", H.green.mid, true)}${mushroom(30, 296, 1.2)}${mushroom(64, 304, 0.8, H.peach.dark)}${tuft(120, 312)}${moss}${dot(276, 298, 5, H.pink.mid)}${dot(292, 306, 4, H.butter.mid)}<ellipse cx="258" cy="306" rx="12" ry="6" fill="${H.lilac.light}" ${o}/><ellipse cx="300" cy="238" rx="8" ry="5" fill="${H.lilac.light}" ${o}/>`,
  // UP: sky. TL rainbow+cloud, TR bird, BL balloon, BR paper plane+cloud.
  U: `<rect width="320" height="320" fill="${H.sky.bg}"/>${["pink", "butter", "green", "sky"].map((k, i) => `<path d="M${14 + i * 7} 150A${50 - i * 7} ${50 - i * 7} 0 0 1 ${114 - i * 7 - 0} 150" fill="none" stroke="${H[k].mid}" stroke-width="7"/>`).join("")}${cloud(60, 66, 0.9)}${bird(258, 66, H.pink.mid, 1.2, -1)}${cloud(280, 120, 0.5, H.sky.light)}${balloon(52, 232, 0.8)}${plane(250, 262, 1.1)}${cloud(300, 308, 0.7)}${sunny}<path d="M40 292Q120 268 200 296" fill="none" stroke="${white}" stroke-width="10" stroke-linecap="round"/>`,
  // DOWN: pond. TL dragonfly, TR lily pad, BL fish, BR reeds + bubbles.
  D: `<rect width="320" height="320" fill="${H.sky.aqua}"/><path d="M0 60Q80 30 160 60T320 60" fill="none" stroke="${H.sky.water}" stroke-width="8" stroke-linecap="round"/>${dragonfly(58, 74, 1.1)}<ellipse cx="60" cy="128" rx="20" ry="5" fill="none" stroke="${H.sky.water}" stroke-width="3"/><path d="M240 120a36 28 0 1 0 64 -22L272 116Z" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${petals(270, 100, 16, 5, H.pink.mid, 0)}<circle cx="270" cy="100" r="6" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.fine}"/>${plop}${fish(52, 288, 1.1)}${reeds(292, 296, 1)}${dot(240, 262, 5, "#fff")}${dot(256, 248, 3.5, "#fff")}`,
};

const images = [];
for (const [face, shapes] of Object.entries(drawings)) {
  const svg = (viewBox, width) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${viewBox}">${shapes}</svg>\n`;
  writeFileSync(new URL(`${face}.svg`, dir), svg("0 0 320 320", 320));
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++) {
      const id = `${face}_${row}_${col}`;
      const source = svg(`${col * 160} ${row * 160} 160 160`, 160);
      writeFileSync(new URL(`${id}.svg`, dir), source);
      images.push({ id, sha256: createHash("sha256").update(source).digest("hex") });
    }
}
writeFileSync(new URL("manifest.json", dir), JSON.stringify({ design: "pastel-garden-friends", images }, null, 2) + "\n");

// Unfolded-cross preview (assembly reference only).
const pos = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
const net = Object.entries(pos)
  .map(([f, [c, r]]) => `<svg x="${c * 330 + 10}" y="${r * 330 + 10}" width="320" height="320" viewBox="0 0 320 320" overflow="hidden">${drawings[f]}<rect width="320" height="320" fill="none" stroke="${ink}" stroke-width="2"/></svg>`)
  .join("");
writeFileSync(new URL("net.svg", dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1330 1000" width="1330" height="1000"><rect width="1330" height="1000" fill="#f5f3eb"/>${net}</svg>\n`);
