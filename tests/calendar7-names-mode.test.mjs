// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 "Names layout" app mode (research candidate, not certified): URL parameter, lazy loading, fallback outside the
// window May 2026 to January 2028, the tile class `band` in every scheme, the 3-slot grid of the name tiles, and the
// mode switch of the mount (fake DOM, fake stage; no WebGL, no browser, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAYOUT_PARAM, NAME_SLOTS, NAME_WORDS, NAMES_NOTICE, nameAlign, nameSlotStart, parseLayout } from "../src/apps/calendar7/layout.ts";
import { SCHEMES } from "../src/apps/calendar7/schemes.ts";
import { FACE_FLAT, LINE_SCALE, NAME_FONT_SIZE, TEXTURE, TEXT_SQUARE, drawFace, drawSticker, nameGrid, tileClass, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
import { parseDisplays, parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { nameLabelLayout } from "../src/apps/calendar7/font-art.ts";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";
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
  assert.equal(nameAlign("IL"), "left");
  assert.equal(nameAlign("Y"), "left");
  for (const full of ["ANU", "ARY", "BRU", "RCH", "APR", "UNE", "ULY", "AUG", "UST", "SEP", "TEM", "BER", "TOB", "NOV", "EMB", "DEC"]) assert.equal(nameAlign(full), "full", full);
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
    const fill = scheme.bandFill ?? scheme.dayFill;
    assert.equal(band.cls, "band");
    assert.equal(band.fill, fill);
    assert.equal(month.fill, fill);
    assert.equal(month.ink, scheme.monthInk);
    assert.deepEqual(band.line, scheme.lineRow1);
    assert.deepEqual(month.line, scheme.lineRow1);
    assert.equal(blank.fill, scheme.emptyFill);
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
      assert.deepEqual(log[0], ["fillStyle", scheme.bandFill ?? scheme.dayFill], `${name} ground`);
      assert.equal(texts(log).length, 0);
      const last = rects(log).at(-1);
      if (scheme.lineRow1) {
        const h = scheme.lineRow1.px * LINE_SCALE;
        assert.equal(last[1], scheme.lineRow1.color, `${name} line color`);
        assert.equal(last[5], h);
        if (name === "sticker") assert.deepEqual(last.slice(2), [0, TEXTURE - h, TEXTURE, h]);
        else assert.ok(Math.abs(last[3] + last[5] - TEXTURE * ((1 + FACE_FLAT) / 2)) < 1e-9);
      } else assert.ok(rects(log).every((e) => e[1] === (scheme.bandFill ?? scheme.dayFill)), `${name} only the ground`);
    }
    const blank = record((c) => drawFace(c, "", "blank", "strict", scheme, "names"));
    assert.deepEqual(blank[0], ["fillStyle", scheme.emptyFill]);
    assert.ok(rects(blank).every((e) => e[1] === scheme.emptyFill));
    // The standard layout draws exactly what it drew before.
    assert.deepEqual(record((c) => drawSticker(c, "J", "month", "strict", scheme)), record((c) => drawSticker(c, "J", "month", "strict", scheme, "standard")));
  });
}

