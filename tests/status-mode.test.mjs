// SPDX-License-Identifier: AGPL-3.0-or-later
// CI Quality Cube as the mode `ci` of index.html: registry entry, URL parameters and the mount with fakes
// (no browser, no WebGL, no network): slots, chip, primary action, readout, Nerd drawer, cancelled and disposed mounts.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { stateEquals } from "@cubistry/cube-core";
import { validatePresentation } from "@cubistry/cube-mechanics";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { createRegistry } from "../src/apps/registry.ts";
import { QualityPolicy } from "../src/apps/status/policy.ts";
import { validateStatusDefinition } from "../src/apps/status/definition.ts";
import { DEFAULT_TURN_MS, TURN_CHOICES, parseStatusParams, serializeStatusParams } from "../src/apps/status/params.ts";
import { mountStatus, statusController } from "../src/apps/status/mount.ts";
import { urlAfterAppSwitch } from "../src/app-switch-url.mjs";

const definition = validateStatusDefinition(JSON.parse(readFileSync("src/apps/status/definition.json", "utf8")));
const policy = new QualityPolicy(definition, readFileSync("public/assets/quality/distances.u8"));
const q = (s) => new URLSearchParams(s);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("the catalog lists ci as a one-cube mode in the cubes group with the status help page", () => {
  const m = MODE_CATALOG.find((x) => x.id === "ci");
  assert.ok(m);
  assert.equal(m.title, "CI Quality Cube");
  assert.equal(m.cubes, 1);
  assert.equal(m.group, "cubes");
  assert.equal(m.help, "docs/STATUS_CUBE.md");
  assert.ok(existsSync(m.help));
  assert.ok(createRegistry(MODE_CATALOG.map((x) => ({ ...x, mount: async () => {} }))).has("ci"));
});

