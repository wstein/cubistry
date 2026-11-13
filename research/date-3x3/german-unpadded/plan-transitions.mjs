// Planner for date-to-date transitions from an arbitrary physical state (Node; planning only, replay checking is in Julia and Flix).
// Adapted from ../generate-witness.mjs: the source is the current sticker state instead of the home print.
// Usage: node plan-transitions.mjs JOBS.json OUTPUT.json   (OUTPUT must not exist)
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {KPattern} from 'cubing/kpuzzle';
import {puzzles} from 'cubing/puzzles';
import {experimentalSolve3x3x3IgnoringCenters} from 'cubing/search';
import * as G from '../geometry.mjs';
const [jobsPath,output]=process.argv.slice(2);
if(!jobsPath||!output||existsSync(output))throw Error('Supply JOBS.json and a NEW output path');
const here=new URL('..',import.meta.url);
const jobsFile=JSON.parse(readFileSync(jobsPath));
const candidate=JSON.parse(readFileSync(new URL('constructive/de-2.json',here)));
const model=JSON.parse(readFileSync(new URL('model.json',here))),lex=model.languages.DE;
const corrections=JSON.parse(readFileSync(new URL('center-corrections.json',here))).witnesses;
const key=JSON.stringify;
const kp=await puzzles['3x3x3'].kpuzzle(),base=kp.defaultPattern();
const faces=Object.keys(G.faces).slice(0,6);
const positions={},orientation={};
for(const [orbit,count] of [['CORNERS',8],['EDGES',12]]){
 const ps=Array.from({length:count},()=>[0,0,0]);
 for(const face of faces){const [axis,layer]=G.faces[face],pieces=base.applyMove(face).patternData[orbit].pieces;for(let i=0;i<count;i++)if(pieces[i]!==i)ps[i][axis]=layer;}
 positions[orbit]=ps;const table=new Map();orientation[orbit]=table;
 for(let piece=0;piece<count;piece++){
  const queue=[{p:ps[piece],R:[[1,0,0],[0,1,0],[0,0,1]],pattern:base}],seen=new Set();
  for(let i=0;i<queue.length;i++){
   const {p,R,pattern}=queue[i],k=key([p,R]);if(seen.has(k))continue;seen.add(k);
   const index=ps.findIndex(q=>G.eq(q,p));table.set(key([piece,p,R]),pattern.patternData[orbit].orientation[index]);
   for(const face of faces){
    const marker={id:0,cubie:0,p,n:R[0],up:R[1]},t=G.apply([marker],face)[0];
    queue.push({p:t.p,R:[t.n,t.up,G.cross(t.n,t.up)],pattern:pattern.applyMove(face)});
   }
  }
 }
}
const parity=p=>p.reduce((n,v,i)=>n+p.slice(i+1).filter(w=>w<v).length,0)%2;
const isCenter=s=>s.p.filter(Boolean).length===1;
const stateKey=state=>key(state.filter(isCenter).map(s=>[s.p,s.up]));
function globals(printing){
 const global=[{state:printing,word:''}],seen=new Set([stateKey(printing)]);
 for(let i=0;i<global.length;i++)for(const move of ['x','y','z']){
  const state=G.apply(global[i].state,move),nk=stateKey(state);
  if(!seen.has(nk)){seen.add(nk);global.push({state,word:[global[i].word,move].filter(Boolean).join(' ')});}
 }
 if(global.length!==24)throw Error('Global orientation group incomplete');return global;
}
function placements(source,slots,cells){
 const result=[];
 function visit(i){
  if(i===slots.length)return true;
  const slot=slots[i],image=cells[slot];
  for(const s of source){
   if(s.image!==image||result.some(t=>t.cubie===s.cubie))continue;
   const R=G.rotations.find(R=>G.eq(G.rotate(s.p,R),G.front[slot])&&G.eq(G.rotate(s.n,R),[0,0,1])&&(!image||G.eq(G.rotate(s.up,R),[0,1,0])));
   if(!R)continue;result.push({cubie:s.cubie,p:G.front[slot],R});if(visit(i+1))return true;result.pop();
  }
  return false;
 }
 if(!visit(0))throw Error('No distinct physical piece selection');return result;
}
function complete(source,orbit,selected,wantedParity){
 const ps=positions[orbit],table=orientation[orbit],mod=orbit==='CORNERS'?3:2;
 const parts=ps.map(p=>source.filter(s=>G.eq(s.p,p)));
 const index=p=>ps.findIndex(q=>G.eq(p,q));
 const rest=parts.map(s=>s[0].cubie).filter(c=>!selected.some(t=>t.cubie===c));
 const hidden=ps.filter(p=>!selected.some(t=>G.eq(p,t.p)));
 const list=[...selected,...rest.map((cubie,i)=>({cubie,p:hidden[i],R:null}))];
 const perm=Array(ps.length);
 for(const s of list)perm[index(s.p)]=parts.findIndex(p=>p[0].cubie===s.cubie);
 if(wantedParity!==undefined&&parity(perm)!==wantedParity){const a=list.at(-1),b=list.at(-2);[a.p,b.p]=[b.p,a.p];}
 const cp=Array(ps.length),co=Array(ps.length);let sum=0;
 for(let i=0;i<list.length;i++){
  const s=list[i],piece=parts.findIndex(p=>p[0].cubie===s.cubie);
  if(!s.R){const twist=i===list.length-1?(mod-sum%mod)%mod:0;s.R=G.rotations.find(R=>G.eq(G.rotate(parts[piece][0].p,R),s.p)&&table.get(key([piece,s.p,R]))===twist);}
  const o=table.get(key([piece,s.p,s.R]));if(o===undefined)throw Error('Invalid rigid placement');
  cp[index(s.p)]=piece;co[index(s.p)]=o;sum+=o;
 }
 if(sum%mod)throw Error('Orientation invariant failed');return {pieces:cp,orientation:co};
}
function cellsOf(weekday,day,month,padded){
 const wd=lex.weekdays2[weekday],mo=lex.months[month-1],digits=String(day).padStart(2,padded?'0':' ');
 const dateCells=candidate.dayCells.map(kind=>kind==='tens'?(digits[0]===' '?'':digits[0]):kind==='units'?digits[1]:'');
 return [...candidate.weekdayParts[wd],...dateCells,...candidate.monthParts[mo]];
}
const witnessCache=new Map();
function sourceState(spec){
 if(!witnessCache.has(spec.witness))witnessCache.set(spec.witness,JSON.parse(readFileSync(spec.witness)));
 const w=witnessCache.get(spec.witness);
 const t=w.targets.find(t=>t.weekday===spec.weekday&&t.day===spec.day&&t.month===spec.month);
 if(!t)throw Error('source target missing');
 const word=[t.prelude,t.word,t.centerCorrection,...(spec.extra??[])].filter(Boolean).join(' ');
 return {state:G.apply(w.printing,word),word};
}
async function plan(source,target,padded){
 const cells=cellsOf(target.weekday,target.day,target.month,padded);
 const prelude=globals(source).find(row=>row.state.some(s=>G.eq(s.p,[0,0,1])&&s.image===cells[4]&&(!s.image||G.eq(s.up,[0,1,0]))));
 if(!prelude)throw Error('No oriented center selection');
 const src=prelude.state;
 const corners=complete(src,'CORNERS',placements(src.filter(s=>s.p.filter(Boolean).length===3),[0,2,6,8],cells));
 const edges=complete(src,'EDGES',placements(src.filter(s=>s.p.filter(Boolean).length===2),[1,3,5,7],cells),parity(corners.pieces));
 const pattern=new KPattern(kp,{CORNERS:corners,EDGES:edges,CENTERS:base.patternData.CENTERS});
 const solution=await experimentalSolve3x3x3IgnoringCenters(pattern),word=solution.invert().toString().replace(/([RLUDFB])2'/g,'$12');
 let state=G.apply(src,word),center=state.find(s=>G.eq(s.p,[0,0,1])),fix='';
 if(cells[4]&&!G.eq(center.up,[0,1,0])){
  const c=corrections.find(c=>G.eq(G.apply([center],c.word)[0].up,[0,1,0]));
  if(!c)throw Error('No visible center correction');fix=c.word;state=G.apply(state,fix);
 }
 for(let slot=0;slot<9;slot++){
  const s=state.find(s=>G.eq(s.p,G.front[slot])&&G.eq(s.n,[0,0,1]));
  if(!s||s.image!==cells[slot]||(s.image&&!G.eq(s.up,[0,1,0])))throw Error('Incorrect final display');
 }
 return {prelude:prelude.word,word,centerCorrection:fix};
}
const results=[];
for(const job of jobsFile.jobs){
 const src=sourceState(job.source);
 const r=await plan(src.state,job.target,job.padding==='zero');
 results.push({id:job.id,source:job.source,target:job.target,padding:job.padding,...r});
}
writeFileSync(output,JSON.stringify({schema:'cubistry.date-3x3-transitions',version:1,results},null,1));
console.log(JSON.stringify({jobs:results.length}));
