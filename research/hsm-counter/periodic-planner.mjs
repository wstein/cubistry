import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as G from '../five-second-timer/geometry.mjs';
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
const source=JSON.parse(readFileSync(new URL('./comparison/candidates/intermediate.json',import.meta.url))).printing;
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

export {source,initial,advance,goals,moveTo,moves,dist};
