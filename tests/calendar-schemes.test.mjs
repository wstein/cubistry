// SPDX-License-Identifier: AGPL-3.0-or-later
// Screen-only color schemes of the 3x3 calendar: role tokens in stickerArt, fed by the Calendar7 catalog.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDesign } from "../src/apps/calendar/model.ts";
import { stickerArt, stickerSvg, CAL3_SCHEMES, CAL3_EXCLUDED, DEFAULT_CAL3_SCHEME, cal3SchemeById, paintSticker, stickerRole } from "../src/apps/calendar/artwork.ts";
import { mountCalendar } from "../src/apps/calendar/mount.ts";
import { SCHEMES } from "../src/apps/calendar7/schemes.ts";
import { contrast } from "./calendar7-contrast.mjs";

const IDS = ["de-a", "de-a-unpadded", "en-3-zero", "en-3-unpadded"];
const designs = Object.fromEntries(IDS.map((id) => [id, validateDesign(JSON.parse(readFileSync(`public/calendar/${id}.json`, "utf8")))]));

// The artwork of main before this change, copied verbatim as the pin of the default scheme.
const legacy = (s) => {
  const weekend = s.slot === 0 && ["SAT", "SUN"].includes(s.image);
  return {
    weight: weekend ? 800 : 600,
    color: weekend ? "#ba302c" : /^[0-9]$/.test(s.image) ? "#315d4e" : s.slot < 3 ? "#25343e" : "#925a32",
    size: s.image.length === 3 ? 82 : s.image.length === 2 ? 112 : 168,
  };
};

test("default scheme reproduces the current artwork for every sticker of every print", () => {
  assert.equal(DEFAULT_CAL3_SCHEME.id, "default");
  for (const d of Object.values(designs))
    for (const s of d.printing) {
      for (const art of [stickerArt(s), stickerArt(s, DEFAULT_CAL3_SCHEME)]) {
        assert.deepEqual({ weight: art.weight, color: art.color, size: art.size }, legacy(s), `${d.id} ${s.id}`);
        assert.equal(art.ground, "#fffdf6");
      }
    }
});

test("the print export keeps the default artwork: stickerSvg takes no scheme", () => {
  const s = designs["en-3-zero"].printing.find((x) => x.image === "SUN");
  const svg = stickerSvg(s, { 600: "", 800: "" });
  assert.match(svg, /fill="#ba302c"/);
  assert.match(svg, /<rect width="256" height="256" fill="#fffdf6"\/>/);
  assert.equal(stickerSvg.length, 2);
});

test("unknown, null and missing scheme ids give the default; the catalog is the Calendar7 one minus the excluded", () => {
  for (const id of ["nope", "", null, undefined, "__proto__"]) assert.equal(cal3SchemeById(id), DEFAULT_CAL3_SCHEME);
  assert.deepEqual(CAL3_SCHEMES[0], DEFAULT_CAL3_SCHEME);
  const ids = CAL3_SCHEMES.slice(1).map((s) => s.id);
  const excluded = CAL3_EXCLUDED.map((e) => e.id);
  assert.deepEqual([...ids, ...excluded].sort(), SCHEMES.map((s) => s.id).sort());
  for (const e of CAL3_EXCLUDED) assert.ok(e.reason.length > 20, e.id);
  assert.ok(excluded.includes("rubik-tint"), "needs the home faces of the 7x7 names data");
  for (const s of SCHEMES.filter((x) => ids.includes(x.id))) assert.equal(cal3SchemeById(s.id).name, s.name);
});

test("every label class of every 3x3 scheme passes the contrast gates", () => {
  for (const sc of CAL3_SCHEMES.slice(1)) {
    for (const role of ["day", "weekday", "month"]) assert.ok(contrast(sc.roles[role].ink, sc.roles[role].ground) >= 4.5, `${sc.id} ${role} ${contrast(sc.roles[role].ink, sc.roles[role].ground)}`);
    // SAT/SUN and the German S are large bold (82 px and 168 px, weight 800): the 3:1 gate of the Calendar7 weekend labels.
    assert.ok(contrast(sc.roles.weekend.ink, sc.roles.weekend.ground) >= 3, `${sc.id} weekend`);
    assert.equal(sc.roles.weekend.weight, 800);
  }
});