test("name tiles use one monospaced 3-slot grid: right-flush first tile, left-flush last tile, full middle, centered otherwise", () => {
  const slot = TEXT_SQUARE / NAME_SLOTS;
  const left = TEXTURE / 2 - TEXT_SQUARE / 2;
  const at = (k) => left + (k + 0.5) * slot;
  const cases = { J: [2], FE: [1, 2], MA: [1, 2], OC: [1, 2], ANU: [0, 1, 2], ER: [0, 1], IL: [0, 1], Y: [0], BER: [0, 1, 2] };
  for (const [label, slots] of Object.entries(cases)) {
    const grid = nameGrid(label);
    assert.deepEqual(grid.map((g) => g.char), label.split(""), label);
    assert.deepEqual(grid.map((g) => g.x), slots.map(at), label);
    assert.ok(grid.every((g) => g.size === NAME_FONT_SIZE), "one size for every name tile");
  }
  // The same grid is what the sticker draws: size and x of each letter.
  const log = record((c) => drawSticker(c, "FE", "month", "strict", SCHEMES[0], "names"));
  assert.deepEqual(texts(log).map((e) => [e[2], e[3]]), [["F", at(1)], ["E", at(2)]]);
  assert.ok(texts(log).every((e) => e[6].includes(`${NAME_FONT_SIZE}px`) && e[5] === "center"));
  // Standard layout: the label is one centered run.
  const std1 = texts(record((c) => drawSticker(c, "FE", "month", "strict", SCHEMES[0])));
  assert.deepEqual(std1.map((e) => e[2]), ["FE"]);
  // A letter of any slot fits its slot (monospaced cell is at least as wide as the widest capital at this size).
  assert.ok(NAME_FONT_SIZE * 0.95 <= slot, "M and W fit a slot");
});

// ---- the mount ----
class El {
  constructor(attrs = {}) { this.attrs = { ...attrs }; this.textContent = ""; this.hidden = false; this.disabled = false; this.value = ""; this.innerHTML = ""; this.focused = 0; }
  querySelector() { return { focus: () => this.focused++ }; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "hidden") this.hidden = true; if (k === "disabled") this.disabled = true; }
  removeAttribute(k) { delete this.attrs[k]; if (k === "hidden") this.hidden = false; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  focus() { this.focused++; }
}
function fakeRoot() {
  const listeners = { click: new Set(), change: new Set() };
  const els = new Map();
  const view = new El();
  const live = new El();
  const get = (name) => { if (!els.has(name)) els.set(name, new El({ "data-c7": name })); return els.get(name); };
  return {
    attrs: {},
    set innerHTML(html) { this.html = html; },
    querySelector(sel) {
      if (sel === ".c7-view") return view;
      if (sel === ".c7-live") return live;
      const m = sel.match(/^\[data-c7="([a-z-]+)"\]$/);
      return m ? get(m[1]) : null;
    },
    contains: () => true,
    addEventListener: (t, l) => listeners[t].add(l),
    removeEventListener: (t, l) => listeners[t].delete(l),
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    view, live, el: get, listeners,
    clickLink(h) {
      let prevented = false;
      const a = { getAttribute: () => h };
      for (const l of [...listeners.click]) l({ target: { closest: (s) => (s === "a.c7-nav" ? a : null) }, preventDefault: () => (prevented = true) });
      return prevented;
    },
    choose(name, value) {
      const el = get(name);
      el.value = value;
      for (const l of [...listeners.change]) l({ type: "change", target: { closest: (s) => (s === "a.c7-nav" ? null : el) } });
    },
  };
}
function fakeStage() {
  const stage = {
    configs: [], shows: 0, turns: 0, destroyed: 0, labels: [],
    show() { stage.shows++; },
    turn() { stage.turns++; return Promise.resolve(); },
    setScheme() {},
    configure(printing, pose, surface, layout) { stage.configs.push({ printing, pose: clonePose(pose), surface, layout }); },
    setLabel: (t) => stage.labels.push(t),
    resetView() {}, destroy: () => stage.destroyed++,
  };
  return stage;
}
const q = (s) => new URLSearchParams(s);
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const settle = async (root, want) => {
  for (let i = 0; i < 200000; i++) {
    if (root.getAttribute("data-c7-state") === "idle" && (!want || root.getAttribute("data-c7-month") === want)) return;
    await Promise.resolve();
  }
  throw new Error(`not idle at ${want}: ${root.getAttribute("data-c7-state")} ${root.getAttribute("data-c7-month")}`);
};
function setup({ search = "?app=calendar7&year=2027&month=3", fail = false, now = new Date(2026, 10, 10) } = {}) {
  const stage = fakeStage();
  const host = { hidden: false };
  const calls = { fetched: [], query: [] };
  const env = {
    base: "/",
    fetchJson: async (url) => {
      calls.fetched.push(url);
      if (fail && url.includes("/names/")) throw new Error("HTTP 404");
      const dir = url.includes("/names/") ? "public/calendar7/names/" : "public/calendar7/";
      return json(dir + url.split("/").pop());
    },
    now: () => now,
    search: () => search,
    replaceQuery: (s) => calls.query.push(s),
    isCurrent: () => true,
    sceneHost: () => host,
    createStage: async () => stage,
    reducedMotion: () => false,
  };
  return { env, stage, calls };
}
const namesFetches = (calls) => calls.fetched.filter((u) => u.includes("/names/"));
const notice = (root) => root.el("layout-notice");
const NOTICE = "The names layout covers May 2026 to January 2028. Showing the standard layout.";

