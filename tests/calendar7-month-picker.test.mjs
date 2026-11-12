// SPDX-License-Identifier: AGPL-3.0-or-later
// Month and year picker. Model and controller cases are the #412 picker tests.
// Mount cases run on the current chain (May 2026 through December 2099) and the existing outside-chain page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MonthPickerModel, pickerHtml, gridTarget } from "../src/apps/calendar7/month-picker.ts";

test("opening starts with the selected year's twelve months and a year chooser", () => {
  const m = new MonthPickerModel({year:2026, month:11}, {year:2026, month:11});
  m.show(); assert.equal(m.mode,"months"); assert.equal(m.year,2026);
  const html=pickerHtml(m); assert.match(html,/Choose year/); assert.match(html,/Months in 2026/);
  assert.equal((html.match(/data-c7-picker-action="month"/g)||[]).length,12);assert.equal((html.match(/role="row"/g)||[]).length,4);
  assert.match(html,/November 2026[^>]*aria-selected="true"/); assert.doesNotMatch(html,/>Show</);
});
test("year and decade browsing never commits a month", () => {
  const m=new MonthPickerModel({year:2026,month:11},{year:2026,month:11}); m.show();m.showYears();m.browse(1);
  assert.equal(m.decade,2030);assert.deepEqual(m.value,{year:2026,month:11});assert.match(pickerHtml(m),/Years 2030 to 2039/);
  m.chooseYear(2034);assert.equal(m.mode,"months");assert.equal(m.year,2034);assert.deepEqual(m.value,{year:2026,month:11});
  assert.deepEqual(m.chooseMonth(2),{year:2034,month:2});assert.equal(m.open,false);
});
test("today chooses only the current month and closes",()=>{const m=new MonthPickerModel({year:2099,month:12},{year:2026,month:11});m.show();assert.deepEqual(m.chooseToday(),{year:2026,month:11});assert.equal(m.open,false);});
test("year bounds, invalid jumps, and decade bounds preserve the 1 through 9999 range",()=>{
  const m=new MonthPickerModel({year:1,month:1},{year:2026,month:11});m.show();m.browse(-1);assert.equal(m.year,1);m.showYears();m.browse(-1);assert.equal(m.decade,0);
  assert.doesNotMatch(pickerHtml(m),/data-c7-picker-action="year" data-value="0"/);
  for(const value of ["", "0","10000","1.5","NaN","-1"]){assert.equal(m.jump(value),false);assert.equal(m.year,1);}
  assert.equal(m.jump("9999"),true);m.showYears();m.browse(1);assert.equal(m.decade,9990);m.chooseYear(9999);m.browse(1);assert.equal(m.year,9999);
});
test("grid keys use month and year row sizes without leaving bounds",()=>{
  assert.equal(gridTarget("ArrowDown",2,1,12,3),5);assert.equal(gridTarget("ArrowRight",12,1,12,3),12);
  assert.equal(gridTarget("Home",8,1,12,3),1);assert.equal(gridTarget("End",8,1,12,3),12);
  assert.equal(gridTarget("ArrowDown",2022,2020,2029,4),2026);assert.equal(gridTarget("Escape",2022,2020,2029,4),null);
});

