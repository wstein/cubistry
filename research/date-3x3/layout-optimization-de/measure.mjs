/** Compare fixed prints with the same actual application controller and planner. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [appPath,output,...files]=process.argv.slice(2);
if(!appPath||!output||!files.length)throw Error('APP_ROOT NEW_OUTPUT WITNESS... required');
const app=resolve(appPath),digest=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const M=await import(pathToFileURL(join(app,'src/apps/calendar/model.ts')));
const {CalendarController}=await import(pathToFileURL(join(app,'src/apps/calendar/controller.ts')));
const {createPlanner}=await import(pathToFileURL(join(app,'src/apps/calendar/center-planner.mjs')));
const records=[],warmups=[];
const appHead=execFileSync('git',['rev-parse','HEAD'],{cwd:app,encoding:'utf8'}).trim();
const appDirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:app,encoding:'utf8'}).trim();
for(const file of files){
 const raw=readFileSync(file),w=JSON.parse(raw),variant=resolve(file).split('/').at(-2);
 const runtime={schema:'cubistry.calendar-runtime',version:1,id:'de-a',printing:w.printing,targets:w.targets.map(t=>({weekday:t.weekday,day:t.day,month:t.month,cells:t.cells,word:[t.prelude,t.word,t.centerCorrection].filter(Boolean).join(' ')}))};
 const design=M.validateDesign(runtime),planner=await createPlanner({design,options:{maximumNodes:100000,maximumDepth:24,threshold:14,policy:'portfolio'}});
 const warmFrom=M.findTarget(design,M.civilDate('2026-10-28')),warmTo=M.findTarget(design,M.civilDate('2026-10-29')),warmStart=performance.now(),warmPose=M.sourcePose(design,warmFrom);
 const warmWord=await planner({design,from:warmPose,sourceWord:warmFrom.word,target:warmTo,fallbackWord:M.simplify(M.inverse(warmFrom.word)+' '+warmTo.word)});
 if(!M.matches(M.apply(warmPose,warmWord),warmTo.cells))throw Error('Warmup route invalid');
 warmups.push({variant,elapsedMs:performance.now()-warmStart,word:warmWord,diagnostics:planner.lastDiagnostics});
 const forward=Array.from({length:367},(_,i)=>new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10));
 const paths=process.env.DE_YEAR==='1'?[['year',forward.concat(forward.slice(0,-1).reverse())]]:[['november',Array.from({length:15},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`)],['jump',['2026-10-29','2026-11-03','2026-11-04']],['wrap',['2024-02-28','2024-02-29','2024-03-01','2024-03-02','2024-03-03','2024-12-30','2024-12-31','2025-01-01']]];
 for(const [scenario,dates]of paths){
  let word=[];const initial=M.findTarget(design,M.civilDate(dates[0]));
  let err=null;
  const c=new CalendarController(design,initial,{configure(){},async animate(from,token,to){if(!M.sameState(M.apply(from,token),to))throw Error('Bad port turn');word.push(token);}},(_target,_busy,error)=>{if(error)err=error;},planner);
  for(const iso of dates.slice(1)){
   const from=c.physicalState,reference=c.sourceReferenceWord,start=performance.now(),target=M.findTarget(design,M.civilDate(iso));word=[];
   c.request(target);
   while(c.busy)await new Promise(r=>setTimeout(r,0));
   if(err)throw err;
   if(!M.matches(c.physicalState,target.cells)||!M.sameState(M.apply(from,word.join(' ')),c.physicalState))throw Error('Incorrect observed route');
   records.push({variant,scenario,iso,sourceReference:reference,fromHash:digest(from.map(s=>[s.id,s.cubie,s.p,s.n,s.up,s.image])),word:word.join(' '),htm:word.filter(t=>/^[RLUDFB]/.test(t)).length,rotations:word.filter(t=>/^[xyz]/.test(t)).length,elapsedMs:performance.now()-start,diagnostics:planner.lastDiagnostics??null,endHash:digest(c.physicalState.map(s=>[s.id,s.cubie,s.p,s.n,s.up,s.image]))});
   if(records.length%10===0)console.error(variant,scenario,records.length);
  }
 }
 console.error('DONE',variant);
}
const summaries=[...new Set(records.map(r=>r.variant))].map(variant=>{const rows=records.filter(r=>r.variant===variant);return{variant,cases:rows.length,totalHTM:rows.reduce((s,r)=>s+r.htm,0),meanHTM:rows.reduce((s,r)=>s+r.htm,0)/rows.length,maxHTM:Math.max(...rows.map(r=>r.htm)),november3to4:rows.filter(r=>r.iso==='2026-11-04').map(r=>r.htm)};});
writeFileSync(output,JSON.stringify({schema:'cubistry.de-layout-measurement',status:'UNKNOWN; independent replay pending',mode:process.env.DE_YEAR==='1'?'leap-year-forward-reverse':'targeted-pilot',appRoot:app,appHead,appDirty:Boolean(appDirty),runnerSHA256:digest(readFileSync(new URL(import.meta.url))),warmups,inputs:files.map(file=>({file,sha256:digest(readFileSync(file))})),records,summaries},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summaries));
