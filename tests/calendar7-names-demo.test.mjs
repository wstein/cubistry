// SPDX-License-Identifier: AGPL-3.0-or-later
import { monthLabel } from "../src/apps/calendar7/month-view.ts";
// DEMO of the Calendar7 names layout on the print window-2029-12 with the beam chain (public/calendar7/names-demo):
// the demo data against the research evidence (PR 411), replay with the repo's simulator, the block-move counts the page
// shows, and the demo selection of the mount. The shipped names data is tested in calendar7-names-data.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, PINNED } from "../scripts/export-calendar7-names-demo.mjs";
import { parseDisplays, parseGraph, parseState, verifyChain } from "../src/apps/calendar7/graph.ts";
import { applyMoves, clonePose, metrics, stateDigest } from "../src/apps/calendar7/engine.ts";
import { DEFAULT_WORD_OPTIONS, stepNotation } from "../src/apps/calendar7/notation.ts";
import { buildModel, chainRange, chooseMonth, pageHtml, stepFrom } from "../src/apps/calendar7/month-view.ts";
import { NAMES_DEMO_LABEL, NAMES_DEMO_NOTICE, parseLayout, parseLayoutMode } from "../src/apps/calendar7/layout.ts";
import { namesCells, wrongStickerIndices } from "../src/apps/calendar7/anydate.ts";
import { frontFailures } from "../src/apps/calendar7/display.ts";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";

const DIR = "public/calendar7/names-demo";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json(`${DIR}/graph.v1.json`));
const table = parseDisplays(json(`${DIR}/displays.v1.json`));
const start = parseState(json(`${DIR}/state.v1.json`));
const range = chainRange(graph);

// Evidence of PR 411 (research/calendar-7x7/row1-window-chain/README.md, evidence/beam-chain-2026-06/moves.tsv): Dec 2026 to Jun 2027.
const BEAM_HTM = [61, 96, 115, 34, 99, 121, 124];
const BEAM_QTM = [71, 125, 138, 49, 118, 148, 149];
const BEAM_ROT = [1, 1, 2, 0, 2, 1, 1];
const GREEDY_HTM = [485, 477, 430, 435, 442, 458]; // Jun to Nov 2026, the stored greedy prefix of the window-2029-12 chain
const ym = (k) => ({ year: 2026 + Math.floor((4 + k) / 12), month: ((4 + k) % 12) + 1 });

test("the demo graph is May 2026 to June 2027: 14 nodes, 13 edges, the stored greedy prefix then the 7 beam edges", () => {
  assert.deepEqual(range, { first: { year: 2026, month: 5 }, last: { year: 2027, month: 6 }, edges: 13 });
  assert.deepEqual(graph.edges.slice(0, 6).map((e) => e.htm), GREEDY_HTM);
  assert.deepEqual(graph.edges.slice(6).map((e) => e.htm), BEAM_HTM);
  assert.deepEqual(graph.edges.slice(6).map((e) => e.qtm), BEAM_QTM);
  assert.deepEqual(graph.edges.slice(6).map((e) => e.rot), BEAM_ROT);
  assert.equal(table.months.length, 14);
});

test("every edge word reproduces its declared metrics and the replay with the repo's simulator reaches the next node", () => {
  let pose = clonePose(start.pose);
  assert.equal(stateDigest(start.printing, pose), graph.nodes[0].hash);
  graph.edges.forEach((e, k) => {
    const got = metrics(e.moves);
    assert.deepEqual([got.htm, got.qtm, got.rot, got.rotq], [e.htm, e.qtm, e.rot, e.rotq], `edge ${k}`);
    pose = applyMoves(pose, e.moves);
    assert.equal(stateDigest(start.printing, pose), graph.nodes[k + 1].hash, `edge ${k} reaches node ${k + 1}`);
  });
  assert.equal(verifyChain(start.printing, start.pose, table, graph).edges.length, 13);
});

