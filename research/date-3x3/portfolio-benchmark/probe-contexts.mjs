/** Re-run the pinned historical actual-source fixture without regenerating poses. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [app,output] = process.argv.slice(2), root=resolve(app);
if(!app||!output||existsSync(output))throw Error('Supply app root and NEW output');
const hash=x=>createHash('sha256').update(x).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(git('status','--porcelain','--untracked-files=no'))throw Error('Freeze clean application first');
const M=await import(pathToFileURL(join(root,'src/apps/calendar/model.ts')));
const P=await import(pathToFileURL(join(root,'src/apps/calendar/center-planner.mjs')));
const fixtureBytes=readFileSync(join(root,'tests/fixtures/calendar-portfolio-contexts.json'));
const fixture=JSON.parse(fixtureBytes),designs={};
for(const id of Object.keys(fixture.printingSHA256)){
 const bytes=readFileSync(join(root,'public/calendar',id+'.json'));
 if(hash(bytes)!==fixture.printingSHA256[id])throw Error('Printing hash');
 designs[id]=M.validateDesign(JSON.parse(bytes));
}
const rows=[],options={threshold:14,maximumNodes:100000,maximumDepth:24};
for(const row of fixture.contexts){
 const design=designs[row.id],target=M.findTarget(design,M.civilDate('2026-11-04'));
 const context={design,target,sourceWord:row.sourceWord,from:M.apply(design.printing,row.sourceWord),fallbackWord:M.simplify(M.inverse(row.sourceWord)+' '+target.word)};
 const a=performance.now(),baseline=P.tryCenterAware(context,row.directWord,options),baselineMs=performance.now()-a;
 const b=performance.now(),portfolio=P.tryCenterPortfolio(context,row.directWord,options),portfolioMs=performance.now()-b;
 rows.push({fixture:row,baseline,portfolio,baselineMs,portfolioMs});
}
writeFileSync(output,JSON.stringify({schema:'cubistry.calendar-portfolio-fixture-probes',appHead:git('rev-parse','HEAD'),fixtureSHA256:hash(fixtureBytes),scriptSHA256:hash(readFileSync(fileURLToPath(import.meta.url))),providerPin:JSON.parse(readFileSync(join(root,'puzlwerk-picture-source.json'))),fixture,options,rows},null,2)+'\n',{flag:'wx'});
