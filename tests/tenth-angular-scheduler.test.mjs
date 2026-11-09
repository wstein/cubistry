// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {TenthScheduler} from '../src/apps/ms-timer/tenth.ts';
import {initialState} from '@cubistry/cube-mechanics';
import {TENTH_PRINT} from '../src/apps/ms-timer/tenth.ts';
test('tenth scheduling reserves angle rather than token count without changing its fixed preference',()=>{
 for(const turns of [1,-1,2]){
  const requests=[],s=new TenthScheduler();let duration;
  const c={state:initialState(TENTH_PRINT),currentValue:0,busy:false,progress:{total:1,completed:0,target:0},remainingQuarterTurns:Math.abs(turns),prepare:()=>[{face:'R',turns}],clearDeadline(){},setDeadline(){},request:v=>requests.push(v)};
  const snapshot=at=>({at,bucket:0,running:true,next:{target:1,deadline:1000,interval:100}});
  s.tick(snapshot(899),c,v=>duration=v);assert.equal(duration,50);assert.deepEqual(requests,[]);
  s.tick(snapshot(900),c,()=>{});assert.deepEqual(requests,turns===2?[1]:[]);
  if(turns!==2){s.tick(snapshot(950),c,()=>{});assert.deepEqual(requests,[1]);}s.invalidate();
 }
});
