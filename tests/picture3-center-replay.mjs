import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCube3Design,apply,inverse,sameState,FACE_FRAMES} from '../src/apps/picture3/model.ts';
import {centerKernelReference} from '@puzlwerk/solver-3x3-picture';
const target=createCube3Design().printing,order=['U','L','F','R','B','D'];
const isCenter=s=>s.p.filter(Boolean).length===1;
const centers=order.map(face=>target.find(s=>isCenter(s)&&JSON.stringify(s.n)===JSON.stringify(FACE_FRAMES.find(f=>f.face===face).normal)));
let checked=0,maximumReferenceMoves=0;
for(let code=0;code<4096;code++) {
 let at=code;const tuple=Array.from({length:6},()=>{const n=at%4;at=Math.floor(at/4);return n;});
 if(tuple.reduce((a,b)=>a+b,0)%2)continue;
 const reference=centerKernelReference(tuple);assert.equal(reference.status,'reference');
 const word=reference.moves.join(' '),end=apply(target,word);
 assert(sameState(end.filter(s=>!isCenter(s)),target.filter(s=>!isCenter(s))));
 for(let i=0;i<6;i++) {
  const expected=apply([centers[i]],tuple[i]?order[i]+(tuple[i]===2?'2':tuple[i]===3?"'":''):'')[0];
  assert.deepEqual(end.find(s=>s.id===expected.id),expected);
 }
 assert(sameState(apply(end,inverse(word)),target));
 maximumReferenceMoves=Math.max(maximumReferenceMoves,reference.htm);checked++;
 if(checked%256===0)console.log(`kernel replay ${checked}/2048`);
}
assert.equal(checked,2048);
const pin=JSON.parse(readFileSync(new URL('../puzlwerk-picture-source.json',import.meta.url)));
const report={providerCommit:pin.commit,checked,maximumReferenceMoves,allNoncentersPreserved:true,allSixCenterOrientationsMatched:true,allInverseFull54ReplaysExact:true,kind:'finite kernel replay conformance; no shortest-path or SAT claim'};
console.log(JSON.stringify(report));
