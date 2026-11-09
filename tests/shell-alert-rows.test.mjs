import test from "node:test";
import assert from "node:assert/strict";
import { createShellHost, createInertShell } from "../src/apps/shell/slot-api.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// Warning and error rows of the design (docs/design/cubistry-mock.html: `warnrow` and `errrow`): one row per kind
// beside the status chip, role="alert", with a Dismiss button. They sit outside the polite status zone, so their assertive semantics do not nest inside it.

const setup = () => {
  const { doc, regions } = fakeRegions();
  const host = createShellHost(regions, doc);
  let live = true;
  const shell = host.begin(() => live);
  return { doc, regions, host, shell, stale: () => (live = false) };
};
const rows = (regions) => regions.alerts.children.filter((c) => c.getAttribute("role") === "alert");

test("a warning is a role=alert row with a bold title, the text and a Dismiss button", () => {
  const { regions, shell } = setup();
  shell.setWarning({ title: "Late", text: "The last turn ended after its deadline." });
  const [row] = rows(regions);
  assert.equal(row.dataset.kind, "warn");
  assert.match(row.className, /shell-alert-row/);
  assert.equal(row.textContent.startsWith("Late: The last turn ended after its deadline."), true);
  const button = row.find((e) => e.tagName === "BUTTON");
  assert.equal(button.getAttribute("aria-label"), "Dismiss warning");
  assert.equal(button.getAttribute("type"), "button");
});

test("an error row starts with Error: and has its own Dismiss label", () => {
  const { regions, shell } = setup();
  shell.setError({ text: "Assets did not load." });
  const [row] = rows(regions);
  assert.equal(row.dataset.kind, "error");
  assert.equal(row.textContent.startsWith("Error: Assets did not load."), true);
  assert.equal(row.find((e) => e.tagName === "BUTTON").getAttribute("aria-label"), "Dismiss error");
});

test("Dismiss removes the row, runs onDismiss once and leaves the chip", () => {
  const { regions, shell } = setup();
  const seen = [];
  shell.setStatus("sync", "Syncing");
  shell.setWarning({ title: "Late", text: "x", onDismiss: () => seen.push("warn") });
  rows(regions)[0].find((e) => e.tagName === "BUTTON").click();
  assert.deepEqual(seen, ["warn"]);
  assert.equal(rows(regions).length, 0);
  assert.equal(regions.status.children.length, 1);
  assert.equal(regions.status.children[0].textContent, "Syncing");
});

test("there is one row per kind: a new warning replaces the old one, null clears it", () => {
  const { regions, shell } = setup();
  shell.setWarning({ title: "A", text: "1" });
  shell.setWarning({ title: "B", text: "2" });
  shell.setError({ text: "3" });
  assert.deepEqual(rows(regions).map((r) => r.dataset.kind), ["warn", "error"]);
  assert.match(rows(regions)[0].textContent, /^B: 2/);
  shell.setWarning(null);
  assert.deepEqual(rows(regions).map((r) => r.dataset.kind), ["error"]);
  shell.setError(null);
  assert.equal(regions.status.children.length, 0);
});

test("setStatus and clearStatus keep the rows; the same row text writes nothing", () => {
  const { doc, regions, shell } = setup();
  shell.setError({ text: "boom" });
  shell.setStatus("error", "Stopped");
  assert.equal(regions.status.children.length, 1);
  assert.equal(regions.alerts.children.length, 1);
  shell.clearStatus();
  assert.deepEqual(rows(regions).map((r) => r.dataset.kind), ["error"]);
  assert.equal(regions.status.children.length, 0);
  doc.drain();
  shell.setError({ text: "boom" });
  assert.deepEqual(doc.drain(), []);
});

test("a stale mode cannot add a row and the next mode starts without one", () => {
  const { doc, regions, host, shell, stale } = setup();
  shell.setError({ text: "old" });
  const next = host.begin(() => true);
  assert.equal(regions.status.children.length, 0);
  stale();
  shell.setWarning({ title: "late", text: "write" });
  assert.equal(regions.status.children.length, 0);
  next.setWarning({ title: "ok", text: "new" });
  assert.equal(rows(regions).length, 1);
});

test("the rows need no explicit aria-live attribute and reject empty text", () => {
  const { regions, shell } = setup();
  shell.setError({ text: "boom" });
  const [row] = rows(regions);
  assert.equal([row, ...row.descendants()].some((e) => e.hasAttribute("aria-live")), false);
  assert.throws(() => shell.setError({ text: " " }), TypeError);
  assert.throws(() => shell.setWarning({ title: "", text: "x" }), TypeError);
});

test("the inert shell accepts the row calls", () => {
  const inert = createInertShell();
  inert.setWarning({ title: "a", text: "b" });
  inert.setError(null);
});


test("changing the polite status never detaches an existing alert or its focused Dismiss button", () => {
  const { doc, regions, shell } = setup();
  shell.setError({ text: "Keep this error visible" });
  const row = rows(regions)[0];
  assert.notEqual(row.parentElement, regions.status, "an assertive alert must not sit inside the polite status");
  const button = row.find((e) => e.tagName === "BUTTON");
  button.focus();
  doc.drain();
  shell.setStatus("sync", "Synchronizing");
  shell.setStatus("ready", "Ready");
  shell.clearStatus();
  assert.equal(doc.activeElement, button);
  assert.equal(rows(regions)[0], row);
  assert.equal(doc.drain().some((entry) => entry.slice(1).includes(row)), false);
});

test("adding a warning never reinserts the error with the focused Dismiss button", () => {
  const { doc, regions, shell } = setup();
  shell.setError({ text: "Keep this error" });
  const row = rows(regions)[0];
  const button = row.find((element) => element.tagName === "BUTTON");
  button.focus();
  doc.drain();
  shell.setWarning({ title: "Warning", text: "Added beside the error" });
  assert.equal(doc.activeElement, button, "updating another alert must preserve focus");
  assert.equal(rows(regions)[1], row);
  assert.deepEqual(rows(regions).map((element) => element.dataset.kind), ["warn", "error"]);
  assert.equal(doc.drain().some(([kind, , node]) => kind === "remove" && node === row), false);
});
