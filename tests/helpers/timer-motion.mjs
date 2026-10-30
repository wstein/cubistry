import { readFileSync } from 'node:fs';
import { TimerController } from '../../src/apps/timer/controller.ts';
import { validateCounterDesign } from '../../src/apps/counter/design.ts';
import { animateTimedProgress } from '../../packages/cube-viewer/src/motion-timing.ts';
import { prepareTestSolver } from './shared-solver.mjs';
const design=validateCounterDesign(JSON.parse(readFileSync('public/counter-design.v2.json')));
/** Actual controller and interpolation; only the display and monotonic scheduler are synthetic. */
export async function timerMotion(route,value,duration=250,startAt=0){
 let at=startAt,id=0,speed=duration,failure;
 const frames=new Map(),timers=new Map(),history=[],rows=[];
 const runtime={now:()=>at,frame(cb){const n=++id;frames.set(n,cb);history.push(cb);return n;},cancelFrame(n){frames.delete(n);},
  timer(cb,delay){const n=++id;timers.set(n,{cb,at:at+delay});history.push(cb);return n;},cancelTimer(n){timers.delete(n);}};
 const controller=new TimerController({configure(){},resetCamera(){},async animate(event,source){
  const row={event,source,calledAt:at,samples:[],completeAt:null};rows.push(row);
  await animateTimedProgress(source??(()=>null),()=>speed,progress=>row.samples.push({at,progress}),runtime);row.completeAt=at;
 }},route,design.assets,(_v,_busy,error)=>{if(error)failure=error;},async manifest=>({manifest,images:new Map(),materials:new Map(),textureOrigin:'bottom-left',dispose(){}}),prepareTestSolver);
 await controller.configure(value);
 async function advance(time){at=time;const due=[...timers.entries()].filter(([,t])=>t.at<=at);
  for(const[n,t]of due){if(!timers.delete(n))continue;t.cb();}
  const next=[...frames.entries()];for(const[n,cb]of next){if(!frames.delete(n))continue;cb(at);}
  // One event-loop boundary drains the finite animation/controller promise chain.
  await new Promise(setImmediate);if(failure)throw failure;
 }
 return {controller,rows,frames,timers,history,runtime,get now(){return at;},setDuration(v){speed=v;},advance,
  async finishRow(){const row=rows.at(-1),plan=row.source?.(),from=row.samples.at(-1).progress;
   const end=plan?.endAt??at+speed*(1-from),start=plan?Math.max(at,end-plan.durationMs*(1-from)):at;
   await advance(start);await advance((start+end)/2);await advance(end);return row;},
 };
}
