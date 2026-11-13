// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 "Names layout" app mode (research candidate, not certified): URL parameter, lazy loading, fallback outside the
// window May 2026 to January 2028, the tile class `band` in every scheme, the 3-slot grid of the name tiles, and the
// mode switch of the mount (fake DOM, fake stage; no WebGL, no browser, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAYOUT_PARAM, NAME_SLOTS, NAME_WORDS, nameAlign, nameSlotStart, parseLayout } from "../src/apps/calendar7/layout.ts";
import { SCHEMES, namesGround } from "../src/apps/calendar7/schemes.ts";
import { FACE_FLAT, LINE_SCALE, NAMES_LINE_FACTOR, NAME_FONT_SIZE, namePxPerUnit, TEXTURE, TEXT_SQUARE, drawFace, drawSticker, nameGrid, tileClass, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
import { parseDisplays, parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { drawFontSticker, nameLabelLayout } from "../src/apps/calendar7/font-art.ts";
import { PLASTICITY_PARAM, mountCalendar7 } from "../src/apps/calendar7/mount.ts";
import { DEFAULT_PLASTICITY } from "../src/apps/calendar7/names-plasticity.ts";
import { href } from "../src/apps/calendar7/month-view.ts";
import { clonePose } from "../src/apps/calendar7/engine.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const names = { graph: parseGraph(json("public/calendar7/names/graph.v1.json")), table: parseDisplays(json("public/calendar7/names/displays.v1.json")), state: parseState(json("public/calendar7/names/state.v1.json")) };
const std = { graph: parseGraph(json("public/calendar7/graph.v1.json")) };

// ---- URL parameter ----
test("layout parameter: names selects the names layout, everything else gives the standard layout", () => {
  assert.equal(LAYOUT_PARAM, "layout");
  assert.equal(parseLayout("names"), "names");
  for (const bad of [null, undefined, "", "standard", "Names", "NAMES", "names ", "name", "x", "__proto__", "1"]) assert.equal(parseLayout(bad), "standard", String(bad));
});

// ---- the name table ----
test("the name words match the row 1 of the window data and name alignment is consistent per label", () => {
  assert.equal(NAME_SLOTS, 3);
  const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  assert.equal(NAME_WORDS.length, 12);
  NAME_WORDS.forEach((w, i) => assert.equal(w.join(""), MONTHS[i]));
  // The data has each month's tiles in columns 1 to 3 (ink month), then band.
  for (const d of names.table.displays) {
    const row1 = d.cells.slice(0, 7);
    const tiles = row1.filter((c) => c.ink === "month").map((c) => c.text);
    assert.deepEqual(tiles, NAME_WORDS[d.month - 1], `month ${d.month}`);
    assert.ok(row1.slice(tiles.length).every((c) => c.ink === "band" && c.text === ""), `month ${d.month} band tail`);
  }
  // First tiles of multi-tile words are right-flush, last tiles left-flush; a full tile is full.
  assert.equal(nameAlign("J"), "right");
  assert.equal(nameAlign("FE"), "right");
  assert.equal(nameAlign("MA"), "right");
  assert.equal(nameAlign("OC"), "right");
  assert.equal(nameAlign("ER"), "left");
  assert.equal(nameAlign("AP"), "right"); // April is "AP" + "RIL" (owner decision of 2026-11-11)
  assert.equal(nameAlign("Y"), "left");
  for (const full of ["ANU", "ARY", "BRU", "RCH", "RIL", "UNE", "ULY", "AUG", "UST", "SEP", "TEM", "BER", "TOB", "NOV", "EMB", "DEC"]) assert.equal(nameAlign(full), "full", full);
  assert.equal(nameAlign("QQ"), "center"); // not a name tile: unchanged centered look
  assert.equal(nameSlotStart("J"), 2);
  assert.equal(nameSlotStart("FE"), 1);
  assert.equal(nameSlotStart("Y"), 0);
  assert.equal(nameSlotStart("ER"), 0);
  assert.equal(nameSlotStart("ANU"), 0);
});

// ---- tile classes ----
test("band is its own class: empty text with ink band; blank stays the empty days", () => {
  assert.equal(tileClass("", "band"), "band");
  assert.equal(tileClass("", "blank"), "blank");
  assert.equal(tileClass("", "dark"), "blank"); // unchanged: empty text without band ink
  assert.equal(tileClass("J", "month"), "month");
});

test("the class counts of the window print are band 12, month 24, blank 32 and travel with the sticker id", () => {
  const { text, ink } = names.state.printing;
  const count = {};
  for (let i = 0; i < text.length; i++) count[tileClass(text[i], ink[i])] = (count[tileClass(text[i], ink[i])] ?? 0) + 1;
  assert.equal(count.band, 12);
  assert.equal(count.month, 24);
  assert.equal(count.blank, 32);
  // Class is a function of (text, ink) only: moving a sticker (any pose) never changes it.
  assert.equal(tileClass.length, 2);
});

for (const scheme of SCHEMES) {
  test(`${scheme.id}: band shares the month band fill and the row 1 line; blank keeps the empty fill; standard layout keeps lineRow1 off`, () => {
    const band = tileRoles(scheme, "", "band", "names");
    const month = tileRoles(scheme, "J", "month", "names");
    const blank = tileRoles(scheme, "", "blank", "names");
    const fill = namesGround(scheme.bandFill ?? scheme.dayFill);
    assert.equal(band.cls, "band");
    assert.equal(band.fill, fill);
    assert.equal(month.fill, fill);
    assert.equal(month.ink, scheme.monthInk);
    assert.deepEqual(band.line, scheme.lineRow1);
    assert.deepEqual(month.line, scheme.lineRow1);
    assert.equal(blank.fill, namesGround(scheme.emptyFill));
    assert.equal(blank.line, null);
    assert.notDeepEqual([band.fill, band.line], [blank.fill, blank.line], "band differs from blank in fill or line");
    // Weekday line is a property of the weekday tile classes in both layouts.
    for (const [t, k] of [["MON", "weekday"], ["SUN", "red"], ["SAT", "red"]]) {
      assert.deepEqual(tileRoles(scheme, t, k, "names").line, scheme.lineRow2);
      assert.deepEqual(tileRoles(scheme, t, k).line, scheme.lineRow2);
    }
    for (const [t, k] of [["7", "dark"], ["28", "red"], ["23/30", "red"]]) assert.equal(tileRoles(scheme, t, k, "names").line, null);
    // Standard layout: month tile as shipped (no line), band never carries a line.
    assert.equal(tileRoles(scheme, "J", "month").line, null);
    assert.equal(tileRoles(scheme, "", "band").line, null);
  });
}

// ---- drawing ----
function record(draw) {
  const log = [];
  const state = { font: "", align: "" };
  const ctx = {
    set fillStyle(v) { log.push(["fillStyle", v]); },
    get fillStyle() { return [...log].reverse().find((e) => e[0] === "fillStyle")?.[1]; },
    set font(v) { state.font = v; },
    get font() { return state.font; },
    set textAlign(v) { state.align = v; },
    set textBaseline(v) {},
    fillRect(...a) { log.push(["fillRect", ctx.fillStyle, ...a]); },
    fillText(t, x, y) { log.push(["fillText", ctx.fillStyle, t, x, y, state.align, state.font]); },
    measureText: (t) => ({ width: Number(state.font.match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
    save() {}, restore() {}, translate() {}, scale() {},
  };
  draw(ctx);
  return log;
}
const rects = (log) => log.filter((e) => e[0] === "fillRect");
const texts = (log) => log.filter((e) => e[0] === "fillText");

for (const scheme of SCHEMES) {
  test(`${scheme.id}: a band tile draws its ground, no text and the row 1 line; a blank tile never does`, () => {
    for (const [name, draw] of [["sticker", (c) => drawSticker(c, "", "band", "strict", scheme, "names")], ["face", (c) => drawFace(c, "", "band", "strict", scheme, "names")]]) {
      const log = record(draw);
      assert.deepEqual(log[0], ["fillStyle", namesGround(scheme.bandFill ?? scheme.dayFill)], `${name} ground`);
      assert.equal(texts(log).length, 0);
      const last = rects(log).at(-1);
      if (scheme.lineRow1) {
        const h = scheme.lineRow1.px * LINE_SCALE * (name === "sticker" ? 1 : NAMES_LINE_FACTOR); // the sheet keeps its thickness
        assert.equal(last[1], scheme.lineRow1.color, `${name} line color`);
        assert.equal(last[5], h);
        assert.deepEqual(last.slice(2, 5), [0, name === "sticker" ? TEXTURE - h : TEXTURE * ((1 + FACE_FLAT) / 2) - h, TEXTURE], `${name} full width`);
      } else assert.ok(rects(log).every((e) => e[1] === namesGround(scheme.bandFill ?? scheme.dayFill)), `${name} only the ground`);
    }
    const blank = record((c) => drawFace(c, "", "blank", "strict", scheme, "names"));
    assert.deepEqual(blank[0], ["fillStyle", namesGround(scheme.emptyFill)]);
    assert.ok(rects(blank).every((e) => e[1] === namesGround(scheme.emptyFill)));
    // The standard layout draws exactly what it drew before.
    assert.deepEqual(record((c) => drawSticker(c, "J", "month", "strict", scheme)), record((c) => drawSticker(c, "J", "month", "strict", scheme, "standard")));
  });
}

test("name tiles use one monospaced 3-slot grid (thirds of the cubie pitch): right-flush first tile, left-flush last tile, full middle, centered otherwise", () => {
  const slot = TEXT_SQUARE / NAME_SLOTS;
  const atFace = (k) => TEXTURE / 2 + ((k + 0.5) / NAME_SLOTS - 0.5) * namePxPerUnit();
  const atSheet = (k) => TEXTURE / 2 - TEXT_SQUARE / 2 + (k + 0.5) * slot; // the 2D sheet (sticker surface) keeps the 3-slot text square
  const cases = { J: [2], FE: [1, 2], MA: [1, 2], OC: [1, 2], ANU: [0, 1, 2], ER: [0, 1], AP: [1, 2], RIL: [0, 1, 2], Y: [0], BER: [0, 1, 2] };
  for (const [label, slots] of Object.entries(cases)) {
    const grid = nameGrid(label);
    assert.deepEqual(grid.map((g) => g.char), label.split(""), label);
    assert.deepEqual(grid.map((g) => g.x), slots.map(atFace), label);
    assert.ok(grid.every((g) => g.size === NAME_FONT_SIZE), "one size for every name tile");
  }
  // The same grid is what the sticker draws: size and x of each letter.
  const log = record((c) => drawSticker(c, "FE", "month", "strict", SCHEMES[0], "names"));
  assert.deepEqual(texts(log).map((e) => [e[2], e[3]]), [["F", atSheet(1)], ["E", atSheet(2)]]);
  assert.ok(texts(log).every((e) => e[6].includes(`${NAME_FONT_SIZE}px`) && e[5] === "center"));
  // Standard layout: the label is one centered run.
  const std1 = texts(record((c) => drawSticker(c, "FE", "month", "strict", SCHEMES[0])));
  assert.deepEqual(std1.map((e) => e[2]), ["FE"]);
  // A letter of any slot fits its slot (monospaced cell is at least as wide as the widest capital at this size).
  assert.ok(NAME_FONT_SIZE * 0.95 <= slot, "M and W fit a slot");
});

// ---- canonical one-print mount (replaces the retired layout switch contract) ----
import { fakeRoot, setup, settle } from "./helpers/calendar7-mount.mjs";
const canonicalStart = parseState(json("public/calendar7/chain-c/state.v1.json"));
const canonicalGraph = parseGraph(json("public/calendar7/chain-c/graph.v1.json"));
const q = s => new URLSearchParams(s);
/** Node of March 2027 in the chain C graph (January 1980 is node 0). */
const MAR_2027 = (2027 - 1980) * 12 + 2;
const flushed = async()=>{for(let i=0;i<200;i++)await Promise.resolve();};

test("all former layout parameters select one names print without a layout control",async()=>{
 for(const layout of ["standard","names","names-demo","names-any","bogus"]){const root=fakeRoot(),{env,stage}=setup();const i=await mountCalendar7(root,q("year=2027&month=3&layout="+layout),env);await settle(root,"2027-03");assert.equal(stage.configs[0].layout,"names");assert.deepEqual([...stage.configs[0].printing.text],[...canonicalStart.printing.text]);assert.doesNotMatch(root.html,/Cube layout/);i.dispose();}
});
test("the plasticity URL parameter reaches the stage (absent or invalid: default, clamped to 0..1)",async()=>{
 for(const [input,want]of [["",DEFAULT_PLASTICITY],["&plasticity=0",0],["&plasticity=1",1],["&plasticity=2",1],["&plasticity=-1",0],["&plasticity=bad",DEFAULT_PLASTICITY]]){const root=fakeRoot(),{env,stage}=setup();stage.setPlasticity=v=>{stage.plasticity=v;};const i=await mountCalendar7(root,q("year=2027&month=3"+input),env);await settle(root,"2027-03");assert.equal(stage.plasticity,want);i.dispose();}
});
test("a chain month loads exactly the four canonical files once and shows the stored full-state digest",async()=>{const root=fakeRoot(),{env,calls}=setup();const i=await mountCalendar7(root,q("year=2027&month=3"),env);await settle(root,"2027-03");assert.equal(calls.fetched.length,4);assert.ok(calls.fetched.every(u=>u.includes("/chain-c/")));assert.equal(root.getAttribute("data-c7-digest"),canonicalGraph.nodes[MAR_2027].hash);i.dispose();});
test("outside the window the same print shows a display-only board; the notice goes away on returning",async()=>{const root=fakeRoot(),{env,stage}=setup();const i=await mountCalendar7(root,q("year=2037&month=2"),env);await settle(root,"2037-02");assert.equal(root.getAttribute("data-c7-any"),"best-effort");assert.equal(root.el("layout-notice").hidden,false);root.date(2027,3);await settle(root,"2027-03");assert.equal(root.el("layout-notice").hidden,true);assert.ok(stage.configs.every(c=>c.printing===stage.configs[0].printing));i.dispose();});
test("today outside the chain stays today's date with a display-only preview",async()=>{const root=fakeRoot(),{env}=setup({now:new Date(2040,4,10)});const i=await mountCalendar7(root,q(""),env);await settle(root,"2040-05");assert.equal(root.el("player").hidden,true);assert.match(root.view.innerHTML,/May 2040/);i.dispose();});
test("a failed canonical download cannot substitute an unrelated print",async()=>{const root=fakeRoot(),{env,calls}=setup({fail:true});await assert.rejects(mountCalendar7(root,q(""),env),/HTTP 404/);assert.ok(calls.fetched.every(u=>u.includes("/chain-c/")));});
test("instant date changes preserve font, scheme and unrelated URL parameters without exposing old modes",async()=>{const root=fakeRoot(),{env}=setup({search:"?app=calendar7&scheme=dracula&font=nunito&extra=keep"});const i=await mountCalendar7(root,q("year=2027&month=3"),env);await settle(root,"2027-03");root.date(2026,2);await settle(root,"2026-02");const p=q(env.search());for(const[k,v]of[["scheme","dracula"],["font","nunito"],["extra","keep"],["year","2026"],["month","2"]])assert.equal(p.get(k),v);assert.equal(p.has("layout"),false);i.dispose();});
test("a retired layout control event cannot select an old print",async()=>{const root=fakeRoot(),{env,stage}=setup();const i=await mountCalendar7(root,q("year=2027&month=3"),env);await settle(root,"2027-03");root.choose("layout","standard");await flushed();assert.equal(stage.configs.length,1);assert.equal(root.getAttribute("data-c7-layout"),"names");i.dispose();});
test("a preview-to-chain date change restores playback with the same printing",async()=>{const root=fakeRoot(),{env,stage}=setup();const i=await mountCalendar7(root,q("year=2040&month=2"),env);await settle(root,"2040-02");root.date(2027,3);await settle(root,"2027-03");assert.equal(root.getAttribute("data-c7-digest"),canonicalGraph.nodes[MAR_2027].hash);assert.equal(root.el("player").hidden,false);assert.ok(stage.configs.every(c=>c.printing===stage.configs[0].printing));i.dispose();});
test("lower chain boundary January 1980 has no previous step and no display-only notice",async()=>{const root=fakeRoot(),{env}=setup();const i=await mountCalendar7(root,q("year=1980&month=1"),env);await settle(root,"1980-01");assert.equal(root.el("layout-notice").hidden,true);assert.match(root.view.innerHTML,/No earlier month: January 1980/);i.dispose();});
test("invalid URL dates build no cube and keep the instant date form available",async()=>{for(const query of["year=x&month=1","year=0&month=5","year=2026&month=13"]){const root=fakeRoot(),{env,stage}=setup();const i=await mountCalendar7(root,q(query),env);await flushed();assert.equal(stage.configs.length,0);assert.match(root.view.innerHTML,/Invalid month/);assert.match(root.html,/data-c7-month-picker/);assert.doesNotMatch(root.view.innerHTML,/data-c7-date-form/);assert.doesNotMatch(root.view.innerHTML,/>Show</);i.dispose();}});

// ---- the font path of the name tiles (what the app draws) ----
const glyph = { advance: 0.7, left: 0.05, right: 0.65, top: -0.72, bottom: 0 };
const fakeFont = { style: { master: "0" }, glyphs: Object.fromEntries([..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((c) => [c, c === "M" || c === "W" ? { ...glyph, advance: 0.95, left: 0.04, right: 0.91 } : glyph])), dateSize: 100 };

test("font path on the sheet: name letters sit on the 3-slot grid, one size for every tile, the same x as the sticker grid", () => {
  const slot = TEXT_SQUARE / NAME_SLOTS;
  const cases = { J: [2], MA: [1, 2], ER: [0, 1], ANU: [0, 1, 2], Y: [0], OC: [1, 2] };
  const sizes = new Set();
  for (const [label, slots] of Object.entries(cases)) {
    const parts = nameLabelLayout(label, fakeFont, "sticker");
    assert.deepEqual(parts.map((p) => p.text), label.split(""), label);
    assert.deepEqual(parts.map((p) => p.x), slots.map((k) => TEXTURE / 2 - TEXT_SQUARE / 2 + (k + 0.5) * slot), label);
    assert.deepEqual(parts.map((p) => p.x), nameGrid(label, false).map((g) => g.x), `${label} same slots as the sticker grid`);
    parts.forEach((p) => sizes.add(p.size));
  }
  assert.equal(sizes.size, 1, "one font size");
  assert.ok([...sizes][0] * 0.91 <= slot, "the widest capital fits a slot");
});
test("font path on the face: one glyph size for every name tile (the layout itself is tests/calendar7-name-layout.test.mjs)", () => {
  const sizes = new Set(["J", "MA", "ER", "ANU", "Y", "OC"].flatMap((label) => nameLabelLayout(label, fakeFont).map((p) => p.size)));
  assert.equal(sizes.size, 1);
});

/** Records the letters drawFontSticker draws: text and the x of the translate in effect (drawFontRun translates to the run). */
function recordFont(text, ink, layout, surface = "sticker") {
  const stack = [], runs = [];
  let tx = 0, tr = 0;
  const ctx = {
    set fillStyle(v) {}, set font(v) {}, set fontKerning(v) {}, set textAlign(v) {}, set textBaseline(v) {},
    fillRect() {},
    save() { stack.push([tx, tr]); }, restore() { [tx, tr] = stack.pop(); },
    translate(x) { tx += x; }, rotate() {}, scale() {},
    fillText(t) { runs.push([t, tx]); },
  };
  drawFontSticker(ctx, text, ink, fakeFont, SCHEMES[0], surface, undefined, layout);
  return runs;
}

test("font path: drawFontSticker draws a name tile as one run per letter at the slot x, and any other label as before", () => {
  const at = (k) => TEXTURE / 2 - TEXT_SQUARE / 2 + (k + 0.5) * (TEXT_SQUARE / NAME_SLOTS); // recordFont draws on the sticker surface (the 2D sheet): as before
  const close = (runs, want) => { assert.equal(runs.length, want.length); runs.forEach((r, i) => { assert.equal(r[0], want[i][0]); assert.ok(Math.abs(r[1] - want[i][1]) < 1e-9, `${r[0]} x ${r[1]} want ${want[i][1]}`); }); };
  close(recordFont("MA", "month", "names"), [["M", at(1)], ["A", at(2)]]);
  close(recordFont("ER", "month", "names"), [["E", at(0)], ["R", at(1)]]);
  close(recordFont("J", "month", "names"), [["J", at(2)]]);
  // Not a name tile: the standard label drawing (one centered run), also for a month tile in the standard layout.
  assert.equal(recordFont("MA", "month", "standard").length, 2);
  const standardX = recordFont("MA", "month", "standard").map((r) => r[1]);
  assert.notDeepEqual(standardX, [at(1), at(2)]);
  const digits = recordFont("28", "red", "names");
  assert.deepEqual(digits.map((r) => r[0]), ["2", "8"]);
  assert.deepEqual(digits.map((r) => r[1]), recordFont("28", "red", "standard").map((r) => r[1]));
  assert.deepEqual(recordFont("MON", "weekday", "names").map((r) => r[1]), recordFont("MON", "weekday", "standard").map((r) => r[1]));
});
