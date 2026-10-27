import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {puzzles} from 'cubing/puzzles';
import {experimentalSolve2x2x2} from 'cubing/search';
import * as G from '../geometry.mjs';
const path=process.argv[3] ?? 'research/timer-2x2/optimization/optimized.json',raw=readFileSync(path),data=JSON.parse(raw);
const kp=await puzzles['2x2x2'].kpuzzle(),runs=[];
for(const run of data.runs){
 const cumulative=run.optimized.words.join(' '),target=kp.defaultPattern().applyAlg(cumulative);
 const solution=await experimentalSolve2x2x2(target);
 const word=solution.invert().toString().replace(/([RLUDFB])2'/g,'$12');
 if(!target.applyAlg(solution).isIdentical(kp.defaultPattern()))throw Error('Setup solver mismatch');
 if(JSON.stringify(G.apply(run.printing,word))!==JSON.stringify(G.apply(run.printing,cumulative)))throw Error('Full physical setup mismatch');
 runs.push({ticks:run.ticks,zeroWord:run.optimized.words[0],maximumWord:word,maximumHTM:word.split(/\s+/).filter(Boolean).length});
}
writeFileSync(process.argv[2],JSON.stringify({candidateSHA256:createHash('sha256').update(raw).digest('hex'),solver:'cubing@0.66.1; exact full-state setup, no shortest-path claim',runs},null,2)+'\n',{flag:'wx'});
