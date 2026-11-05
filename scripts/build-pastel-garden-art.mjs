/** Original "Pastel Garden" vector illustrations, copyright 2026 Cubistry contributors.
 * Distributed under the repository's AGPL-3.0-or-later license. No fonts, characters,
 * third-party images or trademarked assets; every shape is drawn here.
 * Rebuild: node scripts/build-pastel-garden-art.mjs
 * Draft artwork: not wired into the playground and not a physical-feasibility claim.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = new URL("../public/playground-pastel/", import.meta.url);
mkdirSync(dir, { recursive: true });

const ink = "#4a3a38"; // soft brown line work
const leaf = "#9cc08a";
const leafDk = "#6f9f6b";
const strokeW = (w = 3) =>
  `fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const stroke = strokeW();
const petals = (cx, cy, r, n, fill, rot = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (360 / n) * i;
    return `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.45}" ry="${r * 0.8}" fill="${fill}" stroke="${ink}" stroke-width="3" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join("");
const leafShape = (x, y, rot, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C14-30 46-30 62 0C46 30 14 30 0 0Z" fill="${leaf}" stroke="${ink}" stroke-width="3"/><path d="M4 0H54" ${strokeW(2)}/></g>`;

const drawings = {
  // Front: big peach blossom on cream
  F: `<rect width="320" height="320" fill="#fdf1cf"/>${leafShape(40, 290, -50, 1.3)}${leafShape(280, 290, -130, 1.3)}<path d="M160 190V320" ${stroke}/>${petals(160, 135, 52, 6, "#f6b98c", 15)}<circle cx="160" cy="135" r="20" fill="#f6d36e" stroke="${ink}" stroke-width="3"/><circle cx="60" cy="60" r="7" fill="#f6b98c"/><circle cx="268" cy="48" r="9" fill="#f4a9bd"/>`,
  // Back: dusk-blue with crescent and stars
  B: `<rect width="320" height="320" fill="#c9dcf2"/><path d="M215 55a58 58 0 1 0 55 80a46 46 0 1 1-55-80Z" fill="#fff4c2" stroke="${ink}" stroke-width="3"/><path d="M90 70l7 16 17 2-13 11 4 17-15-9-15 9 4-17-13-11 17-2Z" fill="#fff4c2" stroke="${ink}" stroke-width="3"/><path d="M0 255Q80 215 160 250T320 240V320H0Z" fill="#a9c1e6" stroke="${ink}" stroke-width="3"/><path d="M0 295Q90 265 170 292T320 285V320H0Z" fill="#8fb0dd"/>`,
  // Right: pink tulips
  R: `<rect width="320" height="320" fill="#fbdde4"/><path d="M95 320V170M225 320V130" ${stroke}/>${leafShape(95, 290, -60, 1.1)}${leafShape(225, 280, -120, 1.1)}<path d="M62 170C60 120 80 100 95 90C110 100 130 120 128 170Q95 190 62 170Z" fill="#f4a9bd" stroke="${ink}" stroke-width="3"/><path d="M192 130C190 78 210 56 225 46C240 56 260 78 258 130Q225 150 192 130Z" fill="#f7c2a6" stroke="${ink}" stroke-width="3"/><path d="M80 110C90 130 100 130 110 110M210 70C220 92 232 92 240 70" ${strokeW(2)}/>`,
  // Left: sage leafy branches
  L: `<rect width="320" height="320" fill="#e2efd9"/><path d="M-10 300Q120 240 330 110" ${stroke}/>${leafShape(40, 275, -70, 1)}${leafShape(95, 252, 60, 1)}${leafShape(140, 224, -75, 1.1)}${leafShape(195, 188, 55, 1.1)}${leafShape(245, 150, -80, 1.2)}<circle cx="270" cy="230" r="10" fill="#f6b98c" stroke="${ink}" stroke-width="3"/><circle cx="60" cy="90" r="8" fill="#f6d36e" stroke="${ink}" stroke-width="3"/><circle cx="110" cy="60" r="6" fill="#f4a9bd"/>`,
  // Up: pale sky, sun and clouds
  U: `<rect width="320" height="320" fill="#d6ecf5"/><circle cx="235" cy="85" r="40" fill="#fbe08a" stroke="${ink}" stroke-width="3"/><path d="M40 190Q20 150 62 148Q72 108 108 132Q146 126 152 162Q182 182 150 196H62Q42 198 40 190Z" fill="#fffaf1" stroke="${ink}" stroke-width="3"/><path d="M180 270Q172 246 198 244Q210 220 232 238Q258 236 260 258Q282 266 262 278H196Q182 280 180 270Z" fill="#fffaf1" stroke="${ink}" stroke-width="3"/>`,
  // Down: peach pond with lily pads and one blossom
  D: `<rect width="320" height="320" fill="#fbe0c8"/><path d="M0 70Q80 40 160 70T320 70M0 150Q80 120 160 150T320 150" fill="none" stroke="#f1c19c" stroke-width="8" stroke-linecap="round"/><path d="M80 250a50 38 0 1 0 90 -30L125 242Z" fill="${leaf}" stroke="${ink}" stroke-width="3"/><path d="M215 120a42 32 0 1 0 76 -26L253 114Z" fill="${leafDk}" stroke="${ink}" stroke-width="3"/>${petals(238, 255, 30, 5, "#f4a9bd", 0)}<circle cx="238" cy="255" r="11" fill="#f6d36e" stroke="${ink}" stroke-width="3"/>`,
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
writeFileSync(new URL("manifest.json", dir), JSON.stringify({ design: "pastel-garden", images }, null, 2) + "\n");

// Unfolded-cross preview (assembly reference only).
const pos = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
const net = Object.entries(pos)
  .map(([f, [c, r]]) => `<svg x="${c * 330 + 10}" y="${r * 330 + 10}" width="320" height="320" viewBox="0 0 320 320" overflow="hidden">${drawings[f]}<rect width="320" height="320" fill="none" stroke="${ink}" stroke-width="2"/></svg>`)
  .join("");
writeFileSync(new URL("net.svg", dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1330 1000" width="1330" height="1000"><rect width="1330" height="1000" fill="#f5f3eb"/>${net}</svg>\n`);