test("the studio select has a ci option and the legacy page and its Vite input stay", () => {
  assert.match(readFileSync("index.html", "utf8"), /<option value="ci">CI Quality Cube \(1 cube\)<\/option>/);
  assert.ok(existsSync("status.html"));
  assert.match(readFileSync("vite.config.mjs", "utf8"), /status: fileURLToPath\(new URL\("\.\/status\.html"/);
});

test("parameters: defaults, valid values, invalid values per parameter, and the round trip", () => {
  const d = parseStatusParams(q(""), definition);
  assert.equal(d.turnMs, DEFAULT_TURN_MS);
  assert.equal(DEFAULT_TURN_MS, 250);
  assert.deepEqual([...d.snapshot], [...definition.initial]);
  assert.deepEqual([...TURN_CHOICES], [500, 250, 100, 50]);

  const v = parseStatusParams(q("turn=100&build=ok&test=running&analyze=error&review=blocked"), definition);
  assert.equal(v.turnMs, 100);
  assert.deepEqual([...v.snapshot], ["ok", "running", "error", "blocked"]);

  // An invalid value falls back for that parameter only.
  const bad = parseStatusParams(q("turn=123&build=nope&test=ok&analyze=&review=OK"), definition);
  assert.equal(bad.turnMs, 250);
  assert.deepEqual([...bad.snapshot], ["open", "ok", "open", "open"]);
  assert.equal(parseStatusParams(q("turn=50x"), definition).turnMs, 250);
  assert.equal(parseStatusParams(q("turn=050"), definition).turnMs, 250);
  assert.equal(parseStatusParams(q("turn=500&turn=50"), definition).turnMs, 500, "the first value counts");

  // Serialization leaves defaults out and parses back to the same value.
  assert.equal(serializeStatusParams(d, definition).toString(), "");
  assert.equal(serializeStatusParams(v, definition).toString(), "turn=100&build=ok&test=running&analyze=error&review=blocked");
  for (const value of [d, v, bad]) {
    const back = parseStatusParams(serializeStatusParams(value, definition), definition);
    assert.equal(back.turnMs, value.turnMs);
    assert.deepEqual([...back.snapshot], [...value.snapshot]);
  }
  assert.equal(serializeStatusParams({ turnMs: 250, snapshot: ["open", "ok", "open", "open"] }, definition).toString(), "test=ok");
});

test("the status parameters belong to the application and are dropped on an app switch", () => {
  const href = "http://x/index.html?app=ci&turn=100&build=ok&test=ok&analyze=ok&review=ok&nerd=1";
  assert.equal(urlAfterAppSwitch(href, "ci", "clock"), "/index.html?app=ci&nerd=1");
  assert.equal(urlAfterAppSwitch(href, "ci", "ci"), "/index.html?app=ci&turn=100&build=ok&test=ok&analyze=ok&review=ok&nerd=1");
});

// ----- a small fake DOM and a recording shell
class El {
  constructor(tag) {
    Object.assign(this, { tagName: tag.toUpperCase(), children: [], attrs: {}, dataset: {}, listeners: {}, textContent: "", id: "", className: "", value: "", disabled: false });
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  fire(type) {
    for (const fn of this.listeners[type] ?? []) fn({ type });
  }
  find(id) {
    if (this.id === id) return this;
    for (const c of this.children) {
      const hit = c.find?.(id);
      if (hit) return hit;
    }
    return null;
  }
}
const doc = { createElement: (tag) => new El(tag) };

function fixture({ current = () => true, definitionRaw, configureError = false } = {}) {
  const log = [];
  const slots = {};
  const guarded = [];
  let primary = null;
  const shell = {
    setSlot: (n, spec) => ((slots[n] = spec), log.push(`slot${n}`)),
    clearSlot() {},
    clearSlots() {},
    setPrimaryAction(spec) {
      primary = { spec, disabled: !!spec.disabled };
      log.push(`primary:${spec.label}`);
      const mine = primary;
      return { update: (p) => (p.disabled !== undefined && (mine.disabled = p.disabled), log.push("primary-update")) };
    },
    clearPrimaryAction() {},
    setStatus: (state, text) => (log.push(`status:${state}`), (shell.chip = { state, text })),
    clearStatus() {},
    setWarning() {},
    setError: (row) => (log.push(`error:${row ? row.text : "none"}`), (shell.errorRow = row)),
    setReadout: (items) => (log.push("readout"), (shell.readout = items.map((i) => i.value))),
    updateReadout: (i, v) => (log.push("readout-update"), (shell.readout[i] = v)),
    clearReadout() {},
    setNerd: (spec) => ((shell.nerd = spec), log.push("nerd")),
    refreshNerd: () => log.push("nerd-refresh"),
    clearNerd() {},
    setHint() {},
    setReferenceView() {},
    listen(target, type, handler) {
      target.addEventListener(type, handler);
      guarded.push(() => target.removeEventListener(type, handler));
    },
    onDispose() {},
    dispose() {},
  };
  const pending = [];
  let pose, printing;
  const counts = { destroyed: 0, speed: [], assetsDisposed: 0, reloads: 0, configures: 0 };
  const viewer = {
    configure(print, state) {
      if (configureError) throw Error("Synthetic viewer configuration failure");
      printing = print;
      pose = state;
      counts.configures++;
    },
    resetCamera() {},
    animate(p) {
      validatePresentation(p, printing);
      assert(stateEquals(pose, p.from));
      return new Promise((resolve) => pending.push({ p, resolve: () => ((pose = p.to), resolve()) }));
    },
    setAnimationSpeed: (speed, kind) => counts.speed.push([speed, kind]),
    destroy: () => counts.destroyed++,
  };
  let release;
  const gate = new Promise((r) => (release = r));
  const env = {
    doc,
    definition: definitionRaw ?? JSON.parse(readFileSync("src/apps/status/definition.json", "utf8")),
    createViewer: () => viewer,
    baseMoveMs: 75,
    resolveAssets: async (manifest) => ({ manifest, textureOrigin: "bottom-left", images: new Map(), materials: new Map(), dispose: () => counts.assetsDisposed++ }),
    resolvePolicy: async () => (await gate, policy),
    reload: () => counts.reloads++,
    replaceParams: (own, keys) => ((env.urlOwn = own.toString()), (env.urlKeys = keys)),
    wait: () => Promise.resolve(),
  };
  const root = new El("div");
  const ctx = { isCurrent: current, shell };
  const find = (id) => {
    for (const spec of [{ element: root }, ...Object.values(slots)]) {
      for (const el of [spec.element].flat()) {
        const hit = el.find?.(id);
        if (hit) return hit;
      }
    }
    return null;
  };
  return { env, root, ctx, shell, log, slots, pending, counts, release, find, get primary() { return primary; }, guarded };
}
async function step(f) {
  assert.equal(f.pending.length, 1);
  f.pending.shift().resolve();
  await flush();
}
async function settle(f) {
  for (let n = 0; f.pending.length && n < 40; n++) await step(f);
}

test("mount fills dock slots 1 and 2, the chip, primary action, readout and the Nerd drawer through the shell", async () => {
  const f = fixture();
  const loading = mountStatus(f.root, q(""), f.ctx, f.env);
  await flush();
  assert.deepEqual(f.shell.chip, { state: "sync", text: "Loading the fixed workflow print…" });
  assert.equal(f.find("status-build").disabled, true, "controls wait for the print");
  f.release();
  const instance = await loading;
  assert.equal(typeof instance?.dispose, "function");
  assert.deepEqual(Object.keys(f.slots), ["1", "2"]);
  assert.equal(f.slots[1].label, "Simulated events");
  assert.equal(f.slots[2].label, "Workflow");
  assert.equal(f.primary.spec.label, "Send event");
  assert.equal(f.primary.disabled, false);
  assert.deepEqual(f.shell.readout, ["0 / 0 HTM", "0"]);
  assert.match(f.shell.chip.text, /^In sync · BUILD: Open · TEST: Open · ANALYZE: Open · REVIEW: Open$/);
  assert.equal(f.shell.nerd.title, "Recent local events");
  const drawer = new El("div");
  f.shell.nerd.render(drawer);
  const [facts] = drawer.children;
  assert.deepEqual(facts.children.map((c) => c.textContent), ["Last completed snapshot", "BUILD: Open · TEST: Open · ANALYZE: Open · REVIEW: Open", "Requested snapshot", "BUILD: Open · TEST: Open · ANALYZE: Open · REVIEW: Open"]);
  assert.equal(f.shell.chip.state, "done");
  assert.equal(f.find("status-viewer").dataset.sync, "idle");
  assert.equal(f.find("status-viewer").dataset.appearanceDock, "view-controls");
  assert.equal(f.find("status-viewer").dataset.current, "open,open,open,open");
  assert.equal(f.find("status-front").textContent, "BUILD OFFEN · TEST OFFEN · ANALYZE OFFEN · REVIEW OFFEN");
  assert.ok(statusController, "the controller hook is set while mounted");
  instance.dispose();
  assert.equal(statusController, null, "the hook is cleared on dispose");
});

test("a send event action moves the cube, writes history to the Nerd drawer and leaves the URL parameters alone", async () => {
  const f = fixture();
  f.release();
  const instance = await mountStatus(f.root, q(""), f.ctx, f.env);
  f.find("status-event").value = "start";
  f.primary.spec.onClick();
  await flush();
  assert.equal(f.find("status-viewer").dataset.requested, "running,open,open,open");
  assert.equal(f.find("status-viewer").dataset.sync, "moving");
  assert.equal(f.shell.chip.state, "moving");
  assert.equal(f.env.urlOwn, "", "the address bar only follows turn; a reload recovers to the initial snapshot");
  assert.ok(f.log.includes("nerd-refresh"));
  const body = new El("div");
  f.shell.nerd.render(body);
  assert.match(body.children[1].children.map((li) => li.textContent).join("|"), /build: Start or retry/);
  assert.equal(body.children[0].children[3].textContent, "BUILD: Running · TEST: Open · ANALYZE: Open · REVIEW: Open", "the drawer shows the requested snapshot");
  await settle(f);
  assert.equal(f.find("status-viewer").dataset.current, "running,open,open,open");
  // A transition that the workflow rejects shows an error row and leaves the cube alone.
  f.find("status-event").value = "passed";
  f.find("status-event-category").value = "test";
  f.primary.spec.onClick();
  assert.match(f.shell.errorRow.text, /not allowed/);
  assert.equal(f.find("status-viewer").dataset.requested, "running,open,open,open");
  instance.dispose();
});

test("URL parameters set the quarter-turn time and the requested snapshot after loading", async () => {
  const f = fixture();
  f.release();
  const instance = await mountStatus(f.root, q("turn=100&build=ok&review=blocked"), f.ctx, f.env);
  assert.deepEqual(f.counts.speed[0], [75 / 100, "quarter-turn"]);
  assert.equal(f.find("status-speed").value, "100");
  assert.equal(f.env.urlOwn, "turn=100", "the category parameters are consumed and leave the address bar");
  assert.deepEqual(f.env.urlKeys, ["turn", "build", "test", "analyze", "review"]);
  assert.equal(f.find("status-viewer").dataset.requested, "ok,open,open,blocked");
  assert.equal(f.find("status-build").value, "ok");
  await settle(f);
  assert.equal(f.find("status-viewer").dataset.current, "ok,open,open,blocked");
  f.find("status-speed").value = "50";
  f.find("status-speed").fire("change");
  assert.deepEqual(f.counts.speed.at(-1), [75 / 50, "quarter-turn"]);
  assert.equal(f.env.urlOwn, "turn=50");
  instance.dispose();
});

test("invalid URL parameters leave the defaults and request nothing", async () => {
  const f = fixture();
  f.release();
  const instance = await mountStatus(f.root, q("turn=7&build=bogus"), f.ctx, f.env);
  assert.equal(f.find("status-speed").value, "250");
  assert.equal(f.pending.length, 0);
  assert.equal(f.find("status-viewer").dataset.requested, "open,open,open,open");
  instance.dispose();
});

test("a mount that is superseded while its print loads releases the viewer, returns nothing and writes nothing later", async () => {
  let live = true;
  const f = fixture({ current: () => live });
  const loading = mountStatus(f.root, q("build=ok"), f.ctx, f.env);
  await flush();
  live = false;
  const before = f.log.length;
  f.release();
  assert.equal(await loading, undefined);
  assert.equal(f.counts.destroyed, 1);
  assert.equal(statusController, null);
  assert.equal(f.pending.length, 0, "the requested snapshot of the URL is not started");
  assert.equal(f.log.length, before, "no shell write after the supersession");
});

test("dispose while the cube moves finishes the active snapshot and then destroys the viewer once", async () => {
  const f = fixture();
  f.release();
  const instance = await mountStatus(f.root, q("build=ok&test=ok"), f.ctx, f.env);
  assert.ok(f.pending.length > 0);
  instance.dispose();
  assert.equal(f.counts.destroyed, 0, "the viewer cannot be destroyed while it animates");
  const before = f.log.length;
  await settle(f);
  assert.equal(f.counts.destroyed, 1);
  assert.equal(f.counts.assetsDisposed, 1);
  assert.equal(f.log.length, before, "no shell write after dispose");
  instance.dispose();
  assert.equal(f.counts.destroyed, 1, "a second dispose does nothing");
});

test("dispose stops a running demo", async () => {
  const f = fixture();
  f.env.wait = () => new Promise((r) => setImmediate(r));
  f.release();
  const instance = await mountStatus(f.root, q(""), f.ctx, f.env);
  f.find("status-demo").fire("click");
  await flush();
  assert.equal(f.find("status-demo").textContent, "Stop demo");
  instance.dispose();
  await settle(f);
  for (let i = 0; i < 5; i++) await flush();
  assert.equal(f.counts.destroyed, 1);
  assert.equal(f.pending.length, 0, "no further turn after dispose");
});

test("a failed print load keeps the controls off, shows the error and offers Reload as the primary action", async () => {
  const f = fixture();
  f.env.resolvePolicy = async () => {
    throw Error("Synthetic certificate integrity failure");
  };
  const instance = await mountStatus(f.root, q(""), f.ctx, f.env);
  assert.equal(typeof instance?.dispose, "function");
  assert.equal(f.shell.chip.state, "error");
  assert.match(f.shell.errorRow.text, /integrity/);
  const drawer = new El("div");
  f.shell.nerd.render(drawer);
  assert.equal(drawer.children[0].children[1].textContent, "Not configured");
  assert.equal(f.find("status-build").disabled, true);
  assert.equal(f.find("status-viewer").dataset.sync, "failed");
  assert.equal(f.primary.spec.label, "Reload application");
  assert.equal(f.primary.disabled, false);
  f.primary.spec.onClick();
  assert.equal(f.counts.reloads, 1);
  instance.dispose();
});