import { MonthPicker } from "../src/apps/calendar7/month-picker.ts";
import { pickerDom } from "./helpers/calendar7-picker-dom.mjs";
function domFixture(onSelect = () => {}, deferred = false) {
 const f=pickerDom();if(!deferred)f.picker=new MonthPicker(f.host,{year:2026,month:11},{today:{year:2026,month:11},onSelect});return f;
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test("controller opens the months, chooses a year without committing, and commits a month once",async()=>{
  const selected=[],f=domFixture(v=>selected.push(v));f.click("toggle");assert.equal(f.trigger.getAttribute("aria-expanded"),"true");
  f.click("years");f.click("year",2099);assert.equal(selected.length,0);f.click("month",12);assert.equal(selected.length,0);
  await flush();assert.deepEqual(selected,[{year:2099,month:12}]);assert.equal(f.dialog.hidden,true);assert.equal(f.doc.activeElement,f.trigger);f.picker.dispose();
});
test("Escape returns focus; outside clicks and Tab leave never steal other control focus",()=>{
  const f=domFixture();f.click("toggle");f.dialog.events.get("keydown")(f.event(f.el(),{key:"Escape"}));assert.equal(f.doc.activeElement,f.trigger);assert.equal(f.dialog.hidden,true);
  f.click("toggle");const other={inside:false};f.doc.activeElement=other;f.docEvents.get("pointerdown")(f.event(other));assert.equal(f.doc.activeElement,other);assert.equal(f.dialog.hidden,true);
  f.click("toggle");f.doc.activeElement=other;f.dialog.events.get("focusout")(f.event(f.input,{relatedTarget:other}));assert.equal(f.doc.activeElement,other);assert.equal(f.dialog.hidden,true);f.picker.dispose();
});
test("invalid year text stays editable, and valid year jumps browse without committing",async()=>{
  const selected=[],f=domFixture(v=>selected.push(v));f.click("toggle");f.click("years");f.input.value="10000";f.dialog.events.get("change")(f.event(f.input));assert.equal(f.input.getAttribute("aria-invalid"),"true");assert.equal(f.picker.model.year,2026);
  f.input.value="2099";f.dialog.events.get("keydown")(f.event(f.input,{key:"Enter"}));await flush();assert.equal(f.picker.model.decade,2090);assert.equal(f.picker.model.year,2099);assert.equal(selected.length,0);assert.equal(f.input.hasAttribute("aria-invalid"),false);f.picker.dispose();
});
test("a year edit followed by a pointer choice retains the clicked target and avoids reentrant change",async()=>{
  const selected=[],f=domFixture(v=>selected.push(v));f.click("toggle");f.click("years");f.input.value="2099";f.doc.activeElement=f.input;
  const target=f.el({"data-c7-picker-action":"year","data-value":"2028"});const e=f.event(target);f.dialog.events.get("pointerdown")(e);assert.equal(e.prevented,true,"pointer focus must not blur/rebuild before click");
  f.setPaintHook(()=>f.dialog.events.get("change")(f.event(f.input)));f.dialog.events.get("click")(f.event(target));await flush();assert.equal(f.picker.model.year,2028);assert.equal(f.picker.model.mode,"months");assert.equal(selected.length,0);
  f.setPaintHook(null);f.click("month",2);await flush();assert.deepEqual(selected,[{year:2028,month:2}]);f.picker.dispose();
});
test("navigation and disposal cancel queued commits and remove all document listeners",async()=>{
  const selected=[],f=domFixture(v=>selected.push(v));f.click("toggle");f.click("month",2);f.picker.setValue({year:2027,month:6});await flush();assert.equal(selected.length,0);
  f.click("toggle");f.click("today");f.picker.dispose();await flush();assert.equal(selected.length,0);assert.equal(f.docEvents.size,0);assert.equal(f.hostEvents.size,0);
});

test("controller keyboard movement follows the actual grid rows",()=>{const f=domFixture();f.click("toggle");f.dialog.events.get("keydown")(f.event(f.el({role:"gridcell","data-value":"2"}),{key:"ArrowDown"}));assert.equal(f.picker.model.focusMonth,5);f.click("years");f.dialog.events.get("keydown")(f.event(f.el({role:"gridcell","data-value":"2022"}),{key:"ArrowDown"}));assert.equal(f.picker.model.focusYear,2026);f.picker.dispose();});
test("the dialog is portaled outside layout containment while actions and internal focus stay owned",()=>{
 const f=domFixture();assert.deepEqual(f.doc.body.children,[f.dialog]);assert.equal(f.host.contains(f.dialog),false);
 f.click("toggle");f.docEvents.get("pointerdown")(f.event(f.input));assert.equal(f.picker.model.open,true);
 f.hostEvents.get("focusout")(f.event(f.trigger,{relatedTarget:f.input}));assert.equal(f.picker.model.open,true);
 f.click("years");assert.equal(f.picker.model.mode,"years");f.picker.dispose();assert.equal(f.doc.body.children.length,0);assert.equal(f.dialog.events.size,0);
});
test("portal Tab boundaries return to the logical page order instead of the end of the body",()=>{
 const f=domFixture(),first=f.el(),last=f.el(),next=f.el({},"outside");f.dialog.tabbables=[first,last];f.doc.focusables=[f.trigger,next];
 f.click("toggle");f.doc.activeElement=last;const forward=f.event(last,{key:"Tab",shiftKey:false});f.dialog.events.get("keydown")(forward);assert.equal(forward.prevented,true);assert.equal(f.doc.activeElement,next);assert.equal(f.picker.model.open,false);
 f.click("toggle");f.doc.activeElement=first;const back=f.event(first,{key:"Tab",shiftKey:true});f.dialog.events.get("keydown")(back);assert.equal(back.prevented,true);assert.equal(f.doc.activeElement,f.trigger);assert.equal(f.picker.model.open,false);f.picker.dispose();
});

import { readFileSync } from "node:fs";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));

function mountRoot(host, { threeD = false } = {}) {
  const listeners = { click: new Set(), change: new Set(), submit: new Set() };
  const attrs = {};
  const view = { innerHTML: "", querySelector() { return { focus() {} }; } };
  const live = { textContent: "" };
  const els = new Map();
  const el = (name) => {
    if (!els.has(name)) els.set(name, { attrs: { "data-c7": name }, textContent: "", hidden: false, disabled: false, value: "", innerHTML: "", setAttribute(k, v) { this.attrs[k] = String(v); if (k === "hidden") this.hidden = true; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k] ?? null; }, focus() {} });
    return els.get(name);
  };
  return {
    html: "", view, live, attrs,
    set innerHTML(html) { this.html = html; },
    querySelector(sel) {
      if (sel === "[data-c7-month-picker]") return host;
      if (sel === ".c7-view") return view;
      if (sel === ".c7-live") return live;
      const match = sel.match(/^\[data-c7="([a-z-]+)"\]$/);
      return match ? el(match[1]) : null;
    },
    contains: () => true,
    addEventListener(type, listener) { (listeners[type] ?? listeners.click).add(listener); },
    removeEventListener(type, listener) { listeners[type]?.delete(listener); },
    setAttribute(key, value) { attrs[key] = String(value); },
    getAttribute(key) { return attrs[key] ?? null; },
    listeners,
  };
}

