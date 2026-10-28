import {writeFileSync} from 'node:fs';
import * as G from '../../five-second-timer/geometry.mjs';
const output=process.argv[2];if(!output)throw Error('SupplyNEWoutput');
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

const groups=[[[2,'0'],[2,'1'],[2,'2']],[[2,'3'],[2,'4'],[2,'5']],[[3,'0'],[3,'1'],[3,'2']],[[3,'3'],[3,'4'],[3,'5']],[[3,'6'],[3,'7'],[3,'8']],[[3,'9'],[3,'0'],[3,'9']],[[1,'H'],[1,'S'],[1,'M']],[[0,''],[0,''],[0,'']]];
let policy=13;
const printing=G.solved().map(s=>{const[slot,image]=groups[s.cubie][s.id%3];const R=G.ROTATIONS.find(R=>G.eq(G.rotate(s.p,R),G.FRONT[slot])&&G.eq(G.rotate(s.n,R),[0,0,1]));return{...s,slot,image,up:R.map(v=>v[1])};});
const initial=printing.map(s=>frameIndex.get(JSON.stringify([s.n,s.up])));
const advance=(state,m)=>state.map((r,id)=>trans[printing[id].slot][m][r]);
function goals(letter,value){const gs=['',letter,String(Math.floor(value/10)),String(value%10)],lists=gs.map((v,slot)=>printing.filter(s=>s.slot===slot&&s.image===v).map(s=>s.id)),result=[];for(const a of lists[0])for(const b of lists[1])for(const c of lists[2])for(const d of lists[3])if(new Set([a,b,c,d].map(id=>printing[id].cubie)).size===4)result.push([a,b,c,d]);return result;}
function bestGoal(state,gs){let d=255,ids;for(const g of gs){const v=dist[encode(g.map(id=>state[id]))];if(v<d){d=v;ids=g;}}if(!ids)throw Error('No goal');return{d,ids};}
function moveTo(state,gs,next){let{d,ids}=bestGoal(state,gs),a=ids.map(id=>state[id]);const word=[];while(d){let m=-1,look=256;for(let j=0;j<18;j++){const c=(j+policy)%18;if(dist[encode(step(a,c))]!==d-1)continue;const v=next?bestGoal(advance(state,c),next).d:0;if(v<look){m=c;look=v;}}if(m<0)throw Error('No descent');word.push(moves[m]);state=advance(state,m);a=step(a,m);d--;}return{state,word:word.join(' '),htm:word.length};}
const modes=[];
for(const letter of ['H','S','M'])for(const maximum of [11,23,59])for(const direction of [1,-1]){
 policy=letter==='M'&&maximum===59&&direction===-1?Number(process.env.HSM_BLANK_DOWN_POLICY??1):13;
 const gs=Array.from({length:maximum+1},(_,n)=>goals(letter,n)),next=n=>(n+direction+maximum+1)%(maximum+1),setup=moveTo(initial,gs[0],gs[next(0)]);
 let state=setup.state,value=0,steps=[],periodStart=-1,maximumHTM=0;const seen=new Map();
 for(let cycle=0;cycle<10000;cycle++){const k=JSON.stringify(state);if(seen.has(k)){periodStart=seen.get(k);break;}seen.set(k,steps.length);for(let j=0;j<=maximum;j++){const target=next(value),r=moveTo(state,gs[target],gs[next(target)]);maximumHTM=Math.max(maximumHTM,r.htm);steps.push({from:value,to:target,word:r.word});state=r.state;value=target;}}
 if(periodStart<0)throw Error('No period');modes.push({letter,maximum,direction,policy,setup:setup.word,periodStart,steps,maximumHTM});console.error(JSON.stringify({letter,maximum,direction,steps:steps.length,periodStart,maximumHTM}));
}
writeFileSync(output,JSON.stringify({schema:'cubistry.hsm-blank-counter',version:1,printing,modes,maximumHTM:Math.max(...modes.map(m=>m.maximumHTM)),status:'UNKNOWN; independent review pending'},null,2)+'\n',{flag:'wx'});
