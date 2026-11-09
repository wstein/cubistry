// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageHtml, buildModel, chooseMonth, chainRange, playerHtml } from "../src/apps/calendar7/month-view.ts";
import { parseGraph, parseDisplays } from "../src/apps/calendar7/graph.ts";
const json = (f) => JSON.parse(readFileSync(f, "utf8"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const table = parseDisplays(json("public/calendar7/displays.v1.json"));
const today = {year:2026,month:11};
const model = buildModel(graph, table, chooseMonth(new URLSearchParams(""), today, chainRange(graph)), today);
test("controls default to orientation before moves and offer exactly one notation choice", () => {
  const html = playerHtml(2);
  assert.match(html, /value="before" selected>Before moves/);
  assert.match(html, /data-c7="notation"/);
  assert.doesNotMatch(html, /Align at the end<\/label>/);
});
test("month cards show one selected word and put alternative counts in Technical details", () => {
  const html = pageHtml(model);
  assert.equal((html.match(/data-notation-word=/g) ?? []).length, 2);
  assert.equal((html.match(/<summary>Technical details<\/summary>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Block word with middle slice|Played with the rotations deferred/);
  assert.match(html, /Whole-cube rotations are free/);
});

test("all notation views map the same actual blocks and exclude free rotations from animation counts", async () => {
  const { notationForBlocks } = await import("../src/apps/calendar7/notation.ts");
  const { expandBlock } = await import("../src/apps/calendar7/blocks.ts");
  const { applyMoves, samePose } = await import("../src/apps/calendar7/engine.ts");
  const { parseState } = await import("../src/apps/calendar7/graph.ts");
  const { pose } = parseState(json("public/calendar7/state.v1.json"));
  const blocks = [{axis:0,lo:-3,hi:3,angle:1,kind:"rotation"},{axis:1,lo:0,hi:0,angle:-1,kind:"slice"},{axis:2,lo:1,hi:3,angle:2,kind:"outer-wide"}];
  for (const notation of ["blocks", "layers", "raw"]) {
    const p = notationForBlocks(blocks, notation);
    assert.equal(p.moves, 2, "only two slab moves are actually animated");
    assert.deepEqual(p.completedMoves, [0,0,1,2]);
    assert.deepEqual(p.groups.map(g=>g.index), [0,1,2]);
    if (notation === "raw") for (let i=0;i<blocks.length;i++) {
      const moves = p.groups[i].tokens.map(({text})=>{const m=/^g(\d+):([+-]?\d+)$/.exec(text);return [Number(m[1]),Number(m[2])]});
      assert.ok(moves.every(([g])=>g>=1&&g<=21));
      assert.deepEqual(moves, expandBlock(blocks[i]));
      assert.ok(samePose(applyMoves(pose,moves),applyMoves(pose,expandBlock(blocks[i]))));
    }
  }
});

test("progress marks only the active group, dims past groups and scrolls only the word box", async () => {
  const {markProgress}=await import("../src/apps/calendar7/notation.ts");
  let changes=0;
  const box={scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:40})};
  const groups=Array.from({length:100},(_,i)=>{
    const classes=new Set(), attrs=new Map();
    return {dataset:{block:String(i)},classes,attrs,
      classList:{toggle(c,on){changes++;on?classes.add(c):classes.delete(c)},add(c){changes++;classes.add(c)},remove(c){changes++;classes.delete(c)}},
      setAttribute(k,v){attrs.set(k,v)},removeAttribute(k){attrs.delete(k)},
      getBoundingClientRect:()=>({top:i*20-box.scrollTop,bottom:(i+1)*20-box.scrollTop}),
      scrollIntoView(){throw Error("must not scroll the document")}};
  });
  Object.assign(box,{firstElementChild:groups[0],querySelectorAll:()=>groups});
  markProgress(box,0,true,true);assert.equal(groups[0].attrs.get("aria-current"),"step");
  changes=0;markProgress(box,1,true,true);
  assert.ok(changes<=3,"only the previous/current group is updated");
  assert.ok(groups[0].classes.has("c7-past"));assert.equal(groups[1].attrs.get("aria-current"),"step");
  markProgress(box,3,true,true);assert.equal(box.scrollTop,40);
  assert.ok(groups[2].classes.has("c7-past"));assert.equal(groups[3].attrs.get("aria-current"),"step");
  markProgress(box,3,false,true);assert.equal(groups.filter(g=>g.attrs.has("aria-current")).length,0);
});
