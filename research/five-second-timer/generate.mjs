import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as G from './geometry.mjs';
const started=Date.now(),out=process.argv[2];
if(!out)throw Error('Supply a new output path');
let seed=271028;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const frames=G.ROTATIONS.map(R=>({n:G.rotate([0,0,1],R),up:G.rotate([0,1,0],R)}));
const frameIndex=new Map(frames.map((s,i)=>[JSON.stringify([s.n,s.up]),i]));
const identity=frameIndex.get(JSON.stringify([[0,0,1],[0,1,0]]));
const moves=Object.keys(G.FACES).flatMap(f=>[f,f+'2',f+"'"]);
const inverse=m=>m%3===0?m+2:m%3===2?m-2:m;
const trans=Array.from({length:4},()=>Array.from({length:18},()=>new Uint8Array(24)));
for(let slot=0;slot<4;slot++)for(let m=0;m<18;m++)for(let r=0;r<24;r++){
 const f=frames[r],s={p:G.rotate(G.FRONT[slot],G.ROTATIONS[r]),n:f.n,up:f.up};
 const t=G.apply([s],moves[m])[0];trans[slot][m][r]=frameIndex.get(JSON.stringify([t.n,t.up]));
}
const encode=a=>a.reduce((v,r)=>v*24+r,0);
const decode=k=>[Math.floor(k/13824),Math.floor(k/576)%24,Math.floor(k/24)%24,k%24];
const step=(a,m)=>a.map((r,s)=>trans[s][m][r]);
const dist=new Uint8Array(24**4).fill(255),queue=new Uint32Array(24**4);
let tail=1;queue[0]=encode([identity,identity,identity,identity]);dist[queue[0]]=0;
for(let head=0;head<tail;head++){
 const k=queue[head],a=decode(k);
 for(let m=0;m<18;m++){const nk=encode(step(a,m));if(dist[nk]===255){dist[nk]=dist[k]+1;queue[tail++]=nk;}}
}
const histogram={};for(const d of dist)if(d!==255)histogram[d]=(histogram[d]??0)+1;
console.error('BFS',tail,histogram);
// Reuses the existing four-corner shortest-display graph; no provider table changes.
const groups=[[[0,'0'],[0,'1'],[0,'2']],[[1,'0'],[1,'1'],[1,'2']],[[1,'3'],[1,'4'],[1,'5']],[[1,'6'],[1,'7'],[0,'3']],[[1,'8'],[1,'9'],[0,'3']],[[2,'0'],[2,'1'],[2,'2']],[[2,'3'],[2,'4'],[2,'5']],[[3,'0'],[3,'5'],[3,'0']]];
const source=G.solved().map(s=>{
  const [slot,image]=groups[s.cubie][s.id%3];
  const R=G.ROTATIONS.find(R=>G.eq(G.rotate(s.p,R),G.FRONT[slot])&&G.eq(G.rotate(s.n,R),[0,0,1]));
  if(!R)throw Error('Unusable print frame');
  return {...s,slot,image,up:R.map(v=>v[1])};
});
// Rigid orientation index per physical sticker; geometry is retained by slot invariants.
const initial=source.map(s=>frameIndex.get(JSON.stringify([s.n,s.up])));
const stickerSlot=source.map(s=>s.slot);
const advance=(state,m)=>state.map((r,id)=>trans[stickerSlot[id]][m][r]);
const digits=t=>{const seconds=t*5;return [String(Math.floor(seconds/600)),String(Math.floor(seconds/60)%10),String(Math.floor(seconds%60/10)),String(seconds%10)];};
function options(print,t){
 const d=digits(t),lists=d.map((v,slot)=>print.map((v2,id)=>v2===v&&stickerSlot[id]===slot?id:-1).filter(id=>id>=0));
 const result=[];
 for(const a of lists[0])for(const b of lists[1])for(const c of lists[2])for(const e of lists[3]){
  const ids=[a,b,c,e];if(new Set(ids.map(id=>source[id].cubie)).size===4)result.push(ids);
 }return result;
}
function bestGoal(state,goals,tie=0){
 let best=256,chosen;
 for(let j=0;j<goals.length;j++){const ids=goals[(j+tie)%goals.length],d=dist[encode(ids.map(id=>state[id]))];if(d<best){best=d;chosen=ids;}}
 if(best===256||best===255)throw Error('Unreachable display');return {d:best,ids:chosen};
}
function route(print,ticks,policy=0,record=false){
 const goals=Array.from({length:ticks},(_,t)=>options(print,t));
 if(goals.some(x=>!x.length))return null;
 let state=[...initial];const words=[],lengths=[];
 for(let t=0;t<ticks;t++){
  const goal=bestGoal(state,goals[t],policy%goals[t].length);let a=goal.ids.map(id=>state[id]),d=goal.d,word=[];
  while(d){
   let chosen=-1,bestLook=256;
   for(let j=0;j<18;j++){
    const m=(j+policy)%18,na=step(a,m);
    if(dist[encode(na)]!==d-1)continue;
    // Among shortest-path ties, prefer the pose closer to the next display.
    const look=t+1<ticks?bestGoal(advance(state,m),goals[t+1],policy%goals[t+1].length).d:0;
    if(look<bestLook){bestLook=look;chosen=m;}
   }
   if(chosen<0)throw Error('Broken distance table');
   word.push(moves[chosen]);state=advance(state,chosen);a=step(a,chosen);d--;
  }
  words.push(word.join(' '));if(t)lengths.push(word.length);
 }
 const max=Math.max(...lengths),total=lengths.reduce((a,b)=>a+b,0);
 return {max,total,score:max*100000+total,lengths,...record?{words}:{} };
}
const ticks=480;
let print=source.map(s=>s.image),bestPrint=[...print],bestPolicy=0;
const baseline=route(print,ticks,0,true);if(!baseline)throw Error('Construction does not cover range');
let best=baseline;const history=[];const trials=512;
for(let trial=0;trial<trials;trial++){
 const candidate=[...bestPrint],slot=Math.floor(random()*4),ids=source.filter(s=>s.slot===slot).map(s=>s.id);
 const a=ids[Math.floor(random()*ids.length)],b=ids[Math.floor(random()*ids.length)];
 [candidate[a],candidate[b]]=[candidate[b],candidate[a]];
 const policy=Math.floor(random()*18),r=route(candidate,ticks,policy);
 if(r&&r.score<best.score){best=r;bestPrint=candidate;bestPolicy=policy;history.push({trial,max:r.max,total:r.total});}
}
best=route(bestPrint,ticks,bestPolicy,true);
const data={schema:'cubistry.five-second-timer',version:1,puzzle:'2x2x2',stepSeconds:5,maxSeconds:2395,
 printing:source.map((s,id)=>({...s,image:bestPrint[id]})),zeroWord:best.words[0],increments:best.words.slice(1),totalHTM:best.total,maximumHTM:best.max,
 evidence:{generator:'research/five-second-timer/generate.mjs',sourceCommit:'7c05d28e97ecf30848220f5c70cb3100a4f3628d',strictModel:'fixed24 immutable distinct-digit upright stickers,8 rigid corners,MM/SS,no optical aliases',bfs:{states:tail,histogram,sha256:createHash('sha256').update(dist).digest('hex')},search:{seed:271028,trials,policy:bestPolicy,history,baselineMax:baseline.max,baselineTotal:baseline.total,globalPrintMoveOptimality:'UNKNOWN'},runtimeSeconds:(Date.now()-started)/1000}};
writeFileSync(out,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ticks,maxSeconds:data.maxSeconds,edges:data.increments.length,maxHTM:best.max,totalHTM:best.total,meanHTM:best.total/479,zeroWord:data.zeroWord,runtimeSeconds:data.evidence.runtimeSeconds}));
