// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from "node:assert/strict";
import { pickerDom } from "./calendar7-picker-dom.mjs";
import { readFileSync } from "node:fs";
const json = p => JSON.parse(readFileSync(p,"utf8"));
class El {
  constructor(attrs = {}) { this.attrs = { ...attrs }; this.textContent = ""; this.hidden = false; this.disabled = false; this.value = ""; this.innerHTML = ""; }
  querySelector() { return { focus() {} }; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "hidden") this.hidden = true; if (k === "disabled") this.disabled = true; }
  removeAttribute(k) { delete this.attrs[k]; if (k === "hidden") this.hidden = false; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  focus() {}
}
export function fakeRoot() {
  const listeners = { click: new Set(), change: new Set(), submit: new Set() };
  const els = new Map();
  const view = new El();
  const picker = pickerDom();
  const get = (name) => { if (!els.has(name)) els.set(name, new El({ "data-c7": name })); return els.get(name); };
  return {
    attrs: {}, html: "", view, el: get, listeners, picker, ownerDocument: picker.doc,
    set innerHTML(h) { this.html = h; },
    querySelector(sel) {
      if (sel === "[data-c7-month-picker]") return picker.host;
      if (sel === ".c7-view") return view;
      if (sel === ".c7-live") return new El();
      const m = sel.match(/^\[data-c7="([a-z-]+)"\]$/);
      return m ? get(m[1]) : null;
    },
    contains: () => true,
    addEventListener: (t, l) => listeners[t].add(l),
    removeEventListener: (t, l) => listeners[t].delete(l),
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    clickLink(href) {
      const a = { getAttribute: () => href };
      for (const l of [...listeners.click]) l({ target: { closest: sel => sel === "a.c7-nav" ? a : null }, preventDefault() {} });
    },
    choose(name, value) {
      const el = get(name);
      el.value = value;
      for (const l of [...listeners.change]) l({ type: "change", target: { closest: () => el } });
    },
    date(year, month) {
      if (picker.trigger.getAttribute("aria-expanded") !== "true") picker.click("toggle");
      picker.click("years");
      if (!/^\d{1,4}$/.test(String(year)) || Number(year)<1 || Number(year)>9999) {
        picker.input.value=String(year);picker.dialog.events.get("change")?.(picker.event(picker.input));return false;
      }
      picker.click("year",Number(year));return picker.click("month",Number(month)).prevented;
    },
  };
}
export const fakeStage = () => {
  const stage = { configs: [], shows: [], show: (pose) => stage.shows.push(pose), turn: () => Promise.resolve(), setScheme() {}, setLabel: (t) => (stage.label = t), resetView() {}, destroy() {}, configure(printing, pose, surface, layout, wrong = []) { stage.configs.push({ printing, pose, layout, wrong }); } };
  return stage;
};
export const settle = async (root, want) => {
  for (let i = 0; i < 200000; i++) {
    if (root.getAttribute("data-c7-state") === "idle" && root.getAttribute("data-c7-month") === want) return;
    await Promise.resolve();
  }
  throw new Error(`not idle at ${want}: ${root.getAttribute("data-c7-state")} ${root.getAttribute("data-c7-month")}`);
};
export const attr = async (root, name, want) => {
  for (let i = 0; i < 200000 && root.getAttribute(name) !== want; i++) await Promise.resolve();
  assert.equal(root.getAttribute(name), want);
};
/** `dir`: the data folder served as the canonical data (default the long chain C; the former names demo folder has no best-effort file and gets an empty list). */
export const setup = ({ fail = false, search: initialSearch = "", now = new Date(2026, 10, 10), createStage, dir = "chain-c" } = {}) => {
  const stage = fakeStage();
  const host = { hidden: false };
  const calls = { fetched: [], query: [] };
  let search = initialSearch;
  const env = {
    base: "/",
    fetchJson: async (url) => {
      calls.fetched.push(url);
      if (fail) throw new Error("HTTP 404");
      const name = url.split("/").pop();
      if (name === "best-effort.v1.json" && dir !== "chain-c") return { schema: "cubistry.calendar7.best-effort", version: 1, months: [] };
      return json(`public/calendar7/${dir}/${name}`);
    },
    now: () => now,
    search: () => search,
    replaceQuery: (s) => { search = s; calls.query.push(s); },
    isCurrent: () => true,
    sceneHost: () => host,
    createStage: createStage ?? (async () => stage),
    reducedMotion: () => false,
  };
  return { env, stage, host, calls };
};
