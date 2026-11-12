import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../src/apps/registry.ts";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { APP_SCOPED_PARAMS, urlAfterAppSwitch } from "../src/app-switch-url.mjs";
import { GLOBAL_PARAMS, PENDING_APP_PARAMS, PARAM_SPECS, sharedParams } from "../src/apps/param-specs.ts";
import { parseRoute, serializeRoute } from "../src/apps/routes.ts";

const registry = createRegistry(MODE_CATALOG.map((m) => ({ ...m, mount: async () => {} })));
const base = "http://localhost/index.html";
const to = (href, from, target) => new URL(urlAfterAppSwitch(href, from, target), base).searchParams;

test("every mode of the catalog declares the setup parameters it owns, all of them typed", () => {
  for (const m of MODE_CATALOG) {
    assert.ok(Array.isArray(m.params), `${m.id} has no params`);
    for (const p of m.params) assert.ok(PARAM_SPECS[p], `${m.id}: ${p} has no spec`);
    for (const p of m.params) assert.ok(!GLOBAL_PARAMS.includes(p), `${m.id}: ${p} is global, not owned`);
  }
  for (const [app, params] of Object.entries(PENDING_APP_PARAMS)) {
    for (const p of params) assert.ok(PARAM_SPECS[p], `${app}: ${p} has no spec`);
  }
});

test("APP_SCOPED_PARAMS is the union of every owned key and alias, without the global ones", () => {
  const owned = new Set([...MODE_CATALOG.flatMap((m) => m.params), ...Object.values(PENDING_APP_PARAMS).flat()]);
  const expected = new Set([...owned].flatMap((p) => [PARAM_SPECS[p].name ?? p, ...(PARAM_SPECS[p].aliases ?? [])]));
  assert.deepEqual([...APP_SCOPED_PARAMS].sort(), [...expected].sort());
  for (const g of GLOBAL_PARAMS) assert.ok(!APP_SCOPED_PARAMS.includes(g));
  for (const key of ["val", "value", "duration", "year", "month"]) assert.ok(APP_SCOPED_PARAMS.includes(key), key);
});

// Expected values are written out, not derived from the ownership code under test.
const LEAKS = [
  ["calendar7", "clock", "year=2027&month=3&outer=1.8&font=quicksand&layout=names&scheme=paper-blue&plasticity=0.6&banner=boxed", ""],
  ["ms-counter", "calendar7", "unit=S&dir=down&val=5&pad=0&font=dseg7", ""],
  ["hsm-counter", "timer", "range=23&unit=H&lettering=words-pascal&font=dseg7&speed=300", "font=dseg7&speed=300"],
  ["tenth", "counter", "display=dseg7&marker=all&speed=300&dir=down&val=3", "display=dseg7&marker=all&speed=300"],
  ["clock", "ms-counter", "hours-speed=2&minutes-speed=3&lettering=words-pascal", "lettering=words-pascal"],
  ["calendar7", "counter", "date=2026-11-10&lang=de&design=de-a&size=4&font=quicksand", ""],
  ["counter", "calendar7", "font=dseg7&display=dseg7&scheme=x", ""],
  // single-cube family: the display, marker and speed controls exist on every page, so they travel between the apps
  ["hsm-counter", "ms-counter", "font=dseg7&marker=all&speed=300", "font=dseg7&marker=all&speed=300"],
  ["timer", "five-second-timer", "font=dseg7&rate=10&duration=00:05", "font=dseg7&rate=10"],
  // aliases of shared keys travel under their own name
  ["ms-counter", "hsm-counter", "letter=S&direction=down&val=4", "letter=S&direction=down"],
  // stray: the target owns the key, the previous app does not
  ["hsm-counter", "counter", "print=blank-top", ""],
];

test("a parameter owned by one app does not leak to another app on a switch", () => {
  for (const [from, target, query, kept] of LEAKS) {
    const got = to(`${base}?app=${from}&${query}`, from, target);
    got.delete("app");
    assert.equal(decodeURIComponent(got.toString()), kept, `${from} -> ${target}`);
  }
});

test("calendar7 keeps nothing of its look when it is left, and its font is not the single-cube display", () => {
  const q = "year=2026&month=3&outer=1.8&font=quicksand&layout=names&scheme=paper-blue&plasticity=0.6&banner=boxed";
  for (const target of MODE_CATALOG.map((m) => m.id).filter((id) => id !== "calendar7")) {
    const got = to(`${base}?app=calendar7&${q}`, "calendar7", target);
    got.delete("app");
    assert.equal(got.toString(), "", target);
  }
  assert.equal(to(`${base}?app=counter&font=dseg7`, "counter", "calendar7").has("font"), false);
});

test("design is a per-mode value: it does not travel between Calendar and Print", () => {
  assert.equal(to(`${base}?app=calendar&design=de-a&lang=de`, "calendar", "print").has("design"), false);
  assert.equal(to(`${base}?app=print&design=de-a`, "print", "calendar").has("design"), false);
});

test("a key stray in the URL of an app that does not own it is dropped even if the target owns it", () => {
  assert.equal(to(`${base}?app=timer&val=45`, "timer", "counter").has("val"), false);
});

test("a per-mode value never survives, even between two apps that own the key", () => {
  assert.equal(to(`${base}?app=five-second-timer&duration=00:05`, "five-second-timer", "timer").has("duration"), false);
  assert.equal(to(`${base}?app=ms-counter&val=45`, "ms-counter", "hsm-counter").has("val"), false);
  assert.equal(to(`${base}?app=calendar7&year=2026&month=3`, "calendar7", "calendar7").get("month"), "3");
});

