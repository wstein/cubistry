import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3, Euler } from "three";
import { SmartRotation, ROTATION_TUNING as P } from "../packages/cube-viewer/src/smart-rotation.ts";
const radians = degrees => degrees * Math.PI / 180;
const initial = () => new Quaternion();
const spring = t => (1+P.returnFrequency*t)*Math.exp(-P.returnFrequency*t);
const near = (a,b,tolerance=1e-9) => assert(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function settled(controller, pitch, yaw, start=0) { controller.down(start); controller.drag(radians(pitch),radians(yaw),start+.2); controller.up(start+.4); }
test("settled views within 35 degrees of the front stay; beyond it they spring back to the front, never to an earlier view",()=>{
 const c=new SmartRotation(initial());settled(c,0,34);assert.equal(c.phase,"idle");near(c.anchor.angleTo(initial()),0);near(c.quaternion.angleTo(initial()),radians(34));
 settled(c,0,26,1);assert(c.quaternion.angleTo(initial())>radians(35));assert.equal(c.phase,"awaiting-return");near(c.anchor.angleTo(initial()),0);
 near(c.returnDeadline,3.4);c.step(3.399);assert.equal(c.phase,"awaiting-return");const outside=c.quaternion.clone();
 c.step(3.4);assert.equal(c.phase,"returning");near(c.quaternion.angleTo(outside),0);
 c.step(10);assert.equal(c.phase,"idle");near(c.quaternion.angleTo(initial()),0);
 const exact=new SmartRotation(initial());settled(exact,0,35);assert.equal(exact.phase,"idle");
 const over=new SmartRotation(initial());settled(over,0,36);assert.equal(over.phase,"awaiting-return");
 const spatial=new SmartRotation(initial());settled(spatial,30,30);assert(spatial.quaternion.angleTo(initial())>radians(35));assert.equal(spatial.phase,"awaiting-return");
 const diagonal=new SmartRotation(initial());settled(diagonal,20,20);assert(diagonal.quaternion.angleTo(initial())<radians(35));assert.equal(diagonal.phase,"idle");
});
test("no gesture ever moves the front anchor, and quaternion signs are equivalent",()=>{
 const c=new SmartRotation(initial());settled(c,0,20);settled(c,0,20,1);settled(c,0,5,2);near(c.anchor.angleTo(initial()),0);assert.equal(c.phase,"awaiting-return");
 const negative=new Quaternion(0,0,0,-1),d=new SmartRotation(negative);settled(d,0,24);assert.equal(d.phase,"idle");near(d.anchor.angleTo(initial()),0);near(d.quaternion.angleTo(initial()),radians(24));
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
  const stopAt=.5+P.dampingSeconds*Math.log(releaseSpeed/P.stopSpeed),deadline=stopAt+2;
  for(let at=.5+1/hz;at<deadline+.5;at+=1/hz)c.step(at);
  c.step(deadline+.5);assert.equal(c.phase,"returning");near(c.returnDeadline,deadline,1e-10);
  rows.push({q:c.quaternion.clone(),speed:releaseSpeed,deadline});
  c.step(deadline+3);assert.equal(c.phase,"idle");near(c.quaternion.angleTo(initial()),0);
 }
 for(const row of rows.slice(1)){near(row.speed,rows[0].speed,1e-10);near(row.deadline,rows[0].deadline,1e-10);near(row.q.angleTo(rows[0].q),0,1e-7);}
});
test("the two-second wait starts at the exact coast stop, including a frame crossing every phase",()=>{
 const c=trajectory(60),speed=c.angularSpeed,stop=.5+P.dampingSeconds*Math.log(speed/P.stopSpeed),deadline=stop+2;
 c.step(stop+1.999);assert.equal(c.phase,"awaiting-return");near(c.returnDeadline,deadline);
 c.step(deadline+.001);assert.equal(c.phase,"returning");
 const one=trajectory(60);one.step(deadline+3);assert.equal(one.phase,"idle");near(one.quaternion.angleTo(initial()),0);
});
test("return is a damped spring: monotone, no fixed duration, faster when farther; pointerdown freezes the intermediate quaternion",()=>{
 const c=new SmartRotation(new Quaternion().setFromEuler(new Euler(.2,-.3,0)));
 settled(c,35,30);const deadline=c.returnDeadline,target=c.anchor.clone(),start=c.quaternion.clone();
 let distance=c.quaternion.angleTo(target);
 for(let i=0;i<=400;i++){c.step(deadline+i/100);const next=c.quaternion.angleTo(target);assert(next<=distance+1e-7);distance=next;if(i===100)assert.equal(c.phase,"returning");}
 near(distance,0);assert.equal(c.phase,"idle");
 for(const t of [.1,.3,.8]){const f=new SmartRotation(initial());settled(f,0,90);f.step(f.returnDeadline+t);near(f.quaternion.angleTo(initial()),radians(90)*spring(t),1e-6);}
 const moved=hz=>{const f=new SmartRotation(initial());settled(f,0,distanceDeg(hz));f.step(f.returnDeadline+.1);return f.quaternion.angleTo(initial());};
 function distanceDeg(v){return v;}
 assert(radians(150)-moved(150)>radians(60)-moved(60));
 const d=new SmartRotation(initial());settled(d,30,35);const at=d.returnDeadline;d.step(at+.05);const displayed=d.quaternion.clone();
 d.down(at+.06);assert.equal(d.phase,"dragging");near(d.quaternion.angleTo(displayed),0);d.step(at+100);near(d.quaternion.angleTo(displayed),0);
 d.up(at+100.1,true);assert.equal(d.phase,"awaiting-return");near(d.returnDeadline,at+102.1);
 const e=new SmartRotation(initial());settled(e,0,40);e.down(1);assert.equal(e.returnDeadline,null);e.up(1.2,true);near(e.returnDeadline,3.2);
});
test("fast diagonal flick uses a combined speed cap; stationary holds and cancellation never coast",()=>{
 const c=new SmartRotation(initial());c.down(0);c.drag(10,10,.001);c.up(.001);assert(c.angularSpeed<=P.maximumSpeed);assert.equal(c.phase,"coasting");
 const held=trajectory(60);held.down(1);held.drag(.1,.1,1.01);held.up(1.51);assert.notEqual(held.phase,"coasting");assert.equal(held.angularSpeed,0);
 const cancelled=new SmartRotation(initial());cancelled.down(0);cancelled.drag(1,1,.01);cancelled.up(.01,true);assert.notEqual(cancelled.phase,"coasting");
});
test("small views stay after coast without moving the anchor; free/classic/reduced modes and switching never jump",()=>{
 const c=new SmartRotation(initial());c.down(0);c.drag(0,.2,1);c.up(1);assert.equal(c.phase,"coasting");near(c.anchor.angleTo(initial()),0);c.step(4);assert.equal(c.phase,"idle");near(c.anchor.angleTo(initial()),0);assert(c.quaternion.angleTo(initial())>.2);
 for(const mode of ["free","classic"]){const d=trajectory(60,mode);d.step(100);assert.equal(d.phase,"idle");assert.equal(d.returnDeadline,null);}
 const reduced=new SmartRotation(initial(),"smart",true);settled(reduced,40,40);assert.equal(reduced.phase,"idle");assert.equal(reduced.angularSpeed,0);
 const d=trajectory(60);d.step(.6);const q=d.quaternion.clone();d.setMode("classic",.6);near(d.quaternion.angleTo(q),0);d.setMode("smart",.7);near(d.quaternion.angleTo(q),0);assert.equal(d.phase,"awaiting-return");
 d.setReducedMotion(true,.8);assert.equal(d.phase,"idle");near(d.quaternion.angleTo(q),0);d.setReducedMotion(false,.9);near(d.returnDeadline,2.9);
});
test("zoom interaction, hidden/resume, reset and disposal preserve displayed orientation without hidden time catch-up",()=>{
 const q=new Quaternion().setFromEuler(new Euler(.12,-.18,0)),c=new SmartRotation(q);
 settled(c,30,40);const shown=c.quaternion.clone();c.interact(2);near(c.quaternion.angleTo(shown),0);near(c.returnDeadline,4);
 c.suspend(3);c.step(100);near(c.quaternion.angleTo(shown),0);c.resume(100);near(c.returnDeadline,102);c.step(101.99);near(c.quaternion.angleTo(shown),0);
 c.reset(106);near(c.quaternion.angleTo(q),0);near(c.anchor.angleTo(q),0);assert.equal(c.phase,"idle");c.dispose();c.down(107);c.drag(1,1,108);c.step(200);near(c.quaternion.angleTo(q),0);
 assert.throws(()=>new SmartRotation(new Quaternion(0,0,0,0)));assert.throws(()=>new SmartRotation(q,"invalid"));assert.throws(()=>c.step(NaN));
});

