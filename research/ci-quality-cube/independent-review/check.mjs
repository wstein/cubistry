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
// Replay full eight-body matrices independently, preserving uninterrupted poses.
let replay=0;for(const n of [4,5])for(const style of ['neutral','labeled']){const doc=read(`${n}-state-${style}-witnesses.json`),print=doc.print;assert.equal(print.stickers.length,24);assert.equal(new Set(print.stickers.map(s=>s.id)).size,24);for(const sticker of print.stickers){const p=print.cubies[sticker.cubie].position;assert.equal(dot(sticker.normal,p),1);assert.equal(dot(sticker.normal,sticker.normal),1);assert.equal(dot(sticker.up,sticker.up),1);assert.equal(dot(sticker.normal,sticker.up),0);assert.deepEqual(sticker.equivalentQuarterTurns,[0]);}assert.equal(new Set(print.stickers.map(s=>JSON.stringify([s.cubie,s.normal]))).size,24);const before=JSON.stringify(print),seen=new Set();
const initial=()=>print.cubies.map(()=>ident.map(v=>[...v]));
function check(orient,record){for(const token of record.moves){const m=moves.indexOf(token);assert(m>=0);const [a,l,s]=face[Math.floor(m/3)];orient=orient.map((o,b)=>{if(apply(o,print.cubies[b].position)[a]!==l)return o;let r=o;for(let j=0;j<m%3+1;j++)r=r.map(v=>turn(v,ident[a],s));return r;});}assert.equal(record.htm,record.moves.length);const compact=orient.map((o,b)=>[b,apply(o,print.cubies[b].position),o]);assert.equal(crypto.createHash('sha256').update(JSON.stringify(compact)).digest('hex'),record.physicalStateSHA256);for(let c=0;c<4;c++){const tiles=print.stickers.filter(s=>eq(apply(orient[s.cubie],print.cubies[s.cubie].position),front[c])&&eq(apply(orient[s.cubie],s.normal),[0,0,1]));assert.equal(tiles.length,1);const tile=tiles[0];assert.equal(tile.assetId,`quality-${['build','test','analyze','review'][c]}-${doc.stateNames[record.states[c]-1].toLowerCase()}`);assert.deepEqual(apply(orient[tile.cubie],tile.up),[0,1,0]);}replay++;return orient;}
assert.equal(doc.setupWitnesses.length,n**4);for(const rec of doc.setupWitnesses){const k=rec.states.join();assert(!seen.has(k));seen.add(k);for(const s of rec.states)assert(s>=1&&s<=n);check(initial(),rec);}let o=initial();for(const rec of doc.continuousSequence)o=check(o,rec);assert.equal(doc.continuousSequence.length,2*n**4);assert.equal(JSON.stringify(print),before);}
console.log(JSON.stringify({valid:true,domain:d.length,edges:d.length*18,histogram:hist,replayed:replay,distanceSHA256:crypto.createHash('sha256').update(d).digest('hex')}));
