// Legal center-orientation witnesses; these do not solve or certify a date print.
import {writeFileSync} from 'node:fs';
import * as G from './geometry.mjs';
const output=process.argv[2];if(!output)throw Error('Supply a NEW output file');
const inverse=word=>word.split(/\s+/).filter(Boolean).reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
const quarter=Array(3).fill("R2 F' R2 L2 B L2").join(' ');
const half=Array(5).fill("R F R' F").join(' ');
const source=G.solved(),front=source.find(s=>G.eq(s.p,[0,0,1]));
const words=[quarter,half,inverse(quarter)];
const witnesses=words.map(word=>{
 const state=G.apply(source,word),result=state.find(s=>s.id===front.id);
 if(!source.filter(s=>s.p.filter(Boolean).length>1).every(s=>{
   const t=state.find(t=>t.id===s.id);return G.eq(s.p,t.p)&&G.eq(s.n,t.n)&&G.eq(s.up,t.up);
 }))throw Error('Noncenter frames not restored');
 if(!source.filter(s=>s.p.filter(Boolean).length===1).every(s=>{
  const t=state.find(t=>t.id===s.id);return G.eq(s.p,t.p)&&G.eq(s.n,t.n);
 }))throw Error('Center position changed');
 return {word,htm:word.split(' ').length,frontCenterSourceUp:front.up,frontCenterFinalUp:result.up};
});
if(new Set(witnesses.map(w=>JSON.stringify(w.frontCenterFinalUp))).size!==3 || witnesses.some(w=>G.eq(w.frontCenterSourceUp,w.frontCenterFinalUp)))throw Error('Need all three nontrivial twists');
writeFileSync(output,JSON.stringify({schema:'cubistry.3x3-center-corrections',version:1,scope:'Fix only visible center orientation while restoring all noncenter frames; hidden center orientations are unconstrained',witnesses,globalOptimality:'UNKNOWN'},null,2)+'\n',{flag:'wx'});