test("the notice text is the owner's sentence", () => {
  assert.equal(NAMES_NOTICE, NOTICE);
});

test("standard mode (default, unknown value) never fetches the names files and uses the shipped print", async () => {
  for (const search of ["year=2027&month=3", "year=2027&month=3&layout=standard", "year=2027&month=3&layout=bogus"]) {
    const root = fakeRoot();
    const { env, stage, calls } = setup();
    const inst = await mountCalendar7(root, q(search), env);
    await settle(root, "2027-03");
    assert.equal(namesFetches(calls).length, 0, search);
    assert.equal(stage.configs.length, 1);
    assert.equal(stage.configs[0].layout, "standard");
    assert.equal(root.getAttribute("data-c7-layout"), "standard");
    assert.equal(notice(root).hidden, true);
    inst.dispose();
  }
});

test("names mode inside the window loads the three names files once and builds the cube from the names state", async () => {
  const root = fakeRoot();
  const { env, stage, calls } = setup();
  const inst = await mountCalendar7(root, q("year=2027&month=3&layout=names"), env);
  await settle(root, "2027-03");
  assert.deepEqual(namesFetches(calls).map((u) => u.split("/").pop()).sort(), ["displays.v1.json", "graph.v1.json", "state.v1.json"]);
  assert.equal(stage.configs.length, 1, "no standard cube is built first");
  assert.equal(stage.configs[0].layout, "names");
  assert.deepEqual([...stage.configs[0].printing.text], [...names.state.printing.text]);
  assert.equal(root.getAttribute("data-c7-layout"), "names");
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[10].hash); // March 2027 is node 10 of 21
  assert.equal(notice(root).hidden, true);
  assert.match(root.view.innerHTML, /Names layout window: May 2026 to January 2028, 20 steps\. Research candidate, not certified/);
  inst.dispose();
});

test("names mode outside the window shows the notice and the standard layout without error; the notice goes away inside", async () => {
  for (const ym of ["2030&month=5", "2026&month=4", "2028&month=2", "2099&month=12"]) {
    const root = fakeRoot();
    const { env, stage } = setup();
    const inst = await mountCalendar7(root, q(`year=${ym}&layout=names`), env);
    const month = ym.replace("&month=", "-").replace(/-(\d)$/, "-0$1");
    if (ym.startsWith("2026&month=4")) { await flush(); assert.equal(notice(root).textContent, NOTICE); assert.equal(notice(root).hidden, false); inst.dispose(); continue; }
    await settle(root, month);
    assert.equal(notice(root).textContent, NOTICE, ym);
    assert.equal(notice(root).hidden, false);
    assert.equal(stage.configs.at(-1).layout, "standard", ym);
    assert.equal(root.getAttribute("data-c7-layout"), "standard");
    assert.equal(root.getAttribute("data-c7-layout-mode"), "names");
    assert.equal(root.getAttribute("data-c7-digest"), std.graph.nodes[(Number(ym.slice(0, 4)) - 2026) * 12 + Number(ym.split("=")[1]) - 5].hash);
    inst.dispose();
  }
});