test("a dropped move or a wrong edge word does not reach the next node", () => {
  const e = graph.edges[6];
  const from = applyMoves(clonePose(start.pose), graph.edges.slice(0, 6).flatMap((x) => x.moves));
  assert.equal(stateDigest(start.printing, applyMoves(from, e.moves)), graph.nodes[7].hash);
  assert.notEqual(stateDigest(start.printing, applyMoves(from, e.moves.slice(1))), graph.nodes[7].hash);
  assert.notEqual(stateDigest(start.printing, applyMoves(from, graph.edges[7].moves)), graph.nodes[7].hash);
});

test("the page shows the block-move count of the edge; Nov 2026 to Dec 2026 is 51 moves for 61 HTM", () => {
  const counts = graph.edges.map((_, k) => stepNotation(stepFrom(graph, range, ym(k), 1).moves, DEFAULT_WORD_OPTIONS).moves);
  assert.deepEqual(counts, [361, 375, 326, 325, 340, 345, 51, 81, 90, 24, 79, 96, 101]);
  const nov = { year: 2026, month: 11 };
  const page = (y, m) => pageHtml(buildModel(graph, table, chooseMonth(new URLSearchParams(`year=${y}&month=${m}`), nov, range), nov, "names", true));
  const html = page(2026, 11);
  assert.match(html, /data-step="next"><h3>Next<\/h3><p class="c7-step-summary"><a [^>]*>December 2026<\/a> · 51 moves<\/p>/);
  assert.match(html, /Stored word: 61 layer moves \(HTM\), 71 quarter turns \(QTM\), 1 stored rotation\./);
  assert.match(html, /data-step="previous"><h3>Previous<\/h3><p class="c7-step-summary"><a [^>]*>October 2026<\/a> · 345 moves/);
  const dec = page(2026, 12);
  assert.match(dec, /data-step="previous"><h3>Previous<\/h3><p class="c7-step-summary"><a [^>]*>November 2026<\/a> · 51 moves/); // backward step: the inverse word, same count
  assert.match(dec, /data-c7-demo>DEMO, not a final print: Names \(demo, beam chain, print window-2029-12, May 2026 - Jun 2027\)\. Window: May 2026 to June 2027, 13 steps/);
});

test("months outside May 2026 to June 2027 are outside the chain; the end months have no further step", () => {
  for (const [y, m] of [[2026, 4], [2027, 7], [2028, 1], [2030, 5]]) assert.equal(chooseMonth(new URLSearchParams(`year=${y}&month=${m}`), { year: 2026, month: 11 }, range).kind, "outside", `${y}-${m}`);
  assert.equal(stepFrom(graph, range, { year: 2027, month: 6 }, 1), null);
  assert.equal(stepFrom(graph, range, { year: 2026, month: 5 }, -1), null);
});

test("the demo folder checks clean, its own pins hold, and the shipped names pins are untouched", () => {
  check(DIR);
  assert.equal(PINNED.printing, "73e8e6394167759d284c07ce010ce726f9f5aefa522792323cacc9c1bd7c1192");
  const shipped = readFileSync("public/calendar7/names/research-inputs.sha256", "utf8");
  assert.match(shipped, /^c5671d75/);
  assert.equal(shipped.includes(PINNED.printing), false);
});

test("check stops on a tampered demo folder (edge word without the manifest, edge word with a forged manifest entry)", () => {
  const dir = mkdtempSync(join(tmpdir(), "c7demo-"));
  cpSync(DIR, dir, { recursive: true });
  check(dir);
  const g = json(join(dir, "graph.v1.json"));
  g.edges[6].moves = g.edges[6].moves.slice(1);
  writeFileSync(join(dir, "graph.v1.json"), JSON.stringify(g));
  assert.throws(() => check(dir), /graph\.v1\.json does not match manifest/);
});

