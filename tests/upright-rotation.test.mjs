import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Euler,Vector3} from 'three';
import {SmartRotation,ROTATION_TUNING as P} from '../packages/cube-viewer/src/smart-rotation.ts';
const pose=(p=0,y=0)=>new Quaternion().setFromEuler(new Euler(p,y,0));
const same=(a,b)=>assert(a.angleTo(b)<1e-7);
function upright(q){const up=new Vector3(0,1,0).applyQuaternion(q);assert(Math.abs(up.x)<1e-12);assert(up.y>=Math.sin(.05)-1e-12);}
const ease=t=>t*t*t*(10-15*t+6*t*t);
test('Smart and Classic remain upright through yaw revolutions, pitch poles, coast and angular return',()=>{
 for(const mode of ['smart','classic']){
  const c=new SmartRotation(pose(.16,-.2),mode);c.down(0);
  for(let i=1;i<=100;i++){c.drag(.001,2*Math.PI/100,i/100);upright(c.quaternion);}
  same(c.quaternion,pose(.26,-.2));
  c.drag(100,0,1.1);upright(c.quaternion);same(c.quaternion,pose(P.pitchLimit,-.2));
  c.drag(-200,0,1.2);upright(c.quaternion);same(c.quaternion,pose(-P.pitchLimit,-.2));
  c.up(1.2);for(let t=1.21;t<7;t+=.013){c.step(t);upright(c.quaternion);}
 }
});
test('upright return uses shortest unwrapped yaw and pitch easing without intermediate SLERP roll',()=>{
 const start=pose(.3,179*Math.PI/180),c=new SmartRotation(start);c.down(0);c.drag(.5,50*Math.PI/180,.2);c.up(.4);
 const at=c.returnDeadline;assert.equal(at,2.4);
 for(let i=0;i<=100;i++){const t=i/100;c.step(at+t);upright(c.quaternion);
  same(c.quaternion,pose(.8-.5*ease(t),(229-50*ease(t))*Math.PI/180));}
 same(c.quaternion,start);assert.equal(c.phase,'idle');
});
test('pitch boundary stops outward inertia analytically and leaves the exact two-second settled delay at every frame rate',()=>{
 const rows=[];
 for(const hz of [30,60,144]){
  const c=new SmartRotation(pose(1.35,0));c.down(0);c.drag(.1,.15,.02);c.up(.02);
  const speed=c.angularSpeed,vp=speed*.1/Math.hypot(.1,.15),vy=speed*.15/Math.hypot(.1,.15);
  const stop=.02+P.dampingSeconds*Math.log(vy/P.stopSpeed),deadline=stop+2;
  const hit=.02-P.dampingSeconds*Math.log(1-(P.pitchLimit-1.45)/(vp*P.dampingSeconds));assert(hit<stop);
  for(let t=.02+1/hz;t<deadline+.5;t+=1/hz){c.step(t);upright(c.quaternion);}
  c.step(deadline+.5);assert.equal(c.phase,'returning');assert(Math.abs(c.returnDeadline-deadline)<1e-10);
  rows.push(c.quaternion.clone());c.step(deadline+1);same(c.quaternion,pose(1.35,0));
 }
 for(const q of rows)same(q,rows[0]);
 const c=new SmartRotation(pose());c.down(0);c.drag(1.45,0,.02);c.up(.02);
 const hit=.02-P.dampingSeconds*Math.log(1-(P.pitchLimit-1.45)/(c.angularSpeed*P.dampingSeconds));
 c.step(hit+.001);assert.equal(c.phase,'awaiting-return');assert(Math.abs(c.returnDeadline-hit-2)<1e-10);
});
test('Free retains full quaternion rotation; explicit upright mode change levels to the closest allowed target without snapping',()=>{
 for(const mode of ['smart','classic'])for(const angles of [[.4,.7,1.2],[2.8,-2,2.6],[Math.PI,0,0],[0,0,Math.PI]]){
  const q=new Quaternion().setFromEuler(new Euler(...angles)),c=new SmartRotation(q,'free');same(c.quaternion,q);
  c.setMode(mode,1);same(c.quaternion,q);assert.equal(c.phase,'leveling');
  const target=new SmartRotation(q,mode).quaternion,chosen=q.angleTo(target);
  for(let p=-P.pitchLimit;p<=P.pitchLimit;p+=.09)for(let y=-Math.PI;y<Math.PI;y+=.11)
   assert(q.angleTo(pose(p,y))>=chosen-1e-7,'analytic projection must beat independent grid candidates');
  for(let t=1;t<2;t+=.01)c.step(t);c.step(2);same(c.quaternion,target);upright(c.quaternion);
  same(c.anchor,new SmartRotation(q,mode).anchor);
 }
 const c=new SmartRotation(pose(),'free');c.down(0);c.drag(.7,.4,.1);c.drag(-.2,.8,.2);c.up(.4);
 assert(Math.abs(new Vector3(0,1,0).applyQuaternion(c.quaternion).x)>.01,'Free remains capable of roll');
});
test('interrupted leveling retains its exact residual through tap and drag, resumes on release and never adopts an automatic anchor',()=>{
 const c=new SmartRotation(pose(),'free');c.down(0);c.drag(.7,.4,.1);c.drag(-.2,.8,.2);c.up(.4);const anchor=c.anchor.clone();
 const target=new SmartRotation(c.quaternion).quaternion.clone();c.setMode('smart',1);c.step(1.4);const shown=c.quaternion.clone();c.down(1.4);same(c.quaternion,shown);c.step(10);same(c.quaternion,shown);
 c.up(10,true);assert.equal(c.phase,'leveling');c.step(11);upright(c.quaternion);same(c.quaternion,target);same(c.anchor,anchor);assert.equal(c.returnDeadline,13);
 c.step(13.4);const automatic=c.quaternion.clone();c.down(13.4);same(c.quaternion,automatic);c.up(13.6,true);same(c.anchor,anchor);assert.equal(c.returnDeadline,15.6);
 const d=new SmartRotation(pose(),'free');d.down(0);d.drag(.8,.6,.1);d.drag(.4,.9,.2);d.up(.4);d.setMode('classic',1);d.step(1.4);
 const before=d.quaternion.clone();d.down(1.4);same(d.quaternion,before);d.drag(0,0,1.5);same(d.quaternion,before);
 d.drag(.03,.04,1.6);const moved=d.quaternion.clone();assert(moved.angleTo(before)>.01);d.up(1.8);assert.equal(d.phase,'leveling');same(d.quaternion,moved);
 d.step(2.8);upright(d.quaternion);assert.equal(d.phase,'idle');
});
test('reduced motion performs only requested 150ms leveling; visibility and Free interruption preserve displayed pose',()=>{
 const q=new Quaternion().setFromEuler(new Euler(.7,.6,1)),c=new SmartRotation(q,'free',true);
 c.setMode('smart',1);same(c.quaternion,q);c.step(1.075);assert.equal(c.phase,'leveling');const shown=c.quaternion.clone();
 c.down(1.075);c.step(20);same(c.quaternion,shown);c.up(20,true);c.step(20.149);assert.equal(c.phase,'leveling');c.step(20.15);upright(c.quaternion);assert.equal(c.phase,'idle');assert.equal(c.returnDeadline,null);
 c.setMode('free',21);c.down(21);c.drag(.8,.9,21.1);c.drag(-.4,.6,21.2);c.up(21.4);c.setMode('classic',22);c.step(22.05);
 const hidden=c.quaternion.clone();c.suspend(22.05);c.step(200);same(c.quaternion,hidden);c.resume(200);same(c.quaternion,hidden);c.step(200.15);upright(c.quaternion);
 c.setMode('free',201);c.down(201);c.drag(.8,.9,201.1);c.up(201.4);const free=c.quaternion.clone();c.setMode('smart',202);c.step(202.05);const bridge=c.quaternion.clone();c.setMode('free',202.05);same(c.quaternion,bridge);c.step(210);same(c.quaternion,bridge);assert.equal(c.phase,'idle');
 c.reset(211);upright(c.quaternion);same(c.quaternion,new SmartRotation(q).quaternion);assert(free.angleTo(c.quaternion)>.1);
});
