import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as G from '../five-second-timer/geometry.mjs';
const started=Date.now(), out=process.argv[2];
if(!out)throw Error('Supply a NEW output file');
let seed=281028;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const frames=G.ROTATIONS.map(R=>({n:G.rotate([0,0,1],R),up:G.rotate([0,1,0],R)}));
const frameIndex=new Map(frames.map((s,i)=>[JSON.stringify([s.n,s.up]),i]));
const identity=frameIndex.get(JSON.stringify([[0,0,1],[0,1,0]]));
const moves=Object.keys(G.FACES).flatMap(f=>[f,f+'2',f+"'"]);
const inverse=m=>m%3===0?m+2:m%3===2?m-2:m;
const trans=Array.from({length:3},()=>Array.from({length:18},()=>new Uint8Array(24)));
for(let slot=0;slot<3;slot++)for(let m=0;m<18;m++)for(let r=0;r<24;r++){
 const f=frames[r],s={p:G.rotate(G.FRONT[[1,2,3][slot]],G.ROTATIONS[r]),n:f.n,up:f.up};
 const t=G.apply([s],moves[m])[0];trans[slot][m][r]=frameIndex.get(JSON.stringify([t.n,t.up]));
}
const encode=a=>a.reduce((v,r)=>v*24+r,0);
const decode=k=>[Math.floor(k/576),Math.floor(k/24)%24,k%24];
const step=(a,m)=>a.map((r,s)=>trans[s][m][r]);
const dist=new Uint8Array(24**3).fill(255),queue=new Uint32Array(24**3);
let tail=1;queue[0]=encode([identity,identity,identity]);dist[queue[0]]=0;
for(let head=0;head<tail;head++){
 const k=queue[head],a=decode(k);
 for(let m=0;m<18;m++){const nk=encode(step(a,m));if(dist[nk]===255){dist[nk]=dist[k]+1;queue[tail++]=nk;}}
}
const histogram={};for(const d of dist)if(d!==255)histogram[d]=(histogram[d]??0)+1;
console.error('BFS',tail,histogram);

// Three tracked slots: upper-right letter, lower-left tens, lower-right units.
const groups=[[[1,'0'],[1,'1'],[1,'2']],[[1,'3'],[1,'4'],[1,'5']],
 [[2,'0'],[2,'1'],[2,'2']],[[2,'3'],[2,'4'],[2,'5']],
 [[2,'6'],[2,'7'],[2,'8']],[[2,'9'],[2,'0'],[2,'1']],
 [[0,'H'],[0,'S'],[0,'M']],[[1,'0'],[1,'2'],[1,'4']]];
const source=G.solved().map(s=>{
 const [slot,image]=groups[s.cubie][s.id%3];
 const R=G.ROTATIONS.find(R=>G.eq(G.rotate(s.p,R),G.FRONT[[1,2,3][slot]])&&G.eq(G.rotate(s.n,R),[0,0,1]));
 return {...s,slot,image,up:R.map(v=>v[1])};
});
const initial=source.map(s=>frameIndex.get(JSON.stringify([s.n,s.up])));
const advance=(state,m)=>state.map((r,id)=>trans[source[id].slot][m][r]);
function goals(print,letter,n){
 const glyphs=[letter,String(Math.floor(n/10)),String(n%10)];
 const lists=glyphs.map((g,s)=>print.flatMap((v,id)=>source[id].slot===s&&v===g?[id]:[]));
 const result=[];
 for(const a of lists[0])for(const b of lists[1])for(const c of lists[2])
  if(new Set([a,b,c].map(id=>source[id].cubie)).size===3)result.push([a,b,c]);
 return result;
}
function bestGoal(state,gs){
 let d=255,ids;
 for(const g of gs){const v=dist[encode(g.map(id=>state[id]))];if(v<d){d=v;ids=g;}}
 if(!ids)throw Error('Unreachable target');return {d,ids};
}
function moveTo(state,gs,next,policy){
 let {d,ids}=bestGoal(state,gs),a=ids.map(id=>state[id]);const word=[];
 while(d){
  let choice=-1,look=256;
  for(let j=0;j<18;j++){
   const m=(j+policy)%18;if(dist[encode(step(a,m))]!==d-1)continue;
   const v=next?bestGoal(advance(state,m),next).d:0;
   if(v<look){choice=m;look=v;}
  }
  if(choice<0)throw Error('Distance descent failed');
  word.push(moves[choice]);state=advance(state,choice);a=step(a,choice);d--;
 }
 return {state,word:word.join(' '),htm:word.length};
}
function evaluate(print,policy,record=false){
 const routes=[];let max=0,total=0,maxJump=0,maxJump11=0;
 for(const letter of ['H','S','M']){
  const gs=Array.from({length:60},(_,n)=>goals(print,letter,n));
  if(gs.some(g=>!g.length))return null;
  let state=[...initial],state23,state11;const words=[];
  for(let n=0;n<60;n++){
   const r=moveTo(state,gs[n],gs[n+1],policy);state=r.state;words.push(r.word);
   if(n){max=Math.max(max,r.htm);total+=r.htm;}if(n===23)state23=state;if(n===11)state11=state;
  }
  const jump=moveTo(state23,gs[0],null,policy);maxJump=Math.max(maxJump,jump.htm);
  const jump11=moveTo(state11,gs[0],null,policy);maxJump11=Math.max(maxJump11,jump11.htm);
  if(record)routes.push({letter,setup:words[0],increments:words.slice(1),from23To00:jump.word,from11To00:jump11.word});
 }
 return {max,total,maxJump,maxJump11,score:Math.max(max,maxJump,maxJump11)*100000+Math.max(maxJump,maxJump11)*10000+(maxJump+maxJump11)*1000+total,routes};
}
let print=source.map(s=>s.image),policy=0,best=evaluate(print,policy);const baseline={...best};delete baseline.routes;
const trials=4096,history=[];
for(let t=0;t<trials;t++){
 const candidate=[...print],slot=Math.floor(random()*3),ids=source.filter(s=>s.slot===slot).map(s=>s.id);
 const a=ids[Math.floor(random()*ids.length)],b=ids[Math.floor(random()*ids.length)];
 [candidate[a],candidate[b]]=[candidate[b],candidate[a]];
 const p=Math.floor(random()*18),r=evaluate(candidate,p);
 if(r&&r.score<best.score){print=candidate;policy=p;best=r;history.push({trial:t,max:r.max,total:r.total,maxJump:r.maxJump,maxJump11:r.maxJump11});}
}
best=evaluate(print,policy,true);
const data={schema:'cubistry.hsm-counter',version:1,puzzle:'2x2x2',
 model:'24 immutable upright glyph stickers; legal outer face turns; fixed front frame; TL unconstrained,TR letter,BL tens,BR units',
 printing:source.map((s,id)=>({...s,image:print[id]})),routes:best.routes,
 metrics:{maximumIncrementHTM:best.max,totalIncrementHTM:best.total,meanIncrementHTM:best.total/177,maximum23To00HTM:best.maxJump,maximum11To00HTM:best.maxJump11},
 search:{seed:281028,trials,policy,baseline,history,globalLayoutOptimality:'UNKNOWN'},
 bfs:{states:tail,histogram,sha256:createHash('sha256').update(dist).digest('hex')},
 runtimeSeconds:(Date.now()-started)/1000};
writeFileSync(out,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({metrics:data.metrics,seconds:data.runtimeSeconds}));
