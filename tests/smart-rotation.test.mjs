import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3, Euler } from "three";
import { SmartRotation, ROTATION_TUNING as P } from "../packages/cube-viewer/src/smart-rotation.ts";
const radians = degrees => degrees * Math.PI / 180;
const initial = () => new Quaternion();
const near = (a,b,tolerance=1e-9) => assert(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function settled(controller, pitch, yaw, start=0) { controller.down(start); controller.drag(radians(pitch),radians(yaw),start+.2); controller.up(start+.4); }
test("24/25 degree settled changes are accepted; 26 degrees returns to the last accepted anchor",()=>{
 const c=new SmartRotation(initial());settled(c,0,24);assert.equal(c.phase,"idle");near(c.anchor.angleTo(initial()),radians(24));
 const accepted=c.anchor.clone();settled(c,0,26,1);assert.equal(c.phase,"awaiting-return");near(c.anchor.angleTo(accepted),0);
 near(c.returnDeadline,6.4);c.step(6.399);assert.equal(c.phase,"awaiting-return");const outside=c.quaternion.clone();
 c.step(6.4);assert.equal(c.phase,"returning");near(c.quaternion.angleTo(outside),0);
 c.step(6.9);near(c.quaternion.angleTo(accepted),radians(13),1e-7);c.step(7.4);assert.equal(c.phase,"idle");near(c.quaternion.angleTo(accepted),0);
 const exact=new SmartRotation(initial());settled(exact,0,25);assert.equal(exact.phase,"idle");
 const spatial=new SmartRotation(initial());settled(spatial,20,20);assert.equal(spatial.phase,"awaiting-return");
});
test("outside gestures do not drift the anchor and quaternion signs are equivalent",()=>{
 const c=new SmartRotation(initial());const anchor=c.anchor.clone();settled(c,0,26);settled(c,0,26,1);near(c.anchor.angleTo(anchor),0);assert.equal(c.phase,"awaiting-return");
 const negative=new Quaternion(0,0,0,-1),d=new SmartRotation(negative);settled(d,0,24);assert.equal(d.phase,"idle");near(d.anchor.angleTo(initial()),radians(24));
});
function trajectory(hz,mode="smart") {
 const c=new SmartRotation(initial(),mode),duration=.5,speed=1.2,frames=Math.round(hz*duration),dt=duration/frames;
 c.down(0);for(let i=1;i<=frames;i++)c.drag(speed*dt*.6,speed*dt*.8,i*dt);
 c.up(duration);return c;
}
test("seconds-based velocity/coast/threshold/delay/return are invariant at 30/60/144 Hz",()=>{
 const rows=[];
 for(const hz of [30,60,144]) {
  const c=trajectory(hz),releaseSpeed=c.angularSpeed;
  assert.equal(c.phase,"coasting");near(c.anchor.angleTo(initial()),0);
  const stopAt=.5+P.dampingSeconds*Math.log(releaseSpeed/P.stopSpeed),deadline=stopAt+5;
  for(let at=.5+1/hz;at<deadline+.5;at+=1/hz)c.step(at);
  c.step(deadline+.5);assert.equal(c.phase,"returning");near(c.returnDeadline,deadline,1e-10);
  rows.push({q:c.quaternion.clone(),speed:releaseSpeed,deadline});
  c.step(deadline+1);assert.equal(c.phase,"idle");near(c.quaternion.angleTo(initial()),0);
 }
 for(const row of rows.slice(1)){near(row.speed,rows[0].speed,1e-10);near(row.deadline,rows[0].deadline,1e-10);near(row.q.angleTo(rows[0].q),0,1e-7);}
});
test("the five-second wait starts at the exact coast stop, including a frame crossing every phase",()=>{
 const c=trajectory(60),speed=c.angularSpeed,stop=.5+P.dampingSeconds*Math.log(speed/P.stopSpeed),deadline=stop+5;
 c.step(stop+4.999);assert.equal(c.phase,"awaiting-return");near(c.returnDeadline,deadline);
 c.step(deadline+.001);assert.equal(c.phase,"returning");
 const one=trajectory(60);one.step(deadline+1.001);assert.equal(one.phase,"idle");near(one.quaternion.angleTo(initial()),0);
});
test("return is smooth, monotone and exactly one second; pointerdown freezes full intermediate quaternion before any drag",()=>{
 const c=new SmartRotation(new Quaternion().setFromEuler(new Euler(.2,-.3,0)));
 settled(c,35,30);const deadline=c.returnDeadline,from=c.quaternion.clone(),target=c.anchor.clone();
 let distance=c.quaternion.angleTo(target);
 for(let i=0;i<=100;i++){c.step(deadline+i/100);const next=c.quaternion.angleTo(target);assert(next<=distance+1e-7);distance=next;}
 near(distance,0);assert.equal(c.phase,"idle");
 const d=new SmartRotation(initial());settled(d,30,35);const at=d.returnDeadline;d.step(at+.41);const displayed=d.quaternion.clone();
 d.down(at+.45);assert.equal(d.phase,"dragging");near(d.quaternion.angleTo(displayed),0);d.step(at+100);near(d.quaternion.angleTo(displayed),0);
 d.up(at+100.1,true);assert.equal(d.phase,"awaiting-return");near(d.returnDeadline,at+105.1);
 const e=new SmartRotation(initial());settled(e,0,26);e.down(1);assert.equal(e.returnDeadline,null);e.up(1.2,true);near(e.returnDeadline,6.2);
});
test("fast diagonal flick uses a combined speed cap; stationary holds and cancellation never coast",()=>{
 const c=new SmartRotation(initial());c.down(0);c.drag(10,10,.001);c.up(.001);assert(c.angularSpeed<=P.maximumSpeed);assert.equal(c.phase,"coasting");
 const held=trajectory(60);held.down(1);held.drag(.1,.1,1.01);held.up(1.51);assert.notEqual(held.phase,"coasting");assert.equal(held.angularSpeed,0);
 const cancelled=new SmartRotation(initial());cancelled.down(0);cancelled.drag(1,1,.01);cancelled.up(.01,true);assert.notEqual(cancelled.phase,"coasting");
});
test("small anchor changes become accepted only after coast; free/classic/reduced modes and switching never jump",()=>{
 const c=new SmartRotation(initial());c.down(0);c.drag(0,.2,1);c.up(1);assert.equal(c.phase,"coasting");near(c.anchor.angleTo(initial()),0);c.step(4);assert.equal(c.phase,"idle");near(c.anchor.angleTo(c.quaternion),0);
 for(const mode of ["free","classic"]){const d=trajectory(60,mode);d.step(100);assert.equal(d.phase,"idle");assert.equal(d.returnDeadline,null);}
 const reduced=new SmartRotation(initial(),"smart",true);settled(reduced,40,40);assert.equal(reduced.phase,"idle");assert.equal(reduced.angularSpeed,0);
 const d=trajectory(60);d.step(.6);const q=d.quaternion.clone();d.setMode("classic",.6);near(d.quaternion.angleTo(q),0);d.setMode("smart",.7);near(d.quaternion.angleTo(q),0);assert.equal(d.phase,"awaiting-return");
 d.setReducedMotion(true,.8);assert.equal(d.phase,"idle");near(d.quaternion.angleTo(q),0);d.setReducedMotion(false,.9);near(d.returnDeadline,5.9);
});
test("zoom interaction, hidden/resume, reset and disposal preserve displayed orientation without hidden time catch-up",()=>{
 const q=new Quaternion().setFromEuler(new Euler(.12,-.18,0)),c=new SmartRotation(q);
 settled(c,30,40);const shown=c.quaternion.clone();c.interact(2);near(c.quaternion.angleTo(shown),0);near(c.returnDeadline,7);
 c.suspend(3);c.step(100);near(c.quaternion.angleTo(shown),0);c.resume(100);near(c.returnDeadline,105);c.step(104.99);near(c.quaternion.angleTo(shown),0);
 c.reset(106);near(c.quaternion.angleTo(q),0);near(c.anchor.angleTo(q),0);assert.equal(c.phase,"idle");c.dispose();c.down(107);c.drag(1,1,108);c.step(200);near(c.quaternion.angleTo(q),0);
 assert.throws(()=>new SmartRotation(new Quaternion(0,0,0,0)));assert.throws(()=>new SmartRotation(q,"invalid"));assert.throws(()=>c.step(NaN));
});

test("tiny slow input stays tiny after orientation integration rather than normalizing into a fast flick",()=>{
 const c=new SmartRotation(initial());c.down(0);c.drag(0,.001,.02);
 assert(c.angularSpeed>0 && c.angularSpeed<.05);near(c.quaternion.angleTo(initial()),.001,1e-8);
 c.up(.02);assert.equal(c.phase,"idle");
});