test("month stickers are inverse chips: the scheme's month color as ground with its month ink; day and weekday stay on paper; default unchanged", () => {
  for (const sc of CAL3_SCHEMES.slice(1)) {
    const src = SCHEMES.find((s) => s.id === sc.id);
    assert.equal(sc.roles.month.ground, src.bandFill ?? src.monthInk, sc.id);
    assert.equal(sc.roles.month.ink, src.bandFill ? src.monthInk : src.dayFill, sc.id);
    assert.notEqual(sc.roles.month.ground, sc.roles.weekday.ground, sc.id + " month ground differs from the weekday ground");
    assert.equal(sc.roles.weekday.ground, sc.ground);
    assert.equal(sc.roles.day.ground, sc.ground);
  }
  assert.equal(DEFAULT_CAL3_SCHEME.roles.month.ground, "#fffdf6");
  // EN months are three stickers, DE months one letter each: all month stickers (slot >= 3, not digits) use the chip.
  for (const id of IDS) for (const s of designs[id].printing) {
    const art = stickerArt(s, cal3SchemeById("dracula"));
    assert.equal(art.ground === "#ff79c6", stickerRole(s) === "month", id + " " + s.slot + ":" + s.image);
  }
});

test("German has no weekend-tinted sticker in any scheme: every sticker is its plain weekday, day or month class", () => {
  for (const sc of CAL3_SCHEMES)
    for (const id of ["de-a", "de-a-unpadded"])
      for (const s of designs[id].printing) {
        const art = stickerArt(s, sc);
        const plainRole = /^[0-9]$/.test(s.image) ? "day" : s.slot < 3 ? "weekday" : "month";
        assert.equal(art.color, sc.roles[plainRole].ink, `${sc.id} ${id} ${s.slot}:${s.image}`);
        assert.equal(art.ground, sc.roles[plainRole].ground);
        assert.equal(art.weight, 600);
        assert.equal(stickerRole(s), plainRole);
      }
  assert.equal("scue" in DEFAULT_CAL3_SCHEME.roles, false);
});

test("English: SAT and both SUN use the weekend token; other stickers do not", () => {
  const sc = cal3SchemeById("paper-blue");
  for (const d of [designs["en-3-zero"], designs["en-3-unpadded"]])
    for (const s of d.printing) {
      const weekend = ["SAT", "SUN"].includes(s.image) && s.slot === 0;
      assert.equal(stickerArt(s, sc).ground === sc.roles.weekend.ground && stickerArt(s, sc).color === sc.roles.weekend.ink, weekend, `${s.slot}:${s.image}`);
    }
});

test("paintSticker draws ground then glyph with the scheme tokens, on the given canvas context", () => {
  const calls = [];
  const ctx = new Proxy({}, { set: (_t, k, v) => (calls.push(["set", k, v]), true), get: (_t, k) => (...a) => calls.push([k, ...a]) });
  const s = designs["en-3-zero"].printing.find((x) => x.image === "SUN");
  paintSticker(ctx, s, cal3SchemeById("classic"));
  const sc = cal3SchemeById("classic");
  assert.deepEqual(calls.find((c) => c[0] === "set" && c[1] === "fillStyle")[2], sc.roles.weekend.ground);
  assert.ok(calls.some((c) => c[0] === "set" && c[1] === "fillStyle" && c[2] === sc.roles.weekend.ink));
  assert.ok(calls.some((c) => c[0] === "fillText" && c[1] === "SUN"));
});

