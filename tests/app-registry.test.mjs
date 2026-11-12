import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRegistry, APP_GROUPS } from "../src/apps/registry.ts";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";

const noopMount = async () => {};
const meta = (over = {}) => ({
  id: "x",
  title: "X",
  subtitle: "x",
  badge: "X",
  cubes: 1,
  group: "cubes",
  help: "docs/APPLICATIONS.md",
  ...over,
});

test("the catalog holds the thirteen modes under one id each", () => {
  assert.deepEqual(
    MODE_CATALOG.map((m) => m.id),
    [
      "clock",
      "ms-timer",
      "calendar",
      "hm-clock",
      "tenth",
      "counter",
      "timer",
      "five-second-timer",
      "hsm-counter",
      "ms-counter",
      "hm-one-cube",
      "calendar7",
      "ci",
    ],
  );
});

test("the unified ids use neither the legacy application keys nor file names", () => {
  for (const { id } of MODE_CATALOG) {
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id);
    assert.ok(!["certified", "tenth-counter"].includes(id), id);
    assert.ok(!id.endsWith(".html"), id);
  }
});

test("every catalog entry has a title, a known group, a cube count and an existing help file", () => {
  for (const m of MODE_CATALOG) {
    assert.ok(m.title.length > 0, `${m.id}: title`);
    assert.ok(APP_GROUPS.includes(m.group), `${m.id}: group`);
    assert.ok(Number.isInteger(m.cubes) && m.cubes >= 1, `${m.id}: cubes`);
    assert.ok(existsSync(resolve(m.help)), `${m.id}: help file ${m.help}`);
  }
});

test("the groups follow the design proposal: the featured modes are apps, the rest are cubes", () => {
  const byGroup = (g) => MODE_CATALOG.filter((m) => m.group === g).map((m) => m.id);
  assert.deepEqual(byGroup("apps"), ["clock", "ms-timer", "calendar"]);
  assert.equal(byGroup("cubes").length, 10);
});

test("createRegistry exposes get, has, ids and list in catalog order", () => {
  const reg = createRegistry([meta({ id: "a" }), meta({ id: "b", group: "apps" })].map((m) => ({ ...m, mount: noopMount })));
  assert.deepEqual(reg.ids(), ["a", "b"]);
  assert.equal(reg.has("a"), true);
  assert.equal(reg.has("zzz"), false);
  assert.equal(reg.get("b").group, "apps");
  assert.equal(reg.get("zzz"), undefined);
  assert.deepEqual(reg.list("apps").map((m) => m.id), ["b"]);
  assert.deepEqual(reg.list().map((m) => m.id), ["a", "b"]);
});

test("createRegistry rejects entries that break the mode contract", () => {
  const ok = { ...meta({ id: "a" }), mount: noopMount };
  assert.throws(() => createRegistry([ok, { ...ok }]), /duplicate/);
  assert.throws(() => createRegistry([{ ...ok, mount: undefined }]), /mount/);
  assert.throws(() => createRegistry([{ ...ok, title: "" }]), /title/);
  assert.throws(() => createRegistry([{ ...ok, group: "other" }]), /group/);
  assert.throws(() => createRegistry([{ ...ok, help: "" }]), /help/);
  assert.throws(() => createRegistry([{ ...ok, id: "Bad Id" }]), /id/);
  assert.throws(() => createRegistry([{ ...ok, id: "a.html" }]), /id/);
});


test("the studio select lists exactly the catalog ids, in catalog order", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(resolve("index.html"), "utf8");
  const ids = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, MODE_CATALOG.map((m) => m.id));
});
