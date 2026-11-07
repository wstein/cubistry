// English 7x7 calendar mode (research candidate, not certified): registry entry, month choice, navigation bounds,
// move words and the mount with a small fake DOM. Deterministic: no network, no timers, no browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { createRegistry } from "../src/apps/registry.ts";
import { monthCells } from "../src/apps/calendar7/display.ts";
import { decodeMoves, parseDisplays, parseGraph } from "../src/apps/calendar7/graph.ts";
import { applyMoves, clonePose, samePose } from "../src/apps/calendar7/engine.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import {
  buildModel,
  chainRange,
  chooseMonth,
  href,
  moveToken,
  rawToken,
  nodeIndex,
  pageHtml,
  sheetCells,
  stepFrom,
  stepMonth,
} from "../src/apps/calendar7/month-view.ts";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const table = parseDisplays(json("public/calendar7/displays.v1.json"));
const range = chainRange(graph);
const q = (s) => new URLSearchParams(s);

test("the catalog lists calendar7 as a one-cube mode that is the last chooser entry", () => {
  const m = MODE_CATALOG.find((x) => x.id === "calendar7");
  assert.ok(m);
  assert.equal(m.title, "7x7 Calendar");
  assert.equal(m.cubes, 1);
  assert.equal(m.group, "cubes");
  assert.equal(m.help, "docs/CALENDAR_7X7.md");
  assert.equal(MODE_CATALOG.at(-1).id, "calendar7");
  const reg = createRegistry(MODE_CATALOG.map((x) => ({ ...x, mount: async () => {} })));
  assert.ok(reg.has("calendar7"));
});

test("the studio select has a calendar7 option", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /<option value="calendar7">7x7 Calendar \(1 cube\)<\/option>/);
});

test("the chain range is January 2028 to January 2076 with 576 edges", () => {
  assert.deepEqual(range, { first: { year: 2028, month: 1 }, last: { year: 2076, month: 1 }, edges: 576 });
});

test("chooseMonth takes the URL month, else today, and reports outside and invalid input", () => {
  const today = { year: 2026, month: 11 };
  assert.deepEqual(chooseMonth(q("year=2030&month=5"), today, range), {
    kind: "ok",
    ym: { year: 2030, month: 5 },
    source: "url",
  });
  assert.equal(chooseMonth(q(""), today, range).kind, "outside");
  assert.equal(chooseMonth(q(""), today, range).source, "today");
  assert.equal(chooseMonth(q(""), { year: 2040, month: 3 }, range).kind, "ok");
  assert.equal(chooseMonth(q("year=2027&month=12"), today, range).kind, "outside");
  assert.equal(chooseMonth(q("year=2076&month=2"), today, range).kind, "outside");
  assert.equal(chooseMonth(q("year=2028&month=1"), today, range).kind, "ok");
  assert.equal(chooseMonth(q("year=2076&month=1"), today, range).kind, "ok");
  for (const bad of ["year=2030", "month=5", "year=abc&month=5", "year=2030&month=13", "year=2030&month=0", "year=2030&month=1.5"])
    assert.equal(chooseMonth(q(bad), today, range).kind, "invalid", bad);
});

test("navigation stops at both ends of the chain and crosses year boundaries", () => {
  assert.equal(stepMonth(range, { year: 2028, month: 1 }, -1), null);
  assert.equal(stepMonth(range, { year: 2076, month: 1 }, 1), null);
  assert.deepEqual(stepMonth(range, { year: 2028, month: 12 }, 1), { year: 2029, month: 1 });
  assert.deepEqual(stepMonth(range, { year: 2029, month: 1 }, -1), { year: 2028, month: 12 });
  assert.equal(stepMonth(range, { year: 2027, month: 12 }, 1), null);
  assert.equal(nodeIndex(range, { year: 2076, month: 1 }), 576);
  assert.equal(nodeIndex(range, { year: 2076, month: 2 }), -1);
});

