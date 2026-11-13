// Writes JOBS.json for plan-transitions.mjs. Usage: node transition-jobs.mjs PADDED.json UNPADDED.json "W TOKENS" OUT.json
import {writeFileSync,existsSync} from 'node:fs';
const [padded,unpadded,W,out]=process.argv.slice(2);
if(!out||existsSync(out))throw Error('Need a NEW output path');
const wk=(y,m,d)=>(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7;
const D=(y,m,d)=>({weekday:wk(y,m,d),day:d,month:m,label:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`});
const pairs=[
 ['8->9',D(2026,3,8),D(2026,3,9)],['9->10',D(2026,3,9),D(2026,3,10)],['10->9',D(2026,3,10),D(2026,3,9)],
 ['28->29',D(2028,2,28),D(2028,2,29)],['28->1 (Feb to Mar)',D(2026,2,28),D(2026,3,1)],
 ['30->1',D(2026,4,30),D(2026,5,1)],['31->1 (to 28-day month)',D(2026,1,31),D(2026,2,1)],['31->1 (to 30-day month)',D(2026,3,31),D(2026,4,1)],
 ['31->1 (to 31-day month)',D(2026,7,31),D(2026,8,1)],['1->2',D(2026,3,1),D(2026,3,2)],['9->8',D(2026,3,9),D(2026,3,8)],
];
const strip=({label,...r})=>r,jobs=[];
for(const [name,a,b] of pairs){
 const src=(file,extra)=>({witness:file,...strip(a),...(extra?{extra:extra.split(' ')}:{})});
 jobs.push({id:`${name}|P|${a.label}`,source:src(padded),target:strip(b),padding:'zero'});
 jobs.push({id:`${name}|U|${a.label}`,source:src(unpadded),target:strip(b),padding:'unpadded'});
 jobs.push({id:`${name}|W|${a.label}`,source:src(padded,a.day<10?W:null),target:strip(b),padding:'zero'});
}
for(const d of [D(2026,3,5),D(2026,3,12)]){
 jobs.push({id:`toggle|P->U|${d.label}`,source:{witness:padded,...strip(d)},target:strip(d),padding:'unpadded'});
}
writeFileSync(out,JSON.stringify({W,jobs},null,1));console.log(jobs.length);