// Mount: the select, the URL parameter, the DE/EN switch (fake DOM, fake viewer; no WebGL).
const flush = () => new Promise((r) => setImmediate(r));
class El {
  constructor(id) { Object.assign(this, { id, textContent: "", value: "", checked: true, hidden: false, disabled: false, dataset: {}, listeners: {} }); this.classList = { toggle() {}, contains: () => false }; }
  setAttribute() {}
  addEventListener(t, fn) { (this.listeners[t] ??= new Set()).add(fn); }
  removeEventListener(t, fn) { this.listeners[t]?.delete(fn); }
  fire(type) { for (const fn of [...(this.listeners[type] ?? [])]) fn({ type, preventDefault() {} }); }
}
function host() {
  const els = new Map();
  return {
    html: "", classList: { toggle() {}, contains: () => false },
    set innerHTML(h) { this.html = h; els.clear(); for (const [, id] of h.matchAll(/\bid="([^"]+)"/g)) els.set(id, new El(id)); if (els.has("calendar-speed")) els.get("calendar-speed").value = "250"; },
    get innerHTML() { return this.html; },
    querySelector: (s) => els.get(s.slice(1)) ?? null,
    el: (id) => els.get(id),
  };
}
async function rig(search) {
  const stage = host(), dock = host(), log = { scheme: [], configured: [], query: [] };
  const viewer = {
    duration: 250, presentedState: null, animating: false,
    configure(d, s) { log.configured.push(d.id); viewer.presentedState = s; },
    async animate() {}, resetReferenceView() {}, destroy() {},
    setScheme(id) { log.scheme.push(id); },
  };
  const env = {
    controls: dock,
    loadDesign: async (id) => structuredClone(JSON.parse(readFileSync("public/calendar/" + id + ".json", "utf8"))),
    now: () => new Date(2026, 10, 14, 12).getTime(), fontsReady: async () => {},
    createViewer: () => viewer,
    createOptimizer: () => ({ plan: async ({ fallbackWord }) => fallbackWord, solverStatus: "none", dispose() {} }),
    every: () => () => {}, onResume: () => () => {}, later() {}, setPrintDesign() {}, expose() {},
    replaceQuery: (q) => log.query.push(q),
  };
  const inst = await mountCalendar(stage, new URLSearchParams(search), { isCurrent: () => true }, env);
  for (let i = 0; i < 50; i++) await flush();
  return { dock, log, inst };
}

test("the 3x3 controls offer a Cube color theme select with the default first", async () => {
  const { dock } = await rig("lang=de&date=2026-11-14");
  assert.match(dock.html, /<label for="calendar-scheme">Cube color theme<\/label>/);
  const options = [...dock.html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map((m) => m[1]);
  assert.deepEqual(options.filter((o) => CAL3_SCHEMES.some((s) => s.id === o)), CAL3_SCHEMES.map((s) => s.id));
  assert.equal(dock.el("calendar-scheme").value, "default");
});

test("?scheme= selects the scheme; an unknown id is the default; a DE/EN switch keeps it", async () => {
  const known = await rig("lang=de&date=2026-11-14&scheme=dracula");
  assert.equal(known.dock.el("calendar-scheme").value, "dracula");
  assert.equal(known.log.scheme.at(-1), "dracula");
  known.dock.el("calendar-design").value = "en-3";
  known.dock.el("calendar-design").fire("change");
  for (let i = 0; i < 50; i++) await flush();
  assert.equal(known.dock.el("calendar-scheme").value, "dracula");
  assert.equal(known.log.scheme.at(-1), "dracula");
  assert.ok(known.log.configured.includes("de-a") && known.log.configured.some((d) => d.startsWith("en-3")));
  const unknown = await rig("lang=en&date=2026-11-14&scheme=zzz");
  assert.equal(unknown.dock.el("calendar-scheme").value, "default");
  assert.equal(unknown.log.scheme.at(-1), "default");
});

test("changing the select recolors the viewer in place and writes ?scheme= to the URL", async () => {
  const { dock, log } = await rig("lang=en&date=2026-11-14");
  const before = log.configured.length;
  dock.el("calendar-scheme").value = "monokai";
  dock.el("calendar-scheme").fire("change");
  assert.equal(log.scheme.at(-1), "monokai");
  assert.equal(log.configured.length, before, "no new configure on a scheme change");
  assert.match(log.query.at(-1), /scheme=monokai/);
  assert.match(log.query.at(-1), /lang=en/);
  assert.match(log.query.at(-1), /(^\?|&)app=calendar(&|$)/, "the router strips app from the mount params; the rewritten URL must keep it");
  dock.el("calendar-scheme").value = "default";
  dock.el("calendar-scheme").fire("change");
  assert.doesNotMatch(log.query.at(-1), /scheme=/);
  dock.el("calendar-design").value = "de-a";
  dock.el("calendar-design").fire("change");
  for (let i = 0; i < 50; i++) await flush();
  dock.el("calendar-scheme").value = "dracula";
  dock.el("calendar-scheme").fire("change");
  assert.match(log.query.at(-1), /lang=de/, "the URL names the print that is shown after a DE/EN switch");
});

test("CalendarViewer.setScheme repaints the existing canvases and textures in place; the stickerless body waits for the end of a turn", async () => {
  const { CalendarViewer } = await import("../src/apps/calendar/viewer.ts");
  const painted = [];
  const mk = (sticker) => ({ canvas: { getContext: () => new Proxy({}, { set: () => true, get: (_t, k) => (...a) => k === "fillText" && painted.push([sticker.image, a[0]]) }) }, texture: { needsUpdate: false }, sticker });
  const glyphs = [mk({ image: "SUN", slot: 0 }), mk({ image: "5", slot: 7 })];
  const textures = glyphs.map((g) => g.texture), canvases = glyphs.map((g) => g.canvas);
  const body = [];
  const viewer = Object.assign(Object.create(CalendarViewer.prototype), {
    glyphs, scheme: DEFAULT_CAL3_SCHEME, busy: false, bodyStale: false, printing: designs["en-3-zero"].printing,
    cube: { setBodyColor: (c) => body.push(["body", c]), setFaceColors: (m) => body.push(["faces", m.size]) },
  });
  viewer.setScheme("dracula");
  assert.equal(painted.length, 2);
  assert.ok(viewer.glyphs.every((g, i) => g.texture === textures[i] && g.canvas === canvases[i]), "same texture and canvas objects");
  assert.ok(textures.every((t) => t.needsUpdate));
  assert.deepEqual(body, [["body", "#282a36"], ["faces", designs["en-3-zero"].printing.length]]);
  viewer.setScheme("dracula");
  assert.equal(painted.length, 2, "same scheme: nothing");
  viewer.busy = true;
  viewer.setScheme("classic");
  assert.equal(body.length, 2, "no body change during a turn");
  assert.equal(viewer.bodyStale, true);
  viewer.busy = false;
  viewer.applyBody();
  assert.deepEqual(body.slice(2), [["body", "#fffdf6"], ["faces", designs["en-3-zero"].printing.length]]);
});

test("the calendar mode and the parameter inventory name scheme", async () => {
  const { MODE_CATALOG } = await import("../src/apps/mode-catalog.ts");
  assert.ok(MODE_CATALOG.find((m) => m.id === "calendar").params.includes("scheme"));
  assert.match(readFileSync("tests/app-parameter-inventory.test.mjs", "utf8"), /row\(\["scheme"\], "src\/apps\/calendar\/mount\.ts", \["calendar"\]/);
});

test("the chosen scheme survives configure (a DE/EN switch): stickers and stickerless body use it, not the default", async () => {
  const THREE = await import("three");
  const { CalendarViewer } = await import("../src/apps/calendar/viewer.ts");
  const painted = [], bodies = [];
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { set: (_t, k, v) => (k === "fillStyle" && painted.push(v), true), get: () => () => {} }) }) };
  globalThis.matchMedia = () => ({ matches: false });
  try {
    const viewer = Object.assign(Object.create(CalendarViewer.prototype), {
      presentation: new THREE.Group(), resources: [], artworkTextures: new Map(), glyphs: [], cube: null, busy: false, scheme: cal3SchemeById("dracula"),
      appearance: { construction: "stickered", frameColor: null }, bodyStale: false,
    });
    const d = designs["en-3-zero"];
    viewer.configure(d, d.printing);
    assert.ok(painted.includes("#282a36"), "stickers painted with the Dracula ground");
    assert.equal(painted.includes("#fffdf6"), false, "no sticker painted with the default ground");
    assert.equal(viewer.cube.bodyColor, "#282a36", "stickerless body color is the scheme ground");
  } finally { delete globalThis.document; delete globalThis.matchMedia; }
});