test("the demo is only selected by ?layout=names-demo: parseLayout never returns it", () => {
  assert.equal(parseLayout("names-demo"), "standard");
  assert.equal(parseLayoutMode("names-demo"), "names-demo");
  assert.equal(parseLayoutMode("names"), "names");
  for (const bad of [null, undefined, "", "Names-demo", "names-demo ", "demo"]) assert.equal(parseLayoutMode(bad), "standard", String(bad));
  assert.equal(NAMES_DEMO_LABEL, "Names (demo, beam chain, print window-2029-12, May 2026 - Jun 2027)");
});

// ---- canonical mount: all former layout URLs select the same physical print ----
import { fakeRoot, setup, settle } from "./helpers/calendar7-mount.mjs";

const flush = async () => { for(let i=0;i<100;i++) await Promise.resolve(); };
const canonicalQueries = ["", "layout=standard", "layout=names", "layout=names-demo", "layout=names-any", "layout=bogus"];
for (const layout of canonicalQueries) test(`one physical names print for the former URL value: ${layout || "absent"}`, async () => {
  const root = fakeRoot();
  const params = new URLSearchParams(`app=calendar7&year=2026&month=11&scheme=paper-blue&font=nunito&extra=keep&${layout}`);
  const {env,stage,calls}=setup({search:"?"+params});
  const inst = await mountCalendar7(root, params, env);
  await settle(root,"2026-11");
  assert.equal(root.getAttribute("data-c7-layout"),"names");
  assert.equal(root.getAttribute("data-c7-layout-mode"),"names");
  assert.equal(root.getAttribute("data-c7-scheme"),"paper-blue");
  assert.doesNotMatch(root.html,/Cube layout|data-c7="layout"/);
  assert.equal(calls.fetched.length,3);
  assert.ok(calls.fetched.every(u=>u.startsWith("/calendar7/names-demo/")));
  assert.deepEqual([...stage.configs[0].printing.text],[...start.printing.text]);
  assert.equal(root.getAttribute("data-c7-digest"),graph.nodes[6].hash);
  assert.match(root.view.innerHTML,/December 2026<\/a> · 51 moves/);
  assert.match(root.view.innerHTML,/May to Nov 2026 stored greedy edges, Dec 2026 to Jun 2027 beam edges/);
  const url = new URLSearchParams(env.search());
  assert.equal(url.has("layout"),false);
  for (const [key,value] of [["scheme","paper-blue"],["font","nunito"],["extra","keep"],["year","2026"],["month","11"]]) assert.equal(url.get(key),value);
  inst.dispose();
});

test("today and Paper Red stay the defaults; the date is not hardcoded to November",async()=>{
 for(const [y,m] of [[2026,11],[2027,2],[2099,12]]) {
  const root=fakeRoot(),{env}=setup({now:new Date(y,m-1,11)});
  const inst=await mountCalendar7(root,new URLSearchParams(),env);
  await settle(root,y+"-"+String(m).padStart(2,"0"));
  assert.equal(root.getAttribute("data-c7-scheme"),"paper-red");
  assert.equal(root.picker.label.textContent, monthLabel({year:y,month:m}));
  assert.doesNotMatch(root.view.innerHTML,/type="submit"|>Show</);
  inst.dispose();
 }
});

for(const [y,m] of [[2026,2],[2099,12],[2027,7]]) test(`off-chain ${y}-${m} uses the same print, actual mismatches and no replay`, async()=>{
 const root=fakeRoot(),{env,stage,calls}=setup();
 const inst=await mountCalendar7(root,new URLSearchParams(`year=${y}&month=${m}&layout=names`),env);
 await settle(root,y+"-"+String(m).padStart(2,"0"));
 assert.ok(calls.fetched.every(u=>u.includes("/names-demo/")));
 assert.equal(stage.configs.length,1);
 const c=stage.configs[0],pose=stage.shows.at(-1);
 assert.deepEqual([...c.printing.text],[...start.printing.text]);
 assert.deepEqual([...c.printing.ink],[...start.printing.ink]);
 const wrong=frontFailures(c.printing,pose,namesCells(y,m)).map(f=>[f.row,f.column]);
 assert.deepEqual(c.wrong,wrongStickerIndices(pose,wrong));
 assert.equal(root.el("player").hidden,true);
 assert.match(root.view.innerHTML,/Display only: no move sequence for this date \(beam preview print\)/);
 assert.match(root.view.innerHTML,/Move reachability is unverified/);
 assert.doesNotMatch(root.view.innerHTML,/Print B|UNSAT|Not exactly possible|data-nav="next"|data-nav="previous"|Cube layout/);
 if(y===2026&&m===2){assert.deepEqual(wrong,[[7,7]]);assert.equal(c.printing.text[c.wrong[0]],"25");assert.match(root.view.innerHTML,/Preview mismatch: cell bottom right \(row 7, column 7\) differs/);}
 inst.dispose();
});

