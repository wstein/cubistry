#!/usr/bin/env node
/** Builds the synthetic demo theme into a directory outside git.
 *   node build-demo.mjs <outDir> [--size 420] [--preview 2,7] [--archive]
 * Faces are independent of N; --preview writes on-demand tile previews for those cube sizes.
 * Default outDir is a fresh temp folder. Prints the measured size report.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { demoTheme } from "./demo-theme.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const out = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--archive")) ?? mkdtempSync(`${tmpdir()}/cube-demo-`);
const size = Number(opt("size", 420));
const previewN = opt("preview", "").split(",").filter(Boolean).map(Number);
const report = demoTheme({ size }).build(out, { archive: args.includes("--archive"), previewN });
const kb = (b) => (b / 1024).toFixed(1) + " KB";
console.log(`demo face size ${size}px built in ${out}`);
console.log(`faces: max ${kb(report.faceBytes.max)}, mean ${kb(report.faceBytes.mean)}; total ${kb(report.totalBytes)}`);
for (const p of report.tilePreviews) console.log(`tile preview N=${p.n}: ${p.count} files, ${p.tile}px, max ${kb(p.max)}, mean ${kb(p.mean)}`);
