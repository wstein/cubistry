import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../src/apps/registry.ts";
import { APP_PARAM, parseAppRoute, createRouter } from "../src/apps/router.ts";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

const fakeEnv = (href) => {
  const state = { href, pushed: [], replaced: [], pop: null };
  return {
    state,
    env: {
      href: () => state.href,
      push: (url) => (state.pushed.push(url), (state.href = new URL(url, state.href).href)),
      replace: (url) => (state.replaced.push(url), (state.href = new URL(url, state.href).href)),
      onPop: (cb) => ((state.pop = cb), () => (state.pop = null)),
    },
  };
};

const makeRegistry = (log, overrides = {}) =>
  createRegistry(
    ["clock", "timer", "counter"].map((id) => ({
      id,
      title: id,
      subtitle: id,
      badge: id,
      cubes: 1,
      group: "cubes",
      help: "docs/APPLICATIONS.md",
      mount:
        overrides[id] ??
        (async (root, params, ctx) => {
          log.push(`mount ${id} ${params.toString()}`);
          return { dispose: () => log.push(`dispose ${id}`) };
        }),
    })),
  );

const BASE = "http://localhost/index.html";

test("the key is app", () => {
  assert.equal(APP_PARAM, "app");
});

test("parseAppRoute reads the app key and reports unknown or missing ids", () => {
  const reg = makeRegistry([]);
  assert.deepEqual(parseAppRoute("?app=timer", reg, "clock"), { id: "timer", known: true });
  assert.deepEqual(parseAppRoute("?app=nope", reg, "clock"), { id: "clock", known: false });
  assert.deepEqual(parseAppRoute("", reg, "clock"), { id: "clock", known: false });
  assert.deepEqual(parseAppRoute("?application=timer&mode=timer", reg, "clock"), { id: "clock", known: false });
});

test("start mounts the app from the URL and hands over the other parameters without the app key", async () => {
  const log = [];
  const { env, state } = fakeEnv(`${BASE}?app=timer&val=45&kiosk=1`);
  const router = createRouter({ registry: makeRegistry(log), root: {}, fallback: "clock", env });
  assert.equal(await router.start(), true);
  assert.deepEqual(log, ["mount timer val=45&kiosk=1"]);
  assert.equal(router.current(), "timer");
  assert.deepEqual(state.pushed, []);
  assert.deepEqual(state.replaced, [], "a valid deep link is not rewritten, so ?val=45 survives a reload");
});

test("an unknown id mounts the fallback and corrects the URL in place", async () => {
  const log = [];
  const { env, state } = fakeEnv(`${BASE}?app=nope&val=45`);
  const router = createRouter({ registry: makeRegistry(log), root: {}, fallback: "clock", env });
  await router.start();
  assert.equal(router.current(), "clock");
  assert.deepEqual(state.replaced, ["/index.html?app=clock&val=45"]);
});

test("go switches without a reload, disposes the previous mode once and drops the app-scoped parameters", async () => {
  const log = [];
  const { env, state } = fakeEnv(`${BASE}?app=timer&val=45&duration=00:05&kiosk=1&lettering=words-pascal`);
  const router = createRouter({ registry: makeRegistry(log), root: {}, fallback: "clock", env });
  await router.start();
  assert.equal(await router.go("counter"), true);
  assert.deepEqual(state.pushed, ["/index.html?app=counter&kiosk=1&lettering=words-pascal"]);
  assert.deepEqual(log.slice(1), ["dispose timer", "mount counter kiosk=1&lettering=words-pascal"]);
  assert.equal(router.current(), "counter");
});

test("go to the current app keeps its parameters", async () => {
  const log = [];
  const { env, state } = fakeEnv(`${BASE}?app=timer&val=45`);
  const router = createRouter({ registry: makeRegistry(log), root: {}, fallback: "clock", env });
  await router.start();
  await router.go("timer");
  assert.deepEqual(state.pushed, [], "same URL, nothing to push");
  assert.equal(log.at(-1), "mount timer val=45");
});

test("back and forward mount the app of the URL with its parameters and without pushing history", async () => {
  const log = [];
  const { env, state } = fakeEnv(`${BASE}?app=timer&val=45`);
  const router = createRouter({ registry: makeRegistry(log), root: {}, fallback: "clock", env });
  await router.start();
  await router.go("counter");
  assert.equal(state.href, `${BASE}?app=counter`);
  state.href = `${BASE}?app=timer&val=45`; // the browser restores the earlier URL on Back
  await state.pop();
  assert.equal(router.current(), "timer");
  assert.deepEqual(state.pushed, ["/index.html?app=counter"]);
  assert.deepEqual(state.replaced, []);
  assert.deepEqual(log, ["mount timer val=45", "dispose timer", "mount counter ", "dispose counter", "mount timer val=45"]);
});

test("back to an unknown id mounts the fallback and corrects the URL in place", async () => {
  const log = [];
  const { env, state } = fakeEnv(`${BASE}?app=timer`);
  const router = createRouter({ registry: makeRegistry(log), root: {}, fallback: "clock", env });
  await router.start();
  state.href = `${BASE}?app=nope&kiosk=1`;
  await state.pop();
  assert.equal(router.current(), "clock");
  assert.deepEqual(state.replaced, ["/index.html?app=clock&kiosk=1"]);
  assert.deepEqual(state.pushed, []);
});

test("a switch that is superseded while it mounts disposes its mode and reports nothing", async () => {
  const log = [];
  const slow = deferred();
  const registry = makeRegistry(log, {
    timer: async () => {
      await slow.promise;
      return { dispose: () => log.push("dispose timer") };
    },
  });
  const { env } = fakeEnv(`${BASE}?app=clock`);
  const mounted = [];
  const router = createRouter({ registry, root: {}, fallback: "clock", env, onMounted: (m) => mounted.push(m.id) });
  await router.start();
  const first = router.go("timer");
  const second = router.go("counter");
  slow.resolve();
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.deepEqual(mounted, ["clock", "counter"]);
  assert.ok(log.includes("dispose timer"));
  assert.equal(router.current(), "counter");
});

test("a mount that throws is reported with its id", async () => {
  const errors = [];
  const registry = makeRegistry([], {
    timer: async () => {
      throw new Error("boom");
    },
  });
  const { env } = fakeEnv(`${BASE}?app=timer`);
  const router = createRouter({ registry, root: {}, fallback: "clock", env, onError: (err, id) => errors.push([id, err.message]) });
  assert.equal(await router.start(), false);
  assert.deepEqual(errors, [["timer", "boom"]]);
});

test("onBefore runs for the new mode before its mount", async () => {
  const log = [];
  const { env } = fakeEnv(`${BASE}?app=clock`);
  const router = createRouter({
    registry: makeRegistry(log),
    root: {},
    fallback: "clock",
    env,
    onBefore: (m) => log.push(`before ${m.id}`),
  });
  await router.start();
  await router.go("timer");
  assert.deepEqual(log, ["before clock", "mount clock ", "dispose clock", "before timer", "mount timer "]);
});

test("dispose unregisters the history listener and disposes the active mode", async () => {
  const log = [];
  const { env, state } = fakeEnv(`${BASE}?app=timer`);
  const router = createRouter({ registry: makeRegistry(log), root: {}, fallback: "clock", env });
  await router.start();
  router.dispose();
  assert.equal(state.pop, null);
  assert.deepEqual(log, ["mount timer ", "dispose timer"]);
});
