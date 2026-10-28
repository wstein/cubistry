import {writeFileSync} from 'node:fs';
import {source,initial,goals,moveTo} from './periodic-planner.mjs';

const output=process.argv[2];if(!output)throw Error('Supply NEW output path');
const modes=[];
for(const letter of ['H','S','M'])for(const maximum of [11,23,59])for(const direction of [1,-1]){
 const gs=Array.from({length:maximum+1},(_,n)=>goals(source.map(s=>s.image),letter,n));
 const next=n=>(n+direction+maximum+1)%(maximum+1);
 const setup=moveTo(initial,gs[0],gs[next(0)],13);
 let state=setup.state,value=0,steps=[];const seen=new Map();
 let periodStart=-1,maximumHTM=0;
 for(let cycle=0;cycle<10000;cycle++){
  const key=JSON.stringify(state);
  if(seen.has(key)){periodStart=seen.get(key);break;}
  seen.set(key,steps.length);
  for(let j=0;j<=maximum;j++){
   const target=next(value),result=moveTo(state,gs[target],gs[next(target)],13);
   maximumHTM=Math.max(maximumHTM,result.htm);
   steps.push({from:value,to:target,word:result.word});state=result.state;value=target;
  }
 }
 if(periodStart<0)throw Error('No finite period under search budget');
 const row={letter,maximum,direction,setup:setup.word,periodStart,steps,maximumHTM};
 modes.push(row);console.error(JSON.stringify({letter,maximum,direction,steps:steps.length,periodStart,maximumHTM}));
}
const data={schema:'cubistry.hsm-periodic-counter',version:1,printing:source,policy:13,
 scope:'All H/S/M × ranges00..11,00..23,00..59 × bothdirections; fullpose finiteperiod',
 modes,maximumHTM:Math.max(...modes.map(m=>m.maximumHTM))};
writeFileSync(output,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
