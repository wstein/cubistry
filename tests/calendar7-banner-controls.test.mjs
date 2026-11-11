// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 month banner choice: the select, the `banner` URL parameter, the stage call and the viewer-local override
// (fake DOM, fake stage; no WebGL, no browser, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";
import { Calendar7Viewer } from "../src/apps/calendar7/viewer.ts";
import { DEFAULT_SCHEME, resolvedBannerStyle, schemeById } from "../src/apps/calendar7/schemes.ts";

class El {
  constructor(attrs = {}) { this.attrs = { ...attrs }; this.textContent = ""; this.value = ""; this.disabled = false; }
  querySelector() { return { focus() {} }; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  focus() {}
}
function fakeRoot() {
  const listeners = { click: new Set(), change: new Set(), submit: new Set() };
  const els = new Map(), view = new El(), live = new El();
  const get = (name) => { if (!els.has(name)) els.set(name, new El({ "data-c7": name })); return els.get(name); };
  return {
    attrs: {}, html: "", el: get,
    set innerHTML(h) { this.html = h; },
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
    choose(name, value) {
      const el = get(name);
      el.value = value;
      for (const l of [...listeners.change]) l({ type: "change", target: { closest: (s) => (s === "a.c7-nav" ? null : el) } });
    },
  };
}
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
function setup(search) {
  const stage = { calls: [], banners: [], schemes: [], show() {}, turn: () => Promise.resolve(), setLabel() {}, resetView() {}, destroy() {}, configure() { stage.calls.push("configure"); },
    setScheme(s) { stage.schemes.push(s); }, setBannerStyle(s) { stage.banners.push(s); stage.calls.push("banner"); } };
  const query = [];
  const env = {
    base: "/", fetchJson: async (url) => json("public/calendar7/" + url.split("/calendar7/")[1]),
    now: () => new Date(2026, 10, 10), search: () => (query.length ? query.at(-1) : search), replaceQuery: (s) => query.push(s),
    isCurrent: () => true, sceneHost: () => ({ hidden: false }), createStage: async () => stage, reducedMotion: () => false,
  };
  return { env, stage, query };
}
const settle = async (root) => {
  for (let i = 0; i < 200000; i++) { if (root.getAttribute("data-c7-state") === "idle") return; await Promise.resolve(); }
  throw new Error("not idle");
};
const params = (env) => new URLSearchParams(env.search());

test("Month banner offers six choices, Theme default first and selected, and tells the stage before the first configure", async () => {
  const root = fakeRoot(), { env, stage } = setup("?app=calendar7&year=2026&month=11");
  const inst = await mountCalendar7(root, params(env), env); await settle(root);
  assert.match(root.html, /<label for="c7-month-banner">Month banner<\/label>/);
  const select = root.html.match(/<select[^>]*data-c7="banner"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...select.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]), ["theme", "rounded", "square", "underline", "boxed", "rounded-box"]);
  assert.match(select, /<option value="theme" selected>Theme default/);
  assert.deepEqual(stage.banners, ["theme"]);
  assert.ok(stage.calls.indexOf("banner") < stage.calls.indexOf("configure"));
  assert.equal(root.getAttribute("data-c7-banner"), "theme");
  inst.dispose();
});

test("an explicit banner is kept in the URL across a color theme change; Theme default removes only banner", async () => {
  const root = fakeRoot(), { env, stage } = setup("?app=calendar7&year=2026&month=11&scheme=paper-blue&font=nunito&extra=keep");
  const inst = await mountCalendar7(root, params(env), env); await settle(root);
  root.choose("banner", "underline"); root.choose("scheme", "dracula");
  assert.equal(stage.banners.at(-1), "underline");
  let p = params(env);
  for (const [k, v] of [["banner", "underline"], ["scheme", "dracula"], ["font", "nunito"], ["extra", "keep"]]) assert.equal(p.get(k), v, k);
  root.choose("banner", "theme"); p = params(env);
  assert.equal(p.has("banner"), false); assert.equal(p.get("scheme"), "dracula"); assert.equal(stage.banners.at(-1), "theme");
  inst.dispose();
});

for (const style of ["rounded", "square", "underline", "boxed", "rounded-box"]) test(`?banner=${style} reaches the stage and is selected`, async () => {
  const root = fakeRoot(), { env, stage } = setup(`?app=calendar7&year=2026&month=11&banner=${style}`);
  const inst = await mountCalendar7(root, params(env), env); await settle(root);
  assert.deepEqual(stage.banners, [style]); assert.equal(root.getAttribute("data-c7-banner"), style);
  assert.match(root.html, new RegExp(`<option value="${style}" selected>`));
  inst.dispose();
});

test("an unknown banner value is Theme default", async () => {
  const root = fakeRoot(), { env, stage } = setup("?app=calendar7&year=2026&month=11&banner=bogus");
  const inst = await mountCalendar7(root, params(env), env); await settle(root);
  assert.deepEqual(stage.banners, ["theme"]); assert.equal(root.getAttribute("data-c7-banner"), "theme");
  inst.dispose();
});

test("viewer banner overrides are instance-local; Theme default follows the current palette", () => {
  const make = () => Object.assign(Object.create(Calendar7Viewer.prototype), { baseScheme: DEFAULT_SCHEME, scheme: DEFAULT_SCHEME, bannerStyle: "theme", layout: "names", destroyed: false });
  const a = make(), b = make();
  a.setScheme("paper-blue"); assert.equal(a.currentScheme, schemeById("paper-blue")); assert.equal(resolvedBannerStyle(a.scheme), "underline");
  a.setBannerStyle("boxed"); a.setScheme("paper-red"); assert.equal(resolvedBannerStyle(a.scheme), "boxed");
  assert.equal(a.currentScheme, DEFAULT_SCHEME); assert.equal(b.bannerStyle, "theme");
  a.setBannerStyle("theme"); assert.equal(resolvedBannerStyle(a.scheme), "rounded");
  assert.equal(Object.hasOwn(DEFAULT_SCHEME, "bannerStyle"), false);
});
