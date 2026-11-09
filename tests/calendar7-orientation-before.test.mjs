// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { playedBlocks, rotationOfMoves, sameMat, allOrientations } from "../src/apps/calendar7/deferral.ts";
import { expand } from "../src/apps/calendar7/blocks.ts";
import { applyMoves, samePose, stateDigest, inverseMoves } from "../src/apps/calendar7/engine.ts";
import { parseState, parseGraph } from "../src/apps/calendar7/graph.ts";
import { Calendar7Player } from "../src/apps/calendar7/player.ts";
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const { printing, pose: root } = parseState(json("public/calendar7/state.v1.json"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));

test("before mode puts an x/y orientation before conjugated layer blocks", () => {
  const word = [[1, 1], [21, 1], [8, -1], [7, 2], [6, 2]];
  const before = playedBlocks(word, { orientation: "before", slice: true });
  assert.ok(before.alignment.length > 0, "a nonidentity orientation must be factored out");
  assert.ok(before.alignment.every(([g]) => g === 7 || g === 14), "prefix uses x/y rotations only");
  assert.ok(before.blocks.every((b) => b.kind !== "rotation"));
  assert.ok(samePose(applyMoves(root, [...before.alignment, ...expand(before.blocks)]), applyMoves(root, word)));
});

test("all 24 orientations have an equivalent x/y prefix of at most three rotations", () => {
  for (const o of allOrientations()) {
    const p = playedBlocks(o.moves, { orientation: "before" });
    assert.ok(p.alignment.length <= 3);
    assert.ok(p.alignment.every(([g]) => g === 7 || g === 14));
    assert.ok(sameMat(rotationOfMoves(p.alignment), o.matrix));
  }
});

test("every stored edge, both ways and both slice settings, keeps the exact pose with a prefix", () => {
  let at = root;
  for (const edge of graph.edges) {
    const target = applyMoves(at, edge.moves);
    for (const slice of [false, true]) for (const [source, word, end] of [[at, edge.moves, target], [target, inverseMoves(edge.moves), at]]) {
      const p = playedBlocks(word, { orientation: "before", slice });
      assert.ok(samePose(applyMoves(source, [...p.alignment, ...expand(p.blocks)]), end));
    }
    at = target;
  }
});

test("the player begins in orientation phase, freezes settings and skips an interrupted prefix safely", () => {
  const word = [[1, 1], [21, 1], [8, -1]];
  const target = applyMoves(root, word);
  const g = { nodes: [{hash: stateDigest(printing, root)}, {hash: stateDigest(printing, target)}], edges: [{moves: word}] };
  let release;
  const turns = [];
  const player = new Calendar7Player({graph:g,printing,root,orientation:"before",slice:true,reducedMotion:()=>false,view:{show(){release?.()},turn(block){turns.push(block);return new Promise(r=>{release=r})}}});
  player.jump(0); player.go(1);
  assert.equal(player.snapshot.phase, "orientation");
  assert.equal(turns[0].kind, "rotation");
  player.setOrientation("stored");
  assert.equal(player.snapshot.orientation, "before", "current plan keeps its orientation");
  player.pause(); player.skip();
  assert.equal(stateDigest(printing, player.shownPose), g.nodes[1].hash);
  assert.equal(player.snapshot.phase, "idle");
  player.go(0); player.skip();
  assert.equal(stateDigest(printing, player.shownPose), g.nodes[0].hash);
  player.dispose();
});

const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
function controlled(options={}) {
  const word = options.word ?? [[1,1],[21,1],[9,-1]];
  const target = applyMoves(root,word);
  const g = { nodes:[{hash:stateDigest(printing,root)},{hash:stateDigest(printing,target)}],edges:[{moves:word}] };
  const turns=[], errors=[], changes=[];
  let finish;
  const player=new Calendar7Player({graph:g,printing,root,orientation:"before",slice:true,reducedMotion:()=>false,onError:e=>errors.push(e),onChange:s=>changes.push(s),view:{show(){finish?.()},turn(block,before,ms,ease){turns.push({block,ms,ease});return new Promise(r=>{finish=r})}},...options});
  return {player,turns,errors,changes,release:()=>finish?.(),g};
}
test("prefix pause/play, layer skip and stale completion all preserve the stored digest", async () => {
  const {player,turns,release,g}=controlled();
  player.jump(0);player.go(1);player.pause();release();await flush();
  assert.equal(turns.length,1,"pausing does not start the next orientation turn");
  assert.equal(player.snapshot.status,"paused");
  player.play();assert.equal(turns.length,2);
  while(player.snapshot.phase==="orientation"){release();await flush();}
  assert.equal(player.snapshot.phase,"blocks");
  player.skip();release();await flush();
  assert.equal(stateDigest(printing,player.shownPose),g.nodes[1].hash);
  player.go(0);player.skip();release();await flush();
  assert.equal(stateDigest(printing,player.shownPose),g.nodes[0].hash);
  player.dispose();
});
test("a preference change during a prefix uses reduced alignment timing; initial reduced motion jumps", async () => {
  let reduced=false;
  const {player,turns,release,g}=controlled({reducedMotion:()=>reduced});
  player.jump(0);player.go(1);reduced=true;release();await flush();
  assert.equal(turns[1].ms,150);
  assert.equal(turns[1].ease,undefined);
  player.skip();release();await flush();
  assert.equal(stateDigest(printing,player.shownPose),g.nodes[1].hash);
  const count=turns.length;player.go(0);
  assert.equal(turns.length,count);
  assert.equal(stateDigest(printing,player.shownPose),g.nodes[0].hash);
  player.dispose();
});
test("prefix disposal and replacement generation never resume retired turns", async () => {
  const {player,turns,release}=controlled();
  player.jump(0);player.go(1);player.dispose();release();await flush();
  assert.equal(turns.length,1);
  assert.equal(player.snapshot.phase,"idle");
});
test("before mode still rejects an incorrect final full-state hash", () => {
  const {player,g}=controlled();
  g.nodes[1].hash="0".repeat(64);
  player.jump(0);player.go(1);
  assert.throws(()=>player.skip(),/state digest.*node 1/);
  player.dispose();
});

test("a rotation-only step has a prefix phase and zero counted layer blocks", async () => {
  const {player,turns,release,g}=controlled({word:[[21,1]]});
  player.jump(0);player.go(1);
  assert.equal(player.snapshot.phase,"orientation");assert.equal(player.snapshot.total,0);
  while(player.snapshot.phase==="orientation"){release();await flush();}
  assert.equal(player.snapshot.phase,"idle");assert.ok(turns.every(t=>t.block.kind==="rotation"));
  assert.equal(stateDigest(printing,player.shownPose),g.nodes[1].hash);player.dispose();
});
