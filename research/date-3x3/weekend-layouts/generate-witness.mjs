// Generate full legal words, including visible-center print orientation.
import {readFileSync,writeFileSync} from 'node:fs';
import {KPattern} from 'cubing/kpuzzle';
import {puzzles} from 'cubing/puzzles';
import {experimentalSolve3x3x3IgnoringCenters} from 'cubing/search';
import * as G from '../geometry.mjs';
const [candidatePath,output,limitText,padding]=process.argv.slice(2);
if(padding!==undefined&&!["zero","unpadded"].includes(padding))throw Error("Invalid padding mode");
if(!candidatePath||!output)throw Error('Supply candidate and NEW output paths');
const candidate=JSON.parse(readFileSync(candidatePath));
const limit=limitText===undefined?2562:Number(limitText);
const started=Date.now(),key=JSON.stringify;
const kp=await puzzles['3x3x3'].kpuzzle(),base=kp.defaultPattern();
const faces=Object.keys(G.faces).slice(0,6);
const orbitOf=p=>p.filter(Boolean).length===3?'CORNERS':'EDGES';
const positions={},orientation={};
for(const [orbit,count] of [['CORNERS',8],['EDGES',12]]){
 const ps=Array.from({length:count},()=>[0,0,0]);
 for(const face of faces){const [axis,layer]=G.faces[face],pieces=base.applyMove(face).patternData[orbit].pieces;for(let i=0;i<count;i++)if(pieces[i]!==i)ps[i][axis]=layer;}
 if(new Set(ps.map(key)).size!==count)throw Error('Position mapping failed');
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
  if(seen.size!==24)throw Error('Incomplete physical orientation map');
 }
}
let printing=G.solved();
for(const kind of ['corners','edges']){
 const count=kind==='corners'?3:2,ps=G.positions.filter(p=>p.filter(Boolean).length===count);
 for(let cubie=0;cubie<ps.length;cubie++){
  const stickers=printing.filter(s=>G.eq(s.p,ps[cubie]));
  for(let j=0;j<count;j++){
   const s=stickers[j],[slot,image]=candidate.pieces[kind][cubie][j];
   const R=image?G.rotations.find(R=>G.eq(G.rotate(s.p,R),G.front[slot])&&G.eq(G.rotate(s.n,R),[0,0,1])):null;
   if(image&&!R)throw Error('Invalid print destination');
   printing[s.id]={...s,image,slot,up:R?R.map(v=>v[1]):s.up};
  }
 }
}
const centers=printing.filter(s=>s.p.filter(Boolean).length===1);
centers.forEach((s,i)=>printing[s.id]={...s,slot:4,image:candidate.centerImages[i]});
// Fixed color/weight is part of every immutable source sticker.
printing=printing.map(s=>({...s,style:s.image?candidate.artwork[candidate.fixedWeekendWords.includes(s.image)&&s.slot===0?'weekend':s.slot===0?'weekday':/^[0-9]$/.test(s.image)?'day':'month']:null}));
// All24 global orientations, using only explicit whole-cube rotations.
const global=[{state:printing,word:''}],seen=new Set();
for(let i=0;i<global.length;i++){
 const row=global[i],k=key(row.state.filter(s=>s.p.filter(Boolean).length===1).map(s=>[s.p,s.up]));
 if(seen.has(k))continue;seen.add(k);
 for(const move of ['x','y','z']){
  const state=G.apply(row.state,move),nk=key(state.filter(s=>s.p.filter(Boolean).length===1).map(s=>[s.p,s.up]));
  if(!seen.has(nk)&&!global.some(r=>key(r.state.filter(s=>s.p.filter(Boolean).length===1).map(s=>[s.p,s.up]))===nk))global.push({state,word:[row.word,move].filter(Boolean).join(' ')});
 }
}
if(global.length!==24)throw Error('Global orientation group incomplete');
const parity=p=>p.reduce((n,v,i)=>n+p.slice(i+1).filter(w=>w<v).length,0)%2;
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
 if(wantedParity!==undefined&&parity(perm)!==wantedParity){
  const a=list.at(-1),b=list.at(-2);[a.p,b.p]=[b.p,a.p];
 }
 const cp=Array(ps.length),co=Array(ps.length);let sum=0;
 for(let i=0;i<list.length;i++){
  const s=list[i],piece=parts.findIndex(p=>p[0].cubie===s.cubie);
  if(!s.R){const twist=i===list.length-1?(mod-sum%mod)%mod:0;s.R=G.rotations.find(R=>G.eq(G.rotate(parts[piece][0].p,R),s.p)&&table.get(key([piece,s.p,R]))===twist);}
  const o=table.get(key([piece,s.p,s.R]));if(o===undefined)throw Error('Invalid rigid placement');
  cp[index(s.p)]=piece;co[index(s.p)]=o;sum+=o;
 }
 if(sum%mod)throw Error('Orientation invariant failed');return {pieces:cp,orientation:co};
}
const corrections=JSON.parse(readFileSync(new URL('../center-corrections.json',import.meta.url))).witnesses;
const words=[],patterns=new Map();let day=new Date(Date.UTC(2000,0,1));
while(day.getUTCFullYear()<2400){const w=(day.getUTCDay()+6)%7,n=day.getUTCDate(),m=day.getUTCMonth()+1;patterns.set(key([w,n,m]),[w,n,m]);day=new Date(day.getTime()+86400000);}
const model=JSON.parse(readFileSync(new URL('../model.json',import.meta.url))),lex=model.languages[candidate.locale];
for(const [weekday,number,month]of [...patterns.values()].sort((a,b)=>a[2]-b[2]||a[1]-b[1]||a[0]-b[0]).slice(0,limit)){
 const wd=lex['weekdays'+candidate.weekdayWidth][weekday],mo=lex.months[month-1],digits=String(number).padStart(2,padding==='unpadded'?' ':'0');
 const dateCells=candidate.dayCells.map(kind=>kind==='tens'?(digits[0]===' '?'':digits[0]):kind==='units'?digits[1]:'');
 const rowValues={weekday:candidate.weekdayParts[wd],day:dateCells,month:candidate.monthParts[mo]};
 const cells=candidate.rows.flatMap(row=>rowValues[row]);
 const prelude=global.find(row=>row.state.some(s=>G.eq(s.p,[0,0,1])&&s.image===cells[4]&&(!s.image||G.eq(s.up,[0,1,0]))));
 if(!prelude)throw Error('No oriented center selection');
 const source=prelude.state;
 const corners=complete(source,'CORNERS',placements(source.filter(s=>s.p.filter(Boolean).length===3),[0,2,6,8],cells));
 const edges=complete(source,'EDGES',placements(source.filter(s=>s.p.filter(Boolean).length===2),[1,3,5,7],cells),parity(corners.pieces));
 const target=new KPattern(kp,{CORNERS:corners,EDGES:edges,CENTERS:base.patternData.CENTERS});
 const solution=await experimentalSolve3x3x3IgnoringCenters(target),word=solution.invert().toString().replace(/([RLUDFB])2'/g,'$12');
 let state=G.apply(source,word),center=state.find(s=>G.eq(s.p,[0,0,1])),fix='';
 if(cells[4]&&!G.eq(center.up,[0,1,0])){
  const correction=corrections.find(c=>G.eq(G.apply([center],c.word)[0].up,[0,1,0]));
  if(!correction)throw Error('No visible center correction');fix=correction.word;state=G.apply(state,fix);
 }
 for(let slot=0;slot<9;slot++){
  const s=state.find(s=>G.eq(s.p,G.front[slot])&&G.eq(s.n,[0,0,1]));
  if(!s||s.image!==cells[slot]||(s.image&&!G.eq(s.up,[0,1,0])))throw Error('Incorrect final date '+key({weekday,number,month,slot,s,cells}));
 }
 words.push({weekday,day:number,month,cells,prelude:prelude.word,word,centerCorrection:fix});
 if(words.length%100===0)console.error(candidate.id,words.length,'/',limit,Date.now()-started);
}
writeFileSync(output,JSON.stringify({schema:'cubistry.date-3x3-witness',version:1,candidateId:candidate.id,locale:candidate.locale,weekdayWidth:candidate.weekdayWidth,...(padding?{paddingMode:padding}:{}),printing,targets:words,totalTargets:patterns.size,complete:words.length===patterns.size,runtimeSeconds:(Date.now()-started)/1000,solver:'cubing0.66.1 experimentalSolve3x3x3IgnoringCenters plus independent physical center correction',status:'UNKNOWN; independent verification pending'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({id:candidate.id,targets:words.length,seconds:(Date.now()-started)/1000}));