test("a key owned by both apps survives the switch, global flags always do", () => {
  assert.equal(to(`${base}?app=ms-counter&unit=S&dir=down`, "ms-counter", "hsm-counter").get("unit"), "S");
  assert.equal(to(`${base}?app=ms-counter&unit=S&dir=down`, "ms-counter", "hsm-counter").get("dir"), "down");
  const kept = to(`${base}?app=calendar7&year=2026&nerd=1&kiosk=1&presentation=1`, "calendar7", "clock");
  assert.deepEqual([...kept.keys()].sort(), ["app", "kiosk", "nerd", "presentation"]);
});

test("a key that no app owns is kept on a switch", () => {
  assert.equal(to(`${base}?app=clock&utm_source=x`, "clock", "timer").get("utm_source"), "x");
});

test("an unknown application id keeps the old flat behavior (legacy page)", () => {
  assert.equal(
    urlAfterAppSwitch(`${base}?val=4&duration=5&year=2026&month=3&unit=S`, "certified", "timer"),
    "/index.html?unit=S",
  );
});

test("parseRoute returns canonical typed setup for the app and drops what the app does not own", () => {
  const r = parseRoute("?app=calendar7&year=2026&month=11&outer=1.8&val=4&kiosk=1", registry, "clock");
  assert.deepEqual(r.app, { id: "calendar7", known: true });
  assert.deepEqual(r.setup, { year: 2026, month: 11, outer: 1.8, kiosk: true });
  assert.deepEqual(r.foreign, ["val"]);
  assert.deepEqual(r.invalid, []);
});

test("aliases parse to the canonical key", () => {
  const r = parseRoute("?app=ms-counter&value=45&letter=s&direction=-1&font=DSEG7&run=true", registry, "clock");
  assert.deepEqual(r.setup, { val: 45, unit: "S", dir: "down", display: "dseg7", autoplay: true });
  assert.deepEqual(parseRoute("?app=counter&padding=off", registry, "clock").setup, { pad: false });
});

test("invalid values are reported and left out, so the mode default applies", () => {
  const r = parseRoute("?app=calendar7&year=abc&month=13&outer=9&kiosk=maybe", registry, "clock");
  assert.deepEqual(r.setup, {});
  assert.deepEqual(r.invalid.sort(), ["kiosk", "month", "outer", "year"]);
});

test("defaults are omitted when serializing and the route round-trips", () => {
  assert.equal(serializeRoute({ app: "ms-counter", setup: { dir: "up", pad: true, unit: "S", val: 45 } }), "?app=ms-counter&val=45&unit=S");
  const cases = [
    "?app=calendar7&year=2026&month=11&outer=1.8",
    "?app=counter&val=45&pad=0&display=dseg7",
    "?app=timer&duration=00:30&mode=countdown&rate=10&kiosk=1",
    "?app=hsm-counter&range=23&unit=H&lettering=words-pascal&nerd=1",
    "?app=clock&hours-speed=2&lettering=words-pascal",
  ];
  for (const q of cases) {
    const a = parseRoute(q, registry, "clock");
    assert.deepEqual(a.invalid, [], q);
    const again = parseRoute(serializeRoute({ app: a.app.id, setup: a.setup }), registry, "clock");
    assert.deepEqual(again.setup, a.setup, q);
    assert.deepEqual(again.app, a.app, q);
  }
});

test("calendar7 owns its font, layout, scheme, plasticity and banner; font is not reported as foreign there", () => {
  const r = parseRoute("?app=calendar7&font=quicksand&layout=names-any&scheme=paper-blue&plasticity=0.6&banner=rounded-box&display=dseg7", registry, "clock");
  assert.deepEqual(r.setup, { "c7-font": "quicksand", layout: "names-any", scheme: "paper-blue", plasticity: 0.6, banner: "rounded-box" });
  assert.deepEqual(r.foreign, ["display"]);
  const c = parseRoute("?app=counter&font=DSEG7&layout=names", registry, "clock");
  assert.deepEqual(c.setup, { display: "dseg7" });
  assert.deepEqual(c.foreign, ["layout"]);
  assert.equal(serializeRoute({ app: "calendar7", setup: r.setup }), "?app=calendar7&font=quicksand&layout=names-any&scheme=paper-blue&plasticity=0.6&banner=rounded-box");
});

test("nerd is true only for 1, like the shell", () => {
  assert.deepEqual(parseRoute("?app=clock&nerd=1", registry, "clock").setup, { nerd: true });
  assert.deepEqual(parseRoute("?app=clock&nerd=true", registry, "clock").setup, { nerd: false });
});

test("an unknown app resolves to the fallback and keeps no mode setup", () => {
  const r = parseRoute("?app=nope&year=2026&kiosk=1", registry, "clock");
  assert.deepEqual(r.app, { id: "clock", known: false });
  assert.deepEqual(r.setup, { kiosk: true });
});

test("the banner style accepts exactly its six values and is not a per-mode value", () => {
  for (const v of ["theme", "rounded", "square", "underline", "boxed", "rounded-box"]) {
    const r = parseRoute(`?app=calendar7&banner=${v}`, registry, "clock");
    assert.deepEqual(r.setup, { banner: v }, v);
    assert.deepEqual(r.invalid, [], v);
  }
  const bad = parseRoute("?app=calendar7&banner=extra", registry, "clock");
  assert.deepEqual(bad.setup, {});
  assert.deepEqual(bad.invalid, ["banner"]);
  assert.ok(sharedParams("calendar7", "calendar7").includes("banner"));
});
