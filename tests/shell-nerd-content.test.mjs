import test from "node:test";
import assert from "node:assert/strict";
import { nerdTable, nerdFacts } from "../src/apps/shell/nerd-content.ts";
import { createShellHost } from "../src/apps/shell/slot-api.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// Builders for the Nerd drawer: the session statistics and the committed-moves table of the Clock move there
// (owner: "maybe move stats"; design deviation 7). The drawer API takes any render function; these are the builders.

test("nerdTable builds a captioned table with column and row headers", () => {
  const { doc } = fakeRegions();
  const table = nerdTable(doc, {
    caption: "Committed moves this session",
    columns: ["Cube", "Total HTM", "Last"],
    rows: [["Hours", "12", "—"], ["Minutes", "7", "2"]],
  });
  assert.equal(table.tagName, "TABLE");
  assert.equal(table.className, "shell-nerd-table");
  const [caption, thead, tbody] = table.children;
  assert.equal(caption.tagName, "CAPTION");
  assert.equal(caption.textContent, "Committed moves this session");
  const heads = thead.children[0].children;
  assert.deepEqual(heads.map((h) => [h.tagName, h.getAttribute("scope"), h.textContent]),
    [["TH", "col", "Cube"], ["TH", "col", "Total HTM"], ["TH", "col", "Last"]]);
  assert.equal(tbody.children.length, 2);
  const first = tbody.children[0].children;
  assert.deepEqual(first.map((c) => [c.tagName, c.getAttribute("scope")]), [["TH", "row"], ["TD", null], ["TD", null]]);
  assert.deepEqual(first.map((c) => c.textContent), ["Hours", "12", "—"]);
});

test("nerdTable rejects a row whose length differs from the column count", () => {
  const { doc } = fakeRegions();
  assert.throws(() => nerdTable(doc, { caption: "c", columns: ["a", "b"], rows: [["x"]] }), /row 0/);
});

test("nerdFacts builds a definition list of label and value pairs", () => {
  const { doc } = fakeRegions();
  const list = nerdFacts(doc, [["Renderer", "WebGL"], ["Tick", "100 ms"]]);
  assert.equal(list.tagName, "DL");
  assert.deepEqual(list.children.map((e) => e.tagName), ["DT", "DD", "DT", "DD"]);
  assert.deepEqual(list.children.map((e) => e.textContent), ["Renderer", "WebGL", "Tick", "100 ms"]);
});

test("a statistics table renders into the drawer on open and refreshes in place", () => {
  const { doc, regions } = fakeRegions();
  const shell = createShellHost(regions, doc).begin(() => true);
  let moves = 0;
  shell.setNerd({
    title: "Moves",
    render: (body) => body.append(nerdTable(doc, { caption: "Committed moves", columns: ["Cube", "HTM"], rows: [["Hours", String(moves)]] })),
  });
  regions.nerdToggle.click();
  assert.match(regions.nerd.textContent, /Hours0/);
  moves = 5;
  shell.refreshNerd();
  assert.match(regions.nerd.textContent, /Hours5/);
  assert.equal(regions.nerd.descendants().filter((e) => e.tagName === "TABLE").length, 1, "re-render replaces the table");
});
