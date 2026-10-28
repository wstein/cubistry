import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { stickerArt, stickerSvg } from "../src/apps/calendar/artwork.ts";
const fontFiles = [600, 800].map((weight) => ({
  weight,
  path: `public/fonts/noto-sans-latin-${weight}.woff2`,
}));
const fontData = Object.fromEntries(
  fontFiles.map((f) => [f.weight, readFileSync(f.path)]),
);
const dir = "assets/calendar";
mkdirSync(dir, { recursive: true });
const manifest = {
  schema: "cubistry.calendar-artwork",
  version: 2,
  dimensions: "14 mm square; 256-unit viewBox",
  fonts: fontFiles.map((f) => ({
    family: "Noto Sans",
    package: "@fontsource/noto-sans@5.2.10",
    weight: f.weight,
    license: "SIL-OFL-1.1",
    path: f.path,
    sha256: createHash("sha256").update(fontData[f.weight]).digest("hex"),
    licensePath: "public/fonts/OFL.txt",
  })),
  designs: {},
};
for (const id of ["de-a", "en-3-zero"]) {
  const d = JSON.parse(readFileSync(`public/calendar/${id}.json`, "utf8")),
    label = id === "de-a" ? "de-a" : "en-3";
  const glyphs = {};
  for (const s of d.printing) {
    const key = `${s.slot}-${s.image || "blank"}`;
    if (!glyphs[key]) {
      const file = `${label}-${Object.keys(glyphs).length}.svg`;
      const svg = stickerSvg(
        s,
        Object.fromEntries(
          Object.entries(fontData).map(([weight, bytes]) => [
            weight,
            bytes.toString("base64"),
          ]),
        ),
      );
      writeFileSync(`${dir}/${file}`, svg + "\n");
      glyphs[key] = {
        file,
        art: stickerArt(s),
        sha256: createHash("sha256")
          .update(svg + "\n")
          .digest("hex"),
        stickers: [],
      };
    }
    glyphs[key].stickers.push(s.id);
  }
  manifest.designs[label] = glyphs;
}
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
