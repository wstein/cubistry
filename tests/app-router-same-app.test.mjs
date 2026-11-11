import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../src/apps/registry.ts";
import { createRouter } from "../src/apps/router.ts";
import { createShellHost } from "../src/apps/shell/slot-api.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// Plan "Host, route and state contract": Back/Forward reapplies setup even when the app id is unchanged. The router
// does this with a controlled remount: dispose the instance, mount again with the parameters of the restored URL.

const BASE = "http://localhost/index.html";
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => (resolve = res));
  return { promise, resolve };
};

const rig = (start, mountFor) => {
  const state = { href: start, pushed: [], replaced: [], pop: null };
  const env = {
    href: () => state.href,
    push: (url) => (state.pushed.push(url), (state.href = new URL(url, state.href).href)),
    replace: (url) => (state.replaced.push(url), (state.href = new URL(url, state.href).href)),
    onPop: (cb) => ((state.pop = cb), () => (state.pop = null)),
  };
  const log = [];
  const { doc, regions } = fakeRegions();
  const shellHost = createShellHost(regions, doc);
  const mount = mountFor
    ? (root, params, ctx) => mountFor(log, doc, root, params, ctx)
    : async (_root, params) => {
        log.push(`mount ${params.get("year")}-${params.get("month")}`);
        return { dispose: () => log.push(`dispose ${params.get("year")}-${params.get("month")}`) };
      };
  const registry = createRegistry(
    ["calendar7", "clock"].map((id) => ({ id, title: id, subtitle: id, badge: id, cubes: 1, group: "cubes", help: "docs/APPLICATIONS.md", mount })),
  );
  const router = createRouter({ registry, root: {}, fallback: "clock", env, shellHost });
  // The router starts the remount from the pop listener without returning it, so let the queued work settle.
  const settle = () => new Promise((res) => setTimeout(res, 0));
  const browserTo = async (href) => ((state.href = href), state.pop(), settle());
  return { state, log, doc, regions, router, browserTo };
};

test("Back and Forward within the same app remount with the parameters of the restored URL", async () => {
  const r = rig(`${BASE}?app=calendar7&year=2026&month=11`);
  await r.router.start();
  // The month picker pushes a new URL of the same app and remounts; the router does not see that push as a pop.
  await r.browserTo(`${BASE}?app=calendar7&year=2026&month=12`);
  await r.browserTo(`${BASE}?app=calendar7&year=2026&month=11`); // Back
  assert.equal(r.router.current(), "calendar7");
  assert.equal(r.log.at(-1), "mount 2026-11");
  await r.browserTo(`${BASE}?app=calendar7&year=2027&month=1`); // Forward to an entry with other year and month
  assert.equal(r.log.at(-1), "mount 2027-1");
  assert.deepEqual(r.log, ["mount 2026-11", "dispose 2026-11", "mount 2026-12", "dispose 2026-12", "mount 2026-11", "dispose 2026-11", "mount 2027-1"]);
  assert.deepEqual(r.state.pushed, [], "a pop never pushes");
  assert.deepEqual(r.state.replaced, [], "a valid restored URL is not rewritten");
});

test("a pop within the same app keeps the query and the fragment of the restored entry", async () => {
  const r = rig(`${BASE}?app=calendar7&year=2026&month=11#licenses`);
  await r.router.start();
  const restored = `${BASE}?app=calendar7&year=2026&month=9&outer=1.8#top`;
  await r.browserTo(restored);
  assert.equal(r.state.href, restored);
  assert.equal(r.log.at(-1), "mount 2026-9");
  assert.deepEqual(r.state.replaced, []);
});

test("a pop to the very same URL still disposes and remounts once (controlled remount)", async () => {
  const r = rig(`${BASE}?app=calendar7&year=2026&month=11`);
  await r.router.start();
  await r.browserTo(`${BASE}?app=calendar7&year=2026&month=11`);
  assert.deepEqual(r.log, ["mount 2026-11", "dispose 2026-11", "mount 2026-11"]);
});

test("the remount after a same-app pop gets a fresh shell: nothing of the previous setup stays in the dock", async () => {
  const r = rig(`${BASE}?app=calendar7&year=2026&month=11`, async (log, doc, _root, params, { shell }) => {
    const month = params.get("month");
    shell.setSlot(1, { label: "Month", element: Object.assign(doc.createElement("div"), { textContent: `m${month}` }) });
    if (month === "11") shell.setSlot(4, { label: "Only November", element: doc.createElement("div") });
    shell.setStatus("ready", `month ${month}`);
    return { dispose: () => log.push(`dispose ${month}`) };
  });
  await r.router.start();
  assert.equal(r.regions.slots[4].hidden, false);
  await r.browserTo(`${BASE}?app=calendar7&year=2026&month=12`);
  assert.equal(r.regions.slots[1].children[1].children[0].textContent, "m12");
  assert.equal(r.regions.slots[4].hidden, true, "a slot of the previous setup does not survive the remount");
  assert.deepEqual(r.log, ["dispose 11"]);
});

test("two quick pops: the superseded mount is disposed and the newest URL wins", async () => {
  const gate = deferred();
  const r = rig(`${BASE}?app=calendar7&year=2026&month=11`, async (log, _doc, _root, params, { isCurrent }) => {
    const month = params.get("month");
    if (month === "12") await gate.promise;
    log.push(`mount ${month} current=${isCurrent()}`);
    return { dispose: () => log.push(`dispose ${month}`) };
  });
  await r.router.start();
  r.state.href = `${BASE}?app=calendar7&year=2026&month=12`;
  r.state.pop();
  await r.browserTo(`${BASE}?app=calendar7&year=2026&month=10`);
  gate.resolve();
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(r.router.current(), "calendar7");
  assert.ok(r.log.includes("mount 10 current=true"));
  assert.ok(r.log.includes("dispose 12"), "the superseded mount does not leak");
});
