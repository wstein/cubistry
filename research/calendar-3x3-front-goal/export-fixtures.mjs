// usage: node export-fixtures.mjs <fixtureDir>
// Writes the print geometry (TSV, one line per sticker) and a deterministic sample of targets for every print.
import { writeFileSync, mkdirSync } from "node:fs";
import { loadApp, loadDesign, printTsv, PRINTS } from "./lib.mjs";
const [dir] = process.argv.slice(2);
const { model } = await loadApp();
mkdirSync(dir, { recursive: true });
for (const id of PRINTS) {
  const design = loadDesign(model, id);
  writeFileSync(`${dir}/print-${id}.tsv`, printTsv(design));
  const rows = design.targets.filter((_, i) => i % 97 === 0)
    .map((t) => [t.weekday, t.month, t.day, t.cells.join("|"), t.word].join("\t"));
  writeFileSync(`${dir}/targets-${id}.tsv`, "# weekday\tmonth\tday\tcells\tsource_word\n" + rows.join("\n") + "\n");
}
