// Generate the assembly net SVG of the 1/10-second cube print preset (ms-timer-tenth-20mm-3sets).
//   node scripts/export-tenth-print.mjs
// Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under
// CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution:
// Werner Stein, Cubistry.
// SPDX-License-Identifier: CC-BY-SA-4.0
// This generator is the editable source of the net artwork: art data, not AGPL
// program code.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));

const PRESET_DIR = "public/print/ms-timer-tenth-20mm-3sets/";
const SOURCE_PATH = "public/ms-timer-tenth.v1.json";

const same = (a, b) => a.every((v, i) => v === b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const neg = (v) => v.map((x) => -x + 0);

// Face definitions matching standard cubistry cross net & print order
const FACES = [
  { name: "U", n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1], col: 1, row: 0 },
  { name: "L", n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0], col: 0, row: 1 },
  { name: "F", n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], col: 1, row: 1 },
  { name: "R", n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0], col: 2, row: 1 },
  { name: "B", n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0], col: 3, row: 1 },
  { name: "D", n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1], col: 1, row: 2 },
];

/** Builds the assembly net. `source` is the tenth print JSON; omitted reads the shipped file. */
export function buildTenthPrint(source = JSON.parse(readFileSync(path(SOURCE_PATH), "utf8"))) {

  // Load digit glyphs
  const digitGlyphs = {};
  for (let d = 0; d <= 9; d++) {
    const raw = readFileSync(path(`public/assets/digits/${d}.svg`), "utf8");
    const m = raw.match(/<g fill="#1d4771">([\s\S]*?)<\/g>/);
    if (!m) throw new Error(`Could not parse glyph for digit ${d}`);
    digitGlyphs[String(d)] = m[0];
  }

  // Load T (1/10) glyph
  const tRaw = readFileSync(path("public/assets/hsm/words/T.svg"), "utf8");
  const tMatch = tRaw.match(/<path fill="#1d4771" d="[\s\S]*?"\/>/);
  if (!tMatch) throw new Error("Could not parse glyph for T.svg");
  digitGlyphs["T"] = tMatch[0];

  // Assembly net
  const NET_CELL = 256;
  const NET_GAP = 8;
  const NET_FACE = 2 * NET_CELL + NET_GAP;
  const NET_MARGIN = 48;
  const netCells = [];
  for (const f of FACES) {
    const faceStickers = source.printing.filter((s) => same(s.n, f.n));
    if (faceStickers.length !== 4)
      throw new Error(`Face ${f.name} needs 4 stickers, found ${faceStickers.length}`);
    for (const s of faceStickers) {
      const col = dot(s.p, f.r) > 0 ? 1 : 0;
      const row = dot(s.p, f.u) > 0 ? 0 : 1;
      const x = NET_MARGIN + f.col * (NET_FACE + NET_GAP * 3) + col * (NET_CELL + NET_GAP);
      const y = NET_MARGIN + f.row * (NET_FACE + NET_GAP * 3) + row * (NET_CELL + NET_GAP);
      const rot = same(s.up, f.u)
        ? 0
        : same(s.up, f.r)
          ? 90
          : same(s.up, neg(f.u))
            ? 180
            : same(s.up, neg(f.r))
              ? 270
              : null;
      if (rot === null) throw new Error(`Sticker ${s.id}: up not in face plane`);
      const glyph = s.image ? digitGlyphs[s.image] : "";
      const art = s.image
        ? `<g transform="rotate(${rot} 128 128)">${glyph}</g>`
        : "";
      netCells.push(
        `<g id="sticker-${s.id}" data-face="${f.name}" data-image="${s.image || "blank"}" transform="translate(${x} ${y})"><rect width="256" height="256" fill="#fffdf6" stroke="#9aa39b" stroke-width="2"/>${art}</g>`,
      );
    }
  }
  const netWidth = 2 * NET_MARGIN + 4 * NET_FACE + 9 * NET_GAP;
  const netHeight = 2 * NET_MARGIN + 3 * NET_FACE + 6 * NET_GAP;
  const netLabels = FACES.map(
    (f) =>
      `<text x="${NET_MARGIN + f.col * (NET_FACE + NET_GAP * 3) + NET_FACE / 2}" y="${NET_MARGIN + f.row * (NET_FACE + NET_GAP * 3) - 12}" text-anchor="middle">${f.name}</text>`,
  ).join("");
  const netSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${netWidth}" height="${netHeight}" viewBox="0 0 ${netWidth} ${netHeight}">` +
    `<title>1/10-Second Counter print, printed state (shows 0.0), outside view of each face</title>` +
    `<desc>Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry. SPDX-License-Identifier: CC-BY-SA-4.0</desc>` +
    `<rect width="${netWidth}" height="${netHeight}" fill="#ffffff"/>` +
    `<g font-family="sans-serif" font-size="28" fill="#5b6560">${netLabels}</g>` +
    netCells.join("") +
    `</svg>\n`;

  return { netSvg };
}

// Only the assembly net is written here. print.pdf, artwork, cuts, manifest, bundle and the
// catalog entry come from scripts/print-sticker-sheets.py (--design ms-timer-tenth), because
// the independent verifier must see PDFs that were rendered from the same artwork.
export function writeTenthPrintPreset() {
  const built = buildTenthPrint();
  writeFileSync(path(PRESET_DIR) + "net.svg", built.netSvg);
  console.log("Successfully wrote tenth assembly net");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeTenthPrintPreset();
}
