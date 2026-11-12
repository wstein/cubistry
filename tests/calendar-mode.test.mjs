// SPDX-License-Identifier: AGPL-3.0-or-later
// The German A and English 3 date cubes as the mode `calendar` of index.html: catalog entry, host wiring and the mount with
// fakes (no browser, no WebGL, no network, no solver): parameters, date changes, failures, stale and disposed mounts.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { createRegistry } from "../src/apps/registry.ts";
import { civilDate, findTarget, front, validateDesign } from "../src/apps/calendar/model.ts";
import { mountCalendar, printOf, runtimeId } from "../src/apps/calendar/mount.ts";

const designs = Object.fromEntries(
  ["de-a", "en-3-zero", "en-3-unpadded"].map((id) => [id, JSON.parse(readFileSync(`public/calendar/${id}.json`, "utf8"))]),
);
const q = (s) => new URLSearchParams(s);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const until = async (fn) => {
  for (let i = 0; i < 400 && !fn(); i++) await flush();
  assert.ok(fn(), "condition not reached");
};
const noon = (y, m, d) => new Date(y, m - 1, d, 12).getTime();

// ----- a small fake DOM: every id of the markup is one element
class El {
  constructor(id) {
    Object.assign(this, { id, textContent: "", value: "", checked: false, hidden: false, disabled: false, attrs: {}, dataset: {}, listeners: {}, classes: new Set() });
    this.classList = { toggle: (c) => (this.classes.has(c) ? this.classes.delete(c) : this.classes.add(c)), contains: (c) => this.classes.has(c) };
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= new Set()).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type]?.delete(fn);
  }
  fire(type, event = {}) {
    for (const fn of [...(this.listeners[type] ?? [])]) fn({ type, preventDefault() {}, ...event });
  }
  get listenerCount() {
    return Object.values(this.listeners).reduce((n, s) => n + s.size, 0);
  }
}
function fakeHost() {
  const els = new Map();
  const host = {
    html: "",
    classList: new El("host").classList,
    set innerHTML(html) {
      host.html = html;
      els.clear();
      for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) els.set(id, new El(id));
      if (els.has("calendar-padding")) els.get("calendar-padding").checked = true;
      if (els.has("calendar-speed")) els.get("calendar-speed").value = "250";
      if (els.has("calendar-padding-label")) els.get("calendar-padding-label").hidden = true;
    },
    querySelector(selector) {
      if (selector === ".hud-toggle-btn") return els.get("hud-toggle") ?? (els.set("hud-toggle", new El("hud-toggle")), els.get("hud-toggle"));
      return els.get(selector.slice(1)) ?? null;
    },
    el: (id) => els.get(id),
  };
  return host;
}

function rig({ now = noon(2026, 10, 29), fonts = true, load, isCurrent = () => true } = {}) {
  const stage = fakeHost(),
    dock = fakeHost();
  const log = { loaded: [], configured: [], animated: [], viewers: 0, destroyed: 0, optimizers: 0, optimizerDisposed: 0, stops: 0, later: [], hooks: {}, print: [], resets: 0 };
  let clock = now,
    animating = false,
    tick = () => {};
  const viewer = {
    duration: 250,
    presentedState: null,
    get animating() {
      return animating;
    },
    configure(design, state) {
      log.configured.push(design.id);
      viewer.presentedState = state;
    },
    async animate(from, token, to) {
      log.animated.push(token);
      animating = true;
      await flush();
      viewer.presentedState = to;
      animating = false;
    },
    resetReferenceView: () => log.resets++,
    destroy() {
      assert.equal(animating, false, "destroy during a turn");
      log.destroyed++;
    },
  };
  const env = {
    controls: dock,
    loadDesign: load ?? (async (id) => (log.loaded.push(id), structuredClone(designs[id]))),
    now: () => clock,
    fontsReady: async () => {
      if (!fonts) throw new Error("Calendar font unavailable");
    },
    createViewer: () => (log.viewers++, viewer),
    createOptimizer: () => (log.optimizers++, { plan: async ({ fallbackWord }) => fallbackWord, solverStatus: "none", dispose: () => log.optimizerDisposed++ }),
    every: (fn) => ((tick = fn), () => log.stops++),
    onResume: () => () => log.stops++,
    later: (fn) => log.later.push(fn),
    setPrintDesign: (d) => log.print.push(d),
    expose: (name, value) => (value === undefined ? delete log.hooks[name] : (log.hooks[name] = value)),
  };
  return {
    stage, dock, log, viewer, env,
    mount: (search = "") => mountCalendar(stage, q(search), { isCurrent }, env),
    setNow: (t) => (clock = t),
    tick: () => tick(),
    setAnimating: (v) => (animating = v),
  };
}
const faceOf = (id, iso) => findTarget(validateDesign(designs[id]), civilDate(iso)).cells.map((c) => c || "blank").join(" · ");

