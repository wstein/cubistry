// SPDX-License-Identifier: AGPL-3.0-or-later
// The Picture Cube as the mode `playground` of index.html: the mount with fakes (no browser, no WebGL, no network).
// Covers the lifecycle rules of the Picture Cube host plan: stale mounts write nothing, dispose releases what is
// pending, the viewer is not destroyed mid-turn, the size control is disabled while a turn, solve or load is pending
// (D7) and a size change replaces the history entry (D8). No `document` or `window` global may be read.
import test from "node:test";
import assert from "node:assert/strict";
import { validatePresentation } from "@cubistry/cube-mechanics";
import { stateEquals } from "@cubistry/cube-core";
import { mountPlayground } from "../src/apps/playground/mount.ts";
import { THEMES } from "../src/apps/playground/themes.ts";

const q = (s) => new URLSearchParams(s);
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};

class El {
  constructor(tag) {
    Object.assign(this, {
      tagName: tag.toUpperCase(),
      children: [],
      attrs: {},
      dataset: {},
      listeners: {},
      textContent: "",
      id: "",
      className: "",
      value: "",
      title: "",
      disabled: false,
      hidden: false,
      tabIndex: 0,
    });
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = [...nodes];
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  fire(type, event = {}) {
    for (const fn of this.listeners[type] ?? []) fn({ type, preventDefault() {}, target: this, ...event });
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

function fixture({ current = () => true, hold = [], factory } = {}) {
  const slots = {};
  const listened = [];
  const shell = {
    setSlot: (n, spec) => (slots[n] = spec),
    clearSlot() {},
    clearSlots() {},
    setPrimaryAction(spec) {
      const mine = { spec, disabled: !!spec.disabled };
      shell.primary = mine;
      return { update: (p) => Object.assign(mine, p) };
    },
    clearPrimaryAction() {},
    setStatus: (state, text) => (shell.chip = { state, text }),
    clearStatus() {},
    setWarning() {},
    setError: (row) => (shell.errorRow = row),
    setReadout: (items) => (shell.readout = items.map((i) => i.value)),
    updateReadout: (i, v) => (shell.readout[i] = v),
    clearReadout() {},
    setNerd: (spec) => (shell.nerd = spec),
    refreshNerd() {},
    clearNerd() {},
    setHint() {},
    setReferenceView() {},
    listen(target, type, handler) {
      listened.push({ target, type });
      target.addEventListener(type, handler, { via: "shell" });
    },
    onDispose() {},
    dispose() {},
  };
  const pending = [];
  const held = [];
  const frames = [];
  const counts = { created: 0, destroyed: 0, assetsDisposed: 0, picturesDisposed: 0, direct: 0, push: 0, replace: [] };
  let pose, printing;
  const viewer = {
    animating: false,
    presentedState: null,
    configure(print, state) {
      printing = print;
      pose = state;
      this.presentedState = state;
    },
    animate(p) {
      validatePresentation(p, printing);
      assert(stateEquals(pose, p.from));
      this.animating = true;
      return new Promise((resolve) =>
        pending.push({
          p,
          resolve: () => {
            pose = p.to;
            this.presentedState = p.to;
            this.animating = false;
            resolve();
          },
        }),
      );
    },
    setAnimationSpeed() {},
    resetCamera() {},
    destroy: () => counts.destroyed++,
  };
  const keys = new El("keys");
  keys.addEventListener = function (type, fn, opts) {
    if (opts?.via !== "shell") counts.direct++;
    El.prototype.addEventListener.call(this, type, fn);
  };
  const env = {
    doc: { createElement: (tag) => new El(tag) },
    createViewer: () => (counts.created++, viewer),
    baseMoveMs: 75,
    loadAssets(design) {
      const assets = { dispose: () => counts.assetsDisposed++ };
      if (!hold.includes(design.style)) return Promise.resolve(assets);
      return new Promise((resolve) => held.push({ style: design.style, release: () => resolve(assets) }));
    },
    solverFactory: factory,
    createPictures(region, hooks) {
      env.hooks = hooks;
      env.region = region;
      return { styleChanged() {}, dispose: () => counts.picturesDisposed++ };
    },
    keys,
    replaceParams: (own, keysOwned) => counts.replace.push([own.toString(), [...keysOwned]]),
    pushParams: () => counts.push++,
    nextFrame: (fn) => frames.push(fn),
  };
  const root = new El("div");
  const ctx = { isCurrent: current, shell };
  const find = (id) => {
    for (const spec of [{ element: root }, ...Object.values(slots)]) {
      for (const el of [spec.element].flat()) {
        const hit = el?.find?.(id);
        if (hit) return hit;
      }
    }
    return null;
  };
  const start = (search = "") => mountPlayground(root, q(search), ctx, env);
  const turn = async () => {
    assert.ok(pending.length > 0, "a turn is animating");
    pending.shift().resolve();
    await flush();
  };
  const settle = async () => {
    for (let i = 0; i < 60 && pending.length; i++) await turn();
  };
  return { env, root, ctx, shell, slots, pending, held, frames, counts, find, start, turn, settle, viewer, listened, keys };
}
const scramble = (f, count = "2") => {
  f.find("playground-seed").value = "1";
  f.find("playground-count").value = count;
  f.find("playground-scramble-form").fire("submit");
};
// Runs the frames queued so far; a release that must wait queues itself again.
const frames = (f) => f.frames.splice(0).forEach((fn) => fn());
const sizeButtons = (f) => [2, 3, 4, 5, 6, 7].map((n) => f.find(`playground-size-${n}`));

test("the mount builds inside root, fills the five slots and reads no document or window global", async () => {
  const trap = (name) => Object.defineProperty(globalThis, name, { configurable: true, get: () => assert.fail(`${name} was read`) });
  trap("document");
  trap("window");
  try {
    const f = fixture();
    const instance = await f.start();
    await flush();
    assert.equal(typeof instance.dispose, "function");
    assert.ok(f.root.find("playground-cube"), "the viewer host is inside root");
    assert.ok(f.root.find("playground-pictures"), "the pictures region is inside root");
    assert.deepEqual([1, 2, 3, 4, 5].map((n) => f.slots[n].label), ["Scramble", "Turns", "Size and history", "Move time", "Design"]);
    assert.equal(f.shell.primary.spec.label, "Solve exact target");
    assert.equal(f.find("playground-move-R").dataset.move, "R");
    assert.equal(f.root.find("playground-cube").attrs["aria-busy"], "false");
    assert.equal(f.counts.created, 1);
    instance.dispose();
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});

test("key listeners go through shell.listen only, and the face keys are ignored while a text field has focus", async () => {
  const f = fixture();
  const instance = await f.start();
  await flush();
  assert.equal(f.counts.direct, 0, "no listener is added behind the shell's back");
  assert.ok(f.listened.some((l) => l.target === f.keys && l.type === "keydown"));
  f.keys.fire("keydown", { key: "r", target: { tagName: "INPUT" } });
  assert.equal(f.pending.length, 0, "typing in the notation field turns nothing");
  f.keys.fire("keydown", { key: "r", target: { tagName: "DIV" } });
  await flush();
  assert.equal(f.pending.length, 1, "R outside a field turns the face");
  await f.turn();
  f.keys.fire("keydown", { key: "u", shiftKey: true, ctrlKey: true, target: { tagName: "DIV" } });
  assert.equal(f.pending.length, 0, "a modifier key is not a turn");
  instance.dispose();
  f.keys.fire("keydown", { key: "r", target: { tagName: "DIV" } });
  await flush();
  assert.equal(f.pending.length, 0, "a disposed mount ignores keys");
});

test("a mount that is replaced while its assets load writes nothing: no viewer, assets released", async () => {
  let current = true;
  const f = fixture({ current: () => current, hold: ["picture"] });
  const result = f.start();
  await flush();
  assert.equal(f.held.length, 1);
  current = false;
  f.held[0].release();
  assert.equal(await result, undefined);
  assert.equal(f.counts.created, 0, "no viewer is created for a stale mount");
  assert.equal(f.counts.assetsDisposed, 1);
  assert.equal(f.counts.picturesDisposed, 1);
});

test("a failed start reports the error and leaves no enabled control", async () => {
  const f = fixture();
  f.env.loadAssets = () => Promise.reject(Error("untrusted asset"));
  const instance = await f.start();
  await flush();
  assert.equal(typeof instance.dispose, "function");
  assert.equal(f.counts.created, 0, "no viewer without assets");
  assert.match(f.shell.chip.text, /Unable to start: untrusted asset/);
  const ids = ["playground-apply", "playground-notation", "playground-undo", "playground-redo", "playground-scramble", "playground-new-session", "playground-move-R"];
  for (const id of ids) assert.equal(f.find(id).disabled, true, id);
  instance.dispose();
});

test("dispose releases the viewer, the assets and the pictures panel once", async () => {
  const f = fixture();
  const instance = await f.start();
  await flush();
  instance.dispose();
  instance.dispose();
  await flush();
  frames(f);
  assert.deepEqual([f.counts.destroyed, f.counts.assetsDisposed, f.counts.picturesDisposed], [1, 1, 1]);
});

test("dispose during a legal turn destroys the viewer only after the turn settled", async () => {
  const f = fixture();
  const instance = await f.start();
  await flush();
  scramble(f);
  await flush();
  assert.equal(f.pending.length, 1);
  instance.dispose();
  await flush();
  frames(f);
  assert.equal(f.counts.destroyed, 0, "the viewer is still animating");
  await f.turn();
  frames(f);
  assert.equal(f.counts.destroyed, 1);
  assert.equal(f.pending.length, 0, "the cancelled word plays no further turn");
});

test("D7: the size control is disabled while a turn, a design load or a solve is pending, and enabled again afterwards", async () => {
  let gate;
  const solverReady = new Promise((r) => (gate = r));
  const f = fixture({ hold: ["pastel"], factory: () => solverReady });
  const instance = await f.start();
  await flush();
  const [two, ...rest] = sizeButtons(f);
  assert.equal(two.disabled, false);
  assert.ok(rest.every((b) => b.disabled), "sizes 3 to 7 stay disabled, they have no engine");

  scramble(f);
  await flush();
  assert.equal(two.disabled, true, "disabled while a turn animates");
  await f.settle();
  assert.equal(two.disabled, false);

  const design = f.find("playground-design");
  design.value = "pastel";
  design.fire("change");
  await flush();
  assert.equal(two.disabled, true, "disabled while a design loads");
  f.held[0].release();
  await flush();
  assert.equal(two.disabled, false);

  f.shell.primary.spec.onClick();
  await flush();
  assert.equal(two.disabled, true, "disabled while the solver loads");
  instance.dispose();
  gate({ solve: () => [] });
});

test("D8: a size change replaces the address-bar entry and never pushes", async () => {
  const f = fixture();
  const instance = await f.start();
  await flush();
  assert.deepEqual(f.counts.replace, [], "mounting writes no size");
  f.find("playground-size-2").fire("click");
  assert.deepEqual(f.counts.replace, [["size=2", ["size"]]]);
  assert.equal(f.counts.push, 0);
  instance.dispose();
});

test("size=3 and an invalid size show the note and play the 2x2", async () => {
  for (const [search, note] of [
    ["size=3", /3×3 is not playable yet\. Showing 2×2\./],
    ["size=9", /size= must be a whole number from 2 to 7/],
    ["size=2", /^$|Sizes 3 to 7 are not playable yet/],
  ]) {
    const f = fixture();
    const instance = await f.start(search);
    await flush();
    assert.match(f.find("playground-size-note").textContent, note, search);
    assert.equal(f.find("playground-cube").dataset.size, "2", search);
    assert.equal(f.find("playground-size-2").attrs["aria-checked"], "true", search);
    instance.dispose();
  }
});

test("dispose while a design loads releases the late assets", async () => {
  const f = fixture({ hold: ["pastel"] });
  const instance = await f.start();
  await flush();
  const design = f.find("playground-design");
  design.value = "pastel";
  design.fire("change");
  await flush();
  assert.equal(f.held.length, 1);
  instance.dispose();
  f.held[0].release();
  await flush();
  assert.equal(f.counts.assetsDisposed, 2, "picture and the late pastel set");
});

test("dispose while an upload loads releases the late pictures and reports the replacement", async () => {
  const f = fixture({ hold: ["upload"] });
  const instance = await f.start();
  await flush();
  const result = f.env.hooks.useUpload({ set: THEMES[0], local: new Map() });
  await flush();
  assert.equal(f.held.length, 1);
  instance.dispose();
  f.held[0].release();
  const done = await result;
  assert.equal(done.ok, false);
  assert.equal(f.counts.assetsDisposed, 2);
});

test("dispose while the solver loads cancels the solve: the late solver plays nothing", async () => {
  let gate;
  const solverReady = new Promise((r) => (gate = r));
  const f = fixture({ factory: () => solverReady });
  const instance = await f.start();
  await flush();
  f.find("playground-notation").value = "R";
  f.find("playground-notation-form").fire("submit");
  await flush();
  await f.settle();
  f.shell.primary.spec.onClick();
  await flush();
  instance.dispose();
  gate({ solve: () => [{ face: "R", turns: -1 }] });
  await flush();
  assert.equal(f.pending.length, 0, "the cancelled solve starts no turn");
});

test("pictures= : an explicit mode is passed to the viewer before the first design is shown; none or an unknown value passes undefined", async () => {
  for (const [search, expected] of [["", undefined], ["?pictures=per-sticker", "per-sticker"], ["pictures=PROJECTED", "projected"], ["pictures=tiles", undefined]]) {
    const f = fixture(), calls = [];
    f.viewer.setPictureModeFromUrl = (mode) => calls.push(mode);
    await f.start(search);
    await flush();
    assert.deepEqual(calls, [expected], search);
  }
});
