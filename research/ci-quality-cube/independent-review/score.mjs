import fs from 'node:fs';import assert from 'node:assert/strict';
const root=process.argv[2],d=fs.readFileSync(`${root}/distances.u8`),groups=JSON.parse(fs.readFileSync(`${root}/candidates.json`));
const fp=[3,7,1,5],bp=[0,2,4,6]; // zero-based lexicographic positions
function rank(q){let av=[0,1,2,3,4,5,6,7],r=0,t=0;for(let j=0;j<4;j++){const k=av.indexOf(Math.floor(q[j]/3));assert(k>=0);r=r*(8-j)+k;av.splice(k,1);t=3*t+q[j]%3;}return 81*r+t;}
const dist=(c,p,t)=>d[rank(fp.map((f,i)=>3*(i===c?p:f)+(i===c?t:0)))];
const e4=[[1,2],[2,3],[2,4],[4,2],[3,2],[1,4],[2,1],[3,1],[4,1]],e5=[...e4,[1,5],[2,5],[5,2],[5,1]];
function canon(p){const all=[];for(let swap=0;swap<2;swap++)for(let a=0;a<3;a++)for(let b=0;b<3;b++){const x=p.slice(swap?3:0,swap?6:3),y=p.slice(swap?0:3,swap?3:6);all.push([...x.slice(a),...x.slice(0,a),...y.slice(b),...y.slice(0,b)].join(''));}return all.sort()[0];}
for(const group of groups){const n=Number(group.name[0]),neutral=group.name.endsWith('neutral'),patterns=new Set();let raw=0;function gen(p){if(p.length===6){if(!Array.from({length:n},(_,i)=>i+1).every(s=>p.includes(s)))return;if(neutral&&Array.from({length:n},(_,i)=>i+1).some(s=>p.filter(x=>x===s).length!==1))return;raw++;patterns.add(canon(p));return;}for(let x=neutral?0:1;x<=n;x++)gen([...p,x]);}gen([]);assert.equal(raw,group.rawPatternCount);assert.equal(patterns.size,group.symmetryRepresentatives);assert.equal(group.candidates.length,patterns.size);for(const row of group.candidates){const p=row.pattern;assert(patterns.delete(p.join('')));let max=0;const means=[];for(let c=0;c<4;c++)for(const [old,next] of n===4?e4:e5){const vals=[];for(let src=0;src<6;src++)if(p[src]===old)for(const back of bp)for(let tw=0;tw<3;tw++){let best=100;for(let target=0;target<6;target++)if(p[target]===next){const same=Math.floor(src/3)===Math.floor(target/3),delta=((same?src%3:tw)-target%3+3)%3;best=Math.min(best,dist(c,same?fp[c]:back,delta));}vals.push(best);}max=Math.max(max,...vals);means.push(vals.reduce((a,b)=>a+b,0)/vals.length);}assert.equal(max,row.maximumHTM);assert(Math.abs(means.reduce((a,b)=>a+b,0)/means.length-row.meanHTM)<1e-12);}assert.equal(patterns.size,0);}console.log('PASS independent exhaustive pattern enumeration and equal-logical-edge weighted scores');
// Verify every slot/edge record independently, then check slot separability.
const stateNames=['open','running','OK','error','blocked'];
let checkedProfiles=0;
for(const group of groups)for(const row of group.candidates){
  const n=Number(group.name[0]),edges=n===4?e4:e5,p=row.pattern,profiles=[];
  for(let c=0;c<4;c++){
    const profile=[];
    for(const [old,next] of edges){
      const vals=[];
      for(let src=0;src<6;src++)if(p[src]===old)for(const back of bp)for(let tw=0;tw<3;tw++){
        const possible=[];
        for(let target=0;target<6;target++)if(p[target]===next){
          const same=Math.floor(src/3)===Math.floor(target/3);
          possible.push(dist(c,same?fp[c]:back,((same?src%3:tw)-target%3+3)%3));
        }
        vals.push(Math.min(...possible));
      }
      const maximum=Math.max(...vals),mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const saved=row.edges.find(e=>e.slot===c+1&&e.from===stateNames[old-1]&&e.to===stateNames[next-1]);
      assert(saved);assert.equal(saved.maximumHTM,maximum);assert.equal(saved.physicalSourceCases,vals.length);assert(Math.abs(saved.meanHTM-mean)<1e-12);
      profile.push([maximum,mean]);checkedProfiles++;
    }
    profiles.push(profile);
  }
  for(let c=1;c<4;c++)assert.deepEqual(profiles[c],profiles[0]);
}
console.log(JSON.stringify({valid:true,independentSlotEdgeProfiles:checkedProfiles,slotIsometry:true}));