test("the catalog lists calendar as a one-cube mode of the Apps group with the calendar help page", () => {
  const m = MODE_CATALOG.find((x) => x.id === "calendar");
  assert.ok(m);
  assert.equal(m.group, "apps");
  assert.equal(m.cubes, 1);
  assert.equal(m.help, "docs/CALENDAR_CUBES.md");
  assert.ok(existsSync(m.help));
  assert.ok(createRegistry(MODE_CATALOG.map((x) => ({ ...x, mount: async () => {} }))).has("calendar"));
});

test("the host lists the mode, loads its mount lazily and no legacy page or Vite input remains", () => {
  assert.match(readFileSync("index.html", "utf8"), /<option value="calendar">[^<]*Calendar[^<]*<\/option>/);
  const host = readFileSync("src/chronocube.mjs", "utf8");
  assert.match(host, /calendar: \(isCurrent, params\) => initCalendarMode\(isCurrent, params\)/);
  assert.match(host, /import\("\.\/apps\/calendar\/mount\.ts"\)/);
  assert.doesNotMatch(host, /^import .*apps\/calendar\//m, "the solver bundle must load on demand");
  const mount = readFileSync("src/apps/calendar/mount.ts", "utf8");
  assert.doesNotMatch(mount, /^import (?!type)[^;]*optimizer/m, "the mount takes the optimizer from its env");
  assert.match(readFileSync("src/main.mjs", "utf8"), /"calendar": "index\.html\?app=calendar"/);
  assert.ok(!existsSync("calendar.html"));
  assert.doesNotMatch(readFileSync("vite.config.mjs", "utf8"), /calendar\.html/);
});

test("printOf reads lang, language and design like the page did; anything unknown is German A", () => {
  for (const [s, p] of [["lang=en", "en-3"], ["language=English", "en-3"], ["design=en-3", "en-3"], ["lang=de", "de-a"], ["language=deutsch", "de-a"], ["design=de-a", "de-a"], ["lang=fr", "de-a"], ["", "de-a"], ["lang=de&design=en-3", "de-a"]])
    assert.equal(printOf(q(s)), p, s);
  assert.deepEqual([runtimeId("de-a", false), runtimeId("en-3", true), runtimeId("en-3", false)], ["de-a", "en-3-zero", "en-3-unpadded"]);
});

test("mount with no parameters shows today on German A and enables the controls", async () => {
  const r = rig();
  const instance = await r.mount();
  assert.ok(instance);
  assert.deepEqual(r.log.loaded, ["de-a"]);
  assert.equal(r.stage.el("calendar-front").textContent, "D · O · blank · blank · 2 · 9 · O · K · T");
  assert.equal(r.stage.el("calendar-front").textContent, faceOf("de-a", "2026-10-29").replace(/^DO\b/, "D · O"));
  assert.equal(r.stage.el("calendar-state").textContent, "Live · local date");
  assert.equal(r.stage.el("calendar-viewer").attrs["aria-busy"], "false");
  assert.equal(r.dock.el("calendar-design").value, "de-a");
  assert.equal(r.dock.el("calendar-design").disabled, false);
  assert.equal(r.dock.el("calendar-padding-label").hidden, true);
  assert.equal(r.dock.el("calendar-date").value, "2026-10-29");
  assert.equal(r.dock.el("calendar-live").attrs["aria-pressed"], "true");
  assert.deepEqual(r.log.print, ["de-a"]);
  assert.equal(r.log.viewers, 1);
  assert.equal(r.log.optimizers, 1);
  assert.deepEqual(Object.keys(r.log.hooks).sort(), ["__calendarController", "__calendarViewer"]);
});

test("parameters choose print, padding and a fixed date; an invalid date and today fall back to the live date", async () => {
  let r = rig();
  await r.mount("lang=en&pad=0&date=2026-11-07");
  assert.deepEqual(r.log.loaded, ["en-3-unpadded"]);
  assert.equal(r.stage.el("calendar-front").textContent, "SAT · blank · blank · N · O · V · blank · blank · 7");
  assert.equal(r.stage.el("calendar-state").textContent, "Selected date");
  assert.equal(r.dock.el("calendar-padding").checked, false);
  assert.equal(r.dock.el("calendar-padding-label").hidden, false);
  assert.deepEqual(r.log.print, ["en-3"]);
  r = rig();
  await r.mount("design=en-3&padding=yes&date=2026-01-03");
  assert.deepEqual(r.log.loaded, ["en-3-zero"]);
  assert.equal(r.stage.el("calendar-front").textContent, "SAT · blank · blank · J · A · N · blank · 0 · 3");
  for (const search of ["date=2026-02-30", "date=today", "date=abc"]) {
    r = rig();
    await r.mount(search);
    assert.equal(r.dock.el("calendar-date").value, "2026-10-29", search);
    assert.equal(r.stage.el("calendar-state").textContent, "Live · local date", search);
  }
});

test("+1 day, -1 day and Today move the cube by legal turns and keep the controls in step", async () => {
  const r = rig();
  await r.mount();
  r.dock.el("calendar-increment").fire("click");
  await until(() => r.stage.el("calendar-viewer").attrs["aria-busy"] === "false" && r.dock.el("calendar-date").value === "2026-10-30" && r.log.animated.length > 0);
  assert.equal(r.dock.el("calendar-date").value, "2026-10-30");
  assert.equal(r.stage.el("calendar-state").textContent, "Selected date");
  assert.deepEqual(front(r.viewer.presentedState).map((s) => s.image), findTarget(validateDesign(designs["de-a"]), civilDate("2026-10-30")).cells);
  assert.match(r.dock.el("calendar-moves").textContent, /^([1-9]\d*) \/ \1 HTM · (\d+) \/ \2 cube rotations$/);
  r.dock.el("calendar-decrement").fire("click");
  await until(() => r.dock.el("calendar-date").value === "2026-10-29" && r.stage.el("calendar-viewer").attrs["aria-busy"] === "false" && r.stage.el("calendar-front").textContent.endsWith("O · K · T"));
  r.dock.el("calendar-date").value = "2026-12-24";
  r.dock.el("calendar-date").fire("change");
  await until(() => r.stage.el("calendar-viewer").attrs["aria-busy"] === "false" && r.stage.el("calendar-front").textContent.endsWith("D · E · Z"));
  assert.equal(r.dock.el("calendar-zone").textContent.endsWith("Inspecting"), true);
  r.dock.el("calendar-live").fire("click");
  await until(() => r.stage.el("calendar-state").textContent === "Live · local date" && r.stage.el("calendar-front").textContent === "D · O · blank · blank · 2 · 9 · O · K · T");
  r.dock.el("calendar-date").value = "garbage";
  r.dock.el("calendar-date").fire("change");
  assert.equal(r.dock.el("calendar-error").textContent, "Use YYYY-MM-DD");
});

test("switching the print loads the other runtime and shows the leading-zero choice and the print link", async () => {
  const r = rig();
  await r.mount();
  r.dock.el("calendar-design").value = "en-3";
  r.dock.el("calendar-design").fire("change");
  await until(() => r.log.loaded.includes("en-3-zero") && r.stage.el("calendar-viewer").attrs["aria-busy"] === "false" && r.dock.el("calendar-design").disabled === false);
  assert.equal(r.dock.el("calendar-padding-label").hidden, false);
  assert.equal(r.stage.el("calendar-front").textContent, "THU · blank · blank · O · C · T · blank · 2 · 9");
  assert.deepEqual(r.log.print, ["de-a", "en-3"]);
  assert.equal(r.log.viewers, 1, "one viewer serves both prints");
});

test("a runtime that fails its check stops the calendar with the reason and disables the controls", async () => {
  const r = rig({ load: async () => { throw new Error("Calendar integrity mismatch"); } });
  const instance = await r.mount();
  assert.ok(instance);
  assert.equal(r.dock.el("calendar-error").textContent, "Calendar integrity mismatch");
  assert.equal(r.stage.el("calendar-state").textContent, "Calendar stopped. Reload to recover.");
  for (const id of ["design", "padding", "date", "live", "decrement", "increment"]) assert.equal(r.dock.el(`calendar-${id}`).disabled, true, id);
});

test("a missing font stops the calendar before any viewer or planner exists", async () => {
  const r = rig({ fonts: false });
  const instance = await r.mount();
  assert.ok(instance);
  assert.equal(r.dock.el("calendar-error").textContent, "Calendar font unavailable");
  assert.equal(r.log.viewers + r.log.optimizers, 0);
  instance.dispose();
  assert.equal(r.log.destroyed, 0);
});

test("a mount that is replaced during its start writes nothing, or cleans up what it made", async () => {
  let current = true;
  let r = rig({ isCurrent: () => current });
  current = false;
  assert.equal(await r.mount(), undefined);
  assert.equal(r.stage.html + r.dock.html, "");
  assert.equal(r.log.viewers, 0);
  current = true;
  r = rig({ isCurrent: () => current, load: async (id) => (current = false, structuredClone(designs[id])) });
  assert.equal(await r.mount(), undefined);
  assert.deepEqual([r.log.viewers, r.log.destroyed, r.log.optimizers, r.log.optimizerDisposed], [1, 1, 1, 1]);
  assert.deepEqual(Object.keys(r.log.hooks), []);
});

test("dispose releases the planner, the viewer, the timers and every listener, and is idempotent", async () => {
  const r = rig();
  const instance = await r.mount();
  const controls = ["design", "padding", "date", "decrement", "increment", "live", "speed"].map((n) => r.dock.el(`calendar-${n}`));
  assert.ok(controls.every((c) => c.listenerCount > 0));
  instance.dispose();
  instance.dispose();
  assert.deepEqual([r.log.destroyed, r.log.optimizerDisposed, r.log.stops], [1, 1, 2]);
  assert.ok(controls.every((c) => c.listenerCount === 0));
  assert.deepEqual(Object.keys(r.log.hooks), []);
});

test("dispose during a turn stops the route after that turn and destroys the viewer once it has ended", async () => {
  const r = rig();
  const instance = await r.mount();
  r.dock.el("calendar-increment").fire("click");
  await until(() => r.log.animated.length === 1);
  instance.dispose();
  assert.equal(r.log.destroyed, 0, "not while the viewer turns");
  assert.equal(r.log.later.length, 1, "the destroy is deferred");
  const turns = r.log.animated.length;
  for (let i = 0; i < 5; i++) await flush();
  assert.equal(r.viewer.animating, false);
  assert.equal(r.log.animated.length, turns, "no further turn after dispose");
  r.log.later.shift()();
  assert.equal(r.log.destroyed, 1);
});

test("in live mode the date follows midnight, an inspected date does not, and resume checks again", async () => {
  let r = rig();
  await r.mount();
  r.setNow(noon(2026, 10, 30));
  r.tick();
  await until(() => r.dock.el("calendar-date").value === "2026-10-30");
  r = rig();
  await r.mount("date=2026-10-29");
  r.setNow(noon(2026, 10, 30));
  r.tick();
  await flush();
  assert.equal(r.dock.el("calendar-date").value, "2026-10-29");
});

test("the reference view reset reaches the viewer until dispose", async () => {
  const r = rig();
  const instance = await r.mount();
  instance.resetCamera();
  assert.equal(r.log.resets, 1);
  instance.dispose();
  instance.resetCamera();
  assert.equal(r.log.resets, 1);
});

test("the rotation speed select sets the viewer turn time", async () => {
  const r = rig();
  await r.mount();
  r.dock.el("calendar-speed").value = "50";
  r.dock.el("calendar-speed").fire("change");
  assert.equal(r.viewer.duration, 50);
});