function mountEnv({ search, threeD = false } = {}) {
  let current = search;
  const stage = {
    configs: [],
    show() {},
    turn: () => Promise.resolve(),
    setScheme() {},
    setBannerStyle() {},
    setPlasticity() {},
    setLabel() {},
    setFont() {},
    resetView() {},
    destroy() {},
    configure(...args) { stage.configs.push(args); },
  };
  const env = {
    base: "/",
    fetchJson: async (url) => json("public/calendar7/" + url.split("/calendar7/")[1]),
    now: () => new Date(2026, 10, 11),
    search: () => current,
    replaceQuery(next) { current = next; },
    isCurrent: () => true,
    reducedMotion: () => true,
    ...(threeD ? { sceneHost: () => ({ hidden: false }), createStage: async () => stage } : {}),
  };
  return { env, stage };
}

const settle = async (root, month) => {
  for (let i = 0; i < 200000; i++) {
    if (root.getAttribute("data-c7-state") === "idle" && root.getAttribute("data-c7-month") === month) return;
    await Promise.resolve();
  }
  throw new Error(`not idle at ${month}: ${root.getAttribute("data-c7-state")} ${root.getAttribute("data-c7-month")}`);
};

test("mounted picker preserves URL settings and moves along the chain without adding a Show form", async () => {
  const f = pickerDom();
  const root = mountRoot(f.host, { threeD: true });
  const { env, stage } = mountEnv({
    threeD: true,
    search: "?app=calendar7&year=2026&month=11&layout=standard&scheme=paper-blue&banner=boxed&font=nunito&extra=keep",
  });
  const inst = await mountCalendar7(root, new URLSearchParams(env.search()), env);
  await settle(root, "2026-11");
  assert.match(root.html, /data-c7-month-picker/);
  assert.doesNotMatch(root.view.innerHTML, /data-c7-date-form|>Show</);
  assert.equal(f.label.textContent, "November 2026");
  assert.equal(f.hostEvents.size, 5);
  f.click("toggle");
  assert.match(f.dialog.innerHTML, /Months in 2026/);
  f.click("month", 12);
  await flush();
  await settle(root, "2026-12");
  const params = new URLSearchParams(env.search());
  for (const [key, value] of [
    ["app", "calendar7"], ["layout", "standard"], ["scheme", "paper-blue"], ["banner", "boxed"],
    ["font", "nunito"], ["extra", "keep"], ["year", "2026"], ["month", "12"],
  ]) assert.equal(params.get(key), value, key);
  assert.equal(root.getAttribute("data-c7-any"), "off");
  assert.ok(stage.configs.length >= 1);
  inst.dispose();
  assert.equal(f.hostEvents.size, 0);
  assert.equal(f.docEvents.size, 0);
});

test("a month outside the chain keeps the existing outside page and does not claim an any-date state", async () => {
  const f = pickerDom();
  const root = mountRoot(f.host, { threeD: true });
  const { env } = mountEnv({ threeD: true, search: "?app=calendar7&year=2026&month=11&banner=underline&extra=keep" });
  const inst = await mountCalendar7(root, new URLSearchParams(env.search()), env);
  await settle(root, "2026-11");
  f.click("toggle");
  f.click("years");
  f.click("year", 1);
  f.click("month", 1);
  await flush();
  const params = new URLSearchParams(env.search());
  assert.equal(params.get("year"), "1");
  assert.equal(params.get("month"), "1");
  assert.equal(params.get("banner"), "underline");
  assert.equal(params.get("extra"), "keep");
  assert.match(root.view.innerHTML, /outside the proven chain/);
  assert.equal(root.getAttribute("data-c7-any"), "off");
  assert.equal(root.getAttribute("data-c7-month"), "2026-11", "the cube stays on the chain month");
  assert.equal(f.label.textContent, "January 1");
  inst.dispose();
});

test("the picker works without a 3D stage and keeps the selected date in its persistent trigger", async () => {
  const f = pickerDom();
  const root = mountRoot(f.host);
  const { env, stage } = mountEnv({ search: "?app=calendar7&year=2026&month=11" });
  const inst = await mountCalendar7(root, new URLSearchParams(env.search()), env);
  assert.equal(f.label.textContent, "November 2026");
  assert.match(root.view.innerHTML, /data-month="2026-11"/);
  f.click("toggle");
  f.click("month", 12);
  await flush();
  assert.equal(f.label.textContent, "December 2026");
  assert.match(root.view.innerHTML, /data-month="2026-12"/);
  assert.match(env.search(), /year=2026/);
  assert.match(env.search(), /month=12/);
  assert.equal(stage.configs.length, 0);
  inst.dispose();
  assert.equal(f.hostEvents.size, 0);
  assert.equal(f.docEvents.size, 0);
});
