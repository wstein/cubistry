import { test } from "node:test";
import assert from "node:assert/strict";
import { installPresentation } from "../src/apps/shared/presentation.ts";

// Minimal DOM double: presentation only touches layout attributes, focus,
// listeners and the Fullscreen API, so the state machine runs in Node.
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this.textContent = "";
    this.disabled = false;
    this.focusCount = 0;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  prepend(...nodes) {
    this.children.unshift(...nodes);
  }
  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  focus() {
    this.focusCount++;
  }
}
function fakeDocument({ fullscreen = "native", hidden = 2 } = {}) {
  const document = new Element("#document"),
    main = new Element("main"),
    body = new Element("body"),
    root = new Element("html"),
    hiddenElements = Array.from({ length: hidden }, () => new Element("div")),
    requests = [];
  Object.assign(document, {
    body,
    documentElement: root,
    fullscreenElement: null,
    exits: 0,
    createElement: (tag) => new Element(tag),
    querySelector: (selector) => (selector === "main" ? main : null),
    querySelectorAll: (selector) =>
      selector === ".editing" ? hiddenElements : [],
    async exitFullscreen() {
      document.exits++;
      document.fullscreenElement = null;
      await fire(document, "fullscreenchange");
    },
  });
  if (fullscreen === "native")
    root.requestFullscreen = () =>
      new Promise((resolve, reject) => requests.push({ resolve, reject }));
  else if (fullscreen === "rejected")
    root.requestFullscreen = () => Promise.reject(Error("Rejected for test"));
  return { document, main, body, root, hiddenElements, requests };
}
async function fire(target, type, event = {}) {
  await Promise.all(
    (target.listeners[type] ?? []).map((listener) => listener(event)),
  );
}
function install(env, resetView = () => {}) {
  globalThis.document = env.document;
  const api = installPresentation({
    app: "clock",
    hide: [".editing"],
    resetView,
  });
  const [tools] = env.main.children;
  const [toggle, reset, feedback] = tools.children;
  return { api, tools, toggle, reset, feedback };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function grant(env, index) {
  env.document.fullscreenElement = env.root;
  env.requests[index].resolve();
  await fire(env.document, "fullscreenchange");
  await flush();
}

test("presentation controls stay disabled until the app is ready", () => {
  const env = fakeDocument();
  const { api, toggle, reset } = install(env);
  assert.equal(toggle.disabled, true);
  assert.equal(reset.disabled, true);
  api.setReady(true);
  assert.equal(toggle.disabled, false);
  assert.equal(reset.disabled, false);
  assert.equal(env.body.dataset.presentationApp, "clock");
  assert(env.hiddenElements.every((e) => e.dataset.presentationHide === ""));
});

for (const mode of ["unsupported", "rejected"])
  test(`${mode} fullscreen still presents and Escape restores controls and focus`, async () => {
    const env = fakeDocument({ fullscreen: mode });
    const { toggle, feedback } = install(env);
    await fire(toggle, "click");
    assert.equal(env.body.dataset.presentation, "true");
    assert.equal(toggle.textContent, "Show controls");
    assert.match(feedback.textContent, /Fullscreen is unavailable/);
    let prevented = false;
    await fire(env.document, "keydown", {
      key: "Escape",
      preventDefault: () => (prevented = true),
    });
    await flush();
    assert(prevented);
    assert.equal(env.body.dataset.presentation, "false");
    assert.equal(toggle.textContent, "Present");
    assert.equal(toggle.focusCount, 1);
    assert.equal(env.document.exits, 0);
  });

test("Escape outside presentation is left to the page", async () => {
  const env = fakeDocument();
  install(env);
  let prevented = false;
  await fire(env.document, "keydown", {
    key: "Escape",
    preventDefault: () => (prevented = true),
  });
  assert.equal(prevented, false);
  assert.equal(env.body.dataset.presentation, undefined);
});

test("owned native fullscreen is exited by Show controls", async () => {
  const env = fakeDocument();
  const { toggle } = install(env);
  await Promise.all([fire(toggle, "click"), grant(env, 0)]);
  assert.equal(env.body.dataset.presentation, "true");
  await fire(toggle, "click");
  assert.equal(env.body.dataset.presentation, "false");
  assert.equal(env.document.exits, 1);
  assert.equal(env.document.fullscreenElement, null);
  assert.equal(toggle.focusCount, 1);
});

test("leaving the browser's fullscreen restores controls and focus", async () => {
  const env = fakeDocument();
  const { toggle } = install(env);
  await Promise.all([fire(toggle, "click"), grant(env, 0)]);
  env.document.fullscreenElement = null;
  await fire(env.document, "fullscreenchange");
  assert.equal(env.body.dataset.presentation, "false");
  assert.equal(toggle.focusCount, 1);
  assert.equal(env.document.exits, 0);
});

test("a fullscreen grant after cancellation exits instead of reentering", async () => {
  const env = fakeDocument();
  const { toggle } = install(env);
  const pending = fire(toggle, "click");
  await fire(toggle, "click");
  assert.equal(env.body.dataset.presentation, "false");
  await grant(env, 0);
  await pending;
  assert.equal(env.body.dataset.presentation, "false");
  assert.equal(env.document.exits, 1);
  assert.equal(env.document.fullscreenElement, null);
});

test("fullscreen that predates presentation is not exited on leave", async () => {
  const env = fakeDocument();
  env.document.fullscreenElement = env.root;
  const { toggle } = install(env);
  await fire(toggle, "click");
  assert.equal(env.requests.length, 0);
  await fire(toggle, "click");
  assert.equal(env.body.dataset.presentation, "false");
  assert.equal(env.document.exits, 0);
  assert.equal(env.document.fullscreenElement, env.root);
});

test("Reference view changes only the camera, inside or outside presentation", async () => {
  const env = fakeDocument({ fullscreen: "unsupported" });
  let resets = 0;
  const { toggle, reset, feedback } = install(env, () => resets++);
  await fire(reset, "click");
  assert.equal(resets, 1);
  assert.equal(env.body.dataset.presentation, undefined);
  await fire(toggle, "click");
  await fire(reset, "click");
  assert.equal(resets, 2);
  assert.equal(env.body.dataset.presentation, "true");
  assert.equal(feedback.textContent, "Reference view restored.");
});
