// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 color scheme "Rubik-Tint": very light tints of the standard Rubik colors behind black print; the tint is the
// home face of the stone. Measures the six tints (scripts/calendar7-rubik-tint.mjs) and gates them; checks the catalog entry,
// the home face of every sticker and the colors the 3D drawing gets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast } from "./calendar7-contrast.mjs";
import { layoutFixture } from "./calendar7-fixture.mjs";
import {
  BAND, BAND_INK, FACES, MIN_BAND_CONTRAST, MIN_PAIR_DE2000, MIN_PRINT_CONTRAST, PRINT, RUBIK, deltaE2000Lab, measure, optimize, tintOf,
} from "../scripts/calendar7-rubik-tint.mjs";
import { SCHEMES, schemeById, withBannerStyle, namesGround } from "../src/apps/calendar7/schemes.ts";
import { HOME_ORIENTATION, RUBIK_TINTS, faceFillsByHome, homeFaceOfNormal, homeFacesOf, schemeForHome, usesHomeTints } from "../src/apps/calendar7/home-tint.ts";
import { tileRoles } from "../src/apps/calendar7/sticker-art.ts";

const HEX = /^#[0-9a-f]{6}$/;
const scheme = () => SCHEMES.find((s) => s.id === "rubik-tint");

// Gates. Print contrast 12:1 is the owner's floor (the strongest tint that keeps it is what the search below finds); the pair
// distance 15 CIEDE2000 is just under the best any strengths reach (15.18, white against blue, whose luminance is what limits
// the tint): chosen as the largest whole number the optimum clears, so no weaker value is accepted.
test("gate values are the owner's floor and the measured optimum", () => {
  assert.equal(MIN_PRINT_CONTRAST, 12);
  assert.equal(MIN_BAND_CONTRAST, 12);
  assert.equal(MIN_PAIR_DE2000, 15);
});