test("the sheet of every chain month equals the independent month generator", () => {
  for (let k = 0; k <= range.edges; k++) {
    const { year, month } = graph.nodes[k];
    assert.deepEqual(sheetCells(graph, table, range, { year, month }), monthCells(year, month), `${year}-${month}`);
  }
  assert.throws(() => sheetCells(graph, table, range, { year: 2027, month: 12 }), RangeError);
});

test("a forward step is the edge word and a backward step is its inverse", () => {
  const ym = { year: 2028, month: 5 };
  const k = nodeIndex(range, ym);
  const fwd = stepFrom(graph, range, ym, 1);
  assert.deepEqual(fwd.moves, graph.edges[k].moves);
  assert.deepEqual(fwd.to, { year: 2028, month: 6 });
  const back = stepFrom(graph, range, { year: 2028, month: 6 }, -1);
  assert.deepEqual(back.to, ym);
  assert.equal(back.moves.length, fwd.moves.length);
  assert.equal(stepFrom(graph, range, { year: 2028, month: 1 }, -1), null);
  assert.equal(stepFrom(graph, range, { year: 2076, month: 1 }, 1), null);
});

test("walking the first steps by the shown words reaches the chain nodes (forward and back)", () => {
  const start = parseState(json("public/calendar7/state.v1.json"));
  let ym = { year: 2028, month: 1 };
  let pose = clonePose(start.pose);
  const poses = [clonePose(pose)];
  for (let i = 0; i < 3; i++) {
    const s = stepFrom(graph, range, ym, 1);
    pose = applyMoves(pose, s.moves);
    poses.push(clonePose(pose));
    ym = s.to;
  }
  for (let i = 3; i > 0; i--) {
    const s = stepFrom(graph, range, ym, -1);
    pose = applyMoves(pose, s.moves);
    assert.ok(samePose(pose, poses[i - 1]), `back to step ${i - 1}`);
    ym = s.to;
  }
});

test("moveToken names axis, layer and turn", () => {
  assert.equal(moveToken([1, 1]), "x-3");
  assert.equal(moveToken([6, -1]), "x+3'");
  assert.equal(moveToken([12, 2]), "y+2²");
  assert.equal(moveToken([21, 1]), "zrot");
  assert.deepEqual(decodeMoves("A").map(moveToken), ["x-3"]);
});

test("rawToken lists generator and exponent, and the step shows both notations", () => {
  assert.equal(rawToken([11, 1]), "g11:+1");
  assert.equal(rawToken([3, -1]), "g3:-1");
  assert.equal(rawToken([21, 2]), "g21:2");
  const today = { year: 2026, month: 11 };
  const model = buildModel(graph, table, chooseMonth(q("year=2028&month=5"), today, range), today);
  const html = pageHtml(model);
  const raw = model.next.moves.map(rawToken).join(" ");
  assert.ok(html.includes(`data-raw="next">${raw}</p>`));
  assert.ok(html.includes(`data-word="next">${model.next.moves.map(moveToken).join(" ").replace(/'/g, "&#39;")}</p>`));
  assert.match(html, /Raw generators/);
});

test("the rotation count is pluralized", () => {
  const today = { year: 2026, month: 11 };
  const texts = [];
  for (let k = 0; k < 40; k++) {
    const m = graph.nodes[k];
    const html = pageHtml(buildModel(graph, table, chooseMonth(q(`year=${m.year}&month=${m.month}`), today, range), today));
    texts.push(...(html.match(/\d+ whole-cube rotations?\./g) ?? []));
  }
  assert.ok(texts.some((t) => t.startsWith("1 whole-cube rotation.")), "a singular occurs");
  assert.ok(texts.every((t) => !/^1 whole-cube rotations/.test(t)));
});

test("the page shows the sheet, both steps and the scope notice for a month inside the chain", () => {
  const today = { year: 2026, month: 11 };
  const html = pageHtml(buildModel(graph, table, chooseMonth(q("year=2028&month=1"), today, range), today));
  assert.match(html, /data-month="2028-01"/);
  assert.equal((html.match(/<tr>/g) ?? []).length, 7);
  assert.equal((html.match(/<td /g) ?? []).length, 49);
  assert.match(html, /February 2028/);
  assert.match(html, /No earlier month: January 2028 is the start of the chain/);
  assert.match(html, /No solver and no jumps/);
  assert.match(html, /data-word="next"/);
  assert.match(html, /JAN|>J</);
});

