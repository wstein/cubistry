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

const ink = "#4a3a38"; // soft brown line work
const leaf = "#9cc08a";
const leafDk = "#6f9f6b";
const strokeW = (w = 3, c = ink) =>
  `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const stroke = strokeW();
const petals = (cx, cy, r, n, fill, rot = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (360 / n) * i;
    return `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.45}" ry="${r * 0.8}" fill="${fill}" stroke="${ink}" stroke-width="3" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join("");
const leafShape = (x, y, rot, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C14-30 46-30 62 0C46 30 14 30 0 0Z" fill="${leaf}" stroke="${ink}" stroke-width="3"/><path d="M4 0H54" ${strokeW(2)}/></g>`;


// ---- Original characters -------------------------------------------------
// merged(): outline all shapes, then fill them, so overlapping parts read as one body.
const merged = (shapes, fill) =>
  `<g stroke="${ink}" stroke-width="6" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${fill}">${shapes}</g>`;
const eye = (x, y, r = 4.5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${x + 1.5}" cy="${y - 1.5}" r="${r * 0.3}" fill="#fff"/>`;
const sleepyEye = (x, y) => `<path d="M${x - 7} ${y}Q${x} ${y + 7} ${x + 7} ${y}" ${strokeW(2.5)}/>`;
const smile = (x, y, w = 8) => `<path d="M${x - w} ${y}Q${x} ${y + w} ${x + w} ${y}" ${strokeW(2.5)}/>`;
const cheeks = (x, y, gap, c = "#f4a0b4") =>
  `<ellipse cx="${x - gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".7"/><ellipse cx="${x + gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".7"/>`;
const happy = (x, y) => eye(x - 17, y) + eye(x + 17, y) + cheeks(x, y + 10, 27) + smile(x, y + 8);
const sleepy = (x, y) => sleepyEye(x - 17, y) + sleepyEye(x + 17, y) + cheeks(x, y + 10, 27, "#e79ab4") + smile(x, y + 10, 6);
const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ink}" stroke-width="3"/>`;

// Pip: round peach sprout-sprite with two leaf ears.
const pip = (() => {
  const body = `<ellipse cx="190" cy="222" rx="68" ry="58"/><ellipse cx="156" cy="276" rx="20" ry="12"/><ellipse cx="224" cy="276" rx="20" ry="12"/><ellipse cx="124" cy="214" rx="14" ry="22" transform="rotate(25 124 214)"/>`;
  return `${leafShape(168, 176, -125, 0.55)}${leafShape(212, 176, -55, 0.55)}${merged(body, "#f8c9a6")}${happy(190, 212)}`;
})();
// Nimbo: lavender cloud-puff with a star antenna.
const nimbo = (() => {
  const body = `<circle cx="130" cy="215" r="38"/><circle cx="178" cy="196" r="50"/><circle cx="224" cy="218" r="36"/><ellipse cx="177" cy="236" rx="76" ry="30"/>`;
  return `<path d="M178 150V122" ${stroke}/><path d="M178 100l6 13 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2Z" fill="#fff4c2" stroke="${ink}" stroke-width="3"/>${merged(body, "#d8ccf2")}${sleepy(178, 205)}`;
})();
// Tulia: mint round creature wearing a tulip bud.
const tulia = (() => {
  const body = `<circle cx="160" cy="222" r="62"/><ellipse cx="124" cy="282" rx="18" ry="11"/><ellipse cx="196" cy="282" rx="18" ry="11"/>`;
  return `${merged(body, "#bfe6d4")}<path d="M138 156C136 132 150 120 160 112C170 120 184 132 182 156Q160 170 138 156Z" fill="#f2877e" stroke="${ink}" stroke-width="3"/>${happy(160, 218)}`;
})();
// Moss: butter-yellow bean with twig antlers and soft ears.
const moss = (() => {
  const body = `<ellipse cx="172" cy="214" rx="54" ry="76"/><ellipse cx="136" cy="296" rx="18" ry="10"/><ellipse cx="208" cy="296" rx="18" ry="10"/><ellipse cx="124" cy="176" rx="12" ry="22" transform="rotate(-35 124 176)"/><ellipse cx="220" cy="176" rx="12" ry="22" transform="rotate(35 220 176)"/>`;
  return `<path d="M152 140Q146 112 128 98M148 118L168 100M192 140Q198 112 216 98M196 118L176 100" ${strokeW(4, "#8a6a4f")}/>${merged(body, "#f7e3a3")}${happy(172, 196)}`;
})();
// Sunny: sunshine-yellow puff with petal rays.
const sunny = (() => {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10;
    return `<circle cx="${160 + Math.cos(a) * 62}" cy="${170 + Math.sin(a) * 62}" r="15"/>`;
  }).join("");
  return `${merged(rays + `<circle cx="160" cy="170" r="52"/>`, "#fbe08a")}${happy(160, 166)}`;
})();
// Plop: coral pond-sprite peeking out of the water with a lily-pad hat.
const plop = (() => {
  const body = `<circle cx="160" cy="205" r="56"/><ellipse cx="92" cy="226" rx="12" ry="18" transform="rotate(-30 92 226)"/><ellipse cx="228" cy="226" rx="12" ry="18" transform="rotate(30 228 226)"/>`;
  return `${merged(body, "#f6a6b8")}<ellipse cx="160" cy="152" rx="36" ry="12" fill="${leaf}" stroke="${ink}" stroke-width="3"/><path d="M160 152l14-6" ${strokeW(2)}/>${eye(143, 196)}${eye(177, 196)}${cheeks(160, 206, 27, "#e8788f")}${smile(160, 204)}<path d="M0 238Q40 220 80 238T160 238T240 238T320 238V320H0Z" fill="#a9dcdf" stroke="${ink}" stroke-width="3"/><path d="M0 280Q50 262 100 280T200 280T320 276V320H0Z" fill="#8ccdd3"/>`;
})();

