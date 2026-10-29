import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync,writeFileSync,mkdirSync } from "node:fs";
import { CounterController } from "../src/apps/counter/controller.ts";
import { validateCounterDesign,targetFor } from "../src/apps/counter/design.ts";
import { validateCertifiedCounter,certifiedStep } from "../src/apps/counter/certified.ts";
import { stateEquals } from "@cubistry/cube-core";
import { applyMoves,parseAlg,matchesTarget,stickerPoses } from "@cubistry/cube-mechanics";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
const raw=JSON.parse(readFileSync(new URL("../public/counter-certified.v1.json",import.meta.url)));
const design=validateCounterDesign(JSON.parse(readFileSync(new URL("../public/counter-design.v2.json",import.meta.url))));
const route=validateCertifiedCounter(raw,design);
const token=m=>m.face+(m.turns===2?"2":m.turns===-1?"'":"");
const settle=async c=>{for(let i=0;c.busy&&i<200;i++) await new Promise(r=>setImmediate(r));assert.equal(c.busy,false);assert.notEqual(c.progress.status,"failed");};
async function harness(value=0){
  const moves=[],events=[];let print,solverCalls=0;
  const view={configure(p){print=p;},resetCamera(){},async animate(p){moves.push(p.move);}};
  const c=new CounterController(view,design,(value,busy,error,progress)=>{assert.equal(error,undefined);events.push({value,busy,progress});},async manifest=>({manifest,images:new Map(),materials:new Map(),textureOrigin:"bottom-left",dispose(){}}),async p=>{const solver=await prepareTestSolver(p);return{solve(from,to){solverCalls++;return solver.solve(from,to);}}});
  await c.configure("CERTIFIED TITLE",true,value,route);
  return{c,moves,events,get print(){return print;},get solverCalls(){return solverCalls;}};
}
test("actual controller commits canonical 00–99 in 339 HTM and inverse traversal restores complete states",async()=>{
  const h=await harness();const start=h.c.state;const transitions=[];
  for(let value=1;value<=99;value++){
    const before=h.moves.length;h.c.request(value);await settle(h.c);
    assert.equal(h.c.currentValue,value);
    assert.equal(stateEquals(h.c.state,{...route.states[value],printId:h.print.id}),true);
    assert.equal(matchesTarget(h.print,h.c.state,targetFor(value,true)),true);
    const word=h.moves.slice(before).map(token).join(" ");
    assert.ok(h.moves.length-before<=5);transitions.push({value,word,state:h.c.state});
  }
  assert.equal(h.moves.length,339);assert.equal(h.c.progress.sessionTotal,339);assert.equal(h.solverCalls,0);
  // Independent Python consumes the actual committed trace, not planned lengths.
  mkdirSync("test-results",{recursive:true});
  writeFileSync("test-results/certified-commits.json",JSON.stringify({print:h.print,start,transitions}));
  for(let value=98;value>=0;value--){h.c.request(value);await settle(h.c);assert.equal(stateEquals(h.c.state,{...route.states[value],printId:h.print.id}),true);}
  assert.equal(h.c.progress.sessionTotal,678);assert.equal(stateEquals(h.c.state,start),true);assert.equal(h.solverCalls,0);
});
test("arbitrary jump uses existing exactPhysical and verified complete goal permits adjacent resumption",async()=>{
  const h=await harness(23);h.c.request(78);await settle(h.c);
  assert.equal(h.solverCalls,1);assert.equal(stateEquals(h.c.state,{...route.states[78],printId:h.print.id}),true);
  const jump=h.moves.length;assert.equal(h.c.progress.sessionTotal,jump);
  h.c.request(79);await settle(h.c);assert.equal(h.solverCalls,1);assert.equal(h.moves.length-jump,route.increments[78].length);
  const alternate=applyMoves(h.c.state,parseAlg("B"));
  assert.equal(matchesTarget(h.print,alternate,targetFor(79,true)),true);
  assert.equal(certifiedStep({...route,states:route.states.map(s=>({...s,printId:h.print.id}))},alternate,79,80),null);
  // Test-only injection models an authoritative noncanonical pose, never a product teleport.
  h.c.authoritative=alternate;h.c.request(80);await settle(h.c);assert.equal(h.solverCalls,2);
  assert.equal(stateEquals(h.c.state,{...route.states[80],printId:h.print.id}),true);
  h.c.request(81);await settle(h.c);assert.equal(h.solverCalls,2);
});
test("certified ingress rejects damaged route/printing and unpadded requests while original remains available",async()=>{
  for(const mutate of [d=>d.version=2,d=>d.printing[0].id=false,d=>d.printing[1].image="X",d=>d.increments[0]="R",d=>d.increments.pop(),d=>d.totalHTM=340]){const d=structuredClone(raw);mutate(d);assert.throws(()=>validateCertifiedCounter(d,design));}
  const h=await harness();await assert.rejects(h.c.configure("TITLE",false,0,route),/leading-zero/);
  h.c.request(1);await settle(h.c);h.c.resetSessionMoves();assert.equal(h.c.progress.sessionTotal,0);
  await h.c.configure("ORIGINAL",false,15);assert.equal(h.c.progress.sessionTotal,0);assert.equal(matchesTarget(h.print,h.c.state,targetFor(15,false)),true);
  h.c.request(7);await settle(h.c);assert.equal(h.solverCalls,1);
});
test("certified queues and rejected turns preserve authoritative commits and session accounting",async()=>{
  const h=await harness();const pending=[];
  h.c.view.animate=p=>new Promise((resolve,reject)=>pending.push({p,resolve,reject}));
  const step=async()=>{assert.ok(pending.length);pending.shift().resolve();await new Promise(r=>setImmediate(r));};
  h.c.request(1);h.c.request(2);assert.equal(h.c.progress.sessionTotal,0);
  assert.equal(h.c.stopAfterCurrent(),1); // Stop cancels queued work before the move commits.
  await step();assert.equal(h.c.progress.sessionTotal,1);
  assert.throws(()=>h.c.resetSessionMoves(),/Wait/);
  while(h.c.busy)await step();
  assert.equal(h.c.currentValue,1);assert.equal(h.c.progress.sessionTotal,route.increments[0].length);
  h.c.request(2);await step();const committed=h.c.progress.sessionTotal;
  // Replace error assertion callback only for this intentionally rejected animation.
  h.c.onState=()=>{};
  pending.shift().reject(Error("interrupted animation"));await new Promise(r=>setImmediate(r));
  assert.equal(h.c.progress.status,"failed");assert.equal(h.c.progress.sessionTotal,committed);
  assert.equal(h.c.progress.completed,1);
});
