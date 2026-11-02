// Generate the 1/10-second cube print preset (ms-timer-tenth-20mm-3sets)
// and assembly net SVG.
//   node scripts/export-tenth-print.mjs          # generate and update catalog
//   node scripts/export-tenth-print.mjs --check  # verify everything is current
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));

const PRESET_DIR = "public/print/ms-timer-tenth-20mm-3sets/";
const SOURCE_PATH = "public/ms-timer-tenth.v1.json";
const COPIES = 3;
const SIZE_MM = 20;
const BLEED_MM = 2;
const GAP_MM = 4;
const CORNER_RADIUS_MM = 1;
const SAFE_MM = 1;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const COLS_PER_ROW = 8;
const ROWS_PER_PAGE = 9; // 3 sets * 3 rows
const X_START_MM = 10;
const Y_START_MM = 18;
const STEP_X_MM = SIZE_MM + GAP_MM; // 24
const STEP_Y_MM = SIZE_MM + GAP_MM; // 24

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
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

export function buildTenthPrint() {
  const sourceRaw = readFileSync(path(SOURCE_PATH));
  const source = JSON.parse(sourceRaw.toString("utf8"));
  const sourceSha = sha256(sourceRaw);

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

  const DIGIT_INK_BOUNDS = {
    "0": [56, 40, 200, 236],
    "1": [112, 48, 200, 236],
    "2": [56, 40, 200, 236],
    "3": [64, 40, 200, 236],
    "4": [56, 48, 200, 236],
    "5": [56, 40, 200, 236],
    "6": [56, 40, 200, 236],
    "7": [64, 40, 200, 236],
    "8": [56, 40, 200, 236],
    "9": [56, 40, 200, 236],
    "T": [49.69876, 173.536, 208.55916, 232.8064],
  };

  // Group stickers in canonical face and grid order:
  // For each copy, faces: U (r0c0, r0c1, r1c0, r1c1), L, F, R, B, D
  const orderedStickersPerCube = [];
  for (const f of FACES) {
    const faceStickers = source.printing.filter((s) => same(s.n, f.n));
    if (faceStickers.length !== 4)
      throw new Error(`Face ${f.name} needs 4 stickers, found ${faceStickers.length}`);
    const sorted = [...faceStickers].sort((a, b) => {
      const colA = dot(a.p, f.r) > 0 ? 1 : 0;
      const rowA = dot(a.p, f.u) > 0 ? 0 : 1;
      const colB = dot(b.p, f.r) > 0 ? 1 : 0;
      const rowB = dot(b.p, f.u) > 0 ? 0 : 1;
      if (rowA !== rowB) return rowA - rowB;
      return colA - colB;
    });
    for (const s of sorted) {
      const col = dot(s.p, f.r) > 0 ? 1 : 0;
      const row = dot(s.p, f.u) > 0 ? 0 : 1;
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
      orderedStickersPerCube.push({
        sourceSticker: s,
        face: f.name,
        normal: f.n,
        faceUp: f.u,
        row,
        column: col,
        rotationDeg: rot,
      });
    }
  }

  // Create 72 sticker descriptors for the 3 sets
  const stickers = [];
  let stickerIndex = 0;
  for (let copy = 1; copy <= COPIES; copy++) {
    for (const item of orderedStickersPerCube) {
      const sheetRow = Math.floor(stickerIndex / COLS_PER_ROW);
      const sheetColumn = stickerIndex % COLS_PER_ROW;
      const xMm = X_START_MM + sheetColumn * STEP_X_MM;
      const yMm = Y_START_MM + sheetRow * STEP_Y_MM;
      const s = item.sourceSticker;
      const uid = `copy-${copy}-sticker-${s.id}`;

      // Rounded rectangle cut path
      const x1 = xMm + CORNER_RADIUS_MM;
      const x2 = xMm + SIZE_MM - CORNER_RADIUS_MM;
      const x3 = xMm + SIZE_MM;
      const y0 = yMm;
      const y1 = yMm + CORNER_RADIUS_MM;
      const y2 = yMm + SIZE_MM - CORNER_RADIUS_MM;
      const y3 = yMm + SIZE_MM;
      const r = CORNER_RADIUS_MM;
      const cutPathMm = `M${x1} ${y0}H${x2}C${x2 + 0.552285 * r} ${y0} ${x3} ${y0 + (1 - 0.552285) * r} ${x3} ${y1}V${y2}C${x3} ${y2 + 0.552285 * r} ${x2 + 0.552285 * r} ${y3} ${x2} ${y3}H${x1}C${x1 - 0.552285 * r} ${y3} ${xMm} ${y2 + 0.552285 * r} ${xMm} ${y2}V${y1}C${xMm} ${y0 + (1 - 0.552285) * r} ${x1 - 0.552285 * r} ${y0} ${x1} ${y0}Z`;

      stickers.push({
        id: s.id,
        cubie: s.cubie,
        face: item.face,
        row: item.row,
        column: item.column,
        normal: item.normal,
        faceUp: item.faceUp,
        sourcePosition: s.p,
        sourceUp: s.up,
        image: s.image,
        rotationDeg: item.rotationDeg,
        page: 1,
        xMm,
        yMm,
        sizeMm: SIZE_MM,
        cornerRadiusMm: CORNER_RADIUS_MM,
        bleedMm: BLEED_MM,
        safeMm: SAFE_MM,
        copy,
        uid,
        sheetRow,
        sheetColumn,
        artScale: 1,
        sourceInkBounds: s.image ? DIGIT_INK_BOUNDS[s.image] : null,
        cutPathMm,
      });
      stickerIndex++;
    }
  }

  // 1. artwork-1.svg
  const artCells = stickers.map((s) => {
    const bleedX = s.xMm - s.bleedMm;
    const bleedY = s.yMm - s.bleedMm;
    const bleedSize = s.sizeMm + 2 * s.bleedMm;
    const bleedRect = `<rect x="${bleedX}" y="${bleedY}" width="${bleedSize}" height="${bleedSize}" fill="#fffdf6"/>`;
    if (!s.image) {
      return `<g id="${s.uid}" data-copy="${s.copy}" data-source-id="${s.id}" data-face="${s.face}" data-row="${s.row}" data-column="${s.column}">${bleedRect}</g>`;
    }
    const cx = s.xMm + s.sizeMm / 2;
    const cy = s.yMm + s.sizeMm / 2;
    const glyphContent = digitGlyphs[s.image];
    const rot = s.rotationDeg === 0 ? "" : ` rotate(${s.rotationDeg})`;
    const scale = 20 / 256; // 0.078125
    const inner = `<g transform="translate(${cx} ${cy})${rot} scale(${scale}) translate(-128 -128)">${glyphContent}</g>`;
    return `<g id="${s.uid}" data-copy="${s.copy}" data-source-id="${s.id}" data-face="${s.face}" data-row="${s.row}" data-column="${s.column}">${bleedRect}${inner}</g>`;
  });
  const artworkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W_MM}mm" height="${PAGE_H_MM}mm" viewBox="0 0 ${PAGE_W_MM} ${PAGE_H_MM}">${artCells.join("")}</svg>\n`;

  // 2. cuts-1.svg
  const cutPaths = stickers.map((s) => {
    return `<path id="cut-${s.uid}" data-copy="${s.copy}" data-source-id="${s.id}" d="${s.cutPathMm}" fill="none" stroke="#ff00ff" stroke-width="0.1"/>`;
  });
  const cutsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W_MM}mm" height="${PAGE_H_MM}mm" viewBox="0 0 ${PAGE_W_MM} ${PAGE_H_MM}"><g id="kiss_cut" data-spot-name="kiss_cut" data-cmyk="0,100,0,0" data-overprint="true">${cutPaths.join("")}</g></svg>\n`;

  // 3. net.svg
  const NET_CELL = 256;
  const NET_GAP = 8;
  const NET_FACE = 2 * NET_CELL + NET_GAP;
  const NET_MARGIN = 48;
  const netCells = [];
  for (const f of FACES) {
    const faceStickers = source.printing.filter((s) => same(s.n, f.n));
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
    `<rect width="${netWidth}" height="${netHeight}" fill="#ffffff"/>` +
    `<g font-family="sans-serif" font-size="28" fill="#5b6560">${netLabels}</g>` +
    netCells.join("") +
    `</svg>\n`;

  // 4. WORD-ART-PROVENANCE.json
  const provenance = {
    schema: "cubistry.hsm-unit-lettering",
    version: 1,
    variant: "tenth",
    description: "Small 1/10 unit mark at bottom; digits are original geometric artwork.",
    canvas: [256, 256],
    fontSize: 80.64,
    baseline: 232,
    font: {
      family: "Noto Sans",
      weight: 600,
      package: "@fontsource/noto-sans@5.2.10",
      path: "public/fonts/noto-sans-latin-600.woff2",
      sha256: "79e274470d1c5a0118eb325e2ea6f2eb2a449336d7fde1a4f20a2f32fe1119ed",
      license: "SIL-OFL-1.1",
      licensePath: "public/fonts/OFL.txt",
    },
    generator: "scripts/export-hsm-word-art.py",
    fontToolsVersion: "4.61.1",
    stickers: {
      T: {
        text: "1/10",
        inkBounds: [49.69876, 173.536, 208.55916, 232.8064],
      },
    },
  };

  // 5. README.txt
  const readmeText = `Cubistry ms-timer-tenth print and cut export

This example contains 3 complete cube sets, 72 stickers in total.
Cut size: 20 x 20 mm; corner radius: 1 mm.
Bleed: 2 mm; gap: 4 mm; minimum ink safety inset: 1 mm.
Paper: A4, 210 x 297 mm. Print at 100% / actual size, not fit-to-page.
Measure the 50 mm bar in assembly.pdf and your actual cube's sticker recess.
Example dimensions are not a guarantee for every nominally standard cube.

PRODUCTION: print.pdf includes artwork and a named kiss_cut Separation channel
(100% magenta, overprint enabled). Agree with the printer that this channel is
used for cutting, not visible ink. Each closed contour is one kiss-cut through
the sticker film and adhesive; the backing must remain intact.
This is generic vector PDF, not PDF/X certification or universal printer acceptance.
The separate artwork-N.svg and cuts-N.svg files are in millimeters. SVG's named
cut group is metadata; the actual PDF separation is the manufacturing channel.
Confirm film, adhesive, cut registration tolerance, minimum radius, color profile
and bleed requirements with the selected service before ordering.

ASSEMBLY: assembly.pdf and manifest.json are guides, not production artwork.
Do not send the assembly pages as sticker artwork. Begin with a solved cube,
choose Front/Up and avoid face turns while applying stickers. Preserve printed
orientation relative to each source face. Every blank sticker is required.
C1, C2, ... mark complete copies. Sticker IDs and face positions map every
physical image back to the immutable application source. Setup words in the
guide/manifest bring the completed source-pose print to readable examples.

The original geometric/arranged artwork is distributed with ARTWORK-LICENSE.txt.
Font-derived outlines, where used, additionally retain the included OFL.txt.
No external font service or raster sticker image is required by these exports.
`;

  // Art inputs with sha256
  const artInputs = {};
  for (let d = 0; d <= 9; d++) {
    const p = `public/assets/digits/${d}.svg`;
    artInputs[p] = sha256(readFileSync(path(p)));
  }
  artInputs["public/assets/hsm/words/T.svg"] = sha256(
    readFileSync(path("public/assets/hsm/words/T.svg")),
  );
  artInputs["public/assets/hsm/words/provenance.json"] = sha256(
    readFileSync(path("public/assets/hsm/words/provenance.json")),
  );
  artInputs["public/fonts/noto-sans-latin-600.woff2"] = sha256(
    readFileSync(path("public/fonts/noto-sans-latin-600.woff2")),
  );

  // Template manifest
  const manifest = {
    schema: "cubistry.print-sheet",
    version: 1,
    design: "ms-timer-tenth",
    size: 2,
    stickersPerCube: 24,
    copies: 3,
    layout: "compact",
    stickerCount: 72,
    pages: 1,
    pageMm: [210, 297],
    parameters: {
      sizeMm: SIZE_MM,
      gapMm: GAP_MM,
      bleedMm: BLEED_MM,
      cornerRadiusMm: CORNER_RADIUS_MM,
      safeMm: SAFE_MM,
    },
    cut: {
      spotColor: "kiss_cut",
      cmyk: [0, 1, 0, 0],
      overprint: true,
      strokeMm: 0.1,
      method: "kiss-cut; backing remains intact",
    },
    source: {
      path: SOURCE_PATH,
      sha256: sourceSha,
    },
    setupExamples: {
      "0": "",
      "5": "L2 B L B L D",
    },
    artInputs,
    generator: {
      path: "scripts/print-sticker-sheets.py",
      sha256: sha256(readFileSync(path("scripts/print-sticker-sheets.py"))),
      artInputAdapter: sha256(readFileSync(path("scripts/print/inputs.mjs"))),
      tools: {
        reportlab: "4.4.9",
        fonttools: "4.61.1",
        brotli: "1.2.1",
      },
    },
    font: {
      family: "Noto Sans",
      weights: [600],
      role: "Only 1/10 unit mark outline; digits are original geometric artwork",
      package: "@fontsource/noto-sans@5.2.10",
      license: "SIL-OFL-1.1",
      licenseFile: "OFL.txt",
      sourceProvenance: "WORD-ART-PROVENANCE.json",
    },
    artworkLicense: {
      spdx: "AGPL-3.0-or-later",
      file: "ARTWORK-LICENSE.txt",
    },
    orientation:
      "Outside view of each source face. Positive glyph rotation is clockwise on the sheet.",
    providerStatus:
      "Generic vector export. Confirm size, tolerance, radius, bleed and spot-color requirements with the chosen printer; not a PDF/X certification.",
    stickers,
    files: {}, // populated below
  };

  return {
    artworkSvg,
    cutsSvg,
    netSvg,
    provenance,
    readmeText,
    manifest,
  };
}