test("tiny slow input stays tiny after orientation integration rather than normalizing into a fast flick",()=>{
 const c=new SmartRotation(initial());c.down(0);c.drag(0,.001,.02);
 assert(c.angularSpeed>0 && c.angularSpeed<.05);near(c.quaternion.angleTo(initial()),.001,1e-8);
 c.up(.02);assert.equal(c.phase,"idle");
});

test("interrupting a return by taps, zoom/settings, mode, reduced motion or visibility never moves the anchor",()=>{
 for(const action of ["tap","interact","mode","reduced","visibility"]) {
  const c=new SmartRotation(initial());settled(c,0,60);const anchor=c.anchor.clone(),deadline=c.returnDeadline;
  c.step(deadline+.05);const q=c.quaternion.clone();assert(q.angleTo(anchor)>radians(35));
  let end=deadline+.07;
  if(action==="tap"){c.down(deadline+.06);c.up(end,true);}
  if(action==="interact")c.interact(end);
  if(action==="mode"){c.setMode("classic",deadline+.06);c.setMode("smart",end);}
  if(action==="reduced"){c.setReducedMotion(true,deadline+.06);c.setReducedMotion(false,end);}
  if(action==="visibility"){c.suspend(deadline+.06);end=100;c.resume(end);c.suspend(101);end=200;c.resume(end);}
  near(c.anchor.angleTo(anchor),0);near(c.quaternion.angleTo(q),0);assert.equal(c.phase,"awaiting-return");near(c.returnDeadline,end+2);
  c.step(end+10);near(c.quaternion.angleTo(anchor),0);near(c.anchor.angleTo(anchor),0);
 }
 const c=new SmartRotation(initial());settled(c,0,60);c.step(c.returnDeadline+.6);const before=c.quaternion.clone();
 assert(before.angleTo(c.anchor)<radians(35));
 c.down(7);c.drag(0,radians(1),7.2);c.up(7.4);assert.equal(c.phase,"idle");near(c.anchor.angleTo(initial()),0);assert(c.quaternion.angleTo(before)>radians(.9));
});
test("nonidentity initial orientations stay idle through reset/tap/settings/visibility without floating-point return loops",()=>{
 const q=new Quaternion().setFromEuler(new Euler(.321,-.789,0)),c=new SmartRotation(q);
 c.interact(1);c.down(2);c.up(2.1,true);c.suspend(3);c.resume(100);c.reset(101);c.setMode("classic",102);c.setMode("smart",103);
 assert.equal(c.phase,"idle");assert.equal(c.returnDeadline,null);near(c.quaternion.angleTo(q),0,1e-7);near(c.anchor.angleTo(q),0,1e-7);
});
