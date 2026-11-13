// SPDX-License-Identifier: AGPL-3.0-or-later
// The Calendar7 mount on the canonical long chain C data (public/calendar7/chain-c): all former layout URLs select the one
// physical print, today and the defaults, display-only months outside the chain, the picker, late stages, failed downloads.
// (Ported from the former names-demo mount tests; the same contracts on the chain C data.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { DEFAULT_WORD_OPTIONS, stepNotation } from "../src/apps/calendar7/notation.ts";
import { chainRange, monthLabel, stepFrom } from "../src/apps/calendar7/month-view.ts";
import { namesCells, wrongStickerIndices } from "../src/apps/calendar7/anydate.ts";
import { frontFailures } from "../src/apps/calendar7/display.ts";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/chain-c/graph.v1.json"));
const start = parseState(json("public/calendar7/chain-c/state.v1.json"));
const range = chainRange(graph);
/** Node of November 2026 (January 1980 is node 0) and the block-move count of the step to December 2026. */
const NOV_2026 = (2026 - 1980) * 12 + 10;
const NOV_DEC_MOVES = stepNotation(stepFrom(graph, range, { year: 2026, month: 11 }, 1).moves, DEFAULT_WORD_OPTIONS).moves;

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
  assert.equal(calls.fetched.length,4);
  assert.ok(calls.fetched.every(u=>u.startsWith("/calendar7/chain-c/")));
  assert.deepEqual([...stage.configs[0].printing.text],[...start.printing.text]);
  assert.equal(root.getAttribute("data-c7-digest"),graph.nodes[NOV_2026].hash);
  assert.match(root.view.innerHTML,new RegExp(`December 2026<\\/a> · ${NOV_DEC_MOVES} moves`));
  assert.match(root.view.innerHTML,/data-c7-chain>Names \(long chain, print D, January 1980 - January 2036\)\. Chain: January 1980 to January 2036, 672 steps\./);
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

for(const [y,m] of [[2037,2],[2099,12],[2036,2]]) test(`off-chain ${y}-${m} uses the same print, actual mismatches and no replay`, async()=>{
 const root=fakeRoot(),{env,stage,calls}=setup();
 const inst=await mountCalendar7(root,new URLSearchParams(`year=${y}&month=${m}&layout=names`),env);
 await settle(root,y+"-"+String(m).padStart(2,"0"));
 assert.ok(calls.fetched.every(u=>u.includes("/chain-c/")));
 assert.equal(stage.configs.length,1);
 const c=stage.configs[0],pose=stage.shows.at(-1);
 assert.deepEqual([...c.printing.text],[...start.printing.text]);
 assert.deepEqual([...c.printing.ink],[...start.printing.ink]);
 const wrong=frontFailures(c.printing,pose,namesCells(y,m)).map(f=>[f.row,f.column]);
 assert.deepEqual(c.wrong,wrongStickerIndices(pose,wrong));
 assert.equal(root.el("player").hidden,true);
 assert.match(root.view.innerHTML,/Display only: no move sequence for this date \(print D\)/);
 assert.match(root.view.innerHTML,/Move reachability is unverified/);
 assert.doesNotMatch(root.view.innerHTML,/Print B|UNSAT|Not exactly possible|data-nav="next"|data-nav="previous"|Cube layout/);
 if(y===2037&&m===2){assert.deepEqual(wrong,[[7,7]]);assert.equal(c.printing.text[c.wrong[0]],"29");assert.match(root.view.innerHTML,/Preview mismatch: cell bottom right \(row 7, column 7\) differs/);}
 inst.dispose();
});

test("instant date changes keep query settings and switch chain to mismatch preview and back without mixing prints",async()=>{
 const root=fakeRoot(),{env,stage,calls}=setup({search:"?app=calendar7&scheme=paper-blue&font=nunito&extra=keep"});
 const inst=await mountCalendar7(root,new URLSearchParams("year=2026&month=11"),env);
 await settle(root,"2026-11");
 root.date(2037,2); await settle(root,"2037-02");
 assert.equal(root.getAttribute("data-c7-any"),"best-effort");
 assert.equal(root.el("player").hidden,true);
 root.date(2026,11); await settle(root,"2026-11");
 assert.equal(root.getAttribute("data-c7-any"),"off");
 assert.equal(root.el("player").hidden,false);
 assert.equal(root.getAttribute("data-c7-digest"),graph.nodes[NOV_2026].hash);
 assert.ok(stage.configs.every(c=>c.printing===stage.configs[0].printing));
 assert.equal(calls.fetched.length,4,"only one immutable data set");
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
 const inst=await mountCalendar7(root,new URLSearchParams("year=2037&month=2"),env);await flush();
 root.date(2099,12);await flush();resolve(stage);await settle(root,"2099-12");
 assert.equal(stage.configs.length,1);assert.match(stage.label,/December 2099/);assert.equal(root.el("player").hidden,true);inst.dispose();
});

test("dispose while the stage is pending cannot configure or show a stale preview",async()=>{
 const root=fakeRoot(),{env,stage}=setup();let resolve;env.createStage=()=>new Promise(r=>{resolve=r;});
 const inst=await mountCalendar7(root,new URLSearchParams("year=2037&month=2"),env);await flush();inst.dispose();resolve(stage);await flush();assert.equal(stage.configs.length,0);assert.equal(stage.shows.length,0);
});

test("a failed canonical download reports an error and never loads a different printing",async()=>{
 const root=fakeRoot(),{env,calls,stage}=setup({fail:true});await assert.rejects(mountCalendar7(root,new URLSearchParams(),env),/HTTP 404/);assert.equal(stage.configs.length,0);assert.ok(calls.fetched.every(u=>u.includes("/chain-c/")));
});