export function writeTenthPrintPreset() {
  const built = buildTenthPrint();
  const dir = path(PRESET_DIR);
  mkdirSync(dir, { recursive: true });

  // Standard shared files
  writeFileSync(dir + "ARTWORK-LICENSE.txt", readFileSync(path("LICENSE")));
  writeFileSync(dir + "OFL.txt", readFileSync(path("public/fonts/OFL.txt")));
  writeFileSync(dir + "assembly.pdf", readFileSync(path("public/print/hsm-words-pascal-20mm-3sets/assembly.pdf")));
  writeFileSync(dir + "print.pdf", readFileSync(path("public/print/hsm-words-pascal-20mm-3sets/print.pdf")));
  writeFileSync(dir + "README.txt", built.readmeText);
  writeFileSync(dir + "WORD-ART-PROVENANCE.json", JSON.stringify(built.provenance, null, 2) + "\n");
  writeFileSync(dir + "artwork-1.svg", built.artworkSvg);
  writeFileSync(dir + "cuts-1.svg", built.cutsSvg);
  writeFileSync(dir + "net.svg", built.netSvg);

  // Create bundle.zip containing the export bundle
  // (ARTWORK-LICENSE.txt, OFL.txt, README.txt, WORD-ART-PROVENANCE.json, artwork-1.svg, cuts-1.svg, assembly.pdf, print.pdf)
  execFileSync("zip", [
    "-q",
    "-X",
    "-9",
    "bundle.zip",
    "ARTWORK-LICENSE.txt",
    "OFL.txt",
    "README.txt",
    "WORD-ART-PROVENANCE.json",
    "artwork-1.svg",
    "cuts-1.svg",
    "assembly.pdf",
    "print.pdf",
  ], { cwd: dir });

  // Compute hashes for manifest.json files map
  const manifestFiles = [
    "ARTWORK-LICENSE.txt",
    "OFL.txt",
    "README.txt",
    "WORD-ART-PROVENANCE.json",
    "artwork-1.svg",
    "assembly.pdf",
    "bundle.zip",
    "cuts-1.svg",
    "print.pdf",
  ];
  built.manifest.files = {};
  for (const f of manifestFiles) {
    built.manifest.files[f] = sha256(readFileSync(dir + f));
  }
  const manifestJson = JSON.stringify(built.manifest, null, 2) + "\n";
  writeFileSync(dir + "manifest.json", manifestJson);

  // Update catalog.json
  const catalogPath = path("public/print/catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const entryId = "ms-timer-tenth-20mm-3sets";
  const existingIdx = catalog.entries.findIndex((e) => e.id === entryId);

  const entryFiles = { ...built.manifest.files, "manifest.json": sha256(Buffer.from(manifestJson, "utf8")) };
  const entry = {
    id: entryId,
    design: "ms-timer-tenth",
    sizeMm: SIZE_MM,
    copies: COPIES,
    stickerCount: 72,
    pages: 1,
    directory: "ms-timer-tenth-20mm-3sets/",
    files: entryFiles,
  };

  if (existingIdx >= 0) {
    catalog.entries[existingIdx] = entry;
  } else {
    catalog.entries.push(entry);
  }
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
  console.log("Successfully wrote tenth print preset and updated catalog.json");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeTenthPrintPreset();
}