test("today outside the window: the selected month is today's month; names mode falls back with the notice", async () => {
  const root = fakeRoot();
  const { env, stage } = setup({ now: new Date(2030, 6, 1) });
  const inst = await mountCalendar7(root, q("layout=names"), env);
  await settle(root, "2030-07");
  assert.equal(notice(root).textContent, NOTICE);
  assert.equal(stage.configs[0].layout, "standard");
  inst.dispose();
  const r2 = fakeRoot();
  const second = setup({ now: new Date(2026, 10, 10) });
  const i2 = await mountCalendar7(r2, q("layout=names"), second.env);
  await settle(r2, "2026-11");
  assert.equal(notice(r2).hidden, true);
  assert.equal(second.stage.configs[0].layout, "names");
  i2.dispose();
});

test("a failed names download falls back to the standard layout with a notice and no thrown error", async () => {
  const root = fakeRoot();
  const { env, stage } = setup({ fail: true });
  const inst = await mountCalendar7(root, q("year=2027&month=3&layout=names"), env);
  await settle(root, "2027-03");
  assert.equal(notice(root).hidden, false);
  assert.match(notice(root).textContent, /^The names layout data could not be loaded\. Showing the standard layout\.$/);
  assert.equal(stage.configs[0].layout, "standard");
  assert.notEqual(root.getAttribute("data-c7-state"), "failed");
  inst.dispose();
});

test("mode switch rebuilds the cube from the new print at the displayed month, both ways, and writes only layout to the URL", async () => {
  const root = fakeRoot();
  const { env, stage, calls } = setup({ search: "?app=calendar7&year=2027&month=3&scheme=dracula&extra=keep" });
  const inst = await mountCalendar7(root, q("year=2027&month=3&scheme=dracula"), env);
  await settle(root, "2027-03");
  assert.equal(root.getAttribute("data-c7-digest"), std.graph.nodes[(2027 - 2026) * 12 + 3 - 5].hash);
  assert.equal(namesFetches(calls).length, 0);
  root.choose("layout", "names");
  await flush();
  await settle(root, "2027-03");
  assert.equal(namesFetches(calls).length, 3);
  assert.equal(stage.configs.length, 2);
  assert.equal(stage.configs[1].layout, "names");
  assert.deepEqual([...stage.configs[1].printing.text], [...names.state.printing.text]);
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[10].hash);
  assert.equal(root.getAttribute("data-c7-layout"), "names");
  const last = new URLSearchParams(calls.query.at(-1));
  assert.equal(last.get("layout"), "names");
  assert.equal(last.get("year"), "2027");
  assert.equal(last.get("extra"), "keep");
  assert.equal(last.get("scheme"), "dracula");
  root.choose("layout", "standard");
  await flush();
  await settle(root, "2027-03");
  assert.equal(stage.configs.length, 3);
  assert.equal(stage.configs[2].layout, "standard");
  assert.deepEqual([...stage.configs[2].printing.text], [...parseState(json("public/calendar7/state.v1.json")).printing.text]);
  assert.equal(root.getAttribute("data-c7-digest"), std.graph.nodes[(2027 - 2026) * 12 + 3 - 5].hash);
  assert.equal(namesFetches(calls).length, 3, "the names data is loaded once");
  assert.equal(new URLSearchParams(calls.query.at(-1)).get("layout"), "standard");
  // Back to names: no new download, a rebuild from the names state (no mixing of prints).
  root.choose("layout", "names");
  await flush();
  await settle(root, "2027-03");
  assert.equal(namesFetches(calls).length, 3);
  assert.equal(stage.configs.length, 4);
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[10].hash);
  assert.notEqual(root.getAttribute("data-c7-state"), "failed");
  inst.dispose();
});

test("an unknown value of the layout control is the standard layout", async () => {
  const root = fakeRoot();
  const { env, stage } = setup();
  const inst = await mountCalendar7(root, q("year=2027&month=3&layout=names"), env);
  await settle(root, "2027-03");
  root.choose("layout", "nonsense");
  await flush();
  await settle(root, "2027-03");
  assert.equal(stage.configs.at(-1).layout, "standard");
  inst.dispose();
});

