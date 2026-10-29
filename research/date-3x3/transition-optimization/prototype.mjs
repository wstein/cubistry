import {readFileSync,writeFileSync}from'node:fs';
import {KPattern}from'cubing/kpuzzle';import{puzzles}from'cubing/puzzles';import{experimentalSolve3x3x3IgnoringCenters as solve}from'cubing/search';
import * as G from '../geometry.mjs';import{createTransitionOptimizer,inverse}from'./planner.mjs';
const kpuzzle=await puzzles['3x3x3'].kpuzzle(),corrections=JSON.parse(readFileSync(new URL('../center-corrections.json',import.meta.url))).witnesses;
const files=[['de-a','../witnesses/de-2.json'],['en-3-zero','../adjacent/witnesses/en-adjacent-3-zero.json'],['en-3-unpadded','../adjacent/witnesses/en-adjacent-3-unpadded.json']];
const out=[];
for(const[id,file]of files){const d=JSON.parse(readFileSync(new URL(file,import.meta.url))),targets=d.targets.map(t=>({...t,word:[t.prelude,t.word,t.centerCorrection].filter(Boolean).join(' ')})),planner=createTransitionOptimizer({printing:d.printing,kpuzzle,KPattern,solve,corrections});
 for(const[iso,next]of [['2026-10-28','2026-10-29'],['2026-07-11','2026-07-12'],['2026-10-29','2026-10-28'],['2026-07-12','2026-07-11']]){const pick=iso=>{const date=new Date(iso+'T12:00Z');return targets.find(t=>t.weekday===(date.getUTCDay()+6)%7&&t.month===date.getUTCMonth()+1&&t.day===date.getUTCDate());},a=pick(iso),b=pick(next),state=G.apply(d.printing,a.word),result=await planner.plan(state,b,inverse(a.word)+' '+b.word);out.push({id,from:iso,to:next,...result});console.log(id,iso,next,result.baselineCounts.total,'→',result.counts.total,result.method,result.error);}
}
writeFileSync(process.argv[2]??'/tmp/cubistry-date-transition-prototype.json',JSON.stringify(out,null,2)+'\n');
