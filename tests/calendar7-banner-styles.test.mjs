// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMES, namesGround, parseBannerStyle, resolvedBannerStyle, withBannerStyle } from "../src/apps/calendar7/schemes.ts";
import { drawFace, paintTileGround, tileEdgeColors, tileGrid, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
import { contrast } from "./calendar7-contrast.mjs";

const byId = (id) => SCHEMES.find((s) => s.id === id);
const styles = ["rounded", "square", "underline"];
const tile = { w: 1.8, h: 1.8, band: { l: 0.8, r: 0, t: 0.8, b: 0 } };
function record() {
  const log = [];
  const ctx = { fillStyle: "", font: "", textAlign: "", textBaseline: "",
    fillRect(...a) { log.push({ kind: "rect", color: this.fillStyle, a }); },
    beginPath() {}, roundRect(...a) { this.path = a; }, fill() { log.push({ kind: "round", color: this.fillStyle, a: this.path }); },
    save() {}, restore() {}, translate() {}, scale() {},
    fillText(...a) { log.push({ kind: "text", color: this.fillStyle, a }); }, measureText() { return { width: 40 }; },
  };
  return { ctx, log };
}
const groundLog = (scheme, ink = "month") => { const { ctx, log } = record(); paintTileGround(ctx, tileRoles(scheme, ink === "month" ? "NOV" : "", ink, "names"), scheme, tile); return log; };

test("theme selects distinct banner shapes and parser accepts only the four choices", () => {
  assert.equal(resolvedBannerStyle(withBannerStyle(byId("paper-red"), "theme")), "rounded");
  assert.equal(resolvedBannerStyle(withBannerStyle(byId("paper-blue"), "theme")), "square");
  assert.equal(resolvedBannerStyle(withBannerStyle(byId("classic"), "theme")), "underline");
  for (const s of ["theme", ...styles]) assert.equal(parseBannerStyle(s), s);
  for (const s of [null, undefined, "", "SQUARE", "unknown", " rounded "]) assert.equal(parseBannerStyle(s), "theme");
});

test("overrides preserve all frozen theme tokens and theme restores the chosen scheme default", () => {
  for (const base of SCHEMES) for (const style of styles) {
    const before = JSON.stringify(base), s = withBannerStyle(base, style);
    assert.notEqual(s, base);
    assert.equal(resolvedBannerStyle(s), style);
    for (const key of Object.keys(base)) assert.deepEqual(s[key], base[key], `${base.id}/${style}/${key}`);
    assert.equal(JSON.stringify(base), before);
    assert.equal(resolvedBannerStyle(withBannerStyle(s, "theme")), resolvedBannerStyle(base));
    assert.equal(resolvedBannerStyle(withBannerStyle(byId("paper-blue"), style)), style, "manual selection survives changing the theme");
  }
});

test("rounded and square render different corners; Paper Blue retains its blue ink and light ground with an outline", () => {
  for (const id of ["paper-red", "paper-blue"]) {
    const rounded = groundLog(withBannerStyle(byId(id), "rounded"));
    const square = groundLog(withBannerStyle(byId(id), "square"));
    assert.ok(rounded.some((r) => r.kind === "round"), `${id}: curved corners`);
    assert.ok(square.every((r) => r.kind !== "round"), `${id}: straight corners`);
    assert.notDeepEqual(rounded, square);
  }
  const blue = withBannerStyle(byId("paper-blue"), "square"), roles = tileRoles(blue, "NOV", "month", "names"), log = groundLog(blue);
  assert.equal(roles.fill, namesGround(blue.dayFill));
  assert.equal(roles.ink, blue.monthInk);
  assert.ok(log.some((r) => r.color === blue.monthInk), "blue frame is visible");
  assert.equal(log.at(-1).color, namesGround(blue.dayFill), "inside the outline remains light");
});

test("underline removes the filled banner and uses readable existing palette colors for every theme", () => {
  for (const [id, color] of [["paper-red", "#e0282c"], ["paper-blue", "#1558d8"], ["classic", "#8a4a12"]])
    assert.equal(tileRoles(withBannerStyle(byId(id), "underline"), "NOV", "month", "names").ink, color, `${id}: retains the month accent`);
  for (const base of SCHEMES) {
    const scheme = withBannerStyle(base, "underline"), month = tileRoles(scheme, "NOV", "month", "names"), band = tileRoles(scheme, "", "band", "names");
    assert.equal(month.fill, namesGround(base.dayFill));
    assert.ok([base.monthInk, base.bandFill, base.dayInk].includes(month.ink));
    assert.ok(contrast(month.ink, month.fill) >= 4.5, base.id);
    assert.deepEqual(band, { ...month, cls: "band" });
    assert.ok(month.line && contrast(month.line.color, month.fill) >= 3, `${base.id}: orientation line remains`);
    assert.ok(groundLog(scheme).every((r) => r.color === namesGround(base.dayFill)), `${base.id}: no filled band`);
    const { ctx, log } = record(); drawFace(ctx, "", "band", "strict", scheme, "names", tile);
    assert.equal(log.at(-1).color, month.line.color, `${base.id}: blank band keeps its direction marker`);
  }
});

test("all style and theme combinations retain text contrast and leave other tile roles unchanged", () => {
  for (const base of SCHEMES) for (const style of styles) {
    const scheme = withBannerStyle(base, style), roles = tileRoles(scheme, "NOV", "month", "names");
    assert.ok(contrast(roles.ink, roles.fill) >= 4.5, `${base.id}/${style}: month text contrast`);
    for (const [text, ink] of [["MON", "weekday"], ["SUN", "red"], ["18", "dark"], ["6", "red"], ["", "blank"]])
      assert.deepEqual(tileRoles(scheme, text, ink, "names"), tileRoles(base, text, ink, "names"), `${base.id}/${style}: ${text}/${ink}`);
    assert.deepEqual(tileRoles(scheme, "NOV", "month", "standard"), tileRoles(base, "NOV", "month", "standard"), "legacy rendering remains unchanged");
  }
});

function colorAt(edge, t) { return typeof edge === "string" ? edge : (edge.find((s) => t <= s.to + 1e-12) ?? edge.at(-1)).color; }
function drawColorAt(log, x, y) {
  let color;
  for (const r of log) {
    if (r.kind === "text") continue;
    const [x0, y0, w, h, radii = [0, 0, 0, 0]] = r.a;
    if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) continue;
    let inside = true;
    if (r.kind === "round") {
      const corners = [[x0, y0, radii[0], 1, 1], [x0 + w, y0, radii[1], -1, 1], [x0 + w, y0 + h, radii[2], -1, -1], [x0, y0 + h, radii[3], 1, -1]];
      for (const [cx, cy, rad, sx, sy] of corners) {
        if (rad && (x - cx) * sx < rad && (y - cy) * sy < rad && Math.hypot(x - cx - sx * rad, y - cy - sy * rad) > rad) inside = false;
      }
    }
    if (inside) color = r.color;
  }
  return color;
}
test("outline and underline cut-face edge colors equal the actual ground and line drawing", () => {
  for (const base of SCHEMES) for (const style of styles) for (const t of [tile, { w: 1, h: 1.8, band: { l: 0, r: 0, t: 0.8, b: 0 } }, { w: 1.8, h: 1, band: { l: 0.8, r: 0, t: 0, b: 0 } }, { w: 1.2, h: 1, band: { l: 0.2, r: 0, t: 0, b: 0 } }]) {
    const s = withBannerStyle(base, style), roles = tileRoles(s, "", "band", "names"), g = tileGrid(t), { ctx, log } = record();
    drawFace(ctx, "", "band", "strict", s, "names", t);
    const e = tileEdgeColors(roles, namesGround(s.dayFill), t);
    for (let k = 1; k < 100; k++) {
      const fraction = k / 100;
      for (const [side, x, y] of [["left", 0, g.H * (1 - fraction)], ["right", g.W, g.H * (1 - fraction)], ["top", g.W * fraction, 0], ["bottom", g.W * fraction, g.H]])
        assert.equal(colorAt(e[side], fraction), drawColorAt(log, x, y), `${base.id}/${style}/${side}/${fraction}`);
    }
  }
});
