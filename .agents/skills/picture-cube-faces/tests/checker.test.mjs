// End-to-end tests of scripts/check-cube-set.mjs (exit codes, negative controls, advisory classification).
// The rendering ones need Playwright's Chromium; they are skipped (and say so) when the browser cannot be started.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { openBrowser } from "../src/browser.mjs";
import { defineTheme } from "../src/theme.mjs";
import { createBelt } from "../src/belt.mjs";
import { demoTheme } from "../examples/demo-theme.mjs";

const CHECK = fileURLToPath(new URL("../scripts/check-cube-set.mjs", import.meta.url));
const run = (...args) => { const r = spawnSync(process.execPath, [CHECK, ...args], { encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; };

let browserError = null;
try { const b = await openBrowser(); await b.close(); } catch (e) { browserError = e.message; }
const skip = browserError ? `no browser: ${browserError.split("\n")[0]}` : false;

const base = mkdtempSync(`${tmpdir()}/cube-base-`);
demoTheme({ size: 420 }).build(base, { previewN: [2] });
const copy = () => { const d = mkdtempSync(`${tmpdir()}/cube-case-`); cpSync(base, d, { recursive: true }); return d; };
const edit = (d, file, fn) => writeFileSync(`${d}/${file}`, fn(readFileSync(`${d}/${file}`, "utf8")));
const inject = (d, file, markup) => edit(d, file, (t) => t.replace("</svg>", `${markup}</svg>`));

test("usage errors exit 2 (no browser needed)", () => {
  assert.equal(run().code, 2);
  assert.equal(run("/nonexistent-dir-for-cube-check").code, 2);
  for (const bad of [["--min-detail", "8%"], ["--sym-tol", "x"], ["--strict-n", "two"], ["--strict-n", "9"], ["--seam-mean", "NaN"], ["--bogus", "1"], ["--n", "8"], ["--n", "2.5"], ["--n-range", "5-3"], ["--max-face-kb", "0"], ["--json"]]) {
    const r = run(base, ...bad);
    assert.equal(r.code, 2, `${bad.join(" ")} -> ${r.code}\n${r.out}`);
  }
});

test("a clean demo set passes with exit 0 and writes the classification json", { skip }, () => {
  const d = copy();
  const r = run(d, "--n-range", "2-3");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /RESULT: PASS/);
  const j = JSON.parse(readFileSync(`${d}/tiles.json`, "utf8"));
  assert.equal(j.perN[2].classification.version, 1);
  assert.equal(j.perN[3].classification.centers.length, 6);
  assert.equal(j.perN[2].classification.counts.stickers, 24);
});

test("a range without a strict N warns that flat stickers cannot fail", { skip }, () => {
  const r = run(copy(), "--n", "3");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /no strict N among the examined sizes/);
  assert.equal(run(copy(), "--n", "3", "--strict-n", "3").code, 0);
});

const bypasses = {
  nstext: ['<s:text xmlns:s="http://www.w3.org/2000/svg" x="150" y="200" fill="#000">Hi</s:text>', /prefixed:s:text/],
  entityGradient: ['<s:linearGradient xmlns:s="http://www.w3.org/2000/svg" id="g2"><s:stop offset="0" stop-color="red"/></s:linearGradient><rect width="400" height="400" fill="&#117;rl(#g2)"/>', /url\(\)/],
  cssMask: ['<rect width="400" height="400" fill="#f00" style="mask-image:linear-gradient(black,transparent)"/>', /attribute:style/],
  animate: ['<rect width="9" height="9"><animate attributeName="fill" from="red" to="blue" dur="1s" repeatCount="indefinite"/></rect>', /element:animate/],
  shapeRendering: ['<g shape-rendering="crispEdges"><rect width="9" height="9"/></g>', /attribute:shape-rendering/],
};
for (const [name, [markup, expect]] of Object.entries(bypasses)) {
  test(`negative control: ${name} in a face fails`, { skip }, () => {
    const d = copy();
    inject(d, "F.svg", markup);
    const r = run(d, "--n", "2");
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL F\.svg/);
    assert.match(r.out, expect);
  });
}

test("negative control: the net is scanned too", { skip }, () => {
  const d = copy();
  inject(d, "net.svg", '<style>rect{fill:red}</style>');
  const r = run(d, "--n", "2");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL net\.svg/);
});

