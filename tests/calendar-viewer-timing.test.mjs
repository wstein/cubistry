// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CalendarViewer} from '../src/apps/calendar/viewer.ts';
import {apply,sameState,validateDesign} from '../src/apps/calendar/model.ts';
const pin=JSON.parse(readFileSync('calendar-source.json'));
const design=validateDesign(JSON.parse(readFileSync('public/calendar/'+Object.keys(pin.runtime)[0])));
test('3x3 calendar preserves quarter-turn preferences and doubles each half-turn duration',async()=>{
 const original={performance:globalThis.performance,requestAnimationFrame:globalThis.requestAnimationFrame,matchMedia:globalThis.matchMedia};
 try{
  let at=0;globalThis.performance={now:()=>at};globalThis.matchMedia=()=>({matches:false});
  for(const duration of [100,250,500,1000])for(const token of ['R',"R'",'R2','U',"U'",'U2']){
   const frames=[],samples=[];globalThis.requestAnimationFrame=cb=>frames.push(cb);
   const from=design.printing,to=apply(from,token);
   const viewer=Object.assign(Object.create(CalendarViewer.prototype),{current:from,busy:false,duration,cube:{beginTurn(){return{update:p=>samples.push(p),dispose(){}};},sync:s=>assert(sameState(s,to))}});
   at=0;let done=false;const pending=viewer.animate(from,token,to).then(()=>done=true);
   const expected=duration*(token.endsWith('2')?2:1);
   while(!done){at+=duration/4;const next=frames.splice(0);for(const cb of next)cb(at);for(let n=0;n<5;n++)await Promise.resolve();}
   await pending;assert.equal(at,expected,`${duration} ${token}`);assert.equal(samples.at(-1),1);assert(sameState(viewer.presentedState,to));assert.equal(viewer.animating,false);
  }
 }finally{Object.assign(globalThis,original);}
});
