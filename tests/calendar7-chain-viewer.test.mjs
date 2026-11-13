// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 mount on the long chain C data (public/calendar7/chain-c) as the canonical data: lazy fetch of its four files,
// the range January 2019 to January 2036, the solved root month, and the best-effort month February 2026 (wrong cell (7,1)).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";
import { parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { samePose } from "../src/apps/calendar7/engine.ts";
import { wrongStickerIndices } from "../src/apps/calendar7/anydate.ts";
import { homeFacesOf, RUBIK_TINTS } from "../src/apps/calendar7/home-tint.ts";
import { fakeRoot, setup, settle } from "./helpers/calendar7-mount.mjs";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/chain-c/graph.v1.json"));
const start = parseState(json("public/calendar7/chain-c/state.v1.json"));
const ym = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

test("the canonical data are the four chain C files, fetched at runtime and nothing else", async () => {
  const root = fakeRoot(), { env, calls } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=2019&month=1"), env);
  await settle(root, "2019-01");
  assert.deepEqual([...calls.fetched].sort(), ["/calendar7/chain-c/best-effort.v1.json", "/calendar7/chain-c/displays.v1.json", "/calendar7/chain-c/graph.v1.json", "/calendar7/chain-c/state.v1.json"]);
  inst.dispose();
});

test("no source file of the mode imports the chain data: they stay out of the main chunk", () => {
  for (const f of readdirSync("src/apps/calendar7").filter((n) => n.endsWith(".ts"))) {
    const text = readFileSync(`src/apps/calendar7/${f}`, "utf8");
    assert.doesNotMatch(text, /import[^;]*(chain-c|\.v1\.json)/, f);
  }
});

test("range January 2019 to January 2036, 204 steps, no demo wording; 2018-12 and 2036-02 are outside", async () => {
  const root = fakeRoot(), { env } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=2019&month=1"), env);
  await settle(root, "2019-01");
  assert.match(root.view.innerHTML, /January 2019 to January 2036, 204 steps/);
  assert.doesNotMatch(root.view.innerHTML, /DEMO|demo|beam preview/);
  assert.match(root.view.innerHTML, /No earlier month: January 2019 is the start of the chain/);
  inst.dispose();
  for (const [y, m] of [[2018, 12], [2036, 2]]) {
    const r = fakeRoot(), { env: e } = setup();
    const i = await mountCalendar7(r, new URLSearchParams(`year=${y}&month=${m}`), e);
    await settle(r, ym(y, m));
    assert.match(r.view.innerHTML, /Display only: no move sequence for this date \(print C\)/);
    assert.equal(r.el("player").hidden, true);
    i.dispose();
  }
});

test("root month 2019-01 in the app: the cube is built from the chain C print and shows the solved root pose, white front in Rubik-Tint", async () => {
  const root = fakeRoot(), { env, stage } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=2019&month=1&scheme=rubik-tint"), env);
  await settle(root, "2019-01");
  assert.equal(root.getAttribute("data-c7-scheme"), "rubik-tint");
  assert.equal(root.getAttribute("data-c7-digest"), graph.nodes[0].hash);
  assert.deepEqual([...stage.configs[0].printing.text], [...start.printing.text]);
  assert.ok(samePose(stage.shows.at(-1), start.pose), "the cube shows the root pose");
  const homes = homeFacesOf(stage.shows.at(-1));
  const front = [...homes.keys()].filter((i) => stage.shows.at(-1).normal[3 * i + 2] === 1);
  assert.equal(front.length, 49);
  assert.deepEqual([...new Set(front.map((i) => homes[i]))], ["white"]);
  assert.equal(RUBIK_TINTS.white, "#ffffff");
  inst.dispose();
});

test("February 2026 is a best-effort chain month: the wrong cell (7,1) goes to the cube, the page says it in one sentence, the sheet is hidden", async () => {
  const root = fakeRoot(), { env, stage } = setup();
  const inst = await mountCalendar7(root, new URLSearchParams("year=2026&month=2"), env);
  await settle(root, "2026-02");
  assert.equal(root.getAttribute("data-c7-digest"), graph.nodes[85].hash);
  assert.equal(root.el("player").hidden, false, "the chain month keeps the player: steps are animated");
  const c = stage.configs.at(-1), pose = stage.shows.at(-1);
  assert.deepEqual(c.wrong, wrongStickerIndices(pose, [[7, 1]]));
  assert.equal(c.printing.text[c.wrong[0]], "29");
  assert.equal(c.printing.ink[c.wrong[0]], "red");
  assert.match(root.view.innerHTML, /data-c7-best-effort[^>]*>Not exactly possible with this print: cell bottom left \(row 7, column 1\) differs\./);
  assert.match(root.view.innerHTML, /<div class="c7-sr-only" data-c7-sheet-hidden><table class="c7-sheet"/);
  assert.match(root.view.innerHTML, /data-nav="next"/);
  assert.match(root.view.innerHTML, /data-nav="previous"/);
  inst.dispose();
});

test("the wrong cell appears with the best-effort month and is gone one step later and one step earlier", async () => {
  for (const [y, m] of [[2026, 1], [2026, 3]]) {
    const root = fakeRoot(), { env, stage } = setup();
    const inst = await mountCalendar7(root, new URLSearchParams(`year=${y}&month=${m}`), env);
    await settle(root, ym(y, m));
    assert.deepEqual(stage.configs.at(-1).wrong ?? [], [], ym(y, m));
    assert.doesNotMatch(root.view.innerHTML, /data-c7-best-effort/);
    root.clickLink("?app=calendar7&year=2026&month=2");
    await settle(root, "2026-02");
    assert.equal(stage.configs.at(-1).wrong.length, 1, "arrived at February 2026");
    // The hatched sticker is not turned along: every turn after leaving February 2026 happens on a cube built without the wrong cell.
    const turn = stage.turn, wrongAtTurn = [];
    stage.turn = (...args) => { wrongAtTurn.push(stage.configs.at(-1).wrong?.length ?? 0); return turn(...args); };
    root.clickLink(`?app=calendar7&year=${y}&month=${m}`);
    await settle(root, ym(y, m));
    assert.deepEqual(stage.configs.at(-1).wrong ?? [], [], "left February 2026");
    assert.ok(wrongAtTurn.length > 0 && wrongAtTurn.every((n) => n === 0), `turns after leaving: ${wrongAtTurn}`);
    assert.equal(root.getAttribute("data-c7-digest"), graph.nodes[(y - 2019) * 12 + m - 1].hash);
    inst.dispose();
  }
});

test("a failed best-effort download stops the mount like any other canonical file", async () => {
  const root = fakeRoot(), { env } = setup();
  const fetchJson = env.fetchJson;
  env.fetchJson = async (url) => { if (url.endsWith("best-effort.v1.json")) throw new Error("HTTP 404"); return fetchJson(url); };
  await assert.rejects(mountCalendar7(root, new URLSearchParams("year=2019&month=1"), env), /HTTP 404/);
});

test("the best-effort sentence is red text only: the sheet red token, no frame, no background, 4.5:1 on the surface and canvas of both themes", async () => {
  const { contrast } = await import("./calendar7-contrast.mjs");
  const css = readFileSync("src/chronocube.css", "utf8");
  const rule = /^\.c7-best-effort \{([^}]*)\}/m.exec(css)?.[1] ?? "";
  assert.match(rule, /color: var\(--c7-red\)/);
  assert.doesNotMatch(rule, /border|background|outline|box-shadow|text-decoration/);
  const token = (scope) => new RegExp(`${scope}[^{]*\\{[^}]*--c7-red: (#[0-9a-f]{6})`).exec(css)?.[1];
  const light = token("\\.c7-root"), dark = token(':root\\[data-theme="dark"\\] \\.c7-root');
  const tokens = readFileSync("src/shell/tokens.css", "utf8");
  const pick = (name, from) => new RegExp(`--${name}: (#[0-9a-f]{6})`).exec(tokens.slice(from))?.[1];
  const darkAt = tokens.indexOf('@media (prefers-color-scheme: dark)');
  for (const name of ["surface", "bg"]) {
    assert.ok(contrast(light, pick(name, 0)) >= 4.5, `light ${name}`);
    assert.ok(contrast(dark, pick(name, darkAt)) >= 4.5, `dark ${name}`);
  }
});