test("negative control: tile files are scanned and need integer sizes", { skip }, () => {
  const d = copy();
  edit(d, "tiles/n2/F_0_0.svg", (t) => t.replace('width="210" height="210"', 'width="209.5" height="209.5"'));
  inject(d, "tiles/n2/F_0_1.svg", '<g shape-rendering="crispEdges"/>');
  const r = run(d, "--n", "2");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /tiles\/n2\/F_0_1\.svg: attribute:shape-rendering/);
  assert.match(r.out, /tiles\/n2\/F_0_0\.svg: dimension|F_0_0\.svg: width\/height must be/);
});

test("a malformed face fails with a RESULT line (not an exit 2 crash)", { skip }, () => {
  const d = copy();
  writeFileSync(`${d}/R.svg`, "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"420\" height=\"420\"");
  const r = run(d, "--n", "2");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /RESULT: FAIL/);
});

test("duplicates, rotation twins and symmetric stickers are information, not failures", { skip }, () => {
  const d = copy();
  const u = readFileSync(`${d}/U.svg`, "utf8");
  writeFileSync(`${d}/F.svg`, u); // F is an exact copy of U
  rmTiles(d);
  const r = run(d, "--n", "2", "--strict-n", "2");
  assert.equal(r.code, 1, r.out); // the F edges no longer match the belt: that is a seam failure, not a duplicate failure
  const j = JSON.parse(readFileSync(`${d}/tiles.json`, "utf8"));
  assert.equal(j.perN[2].classification.counts.identicalGroups, 4);
  assert.equal(j.perN[2].pass, true);
  assert.ok(j.fails.every((m) => m.startsWith("seam ")), j.fails.join("\n"));
  assert.match(r.out, /identical \(info\)/);
});

test("rotated copies are reported as rotation twins", { skip }, () => {
  const d = copy();
  rmTiles(d);
  const u = readFileSync(`${d}/U.svg`, "utf8");
  writeFileSync(`${d}/F.svg`, u.replace(/(<svg[^>]*>)([\s\S]*)<\/svg>/, (m, a, b) => `${a}<g transform="rotate(180 210 210)">${b}</g></svg>`));
  const r = run(d, "--n", "2");
  const j = JSON.parse(readFileSync(`${d}/tiles.json`, "utf8"));
  assert.equal(j.perN[2].classification.counts.rotationTwinGroups, 4);
  assert.equal(j.perN[2].pass, true);
  assert.ok(j.fails.every((m) => m.startsWith("seam ")), r.out);
});

function rmTiles(d) { spawnSync("rm", ["-rf", `${d}/tiles`]); }

test("a tile preview that lost art through a wrong bbox differs from the face crop", { skip }, () => {
  const keys = Array(4).fill([[0, "#aaccee"], [1, "#eeeeff"]]);
  const belt = createBelt({ sky: keys, ground: keys, horizon: 0.7 });
  const art = () => [{ svg: '<circle cx="200" cy="200" r="30" fill="#334455"/>', bbox: [195, 195, 10, 10] }, '<rect x="30" y="30" width="80" height="50" fill="#778899"/>'];
  const t = defineTheme({ name: "bb", size: 420, belt, faces: { L: art, F: art, R: art, B: art, U: art, D: art } });
  const d = mkdtempSync(`${tmpdir()}/cube-bb-`);
  t.build(d, { previewN: [2] });
  const r = run(d, "--n", "2");
  assert.match(r.out, /tiles\/n2\/F_0_1\.svg: differs from the F face crop/);
  assert.equal(r.code, 1);
});

test("negative control: art that stops 1 px short of an edge fails the seam band", { skip }, () => {
  const d = copy();
  inject(d, "L.svg", '<rect x="1" y="0" width="60" height="420" fill="#ff0000"/>');
  rmTiles(d);
  const r = run(d, "--n", "2");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL seam (U\|L|D\|L|B\|L|L\|F)/);
});

test("negative control: one bad sticker segment fails an edge whose mean is fine", { skip }, () => {
  const d = copy();
  inject(d, "L.svg", '<rect x="0" y="0" width="30" height="38" fill="#000000"/><rect x="0" y="100" width="30" height="38" fill="#000000"/>');
  rmTiles(d);
  const r = run(d, "--n", "7", "--seam-mean", "25");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /worst sticker segment/);
});

test("non-periodic belt horizon is reported when a theme is built", () => {
  const keys = Array(4).fill([[0, "#aaccee"], [1, "#eeeeff"]]);
  const belt = createBelt({ sky: keys, ground: keys, horizon: (u) => 0.5 + 0.1 * u });
  const draw = () => "";
  const t = defineTheme({ name: "np", size: 420, belt, faces: { L: draw, F: draw, R: draw, B: draw, U: draw, D: draw } });
  const rep = t.build(mkdtempSync(`${tmpdir()}/cube-np-`));
  assert.equal(rep.warnings.length, 1);
});
