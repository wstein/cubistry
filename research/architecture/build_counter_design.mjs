// Explicit, checked legacy-v1 -> shared-core-v2 adapter; old evidence is untouched.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { validatePrint } from "../../packages/cube-core/src/index.ts";
import { validateCounterDesign } from "../../src/apps/counter/design.ts";
import { digitSvg } from "../../src/apps/counter/artwork.ts";
const raw = readFileSync("public/counter-proof.json"),
  legacy = JSON.parse(raw);
if (legacy.schema !== 1 || legacy.puzzle !== "2x2x2")
  throw Error("Unsupported legacy witness schema or puzzle");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const images = [
  { id: "blank", kind: "color", color: "#fffdf6" },
  {
    id: "title-left",
    kind: "text",
    documentId: "counter-title",
    crop: [0, 0, 256, 256],
  },
  {
    id: "title-right",
    kind: "text",
    documentId: "counter-title",
    crop: [256, 0, 256, 256],
  },
];
mkdirSync("public/assets/digits", { recursive: true });
for (const n of "0123456789") {
  const svg = digitSvg(n);
  writeFileSync(`public/assets/digits/${n}.svg`, svg);
  images.push({
    id: n,
    kind: "image",
    format: "svg",
    url: `/assets/digits/${n}.svg`,
    sha256: hash(svg),
  });
}
function convert(printing, id) {
  const cubies = [
    ...new Map(
      printing.map((s) => [s.cubie, { id: s.cubie, position: s.p }]),
    ).values(),
  ];
  return validatePrint({
    schema: "cubistry.print",
    version: 1,
    id,
    topology: { kind: "cube", size: 2 },
    cubies,
    stickers: printing.map((s) => ({
      id: s.id,
      cubie: s.cubie,
      normal: s.n,
      up: s.up,
      assetId: s.image === " " ? "blank" : s.image,
      materialId: "sticker",
      equivalentQuarterTurns: s.image === " " ? [0, 1, 2, 3] : [0],
    })),
  });
}
const payload = {
  schema: "cubistry.counter-design",
  version: 2,
  puzzle: "2x2x2",
  legacyWitnessSHA256: hash(raw),
  assets: {
    schema: "cubistry.assets",
    version: 1,
    fonts: [
      {
        id: "label-font",
        url: "/fonts/noto-sans-latin-600.woff2",
        sha256: hash(readFileSync("public/fonts/noto-sans-latin-600.woff2")),
        family: "Counter Sans",
        weight: 600,
        format: "woff2",
        license: "SIL-OFL-1.1",
      },
    ],
    materials: [
      { id: "sticker", color: "#ffffff", roughness: 0.7 },
      { id: "plastic", color: "#202329", roughness: 0.45 },
    ],
    documents: [
      {
        id: "counter-title",
        text: "BREAK\nMINUTES",
        fontId: "label-font",
        color: "#202c36",
        background: "#fffdf6",
        width: 512,
        height: 256,
        fontSize: 52,
        minFontSize: 10,
        lineHeight: 64,
      },
    ],
    images,
  },
  prints: {
    padded: convert(legacy.printing, "counter-padded-v2"),
    unpadded: convert(legacy.unpaddedPrinting, "counter-unpadded-v2"),
  },
  witnesses: legacy.witnesses,
};
const validated = validateCounterDesign(payload);
writeFileSync(
  "public/counter-design.v2.json",
  JSON.stringify(validated, null, 2) + "\n",
);
console.log(
  "Validated shared-core design generated from immutable legacy witness",
  hash(raw),
);