test("instant date changes keep query settings and switch chain to mismatch preview and back without mixing prints",async()=>{
 const root=fakeRoot(),{env,stage,calls}=setup({search:"?app=calendar7&scheme=paper-blue&font=nunito&extra=keep"});
 const inst=await mountCalendar7(root,new URLSearchParams("year=2026&month=11"),env);
 await settle(root,"2026-11");
 root.date(2026,2); await settle(root,"2026-02");
 assert.equal(root.getAttribute("data-c7-any"),"best-effort");
 assert.equal(root.el("player").hidden,true);
 root.date(2026,11); await settle(root,"2026-11");
 assert.equal(root.getAttribute("data-c7-any"),"off");
 assert.equal(root.el("player").hidden,false);
 assert.equal(root.getAttribute("data-c7-digest"),graph.nodes[6].hash);
 assert.ok(stage.configs.every(c=>c.printing===stage.configs[0].printing));
 assert.equal(calls.fetched.length,3,"only one immutable data set");
 const p=new URLSearchParams(env.search());
 for(const [k,v] of [["year","2026"],["month","11"],["scheme","paper-blue"],["font","nunito"],["extra","keep"]])assert.equal(p.get(k),v);
 assert.equal(p.has("layout"),false);
 inst.dispose();
 assert.equal(root.listeners.submit.size,0);assert.equal(root.listeners.change.size,0);
});

test("invalid or incomplete picker edits do not navigate or replace the selected month",async()=>{
 const root=fakeRoot(),{env,calls}=setup();const inst=await mountCalendar7(root,new URLSearchParams("year=2026&month=11"),env);await settle(root,"2026-11");
 for(const [y,m]of [["",2],[0,2],[10000,2],[2026,0],[2026,13],["20x",2]])root.date(y,m,"year");
 await flush();assert.equal(calls.query.length,0);assert.equal(root.getAttribute("data-c7-month"),"2026-11");inst.dispose();
});

test("a late stage installs only the latest requested date on the same print",async()=>{
 const root=fakeRoot(),{env,stage}=setup();let resolve;env.createStage=()=>new Promise(r=>{resolve=r;});
 const inst=await mountCalendar7(root,new URLSearchParams("year=2026&month=2"),env);await flush();
 root.date(2099,12);await flush();resolve(stage);await settle(root,"2099-12");
 assert.equal(stage.configs.length,1);assert.match(stage.label,/December 2099/);assert.equal(root.el("player").hidden,true);inst.dispose();
});

test("dispose while the stage is pending cannot configure or show a stale preview",async()=>{
 const root=fakeRoot(),{env,stage}=setup();let resolve;env.createStage=()=>new Promise(r=>{resolve=r;});
 const inst=await mountCalendar7(root,new URLSearchParams("year=2026&month=2"),env);await flush();inst.dispose();resolve(stage);await flush();assert.equal(stage.configs.length,0);assert.equal(stage.shows.length,0);
});

test("a failed canonical download reports an error and never loads a different printing",async()=>{
 const root=fakeRoot(),{env,calls,stage}=setup({fail:true});await assert.rejects(mountCalendar7(root,new URLSearchParams(),env),/HTTP 404/);assert.equal(stage.configs.length,0);assert.ok(calls.fetched.every(u=>u.includes("/names-demo/")));
});
