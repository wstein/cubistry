import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const out=process.argv[2];if(!out)throw Error('Supply a NEW output directory');mkdirSync(out,{recursive:false});
const rows=[];let best;
for(const family of ['A','B'])for(const extra of ['0','5'])for(let a=0;a<3;a++)for(let b=0;b<3;b++){
 const file=`${out}/${family}-${extra}-${a}-${b}.json`;
 execFileSync(process.execPath,['research/five-second-timer/optimize-candidate.mjs',file],{env:{...process.env,FIVE_SECOND_FAMILY:family,FIVE_SECOND_EXTRA:extra,FIVE_SECOND_FACES:`${a},${b}`,FIVE_SECOND_TRIALS:'128'},stdio:['ignore','pipe','pipe']});
 const d=JSON.parse(readFileSync(file)),core={...d};delete core.evidence;
 const row={family,extra,mixedFaces:[a,b],trials:128,maxHTM:d.maximumHTM,totalHTM:d.totalHTM,meanHTM:d.totalHTM/479,coreSHA256:createHash('sha256').update(JSON.stringify(core)).digest('hex'),file:file.split('/').at(-1)};
 rows.push(row);if(!best||row.maxHTM<best.maxHTM||row.maxHTM===best.maxHTM&&row.totalHTM<best.totalHTM)best=row;
 console.log(JSON.stringify({tested:rows.length,current:row,best}));
}
const refined=`${out}/refined.json`;
execFileSync(process.execPath,['research/five-second-timer/optimize-candidate.mjs',refined],{env:{...process.env,FIVE_SECOND_FAMILY:best.family,FIVE_SECOND_EXTRA:best.extra,FIVE_SECOND_FACES:best.mixedFaces.join(','),FIVE_SECOND_TRIALS:'4000',FIVE_SECOND_START:`${out}/${best.file}`},stdio:['ignore','pipe','pipe']});
const d=JSON.parse(readFileSync(refined));copyFileSync(refined,`${out}/selected.json`);
const report={schema:'cubistry.five-second-layout-search',version:1,primaryUseCase:'Consecutive five-second steps over full00:00..39:55; lexicographic maximum then total HTM',scope:'Two constructive cubie-group families, both spare seconds-unit glyphs, nine mixed-family face placements each; seeded bounded swaps; not global layout optimum',baseline:{maximumHTM:6,totalHTM:2261},proposals:36*128+4000,rows,selectedFamily:best,selected:{maximumHTM:d.maximumHTM,totalHTM:d.totalHTM,meanHTM:d.totalHTM/479,extraRefinementTrials:4000},globalPrintMoveOptimality:'UNKNOWN',candidateStatus:'Selected witness must pass both independent physical replayers'};
writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.selected));
