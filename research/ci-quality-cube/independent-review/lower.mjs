import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=process.argv[2];
const read=n=>JSON.parse(fs.readFileSync(`${root}/${n}`));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const apply=(M,v)=>[0,1,2].map(i=>M.reduce((s,c,j)=>s+c[i]*v[j],0));
const mul=(a,b)=>b.map(v=>apply(a,v));
const pos=[]; for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])pos.push([x,y,z]);
const rots=[];for(const x of axes)for(const y of axes)if(!dot(x,y))rots.push([x,y,cross(x,y)]);
const refs=pos.map(p=>rots.find(r=>eq(apply(r,[1,1,1]),p)));
const cyc=[[0,1,0],[0,0,1],[1,0,0]],ident=axes.filter((_,i)=>i%2===0);
const poses=refs.flatMap(r=>[r,mul(r,cyc),mul(mul(r,cyc),cyc)]);
const lookup=new Map(poses.map((r,i)=>[JSON.stringify(r),i]));
// Rodrigues at exact quarter turn: v' = axis cross v + axis*(axis dot v).
const turn=(v,a,sign)=>cross(a,v).map((x,i)=>sign*x+a[i]*dot(a,v));
const face=[[0,1,-1],[0,-1,1],[1,1,-1],[1,-1,1],[2,1,-1],[2,-1,1]];
const moves=[];for(const f of ['R','L','U','D','F','B'])for(const s of ['', '2', "'"])moves.push(f+s);
const trans=poses.map((r,q)=>moves.map((_,m)=>{const [axis,layer,sign]=face[Math.floor(m/3)];if(pos[Math.floor(q/3)][axis]!==layer)return q;let out=r;for(let j=0;j<m%3+1;j++)out=out.map(v=>turn(v,ident[axis],sign));return lookup.get(JSON.stringify(out));}));
for(let q=0;q<24;q++)for(let m=0;m<18;m++){assert.equal(trans[trans[q][m]][m-m%3+2-m%3],q);assert.equal(trans[q][m]%3,(q%3+trans[q-q%3][m]%3)%3);}
const rank=q=>{let av=[0,1,2,3,4,5,6,7],r=0,t=0;for(let j=0;j<4;j++){const i=av.indexOf(Math.floor(q[j]/3));assert(i>=0);r=r*(8-j)+i;av.splice(i,1);t=t*3+q[j]%3;}return r*81+t;};
const unrank=index=>{let p=Math.floor(index/81),t=index%81;const ds=[],ts=[];for(let j=3;j>=0;j--){ds[j]=p%(8-j);p=Math.floor(p/(8-j));ts[j]=t%3;t=Math.floor(t/3);}const av=[0,1,2,3,4,5,6,7];return ds.map((v,i)=>3*av.splice(v,1)[0]+ts[i]);};
const front=[[-1,1,1],[1,1,1],[-1,-1,1],[1,-1,1]];
const goal=rank(front.map(p=>3*pos.findIndex(v=>eq(v,p))));
const d=fs.readFileSync(`${root}/distances.u8`);assert.equal(d.length,136080);assert.equal(d[goal],0);
let zeros=0;const hist=[];
for(let i=0;i<d.length;i++){const q=unrank(i);assert.equal(rank(q),i);hist[d[i]]=(hist[d[i]]||0)+1;if(!d[i])zeros++;let desc=false;for(let m=0;m<18;m++){const next=rank(q.map(v=>trans[v][m]));assert(d[i]<=d[next]+1);if(d[next]+1===d[i])desc=true;}assert(i===goal||desc);}
assert.equal(zeros,1);assert.deepEqual(hist,[1,15,198,2030,15396,61768,53528,3144]);
const family=read('five-state-family-lower-bounds.json');
assert.equal(family.distanceSHA256,crypto.createHash('sha256').update(d).digest('hex'));
const candidates=read('candidates.json').find(g=>g.name==='5-state-labeled').candidates;
const expected=new Set(candidates.map(r=>r.pattern.join(',')));
assert.equal(family.records.length,100);
const names=['open','running','ok','error','blocked'],cats=['build','test','analyze','review'];
const edges=new Set([[1,2],[2,3],[2,4],[4,2],[3,2],[1,4],[2,1],[3,1],[4,1],[1,5],[2,5],[5,2],[5,1]].map(x=>x.join(',')));
function replay(print,orient,word){for(const token of word){const m=moves.indexOf(token);assert(m>=0);const [a,l,s]=face[Math.floor(m/3)];orient=orient.map((o,b)=>{if(apply(o,print.cubies[b].position)[a]!==l)return o;let r=o;for(let j=0;j<m%3+1;j++)r=r.map(v=>turn(v,ident[a],s));return r;});}return orient;}
function digest(print,o){return crypto.createHash('sha256').update(JSON.stringify(o.map((r,b)=>[b,apply(r,print.cubies[b].position),r]))).digest('hex');}
function tiles(print,o,states){return front.map((p,c)=>{const out=print.stickers.filter(s=>eq(apply(o[s.cubie],print.cubies[s.cubie].position),p)&&eq(apply(o[s.cubie],s.normal),[0,0,1]));assert.equal(out.length,1);assert.equal(out[0].assetId,`quality-${cats[c]}-${names[states[c]-1]}`);assert.deepEqual(apply(o[out[0].cubie],out[0].up),[0,1,0]);return out[0];});}
for(const r of family.records){assert(expected.delete(r.pattern.join(',')));assert(edges.has([r.sourceStates[0],r.targetStates[0]].join(',')));assert.deepEqual(r.sourceStates.slice(1),r.targetStates.slice(1));
 const print=r.print,source=replay(print,print.cubies.map(()=>ident),r.sourceMoves);assert.equal(digest(print,source),r.sourcePhysicalStateSHA256);const shown=tiles(print,source,r.sourceStates);
 const target=replay(print,source,r.targetMoves);assert.equal(digest(print,target),r.targetPhysicalStateSHA256);tiles(print,target,r.targetStates);assert.equal(r.targetMoves.length,6);assert.equal(r.exactHTM,6);
 for(let c=1;c<4;c++)assert.equal(print.stickers.filter(s=>s.assetId===shown[c].assetId).length,1);
 const alternatives=print.stickers.filter(s=>s.assetId===`quality-build-${names[r.targetStates[0]-1]}`);assert(alternatives.length>0);const exact=[];
 for(const tile of alternatives){assert.equal(tile.cubie,shown[0].cubie);const wanted=[tile,...shown.slice(1)];
   const goalTwists=wanted.map((s,c)=>{const body=print.cubies[s.cubie],matches=rots.filter(o=>eq(apply(o,body.position),front[c])&&eq(apply(o,s.normal),[0,0,1])&&eq(apply(o,s.up),[0,1,0]));assert.equal(matches.length,1);const q=lookup.get(JSON.stringify(mul(matches[0],refs[s.cubie])));assert.notEqual(q,undefined);assert.equal(Math.floor(q/3),pos.findIndex(p=>eq(p,front[c])));return q%3;});
   const projected=wanted.map((s,c)=>{const q=lookup.get(JSON.stringify(mul(source[s.cubie],refs[s.cubie])));assert.notEqual(q,undefined);return 3*Math.floor(q/3)+(q%3-goalTwists[c]+3)%3;});
   exact.push(d[rank(projected)]);
 }assert(exact.every(n=>n===6));assert.deepEqual(exact,r.targetAlternativeDistances);
}assert.equal(expected.size,0);
console.log(JSON.stringify({valid:true,reachableLowerBounds:family.records.length,exactHTM:6,scope:'five-state fully labeled two-corner/category family only'}));
