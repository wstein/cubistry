// JOBS.json for every consecutive day pair of one calendar year (P, U and W scheme each).
// Usage: node transition-jobs-year.mjs PADDED.json UNPADDED.json "W TOKENS" YEAR OUT.json
import {writeFileSync,existsSync} from 'node:fs';
const [padded,unpadded,W,year,out]=process.argv.slice(2);
if(!out||existsSync(out))throw Error('Need a NEW output path');
const wk=t=>(new Date(t).getUTCDay()+6)%7;
const jobs=[];
for(let t=Date.UTC(+year,0,1);t<Date.UTC(+year+1,0,1)-86400000;t+=86400000){
 const a=new Date(t),b=new Date(t+86400000);
 const A={weekday:wk(t),day:a.getUTCDate(),month:a.getUTCMonth()+1},B={weekday:wk(t+86400000),day:b.getUTCDate(),month:b.getUTCMonth()+1};
 const id=`${a.toISOString().slice(0,10)}`;
 jobs.push({id:`${A.day}->${B.day}|P|${id}`,source:{witness:padded,...A},target:B,padding:'zero'});
 jobs.push({id:`${A.day}->${B.day}|U|${id}`,source:{witness:unpadded,...A},target:B,padding:'unpadded'});
 jobs.push({id:`${A.day}->${B.day}|W|${id}`,source:{witness:padded,...A,...(A.day<10?{extra:W.split(' ')}:{})},target:B,padding:'zero'});
}
writeFileSync(out,JSON.stringify({W,jobs},null,1));console.log(jobs.length);
