// Export the blank-top Counter print as an SVG sticker net (assembly
// reference). It embeds the app's own digit images (public/assets/digits,
// hash-checked by counter-design.v2.json) and rotates each glyph by its
// stored print-up vector; blank stickers carry only the background.
//   node scripts/export-counter-blank-top-net.mjs          # rewrite the net
//   node scripts/export-counter-blank-top-net.mjs --check  # fail when stale
// This is not production cut artwork: no bleed, kiss-cut channel or scaling.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
const OUTPUT = "public/print/counter-blank-top/net.svg";
const CELL = 256,
  GAP = 8,
  FACE = 2 * CELL + GAP,
  MARGIN = 48;
// Outside views: right and up screen directions of each face, and its slot
// in a cross net with Up above Front.
const FACES = [
  { name: "U", n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1], col: 1, row: 0 },
  { name: "L", n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0], col: 0, row: 1 },
  { name: "F", n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], col: 1, row: 1 },
  { name: "R", n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0], col: 2, row: 1 },
  { name: "B", n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0], col: 3, row: 1 },
  { name: "D", n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1], col: 1, row: 2 },
];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const same = (a, b) => a.every((v, i) => v === b[i]);
const neg = (v) => v.map((x) => -x);

export function exportNet() {
  const runtime = JSON.parse(readFileSync(path("public/counter-blank-top.v1.json"), "utf8"));
  const design = JSON.parse(readFileSync(path("public/counter-design.v2.json"), "utf8"));
  const glyph = {};
  for (const image of design.assets.images.filter((i) => /^[0-9]$/.test(i.id))) {
    const bytes = readFileSync(path("public" + image.url));
    if (createHash("sha256").update(bytes).digest("hex") !== image.sha256)
      throw Error(`Digit image ${image.id} does not match its design hash`);
    glyph[image.id] = bytes.toString("utf8").match(/<g [^>]*>.*<\/g>/)[0];
  }
  const cells = [];
  for (const face of FACES) {
    const stickers = runtime.printing.filter((s) => same(s.n, face.n));
    if (stickers.length !== 4) throw Error(`Face ${face.name} needs four stickers`);
    for (const s of stickers) {
      const col = dot(s.p, face.r) > 0 ? 1 : 0,
        row = dot(s.p, face.u) > 0 ? 0 : 1;
      const x = MARGIN + face.col * (FACE + GAP * 3) + col * (CELL + GAP),
        y = MARGIN + face.row * (FACE + GAP * 3) + row * (CELL + GAP);
      const turn = same(s.up, face.u)
        ? 0
        : same(s.up, face.r)
          ? 90
          : same(s.up, neg(face.u))
            ? 180
            : same(s.up, neg(face.r))
              ? 270
              : null;
      if (turn === null) throw Error(`Sticker ${s.id} up vector is not in its face`);
      const art =
        s.image === "blank"
          ? ""
          : `<g transform="rotate(${turn} 128 128)">${glyph[s.image]}</g>`;
      cells.push(
        `<g id="sticker-${s.id}" data-face="${face.name}" data-image="${s.image}" transform="translate(${x} ${y})"><rect width="256" height="256" fill="#fffdf6" stroke="#9aa39b" stroke-width="2"/>${art}</g>`,
      );
    }
  }
  const width = 2 * MARGIN + 4 * FACE + 9 * GAP,
    height = 2 * MARGIN + 3 * FACE + 6 * GAP;
  const labels = FACES.map(
    (f) =>
      `<text x="${MARGIN + f.col * (FACE + GAP * 3) + FACE / 2}" y="${MARGIN + f.row * (FACE + GAP * 3) - 12}" text-anchor="middle">${f.name}</text>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<title>Blank-top Counter print, printed state (shows 00), outside view of each face</title>` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    `<g font-family="sans-serif" font-size="28" fill="#5b6560">${labels}</g>` +
    cells.join("") +
    `</svg>\n`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const svg = exportNet();
  if (process.argv.includes("--check")) {
    if (readFileSync(path(OUTPUT), "utf8") !== svg)
      throw Error("Blank-top sticker net is stale; run without --check");
    console.log("Blank-top sticker net is current");
  } else {
    mkdirSync(path("public/print/counter-blank-top"), { recursive: true });
    writeFileSync(path(OUTPUT), svg);
    console.log("Wrote", OUTPUT);
  }
}
