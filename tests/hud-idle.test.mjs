import test from "node:test";
import assert from "node:assert/strict";

class FakeClassList {
  constructor() {
    this._set = new Set();
  }
  add(cls) {
    this._set.add(cls);
  }
  remove(cls) {
    this._set.delete(cls);
  }
  contains(cls) {
    return this._set.has(cls);
  }
}

class FakeElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
  }
  closest(selector) {
    return null;
  }
}

test("hud-idle controller transitions between ambient, hover/focus, and idle after timeout", async () => {
  const listeners = new Map();
  const fakeWindow = {
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
      }
    },
  };

  const fakeBody = new FakeElement("body");
  const fakeDoc = {
    body: fakeBody,
    activeElement: fakeBody,
    querySelector: () => null,
    readyState: "complete",
    addEventListener: () => {},
  };

  globalThis.window = fakeWindow;
  globalThis.document = fakeDoc;

  const { installHudIdleController } = await import(
    "../src/apps/shared/hud-idle.ts"
  );

  const controller = installHudIdleController({ timeoutMs: 50 });

  // Initially in ambient state
  assert.equal(fakeBody.dataset.hudState, "ambient");

  // Wait for 70ms to allow timeout to trigger
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(fakeBody.dataset.hudState, "idle");

  // Activity wakes back to ambient
  const moveHandler = listeners.get("mousemove")?.[0];
  assert.ok(moveHandler, "mousemove handler should be registered");
  moveHandler();
  assert.equal(fakeBody.dataset.hudState, "ambient");

  controller.destroy();
  assert.equal(fakeBody.dataset.hudState, undefined);

  delete globalThis.window;
  delete globalThis.document;
});

