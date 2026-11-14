// usage: node export-predicate-cases.mjs <out.tsv>
// Cases for cross-checking the Julia goal predicate against the app's own `matches()` and move engine.
// Each case is a print, a target's cells, and a move word applied to the print; the app decides the expected value.
import { writeFileSync, readFileSync } from "node:fs";
import { loadApp, loadDesign, PRINTS, root } from "./lib.mjs";
const [out] = process.argv.slice(2);
const { model } = await loadApp();
const witnesses = JSON.parse(readFileSync(`${root}/src/apps/calendar/transition/center-corrections.json`, "utf8")).witnesses;
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const moves = [..."RLUDFB"].flatMap((f) => [f, f + "2", f + "'"]);
const lines = ["# print\tmatches\tcells\tword"];
for (const id of PRINTS) {
  const design = loadDesign(model, id);
  design.targets.filter((_, i) => i % 193 === 0).forEach((t, i) => {
    const other = design.targets[(i * 389 + 7) % design.targets.length];
    const words = [t.word, t.word + " B", t.word + " B2", t.word + " F", t.word + " R U",
      other.word, t.word + " " + witnesses[1].word, t.word + " " + witnesses[0].word,
      t.word + " " + [0, 1, 2].map(() => moves[Math.floor(rnd() * 18)]).join(" ")];
    for (const w of words) {
      const state = model.apply(design.printing, w);
      lines.push([id, model.matches(state, t.cells) ? 1 : 0, t.cells.join("|"), w].join("\t"));
    }
  });
}
writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.length - 1, "cases", lines.filter((l) => l.split("\t")[1] === "1").length, "positive");
