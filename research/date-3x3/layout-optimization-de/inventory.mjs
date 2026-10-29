import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as G from '../geometry.mjs';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Supply runtime input and NEW output');
const raw=readFileSync(input),data=JSON.parse(raw),used=new Map(data.printing.map(s=>[s.id,[]]));
const role=s=>!s.image?'blank':/^[0-9]$/.test(s.image)?'day':s.slot<3?'weekday':'month';
const counts={corners:{},edges:{},centers:{}};
for(const s of data.printing){const k=['','centers','edges','corners'][s.p.filter(Boolean).length],label=role(s)+':'+s.image;counts[k][label]=(counts[k][label]??0)+1;}
let frontChecks=0;
for(const t of data.targets){
 const state=G.apply(data.printing,t.word);
 for(let slot=0;slot<9;slot++){
  const s=state.find(s=>G.eq(s.p,G.front[slot])&&G.eq(s.n,[0,0,1]));
  if(!s||s.image!==t.cells[slot]||(s.image&&!G.eq(s.up,[0,1,0])))throw Error('Invalid baseline target');
  used.get(s.id).push([t.weekday,t.day,t.month,slot]);frontChecks++;
 }
}
const stickers=data.printing.map(s=>({...s,role:role(s),frontUses:used.get(s.id).length,frontSlots:[...new Set(used.get(s.id).map(t=>t[3]))]}));
writeFileSync(output,JSON.stringify({schema:'cubistry.de-layout-inventory',version:1,evidenceStatus:'UNKNOWN; independent replay pending',sourceSHA256:createHash('sha256').update(raw).digest('hex'),targets:data.targets.length,frontChecks,counts,neverFront:stickers.filter(s=>!s.frontUses),stickers},null,2)+'\n',{flag:'wx'});
