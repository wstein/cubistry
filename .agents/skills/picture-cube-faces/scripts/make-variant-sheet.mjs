#!/usr/bin/env node
/** Side-by-side sheet of variants (or before/after) with an empty rating table.
 *   node make-variant-sheet.mjs <themeDir> --variants b-a,b-b [--out sheet.png]
 *   node make-variant-sheet.mjs --before <dirA> --after <dirB> [--out sheet.png]
 * Folder rule: <theme>/<variant>/ (current build) with v1/, v2/ history; two variants per open question.
 * Also writes <themeDir>/ratings.md (empty table) when missing. If a dir has tiles.json from check-cube-set, its verdict is shown.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { FACE_NAMES, NET_POS } from "../src/geometry.mjs";
import { RATING_AXES, badGroups, ratingTableMd } from "../src/variants.mjs";
import { dataUrl, openBrowser, screenshotHtml } from "../src/browser.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const root = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
let cols;
if (opt("before") && opt("after")) cols = [{ name: `before: ${basename(opt("before"))}`, dir: resolve(opt("before")) }, { name: `after: ${basename(opt("after"))}`, dir: resolve(opt("after")) }];
else if (root && opt("variants")) {
  const names = opt("variants").split(",");
  for (const b of badGroups(names)) console.log(`WARN question group "${b.group}" has ${b.count} variant(s); the rule is exactly two per open question`);
  cols = names.map((n) => ({ name: n, dir: resolve(root, n) }));
} else { console.error("usage: make-variant-sheet.mjs <themeDir> --variants a-a,a-b | --before <dir> --after <dir> [--out sheet.png]"); process.exit(2); }

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cell = Math.floor(1640 / cols.length / 4) - 8;
const colHtml = cols.map((c) => {
  const imgs = FACE_NAMES.map((f) => {
    const p = `${c.dir}/${f}.svg`;
    if (!existsSync(p)) throw new Error(`${c.dir}: missing ${f}.svg`);
    const [x, y] = NET_POS[f];
    return `<img src="${dataUrl(readFileSync(p, "utf8"))}" width="${cell}" height="${cell}" style="grid-column:${x + 1};grid-row:${y + 1};border:1px solid #4a3a38">`;
  }).join("");
  let verdict = "";
  if (existsSync(`${c.dir}/tiles.json`)) { const j = JSON.parse(readFileSync(`${c.dir}/tiles.json`, "utf8")); verdict = ` <span style="font-weight:400">checker: ${esc(j.verdict)}</span>`; }
  const table = `<table style="border-collapse:collapse;margin-top:10px;font-size:14px"><tr>${RATING_AXES.map((a) => `<th style="border:1px solid #4a3a38;padding:3px 10px">${esc(a)}</th>`).join("")}</tr><tr>${RATING_AXES.map(() => `<td style="border:1px solid #4a3a38;padding:3px 10px;height:22px;text-align:center">1-5</td>`).join("")}</tr></table>`;
  return `<div style="flex:1"><div style="font:700 22px sans-serif;margin:6px 0">${esc(c.name)}${verdict}</div><div style="display:grid;grid-template-columns:repeat(4,${cell}px);gap:4px;line-height:0">${imgs}</div>${table}</div>`;
}).join("");
const out = resolve(opt("out") ?? `${root ?? "."}/variant-sheet.png`);
const b = await openBrowser();
await screenshotHtml(b.page, `<body style="margin:0;background:#f5f3eb;color:#4a3a38;font-family:sans-serif"><div style="display:flex;gap:24px;padding:12px">${colHtml}</div></body>`, out, 1700);
await b.close();
console.log(`sheet: ${out}`);
if (root && opt("variants")) {
  const md = `${resolve(root)}/ratings.md`;
  if (!existsSync(md)) { writeFileSync(md, `# Ratings\n\nScale 1-5 (5 best). Fill in after viewing the sheet.\n\n${ratingTableMd(opt("variants").split(","))}`); console.log(`rating table: ${md}`); }
}