const drawings = {
  F: `<rect width="320" height="320" fill="#fdf1cf"/><path d="M90 150V320" ${stroke}/>${leafShape(90, 295, -140, 1)}${petals(90, 105, 36, 6, "#f6b98c", 15)}<circle cx="90" cy="105" r="14" fill="#f6d36e" stroke="${ink}" stroke-width="3"/>${dot(40, 40, 7, "#f4a9bd")}${dot(270, 60, 9, "#f6d36e")}${pip}`,
  B: `<rect width="320" height="320" fill="#c9dcf2"/><path transform="translate(40 -20)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z" fill="#fff4c2" stroke="${ink}" stroke-width="3"/><path d="M70 60l6 14 15 2-11 10 4 15-14-8-14 8 4-15-11-10 15-2Z" fill="#fff4c2" stroke="${ink}" stroke-width="3"/>${dot(40, 150, 5, "#fff4c2")}${dot(280, 190, 5, "#fff4c2")}<path d="M0 285Q80 255 160 282T320 272V320H0Z" fill="#a9c1e6" stroke="${ink}" stroke-width="3"/>${nimbo}`,
  R: `<rect width="320" height="320" fill="#fbdde4"/><path d="M40 320V210M285 320V190" ${stroke}/>${leafShape(40, 295, -60, 0.9)}${leafShape(285, 290, -120, 0.9)}<path d="M20 210C18 175 32 160 40 152C50 160 62 175 60 210Q40 224 20 210Z" fill="#f7c2a6" stroke="${ink}" stroke-width="3"/><path d="M265 190C263 155 277 140 285 132C295 140 307 155 305 190Q285 204 265 190Z" fill="#f4a9bd" stroke="${ink}" stroke-width="3"/>${dot(60, 70, 7, "#fff")}${dot(255, 70, 5, "#f6d36e")}${tulia}`,
  L: `<rect width="320" height="320" fill="#e2efd9"/><path d="M-10 90Q90 70 200 20" ${stroke}/>${leafShape(30, 82, -75, 0.8)}${leafShape(90, 70, 60, 0.8)}${leafShape(150, 50, -70, 0.8)}${dot(40, 190, 8, "#f6b98c")}${dot(285, 120, 7, "#f6d36e")}${dot(270, 220, 6, "#f4a9bd")}<path d="M0 300Q90 270 190 298T320 290V320H0Z" fill="#a8ce8d" stroke="${ink}" stroke-width="3"/>${moss}`,
  U: `<rect width="320" height="320" fill="#d6ecf5"/><path d="M30 80Q14 50 48 48Q58 18 88 36Q118 30 124 58Q148 74 122 82H46Q32 86 30 80Z" fill="#fffaf1" stroke="${ink}" stroke-width="3"/><path d="M200 300Q190 270 220 266Q232 238 258 258Q288 254 290 280Q312 290 292 300Z" fill="#fffaf1" stroke="${ink}" stroke-width="3"/>${sunny}<path d="M40 290Q140 255 230 292" fill="none" stroke="#fffaf1" stroke-width="10" stroke-linecap="round"/>`,
  D: `<rect width="320" height="320" fill="#cfeaee"/><path d="M0 60Q80 30 160 60T320 60" fill="none" stroke="#9fd2d8" stroke-width="8" stroke-linecap="round"/>${dot(50, 120, 5, "#fff")}${dot(270, 100, 6, "#fff")}<path d="M240 120a36 28 0 1 0 64 -22L272 116Z" fill="${leaf}" stroke="${ink}" stroke-width="3"/>${petals(270, 100, 16, 5, "#f4a9bd", 0)}<circle cx="270" cy="100" r="6" fill="#f6d36e" stroke="${ink}" stroke-width="2"/>${plop}`,
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
