import test from "node:test";
import assert from "node:assert/strict";
import { Cube3Controller } from "../src/apps/picture3/controller.ts";
import { sameState } from "../src/apps/picture3/model.ts";
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
const solver={async solve(){return "R'";},cancel(){},dispose(){}};
function setup(animate=async()=>{}){const view={configure(design,state,art){this.state=state;this.art=art;},async animate(from,token,to){await animate();this.state=to;}};const art=new Map(),controller=new Cube3Controller(view,()=>art,()=>{},solver);return{controller,view,art};}
test("real 3x3 controller retains history through view/art changes and replays undo/redo/exact solve",async()=>{
 const{controller:c,view}=setup();const original=c.snapshot.state;
 await c.play("R U2 F'");assert(!c.snapshot.exact);assert.equal(c.snapshot.cursor,3);
 await c.undo();await c.redo();assert(sameState(c.snapshot.state,view.state));
 await c.restore();assert(c.snapshot.exact);assert.equal(c.snapshot.cursor,0);assert.equal(c.snapshot.history.length,3);
 await c.play("R");await c.solve();assert(c.snapshot.exact);assert.equal(c.snapshot.history.length,2);
 assert(sameState(c.snapshot.state,original));c.dispose();
});
test("cancel finishes one in-flight legal turn then stops; failed exact solving preserves state/history",async()=>{
 const gate=deferred(),{controller:c}=setup(()=>gate.promise),run=c.play("R U F");
 c.cancel();gate.resolve();await run;assert.equal(c.snapshot.cursor,1);assert.equal(c.snapshot.busy,false);
 const before=c.snapshot;solver.solve=async()=>{throw Error("Unavailable: worker failed");};await c.solve();
 assert(sameState(c.snapshot.state,before.state));assert.deepEqual(c.snapshot.history,before.history);assert.match(c.snapshot.message,/Unavailable/);c.dispose();
});

test("history restore reverses only the applied prefix, retains redo, and can exceed manual limits",async()=>{
 const trace=[],{controller:c,view}=setup();const animate=view.animate;
 view.animate=async function(from,token,to){trace.push(token);await animate.call(this,from,token,to);};
 await c.play("R U F");await c.undo();const entries=c.snapshot.history.slice();trace.length=0;
 await c.restore();assert.deepEqual(trace,["U'","R'"]);assert(c.snapshot.exact);assert.equal(c.snapshot.cursor,0);assert.deepEqual(c.snapshot.history,entries);
 await c.redo();assert.equal(c.snapshot.cursor,1);await c.undo();
 const word=Array.from({length:99},(_,i)=>i%2?"U":"R").join(" ");
 await c.play(word);await c.play(word);assert.equal(c.snapshot.cursor,198);assert(!c.snapshot.exact);
 trace.length=0;await c.restore();assert(c.snapshot.exact);assert.equal(trace.length,198);assert.equal(c.snapshot.cursor,0);assert.equal(c.snapshot.history.length,198);
 const count=trace.length;await c.restore();assert.equal(trace.length,count);c.dispose();
});
test("canceling history restore commits one inverse turn, then a resumed restore verifies the remaining prefix",async()=>{
 const{controller:c,view}=setup();await c.play("R U F");const original=c.snapshot.history.slice();
 const gate=deferred();let first=true;view.animate=async function(from,token,to){if(first){first=false;await gate.promise;}this.state=to;};
 const restoring=c.restore();c.cancel();gate.resolve();await restoring;
 assert.equal(c.snapshot.cursor,2);assert.deepEqual(c.snapshot.history,original);assert(!c.snapshot.exact);
 await c.restore();assert(c.snapshot.exact);assert.equal(c.snapshot.cursor,0);assert.deepEqual(c.snapshot.history,original);c.dispose();
});