test("stepping from a fallback month into the window switches the print at the new month; the cube is never mixed", async () => {
  const root = fakeRoot();
  const { env, stage } = setup();
  const inst = await mountCalendar7(root, q("year=2028&month=2&layout=names"), env);
  await settle(root, "2028-02");
  assert.equal(notice(root).hidden, false);
  assert.equal(root.clickLink(href({ year: 2028, month: 1 })), true);
  await flush();
  await settle(root, "2028-01");
  assert.equal(stage.configs.at(-1).layout, "names");
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[20].hash);
  assert.equal(notice(root).hidden, true);
  // Inside the window the names chain is used: its step plays the names word (the standard chain has none beyond January 2028 here).
  assert.equal(root.clickLink(href({ year: 2027, month: 12 })), true);
  await flush();
  await settle(root, "2027-12");
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[19].hash);
  inst.dispose();
});

test("lower window edge: May 2026 mounts in the names layout without a notice", async () => {
  const root = fakeRoot();
  const { env, stage } = setup();
  const inst = await mountCalendar7(root, q("year=2026&month=5&layout=names"), env);
  await settle(root, "2026-05");
  assert.equal(notice(root).hidden, true);
  assert.equal(stage.configs.at(-1).layout, "names");
  assert.equal(root.getAttribute("data-c7-layout"), "names");
  assert.equal(root.getAttribute("data-c7-digest"), names.graph.nodes[0].hash);
  inst.dispose();
});

test("an invalid month in names mode shows no notice", async () => {
  for (const search of ["year=2027", "month=5", "year=abc&month=5", "year=2027&month=13"]) {
    const root = fakeRoot();
    const { env } = setup();
    const inst = await mountCalendar7(root, q(`${search}&layout=names`), env);
    await flush();
    assert.equal(notice(root).hidden, true, search);
    assert.equal(notice(root).textContent, "", search);
    assert.match(root.view.innerHTML, /Invalid month/, search);
    inst.dispose();
  }
});

// ---- the font path of the name tiles (what the app draws) ----
const glyph = { advance: 0.7, left: 0.05, right: 0.65, top: -0.72, bottom: 0 };
const fakeFont = { style: { master: "0" }, glyphs: Object.fromEntries([..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((c) => [c, c === "M" || c === "W" ? { ...glyph, advance: 0.95, left: 0.04, right: 0.91 } : glyph])), dateSize: 100 };

test("font path: name letters sit on the 3-slot grid, one size for every tile, the same x as the sticker grid", () => {
  const slot = TEXT_SQUARE / NAME_SLOTS;
  const at = (k) => TEXTURE / 2 - TEXT_SQUARE / 2 + (k + 0.5) * slot;
  const cases = { J: [2], MA: [1, 2], ER: [0, 1], ANU: [0, 1, 2], Y: [0], OC: [1, 2] };
  const sizes = new Set();
  for (const [label, slots] of Object.entries(cases)) {
    const parts = nameLabelLayout(label, fakeFont);
    assert.deepEqual(parts.map((p) => p.text), label.split(""), label);
    assert.deepEqual(parts.map((p) => p.x), slots.map(at), label);
    assert.deepEqual(parts.map((p) => p.x), nameGrid(label).map((g) => g.x), `${label} same slots as the sticker grid`);
    parts.forEach((p) => sizes.add(p.size));
  }
  assert.equal(sizes.size, 1, "one font size");
  const [size] = sizes;
  assert.ok(size * 0.91 <= slot, "the widest capital fits a slot");
  // A single run would have a different x for the second letter.
  const two = nameLabelLayout("MA", fakeFont);
  assert.ok(Math.abs(two[1].x - two[0].x - slot) < 1e-9, "letters are one slot apart");
});
