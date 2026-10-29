import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=process.argv[2];
const read=p=>JSON.parse(fs.readFileSync(`${root}/${p}`));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=read('manifest.json');
for(const [path,digest] of Object.entries(manifest.hashes))assert.equal(hash(fs.readFileSync(`${root}/${path}`)),digest,path);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const apply=(M,v)=>[0,1,2].map(i=>M.reduce((s,c,j)=>s+c[i]*v[j],0));
const rots=[];for(const x of axes)for(const y of axes)if(!dot(x,y))rots.push([x,y,cross(x,y)]);
assert.equal(rots.length,24);
const front=[[-1,1,1],[1,1,1],[-1,-1,1],[1,-1,1]],cats=['build','test','analyze','review'];
const groups=read('evidence/candidates.json'),globalCounts={};
for(const n of [4,5])for(const style of ['neutral','labeled']){
 const name=`${n}-state-${style}`,doc=read(`evidence/${name}-witnesses.json`),p=doc.print;
 assert.equal(p.cubies.length,8);p.cubies.forEach((b,i)=>{assert.equal(b.id,i);assert(b.position.length===3&&b.position.every(v=>v===-1||v===1));});
 assert.equal(new Set(p.cubies.map(b=>b.position.join(','))).size,8);
 assert.equal(p.stickers.length,24);assert.equal(new Set(p.stickers.map(s=>s.id)).size,24);
 for(const s of p.stickers){assert(Number.isInteger(s.cubie)&&s.cubie>=0&&s.cubie<8);assert(axes.some(v=>eq(v,s.normal)));assert(axes.some(v=>eq(v,s.up)));assert.equal(dot(s.normal,p.cubies[s.cubie].position),1);assert.equal(dot(s.normal,s.up),0);assert.deepEqual(s.equivalentQuarterTurns,[0]);}
 assert.equal(new Set(p.stickers.map(s=>JSON.stringify([s.cubie,s.normal]))).size,24);
 const rows=groups.find(g=>g.name===name).candidates,best=rows.reduce((a,b)=>b.maximumHTM<a.maximumHTM||(b.maximumHTM===a.maximumHTM&&b.meanHTM<a.meanHTM-1e-12)?b:a);
 assert.equal(rows.find(r=>eq(r.pattern,doc.pattern)).maximumHTM,best.maximumHTM);
 assert(Math.abs(rows.find(r=>eq(r.pattern,doc.pattern)).meanHTM-best.meanHTM)<1e-12);
 globalCounts[name]=rots.filter(o=>front.every((pos,c)=>{
   const s=p.stickers.find(s=>eq(apply(o,p.cubies[s.cubie].position),pos)&&eq(apply(o,s.normal),[0,0,1]));
   return s&&doc.stateNames.some(name=>s.assetId===`quality-${cats[c]}-${name.toLowerCase()}`)&&eq(apply(o,s.up),[0,1,0]);
 })).length;
 assert.equal(globalCounts[name],style==='labeled'?1:0);
}
console.log(JSON.stringify({valid:true,manifestHashes:Object.keys(manifest.hashes).length,wholeCubeOnlyValidOrientations:globalCounts}));
const baseline=read('evidence/5-state-labeled-witnesses.json').print;
const names=['open','running','ok','error','blocked'];
for(const r of read('evidence/five-state-family-lower-bounds.json').records){
 assert.deepEqual(r.print.cubies,baseline.cubies);
 assert.equal(r.print.stickers.length,24);
 for(let c=0;c<4;c++)for(let t=0;t<6;t++){
   const id=c*6+t,s=r.print.stickers.find(s=>s.id===id),b=baseline.stickers.find(s=>s.id===id);
   assert(s);for(const k of ['cubie','normal','up','equivalentQuarterTurns'])assert.deepEqual(s[k],b[k]);
   assert.equal(s.assetId,`quality-${cats[c]}-${names[r.pattern[t]-1]}`);
 }
}
console.log('PASS all 100 lower-bound prints match their declared patterns and fixed pairing/up geometry');
