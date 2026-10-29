import{readFileSync,writeFileSync}from'node:fs';import{KPattern}from'cubing/kpuzzle';import{puzzles}from'cubing/puzzles';import{experimentalSolve3x3x3IgnoringCenters as solve}from'cubing/search';import*as G from'../../geometry.mjs';import{createTransitionOptimizer,inverse}from'../planner.mjs';
const root=new URL('../../',import.meta.url),kpuzzle=await puzzles['3x3x3'].kpuzzle(),corrections=JSON.parse(readFileSync(new URL('center-corrections.json',root))).witnesses;
const out=[];
for(const[id,path]of[['de-a','witnesses/de-2.json'],['en-3-zero','adjacent/witnesses/en-adjacent-3-zero.json'],['en-3-unpadded','adjacent/witnesses/en-adjacent-3-unpadded.json']]){
const d=JSON.parse(readFileSync(new URL(path,root))),targets=d.targets.map(t=>({...t,word:[t.prelude,t.word,t.centerCorrection].filter(Boolean).join(' ')})),pick=s=>{const a=new Date(s+'T12:00Z');return targets.find(t=>t.weekday===(a.getUTCDay()+6)%7&&t.day===a.getUTCDate()&&t.month===a.getUTCMonth()+1)},p=createTransitionOptimizer({printing:d.printing,kpuzzle,KPattern,solve,corrections});
let sourceWord=pick('2026-10-28').word,state=G.apply(d.printing,sourceWord);
for(const[date,prelude]of[['2026-10-29',''],['2026-10-30',''],['2026-10-29',''],['2026-11-01','x'],['2026-12-31',"y'"],['2027-01-01',''],['2024-02-29','z2'],['2024-03-01','']]){
sourceWord+=' '+prelude;state=G.apply(state,prelude);const target=pick(date),fallback=inverse(sourceWord)+' '+target.word,r=await p.plan(state,target,fallback);out.push({id,date,sourceWord,cells:target.cells,...r});state=G.apply(state,r.word);sourceWord+=' '+r.word;
}
}
writeFileSync(new URL('chained.json',import.meta.url),JSON.stringify(out,null,2));
