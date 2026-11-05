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

const drawings = {
  F: `<rect width="320" height="320" fill="${H.butter.bg}"/><path d="M90 150V320" ${stroke}/>${leafShape(90, 295, -140, 1)}${petals(90, 105, 36, 6, H.peach.mid, 15)}<circle cx="90" cy="105" r="14" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${dot(40, 40, 7, H.pink.mid)}${dot(270, 60, 9, H.butter.mid)}${pip}`,
  B: `<rect width="320" height="320" fill="${H.sky.light}"/><path transform="translate(40 -20)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M70 60l6 14 15 2-11 10 4 15-14-8-14 8 4-15-11-10 15-2Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>${dot(40, 150, 5, H.butter.light)}${dot(280, 190, 5, H.butter.light)}<path d="M0 285Q80 255 160 282T320 272V320H0Z" fill="${H.sky.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${nimbo}`,
  R: `<rect width="320" height="320" fill="${H.pink.bg}"/><path d="M40 320V210M285 320V190" ${stroke}/>${leafShape(40, 295, -60, 0.9)}${leafShape(285, 290, -120, 0.9)}<path d="M20 210C18 175 32 160 40 152C50 160 62 175 60 210Q40 224 20 210Z" fill="${H.peach.light}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M265 190C263 155 277 140 285 132C295 140 307 155 305 190Q285 204 265 190Z" fill="${H.pink.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${dot(60, 70, 7, "#fff")}${dot(255, 70, 5, H.butter.mid)}${tulia}`,
  L: `<rect width="320" height="320" fill="${H.green.bg}"/><path d="M-10 90Q90 70 200 20" ${stroke}/>${leafShape(30, 82, -75, 0.8)}${leafShape(90, 70, 60, 0.8)}${leafShape(150, 50, -70, 0.8)}${dot(40, 190, 8, H.peach.mid)}${dot(285, 120, 7, H.butter.mid)}${dot(270, 220, 6, H.pink.mid)}<path d="M0 300Q90 270 190 298T320 290V320H0Z" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${moss}`,
  U: `<rect width="320" height="320" fill="${H.sky.bg}"/><path d="M30 80Q14 50 48 48Q58 18 88 36Q118 30 124 58Q148 74 122 82H46Q32 86 30 80Z" fill="${white}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M200 300Q190 270 220 266Q232 238 258 258Q288 254 290 280Q312 290 292 300Z" fill="${white}" stroke="${ink}" stroke-width="${W.outline}"/>${sunny}<path d="M40 290Q140 255 230 292" fill="none" stroke="${white}" stroke-width="10" stroke-linecap="round"/>`,
  D: `<rect width="320" height="320" fill="${H.sky.aqua}"/><path d="M0 60Q80 30 160 60T320 60" fill="none" stroke="${H.sky.water}" stroke-width="8" stroke-linecap="round"/>${dot(50, 120, 5, "#fff")}${dot(270, 100, 6, "#fff")}<path d="M240 120a36 28 0 1 0 64 -22L272 116Z" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${petals(270, 100, 16, 5, H.pink.mid, 0)}<circle cx="270" cy="100" r="6" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.fine}"/>${plop}`,
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
