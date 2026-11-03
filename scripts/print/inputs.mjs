// Preserve the application's exact immutable print and artwork roles.
import { readFileSync } from "node:fs";
import { stickerArt } from "../../src/apps/calendar/artwork.ts";
const root = new URL("../../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root)));
const designs = {};
for (const [id, file] of [
  ["de-a", "public/calendar/de-a.json"],
  ["en-3", "public/calendar/en-3-zero.json"],
]) {
  const d = read(file);
  designs[id] = {
    id,
    size: 3,
    source: file,
    setupExamples: {
      "2026-10-29": d.targets.find(
        (t) => t.weekday === 3 && t.day === 29 && t.month === 10,
      ).word,
    },
    printing: d.printing.map((s) => ({ ...s, art: stickerArt(s) })),
  };
}
const hsm = read("public/hsm-counter.v2.json");
for (const style of ["symbols", "words", "words-pascal"])
  designs[`hsm-${style}`] = {
    id: `hsm-${style}`,
    size: 2,
    source: "public/hsm-counter.v2.json",
    printing: hsm.printing,
    setupExamples: hsm.zeroWords,
    lettering: style,
  };
// The dedicated 1/10-second cube: digits plus the 1/10 mark (image "T") from the words lettering.
const tenth = read("public/ms-timer-tenth.v1.json");
const fromZero = (to) =>
  read("public/tenth-transitions.v1.json").transitions.find(
    (t) => t.from === 0 && t.to === to,
  ).alg;
designs["ms-timer-tenth"] = {
  id: "ms-timer-tenth",
  size: 2,
  source: "public/ms-timer-tenth.v1.json",
  printing: tenth.printing,
  setupExamples: { 0: "", 5: fromZero(5) },
  lettering: "words",
  fontRole: "Only 1/10 unit mark outline; digits are original geometric artwork",
};
console.log(JSON.stringify(designs));
