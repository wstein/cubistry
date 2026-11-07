import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { appHref, landingSections } from "../src/apps/landing/catalog.ts";
import { resolveHostView } from "../src/apps/landing/view.ts";

// Stage 3 of knowledge/plans/unified-application.md: index.html is the landing page and the host of the modes.

const IDS = MODE_CATALOG.map((m) => m.id);
const html = readFileSync(resolve("index.html"), "utf8");

test("no app parameter shows the landing page, a registered id shows its mode, an unknown id shows the landing page", () => {
  assert.deepEqual(resolveHostView("", IDS), { view: "landing" });
  assert.deepEqual(resolveHostView("?kiosk=1", IDS), { view: "landing" });
  assert.deepEqual(resolveHostView("?app=", IDS), { view: "landing" });
  assert.deepEqual(resolveHostView("?app=nope", IDS), { view: "landing" });
  assert.deepEqual(resolveHostView("?application=counter", IDS), { view: "landing" });
  for (const id of IDS) assert.deepEqual(resolveHostView(`?app=${id}&val=45`, IDS), { view: "app", id });
});

test("every registered id is reachable through index.html?app=<id>", () => {
  for (const id of IDS) assert.equal(appHref(id), `index.html?app=${id}`);
});

test("the landing sections place the live clock in the hero and every other mode in exactly one section", () => {
  const { hero, apps, cubes } = landingSections(MODE_CATALOG);
  assert.equal(hero.id, "clock");
  assert.deepEqual(apps.map((m) => m.id), ["ms-timer"]);
  assert.deepEqual(cubes.map((m) => m.id), IDS.filter((id) => id !== "clock" && id !== "ms-timer"));
  assert.deepEqual([hero, ...apps, ...cubes].map((m) => m.id).sort(), [...IDS].sort());
  assert.ok(apps.every((m) => m.group === "apps") && cubes.every((m) => m.group === "cubes"));
});

test("index.html is the landing page and the host, not a redirect", () => {
  assert(!/http-equiv="refresh"/.test(html));
  assert(!/location\.replace/.test(html));
  assert(html.includes("<title>Cubistry</title>"));
  assert(html.includes('<main id="landing"'));
  assert(html.includes('src="/src/index.mjs"'));
  assert(!html.includes("chronocube.mjs"), "the studio bundle loads lazily from src/index.mjs");
});

test("the hero shows the name, one sentence and the Open Live Clock link, and no time text", () => {
  const hero = html.slice(html.indexOf('class="landing-hero"'), html.indexOf("</section>", html.indexOf('class="landing-hero"')));
  assert(hero.includes('<a class="landing-open" id="landing-open-clock" href="index.html?app=clock">Open Live Clock</a>'));
  assert(/<h1>Live H–M–S Clock<\/h1>/.test(hero));
  assert.equal((hero.match(/<p /g) ?? []).length, 1, "one sentence");
  assert(!/<output|landing-clock|landing-hours|landing-minutes|landing-seconds|role="timer"/.test(hero), "no H/M/S readout");
});

test("the landing script has no clock ticker and the landing entry imports no studio code", () => {
  const landing = readFileSync(resolve("src/landing.mjs"), "utf8");
  assert(!/setInterval|new Date|landing-hours/.test(landing));
  assert(!/chronocube|clock\//.test(landing));
});

test("index.html carries the studio markup the modes mount into", () => {
  for (const id of ["shell", "studio-scene", "studio-cards", "studio-controls", "studio-error", "studio-application", "studio-heading"]) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
  }
  const options = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(options, IDS, "the switcher lists the registered modes only");
});

test("index.html links to no application page", () => {
  const targets = [...html.matchAll(/href="((?!https?:)[^"#]+\.html)[^"]*"/g)].map((m) => m[1]);
  for (const t of targets) assert(["index.html", "licenses.html", "print.html"].includes(t), `unexpected link ${t}`);
});

test("vite builds index.html as an input", () => {
  const vite = readFileSync(resolve("vite.config.mjs"), "utf8");
  assert(vite.includes('"./index.html"'));
});
