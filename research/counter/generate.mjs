import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {KPattern} from 'cubing/kpuzzle';
import {puzzles} from 'cubing/puzzles';
import {experimentalSolve2x2x2} from 'cubing/search';
import * as G from '../../src/cube.mjs';
const kp=await puzzles['2x2x2'].kpuzzle(),defaultPattern=kp.defaultPattern();
const key=x=>JSON.stringify(x),faces=Object.keys(G.FACES);
// The position-index correspondence is inferred from independent KPuzzle
// move support, then verified by the physical facelet replayer below.
const positions=Array.from({length:8},(_,i)=>[0,0,0]);
for(const face of faces){const [axis,layer]=G.FACES[face],p=defaultPattern.applyMove(face).patternData.CORNERS.pieces;for(let i=0;i<8;i++)if(p[i]!==i)positions[i][axis]=layer;}
if(new Set(positions.map(key)).size!==8||positions.some(p=>p.some(x=>!x)))throw Error('KPuzzle position mapping failed');
const index=p=>positions.findIndex(q=>G.eq(p,q));
const orientation=new Map();
for(let piece=0;piece<8;piece++){
 const queue=[{p:positions[piece],R:[[1,0,0],[0,1,0],[0,0,1]],pattern:defaultPattern}],seen=new Set();
 for(let j=0;j<queue.length;j++){
  const {p,R,pattern}=queue[j],k=key([p,R]);if(seen.has(k))continue;seen.add(k);
  orientation.set(key([piece,p,R]),pattern.patternData.CORNERS.orientation[index(p)]);
  for(const face of faces){const [axis,layer,dir]=G.FACES[face];let nextP=p,nextR=R;if(p[axis]===layer)for(let t=0;t<(dir+4)%4;t++){nextP=G.quarter(nextP,axis);nextR=nextR.map(v=>G.quarter(v,axis));}queue.push({p:nextP,R:nextR,pattern:pattern.applyMove(face)});}
 }
 if(seen.size!==24)throw Error('Incomplete corner orientation map');
}
const source=G.solved();
const parts=Array.from({length:8},(_,i)=>source.filter(s=>s.cubie===i));
const groups=[['title-left','0','1'],['title-left','2','3'],['4','5','6'],['7','8','9'],['title-right','0','1'],['title-right','2','3'],['4','5','6'],['7','8','9']];
const printing=source.map(s=>({...s}));
for(let c=0;c<8;c++)for(let f=0;f<3;f++){
 const s=parts[c][f],image=groups[c][f],slot=image==='title-left'?0:image==='title-right'?1:c<4?2:3;
 const R=G.ROTATIONS.find(R=>G.eq(G.rotate(s.p,R),G.FRONT[slot])&&G.eq(G.rotate(s.n,R),[0,0,1]));
 printing[s.id]={...s,image,slot,up:R.map(v=>v[1])};
}
const witnesses=[];
for(let value=0;value<100;value++){
 const tens=String(Math.floor(value/10)),units=String(value%10);
 const a=printing.find(s=>s.cubie<4&&s.slot===2&&s.image===tens),b=printing.find(s=>s.cubie>=4&&s.slot===3&&s.image===units);
 const left=printing.find(s=>s.image==='title-left'&&s.cubie!==a.cubie),right=printing.find(s=>s.image==='title-right'&&s.cubie!==b.cubie);
 const selected=[left,right,a,b],placements=[];
 for(let slot=0;slot<4;slot++){
  const s=selected[slot],R=G.ROTATIONS.find(R=>G.eq(G.rotate(s.p,R),G.FRONT[slot])&&G.eq(G.rotate(s.n,R),[0,0,1])&&G.eq(G.rotate(s.up,R),[0,1,0]));
  placements.push({cubie:s.cubie,p:G.FRONT[slot],R});
 }
 const used=new Set(placements.map(s=>s.cubie));
 const remaining=Array.from({length:8},(_,i)=>i).filter(c=>!used.has(c));
 const occupied=new Set(placements.map(s=>key(s.p))),hidden=G.POSITIONS.filter(p=>!occupied.has(key(p)));
 for(let i=0;i<remaining.length;i++){
  const c=remaining[i],piece=index(parts[c][0].p),twist=i===remaining.length-1?(3-placements.reduce((n,s)=>n+orientation.get(key([index(parts[s.cubie][0].p),s.p,s.R])),0)%3)%3:0;
  const R=G.ROTATIONS.find(R=>G.eq(G.rotate(parts[c][0].p,R),hidden[i])&&orientation.get(key([piece,hidden[i],R]))===twist);
  placements.push({cubie:c,p:hidden[i],R});
 }
 const cp=Array(8),co=Array(8);
 for(const s of placements){cp[index(s.p)]=index(parts[s.cubie][0].p);co[index(s.p)]=orientation.get(key([index(parts[s.cubie][0].p),s.p,s.R]));}
 if(co.reduce((a,b)=>a+b,0)%3)throw Error('Corner twist mismatch');
 const target=new KPattern(kp,{CORNERS:{pieces:cp,orientation:co}});
 const solution=await experimentalSolve2x2x2(target),word=solution.invert().toString().replace(/([RLUDFB])2'/g,'$12');
 if(!target.applyAlg(solution).isIdentical(defaultPattern))throw Error('Solver did not solve exact frame');
 G.assertDisplay(G.apply(printing,word),value);
 witnesses.push({value,word});console.error(value,word);
}
const data={schema:1,puzzle:'2x2x2',faceFrame:'+x right,+y up,+z front',source:'fixed 24 labeled physical sticker images; two copies of each title fragment',solver:{package:'cubing',version:'0.66.1',license:'MPL-2.0 OR GPL-3.0-or-later',method:'experimentalSolve2x2x2; canonical complete states, not shortest display paths'},printing,unpaddedPrinting:printing.map(s=>({...s,image:s.cubie<4&&s.image==='0'?' ':s.image})),witnesses};
writeFileSync('public/counter-proof.json',JSON.stringify(data,null,2)+'\n');
console.error('wrote witness',createHash('sha256').update(JSON.stringify(data)).digest('hex'));
