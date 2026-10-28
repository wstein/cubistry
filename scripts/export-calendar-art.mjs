import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { stickerSvg } from "../src/apps/calendar/artwork.ts";
const font = readFileSync("public/fonts/noto-sans-latin-600.woff2");
const dir = "assets/calendar";
mkdirSync(dir, { recursive: true });
const manifest = {
  schema: "cubistry.calendar-artwork",
  version: 1,
  dimensions: "14 mm square; 256-unit viewBox",
  font: {
    family: "Noto Sans",
    package: "@fontsource/noto-sans@5.2.10",
    weight: 600,
    license: "SIL-OFL-1.1",
    path: "public/fonts/noto-sans-latin-600.woff2",
    sha256: createHash("sha256").update(font).digest("hex"),
    licensePath: "public/fonts/OFL.txt",
  },
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
      const svg = stickerSvg(s, font.toString("base64"));
      writeFileSync(`${dir}/${file}`, svg + "\n");
      glyphs[key] = {
        file,
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
