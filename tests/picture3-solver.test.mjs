import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createCube3Design, apply, inverse, exactGoal } from "../src/apps/picture3/model.ts";
import { centerKernelReference } from "@puzlwerk/solver-3x3-picture";
import { alignCenterFrame, centerOrientations, solveExactPicture, verifyExactWord } from "../src/apps/picture3/solver-core.ts";
import { ExactPictureSolver } from "../src/apps/picture3/solver.ts";

test("all-six-center reference is inverted and verified against every immutable tile frame", async () => {
  const d=createCube3Design(), reference=centerKernelReference([1,1,0,0,0,0]);
  assert.equal(reference.status,"reference");
  const word=reference.moves.join(" "), from=apply(d.printing,word);
  assert.deepEqual(centerOrientations(d,from),[1,1,0,0,0,0]);
  assert(!exactGoal(d,apply(from,word)),"forward reference would double the quarter-turn residual");
  assert(exactGoal(d,apply(from,inverse(word))));
  const solved=await solveExactPicture(d,from,async()=>"");assert(exactGoal(d,apply(from,solved)));
  for(const frame of ["x","y'","z2","x y z'","x2 y2"]) {
    const shifted=apply(from,frame),aligned=alignCenterFrame(d,shifted);
    assert.deepEqual(centerOrientations(d,aligned.aligned),[1,1,0,0,0,0]);
    assert(exactGoal(d,apply(shifted,await solveExactPicture(d,shifted,async()=>""))));
  }
  await assert.rejects(solveExactPicture(d,apply(d.printing,"R"),async()=>""),/noncenter/);
  assert.throws(()=>verifyExactWord(d,from,""),/54-tile/);
});
test("real pinned ordinary solver plus center correction replays seed44, center-only and whole-frame cases independently", () => {
  const result=JSON.parse(execFileSync(process.execPath,["tests/helpers/picture3-solve.mjs"],{encoding:"utf8",timeout:25000}));
  assert.equal(result.length,3);assert(result.every(row=>row.all54Exact && row.solutionMoves<=400));
});
function worker(){return{onmessage:null,onerror:null,onmessageerror:null,stopped:0,postMessage(message){this.message=message;},terminate(){this.stopped++;}};}
test("solver workers enforce deadline/cancel, reject color-only endpoints and ignore stale messages",async()=>{
  const created=[],solver=new ExactPictureSolver(()=>{const w=worker();created.push(w);return w;},1000);
  const d=createCube3Design(),from=apply(d.printing,"R");
  const one=solver.solve(d,from),old=created[0].onmessage;
  const two=solver.solve(d,from);await assert.rejects(one,/Cancelled/);assert.equal(created[0].stopped,1);
  old({data:{word:"R'"}});
  created[1].onmessage({data:{word:""}});await assert.rejects(two,/Unavailable.*54-tile/);
  const three=solver.solve(d,from);created[2].onmessage({data:{word:"R'"}});assert.equal(await three,"R'");
  assert.equal(created[2].stopped,1);solver.dispose();await assert.rejects(solver.solve(d,from),/closed/);
  const timeoutWorker=worker(),timeout=new ExactPictureSolver(()=>timeoutWorker,5);
  await assert.rejects(timeout.solve(d,from),/Timeout/);assert.equal(timeoutWorker.stopped,1);timeout.dispose();
});
