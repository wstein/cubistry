import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../src/apps/registry.ts";
import { createRouter } from "../src/apps/router.ts";
import { createShellHost } from "../src/apps/shell/slot-api.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// The router hands each mount its own ModeShell and cleans the shell up with the mode.

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => (resolve = res));
  return { promise, resolve };
};
const fakeEnv = (href) => {
  const state = { href };
  return {
    href: () => state.href,
    push: (url) => (state.href = new URL(url, state.href).href),
    replace: (url) => (state.href = new URL(url, state.href).href),
    onPop: () => () => {},
  };
};
const meta = (id, mount) => ({ id, title: id, subtitle: id, badge: id, cubes: 1, group: "cubes", help: "docs/APPLICATIONS.md", mount });
const BASE = "http://localhost/index.html";

const rig = (mounts) => {
  const { doc, regions } = fakeRegions();
  const shellHost = createShellHost(regions, doc);
  const registry = createRegistry(Object.entries(mounts).map(([id, mount]) => meta(id, mount)));
  const router = createRouter({ registry, root: {}, fallback: Object.keys(mounts)[0], env: fakeEnv(`${BASE}?app=${Object.keys(mounts)[0]}`), shellHost });
  return { doc, regions, router };
};
const el = (doc, text) => Object.assign(doc.createElement("div"), { textContent: text });

test("a mode receives a shell in its mount context and fills a slot through it", async () => {
  const seen = {};
  const { doc, regions, router } = rig({
    a: async (_root, _params, ctx) => {
      seen.shell = ctx.shell;
      ctx.shell.setSlot(1, { label: "Action", element: el(doc, "run") });
      return { dispose() {} };
    },
  });
  await router.start();
  assert.equal(typeof seen.shell.setSlot, "function");
  assert.equal(regions.slots[1].hidden, false);
});

test("switching modes leaves no slot, status, primary action or listener of the previous mode", async () => {
  let button;
  const { doc, regions, router } = rig({
    a: async (_r, _p, { shell }) => {
      shell.setSlot(2, { label: "Value", element: el(doc, "a") });
      shell.setSlot(4, { label: "Motion", element: el(doc, "a") });
      shell.setPrimaryAction({ label: "Run", onClick: () => {} });
      button = regions.primary.children[0];
      shell.setStatus("moving");
      shell.setNerd({ title: "Nerd", render: () => {} });
      return { dispose() {} };
    },
    b: async (_r, _p, { shell }) => {
      shell.setSlot(1, { label: "Action", element: el(doc, "b") });
      return { dispose() {} };
    },
  });
  await router.start();
  await router.go("b");
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => regions.slots[n].hidden), [false, true, true, true, true]);
  assert.equal(regions.primary.hidden, true);
  assert.equal(regions.status.children.length, 0);
  assert.equal(regions.nerdToggle.hidden, true);
  assert.equal(button.listenerCount("click"), 0, "the old primary button lost its handler");
});

test("a mode superseded during its async init cannot fill slots of the next mode", async () => {
  const gate = deferred();
  const { doc, regions, router } = rig({
    slow: async (_r, _p, { shell, isCurrent }) => {
      await gate.promise;
      // A mode that does not check isCurrent() still cannot write: the shell is guarded.
      shell.setSlot(3, { label: "Late", element: el(doc, "late") });
      shell.setStatus("error", "late");
      assert.equal(isCurrent(), false);
      return { dispose() {} };
    },
    fast: async (_r, _p, { shell }) => {
      shell.setSlot(1, { label: "Action", element: el(doc, "fast") });
      return { dispose() {} };
    },
  });
  const first = router.start();
  await router.go("fast");
  gate.resolve();
  await first;
  assert.equal(regions.slots[3].hidden, true);
  assert.equal(regions.status.children.length, 0);
  assert.equal(regions.slots[1].children[1].children[0].textContent, "fast");
});

test("a mount that throws leaves no partial content behind", async () => {
  const errors = [];
  const { doc, regions } = fakeRegions();
  const shellHost = createShellHost(regions, doc);
  const registry = createRegistry([
    meta("bad", async (_r, _p, { shell }) => {
      shell.setSlot(1, { label: "Action", element: el(doc, "x") });
      throw new Error("init failed");
    }),
  ]);
  const router = createRouter({ registry, root: {}, fallback: "bad", env: fakeEnv(`${BASE}?app=bad`), shellHost, onError: (e) => errors.push(e.message) });
  assert.equal(await router.start(), false);
  assert.deepEqual(errors, ["init failed"]);
  assert.equal(regions.slots[1].hidden, true);
});

test("router.dispose empties the shell", async () => {
  const { doc, regions, router } = rig({
    a: async (_r, _p, { shell }) => (shell.setSlot(5, { label: "Print", element: el(doc, "p") }), { dispose() {} }),
  });
  await router.start();
  router.dispose();
  await Promise.resolve();
  assert.equal(regions.slots[5].hidden, true);
});

test("without a shell host the mode still gets a working (inert) shell", async () => {
  let ok = false;
  const registry = createRegistry([meta("a", async (_r, _p, { shell }) => ((ok = typeof shell.setSlot === "function"), shell.setStatus("ready"), undefined))]);
  const router = createRouter({ registry, root: {}, fallback: "a", env: fakeEnv(`${BASE}?app=a`) });
  assert.equal(await router.start(), true);
  assert.equal(ok, true);
});