test("CIEDE2000 matches the published test pairs of Sharma et al. 2005", () => {
  assert.ok(Math.abs(deltaE2000Lab([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 1e-4);
  assert.ok(Math.abs(deltaE2000Lab([50, 3.1571, -77.2803], [50, 0, -82.7485]) - 2.8615) < 1e-4);
  assert.ok(Math.abs(deltaE2000Lab([50, 2.8361, -74.02], [50, 0, -82.7485]) - 3.4412) < 1e-4);
});

test("the six shipped tints are #rrggbb, white stays white, black print reads 12:1 on each", () => {
  assert.deepEqual(Object.keys(RUBIK_TINTS).sort(), [...FACES].sort());
  for (const f of FACES) assert.match(RUBIK_TINTS[f], HEX, f);
  assert.equal(RUBIK_TINTS.white, "#ffffff");
  const m = measure(RUBIK_TINTS);
  for (const f of FACES) assert.ok(m.printContrast[f] >= MIN_PRINT_CONTRAST, `${f} ${m.printContrast[f]}`);
  assert.ok(m.minPrint >= MIN_PRINT_CONTRAST);
});

test("white lettering on the black band reads 12:1", () => {
  assert.ok(contrast(BAND_INK, BAND) >= MIN_BAND_CONTRAST);
  assert.equal(scheme().bandFill, BAND);
  assert.equal(scheme().monthInk, BAND_INK);
});

test("every two tints, white and yellow included, differ by at least 15 CIEDE2000", () => {
  const m = measure(RUBIK_TINTS);
  assert.equal(m.pairs.length, 15);
  for (const p of m.pairs) assert.ok(p.de >= MIN_PAIR_DE2000, `${p.a}-${p.b} ${p.de}`);
  assert.ok(m.toWhite.yellow >= MIN_PAIR_DE2000, `yellow vs white ${m.toWhite.yellow}`);
});

test("the shipped tints are what the deterministic search finds (reproducible)", () => {
  const r = optimize();
  assert.deepEqual(r.tints, RUBIK_TINTS);
  assert.ok(r.minPair >= MIN_PAIR_DE2000);
  for (const f of FACES) assert.equal(tintOf(RUBIK[f], f === "white" ? 0 : r.strengths[f]), RUBIK_TINTS[f]);
});

test("catalog: one more scheme, black print, black band, no weekend shading, Rounded banner", () => {
  assert.equal(SCHEMES.length, 11);
  assert.equal(SCHEMES.filter((s) => s.isDefault).length, 1);
  const s = scheme();
  assert.equal(s.name, "Rubik-Tint");
  assert.equal(s.kind, "light");
  assert.equal(s.style, "band");
  for (const r of ["dayInk", "weekdayInk", "weekendInk", "weekendInkSmall", "sunSatInk"]) assert.equal(s[r], PRINT, r);
  assert.equal(s.weekendFill, null);
  assert.equal(s.weekendTint, null);
  assert.equal(s.dayFill, RUBIK_TINTS.white);
  assert.equal(schemeById("rubik-tint"), s);
  assert.equal(withBannerStyle(s, "theme").bannerStyle, "rounded");
});

test("orientation: white front, red right, a rotation of the standard cube; 49 stickers per home face", () => {
  assert.equal(HOME_ORIENTATION["0,0,1"], "white");
  assert.equal(HOME_ORIENTATION["1,0,0"], "red");
  const opposite = { white: "yellow", red: "orange", blue: "green" };
  for (const [k, f] of Object.entries(HOME_ORIENTATION)) {
    const back = HOME_ORIENTATION[k.split(",").map((v) => -v).join(",")];
    assert.ok(opposite[f] === back || opposite[back] === f, `${f} opposite ${back}`);
  }
  // Standard scheme (white up, green front, red right) turned by a proper rotation gives this orientation: the signed
  // permutation that maps the standard normals onto ours has determinant +1.
  const std = { "0,1,0": "white", "0,0,1": "green", "1,0,0": "red", "0,0,-1": "blue", "-1,0,0": "orange", "0,-1,0": "yellow" };
  const ours = Object.fromEntries(Object.entries(HOME_ORIENTATION).map(([k, v]) => [v, k.split(",").map(Number)]));
  const col = (n) => ours[std[n]];
  const [x, y, z] = ["1,0,0", "0,1,0", "0,0,1"].map(col);
  const det = x[0] * (y[1] * z[2] - y[2] * z[1]) - x[1] * (y[0] * z[2] - y[2] * z[0]) + x[2] * (y[0] * z[1] - y[1] * z[0]);
  assert.equal(det, 1);
  const { pose } = layoutFixture();
  const homes = homeFacesOf(pose);
  assert.equal(homes.length, 294);
  for (const f of FACES) assert.equal(homes.filter((h) => h === f).length, 49, f);
  assert.equal(homeFaceOfNormal([0, 0, 1]), "white");
});

test("schemeForHome: the ground is the tint of the home face, the print stays black, the band stays black", () => {
  const s = withBannerStyle(scheme(), "theme");
  assert.equal(usesHomeTints(s), true);
  assert.equal(usesHomeTints(schemeById("paper-red")), false);
  assert.equal(schemeForHome(schemeById("paper-red"), "red"), schemeById("paper-red"));
  assert.equal(schemeForHome(s, undefined), s);
  for (const f of FACES) {
    const d = schemeForHome(s, f);
    const ground = namesGround(RUBIK_TINTS[f]);
    const cases = [["7", "dark"], ["SUN", "red"], ["23/30", "red"], ["MON", "weekday"], ["", "blank"]];
    for (const [text, ink] of cases) {
      const r = tileRoles(d, text, ink, "names");
      assert.equal(r.fill, ground, `${f} ${text}`);
      assert.equal(r.ink, PRINT, `${f} ${text}`);
      assert.equal(r.inkSmall, PRINT, `${f} ${text}`);
    }
    for (const [text, ink] of [["MAY", "month"], ["", "band"]]) {
      const r = tileRoles(d, text, ink, "names");
      assert.equal(r.fill, BAND, `${f} ${text}`);
      assert.equal(r.ink, BAND_INK, `${f} ${text}`);
      assert.equal(r.banner.style, "rounded");
    }
  }
});

test("solved pose: every non-banner front tile of the fill map is the white tint; the other faces carry their own tint", () => {
  const { printing, pose } = layoutFixture();
  const homes = homeFacesOf(pose);
  const fills = faceFillsByHome(printing, withBannerStyle(scheme(), "theme"), "names", homes);
  assert.equal(fills.size, 294);
  for (let i = 0; i < 294; i++) {
    const banner = printing.ink[i] === "month";
    const want = banner ? BAND : namesGround(RUBIK_TINTS[homes[i]]);
    assert.equal(fills.get(i + 1), want, `sticker ${i + 1} ${homes[i]}`);
    if (homes[i] === "white" && !banner) assert.equal(fills.get(i + 1), namesGround("#ffffff"));
  }
  assert.equal(new Set([...fills.values()]).size, 7);
});