test("the end of the chain has no next step", () => {
  const today = { year: 2026, month: 11 };
  const html = pageHtml(buildModel(graph, table, chooseMonth(q("year=2076&month=1"), today, range), today));
  assert.match(html, /No later month: January 2076 is the end of the chain/);
  assert.match(html, /data-word="previous"/);
});

test("a month outside the chain shows a not-available message and no sheet", () => {
  const today = { year: 2026, month: 11 };
  const html = pageHtml(buildModel(graph, table, chooseMonth(q(""), today, range), today));
  assert.match(html, /Not available yet\. The current month, November 2026, is outside the proven chain \(January 2028 to January 2076\)/);
  assert.doesNotMatch(html, /c7-sheet/);
  assert.match(html, new RegExp("year=2028&amp;month=1"));
  const bad = pageHtml(buildModel(graph, table, chooseMonth(q("year=x&month=1"), today, range), today));
  assert.match(bad, /Invalid month/);
});

function fakeRoot() {
  const listeners = new Set();
  const focused = [];
  const view = { innerHTML: "", querySelector: () => ({ focus: () => focused.push(view.innerHTML.match(/data-month="([^"]+)"/)?.[1] ?? "other") }) };
  const live = { textContent: "" };
  return {
    innerHTML: "",
    view,
    live,
    focused,
    listeners,
    querySelector: (sel) => (sel === ".c7-view" ? view : live),
    contains: () => true,
    addEventListener: (_t, l) => listeners.add(l),
    removeEventListener: (_t, l) => listeners.delete(l),
    click(href) {
      let prevented = false;
      const a = { getAttribute: () => href };
      const target = { closest: () => a };
      for (const l of [...listeners]) l({ target, preventDefault: () => (prevented = true) });
      return prevented;
    },
  };
}
const env = (over = {}) => {
  const calls = { query: [] };
  return {
    calls,
    base: "/",
    fetchJson: async (url) => (url.endsWith("graph.v1.json") ? json("public/calendar7/graph.v1.json") : json("public/calendar7/displays.v1.json")),
    now: () => new Date(2026, 10, 7),
    search: () => "?app=calendar7&year=2028&month=1&kiosk=1",
    replaceQuery: (s) => calls.query.push(s),
    isCurrent: () => true,
    ...over,
  };
};

test("mount renders today's outside notice, follows a step link and keeps other parameters", async () => {
  const root = fakeRoot();
  const e = env();
  const inst = await mountCalendar7(root, q(""), e);
  assert.match(root.view.innerHTML, /Not available yet/);
  assert.equal(root.click(href({ year: 2028, month: 1 })), true);
  assert.match(root.view.innerHTML, /data-month="2028-01"/);
  assert.deepEqual(e.calls.query, ["?app=calendar7&kiosk=1&year=2028&month=1"]);
  assert.deepEqual(root.focused, ["2028-01"], "focus moves to the new heading");
  assert.equal(root.live.textContent, "Showing January 2028");
  assert.equal(root.click(href({ year: 2028, month: 2 })), true);
  assert.match(root.view.innerHTML, /data-month="2028-02"/);
  inst.dispose();
  assert.equal(root.listeners.size, 0);
});

test("mount renders the URL month and does nothing once the mount is stale", async () => {
  const root = fakeRoot();
  await mountCalendar7(root, q("year=2050&month=6"), env());
  assert.match(root.view.innerHTML, /data-month="2050-06"/);
  const stale = fakeRoot();
  const r = await mountCalendar7(stale, q("year=2050&month=6"), env({ isCurrent: () => false }));
  assert.equal(r, undefined);
  assert.equal(stale.listeners.size, 0);
  assert.doesNotMatch(stale.view.innerHTML, /c7-sheet/);
});
