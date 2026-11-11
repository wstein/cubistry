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
  const expected = new Set([...owned].flatMap((p) => [p, ...(PARAM_SPECS[p].aliases ?? [])]));
  assert.deepEqual([...APP_SCOPED_PARAMS].sort(), [...expected].sort());
  for (const g of GLOBAL_PARAMS) assert.ok(!APP_SCOPED_PARAMS.includes(g));
  for (const key of ["val", "value", "duration", "year", "month"]) assert.ok(APP_SCOPED_PARAMS.includes(key), key);
});

test("a parameter owned by one app does not leak to another app on a switch", () => {
  const leaks = [
    ["calendar7", "clock", "year=2027&month=3&outer=1.8"],
    ["ms-counter", "calendar7", "unit=S&dir=down&val=5&pad=0"],
    ["hsm-counter", "timer", "range=23&unit=H&lettering=words-pascal"],
    ["tenth", "counter", "display=dseg7&marker=all&speed=300"],
    ["clock", "ms-counter", "hours-speed=2&minutes-speed=3&lettering=words-pascal"],
    ["calendar7", "counter", "date=2026-11-10&lang=de&design=de-a&cube=3&size=4"],
  ];
  for (const [from, target, query] of leaks) {
    const kept = to(`${base}?app=${from}&${query}`, from, target);
    const both = new Set(sharedParams(from, target));
    for (const key of new URLSearchParams(query).keys()) {
      assert.equal(kept.has(key), both.has(key), `${from} -> ${target}: ${key}`);
    }
  }
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
  const r = parseRoute("?app=ms-counter&value=45&letter=s&direction=-1&padding=off&run=true", registry, "clock");
  assert.deepEqual(r.setup, { val: 45, unit: "S", dir: "down", pad: false, autoplay: true });
});

test("invalid values are reported and left out, so the mode default applies", () => {
  const r = parseRoute("?app=calendar7&year=abc&month=13&outer=9&nerd=maybe", registry, "clock");
  assert.deepEqual(r.setup, {});
  assert.deepEqual(r.invalid.sort(), ["month", "nerd", "outer", "year"]);
});

test("defaults are omitted when serializing and the route round-trips", () => {
  assert.equal(serializeRoute({ app: "ms-counter", setup: { dir: "up", pad: true, unit: "S", val: 45 } }), "?app=ms-counter&val=45&unit=S");
  const cases = [
    "?app=calendar7&year=2026&month=11&outer=1.8",
    "?app=ms-counter&val=45&unit=S&dir=down&pad=0",
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

test("an unknown app resolves to the fallback and keeps no mode setup", () => {
  const r = parseRoute("?app=nope&year=2026&kiosk=1", registry, "clock");
  assert.deepEqual(r.app, { id: "clock", known: false });
  assert.deepEqual(r.setup, { kiosk: true });
});
