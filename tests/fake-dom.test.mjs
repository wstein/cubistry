// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { FakeDocument } from "./helpers/fake-dom.mjs";

test("self insertion records a real move and blurs a focused descendant", () => {
  const doc = new FakeDocument();
  const parent = doc.createElement("div");
  const row = doc.createElement("div");
  const button = doc.createElement("button");
  const next = doc.createElement("p");
  row.append(button);
  parent.append(row, next);
  button.focus();
  doc.drain();
  parent.insertBefore(row, row);
  assert.deepEqual(parent.children, [row, next], "self insertion keeps the sibling order");
  assert.equal(doc.activeElement, null, "removing the row blurs its focused button");
  assert.deepEqual(doc.drain().map(([kind]) => kind), ["insert", "remove"]);
});

test("removing an ancestor blurs its focused descendant", () => {
  const doc = new FakeDocument();
  const parent = doc.createElement("div");
  const row = doc.createElement("div");
  const button = doc.createElement("button");
  row.append(button);
  parent.append(row);
  button.focus();
  row.remove();
  assert.equal(doc.activeElement, null);
  assert.deepEqual(parent.children, []);
});
