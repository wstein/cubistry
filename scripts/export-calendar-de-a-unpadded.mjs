// Derives public/calendar/de-a-unpadded.json from the German A unpadded research witness.
// Same mapping as research/date-3x3/export-runtime.mjs (route = prelude + word + centerCorrection).
// Usage: node scripts/export-calendar-de-a-unpadded.mjs <de-2-unpadded.json> [output]
// Witness: research/date-3x3/german-unpadded/witnesses/de-2-unpadded.json at the commit pinned in calendar-source.json.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const pin = JSON.parse(readFileSync("calendar-source.json", "utf8"));
const [, , source, out = "public/calendar/de-a-unpadded.json"] = process.argv;
if (!source) throw Error("Usage: export-calendar-de-a-unpadded.mjs <witness.json> [output]");
const bytes = readFileSync(source);
const key = "research/date-3x3/german-unpadded/witnesses/de-2-unpadded.json";
if (createHash("sha256").update(bytes).digest("hex") !== pin.sources[key])
  throw Error("Witness differs from its pin in calendar-source.json");
const w = JSON.parse(bytes);
if (!w.complete || w.paddingMode !== "unpadded" || w.targets.length !== 2562) throw Error("Incomplete witness");
const targets = w.targets.map((t) => ({
  weekday: t.weekday,
  day: t.day,
  month: t.month,
  cells: t.cells,
  word: [t.prelude, t.word, t.centerCorrection].filter(Boolean).join(" "),
}));
writeFileSync(out, JSON.stringify({ schema: "cubistry.calendar-runtime", version: 1, id: "de-a-unpadded", printing: w.printing, targets }) + "\n");
