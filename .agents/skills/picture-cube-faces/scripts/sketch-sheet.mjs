#!/usr/bin/env node
/** Pre-sketch stage: renders a concept sheet from a small JSON so the owner can approve the composition before the build.
 *   node sketch-sheet.mjs <concept.json> [--out sheet.svg] [--png sheet.png] [--limit 10] [--strict]
 * Prints the edge-color check (12 shared edges) and hero-share warnings. --strict exits 1 on any mismatch.
 * See templates/concept.example.json for the format.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { validateConcept, seamReport, heroWarnings, sketchSvg } from "../src/sketch.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const input = args.find((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--png", "--limit"].includes(args[i - 1])));
if (!input) { console.error("usage: sketch-sheet.mjs <concept.json> [--out sheet.svg] [--png sheet.png] [--limit 10] [--strict]"); process.exit(2); }
const concept = JSON.parse(readFileSync(input, "utf8"));
const problems = validateConcept(concept);
if (problems.length) { for (const p of problems) console.error(`ERROR ${p}`); process.exit(2); }
const report = seamReport(concept, Number(opt("limit", 10)));
const svg = sketchSvg(concept, report);
const out = opt("out", input.replace(/\.json$/, "") + "-sketch.svg");
writeFileSync(out, svg);
console.log(`concept sheet: ${out}`);
for (const r of report) console.log(`${r.pass ? "ok  " : "DIFF"} ${r.edge.padEnd(4)} ${r.a} | ${r.b}  diff ${r.diff}/255`);
for (const w of heroWarnings(concept)) console.log(`WARN ${w}`);
const png = opt("png");
if (png) {
  const { openBrowser, screenshotHtml } = await import("../src/browser.mjs");
  const b = await openBrowser();
  await screenshotHtml(b.page, `<body style="margin:0">${svg}</body>`, png, 900);
  await b.close();
  console.log(`png: ${png}`);
}
process.exit(args.includes("--strict") && report.some((r) => !r.pass) ? 1 : 0);
