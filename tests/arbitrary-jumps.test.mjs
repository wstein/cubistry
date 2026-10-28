import test from "node:test";import assert from "node:assert/strict";import{readFileSync}from"node:fs";import{execFileSync}from"node:child_process";
import{TABLE_URL,create2x2Solver}from"@puzlwerk/solver-2x2";import{createCounterSolver}from"../src/adapters/puzlwerk-2x2.ts";import{applyMoves}from"@cubistry/cube-mechanics";import{stateEquals}from"@cubistry/cube-core";
const cases=JSON.parse(readFileSync(new URL("./fixtures/arbitrary-jumps.json",import.meta.url)));
test("reported exact-frame jumps reproduce raw frame overhead and bounded coordinate candidates replay shorter physical routes",async()=>{
 const bytes=readFileSync(TABLE_URL),raw=await create2x2Solver(bytes,cases[0].print), selected=await createCounterSolver(cases[0].print,async()=>bytes);
 for(const c of cases){const old=raw.solve2x2(c.from,c.target,{mode:"exactPhysical"});assert.deepEqual(old,c.raw);const moves=selected.solve(c.from,c.target,{coordinateFrames:true});assert.deepEqual(moves,c.selected);assert.ok(moves.length<=11);assert.equal(stateEquals(applyMoves(c.from,moves),c.target),true);assert.equal(c.raw.quotientDistance+c.raw.frameCorrectionMoves,c.raw.moveCount);}
 assert.equal(stateEquals(cases[0].from,cases[1].target),true);assert.equal(stateEquals(cases[0].target,cases[1].from),true);assert.ok(cases[1].selected.length<=cases[0].selected.length);
 assert.match(execFileSync("python3",["tests/arbitrary_jump_replay.py"],{encoding:"utf8"}),/PASS/);
});
