// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { deployPages, parsePublication, readPublication } from '../scripts/pages/publication.mjs';
const sha='a'.repeat(40), storage='b'.repeat(40);
const receipt={schema:1,run:123,attempt:1,sha,storage,nonce:'c'.repeat(32),tracked:[7]};
// GitHub resolves git/trees/<branch> to the branch's commit sha; the tree sha is commits/<branch>.commit.tree.sha.
const commitSha='e'.repeat(40);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('publication receipt validates identity, bounded input and exact fields',()=>{
 assert.deepEqual(parsePublication(JSON.stringify(receipt)),receipt);
 for(const value of [{...receipt,run:0},{...receipt,storage:'main'},{...receipt,nonce:'x'},{...receipt,tracked:[-1]},{...receipt,extra:true}])assert.throws(()=>parsePublication(JSON.stringify(value)));
 assert.throws(()=>parsePublication(' '.repeat(32769)));
});
test('live receipt reads fixed origin without credentials or redirects and bounds streamed bytes',async()=>{
 let call;
 assert.deepEqual(await readPublication({fetch:async(url,options)=>{call={url,options};return json(receipt);}}),receipt);
 assert.equal(new URL(call.url).origin,'https://wstein.github.io');
 assert.equal(call.options.redirect,'error');assert.equal(call.options.cache,'no-store');assert.equal(call.options.headers?.Authorization,undefined);
 assert.equal(await readPublication({fetch:async()=>new Response('x'.repeat(32769))}),null);
});
test('busy rejection waits for previous Pages deployment then creates once accepted',async()=>{
 const calls=[];let posts=0,polls=0;
 const result=await deployPages({receipt,artifact:55,token:'test',oidc:async()=>'oidc-test',sleep:async()=>{},attempts:5,fetch:async(url,options={})=>{
  const path=new URL(url).pathname;calls.push([options.method??'GET',path]);
  if(options.method==='POST'){posts++;return posts===1?json({message:`Deployment request failed for ${sha} due to in progress deployment. Please cancel ${storage} first or wait for it to complete.`},400):json({id:sha},201);}
  if(path.endsWith(`/pages/deployments/${storage}`))return json({status:++polls===1?'deployment_in_progress':'succeed'});
  if(path.endsWith(`/pages/deployments/${sha}`))return json({status:'succeed'});
  return json(receipt);
 }});
 assert.equal(result.nonce,receipt.nonce);assert.equal(posts,2);assert.equal(polls,2);
 assert(calls.some(([method,path])=>method==='GET'&&path.endsWith(storage)));
});
test('a stale same-SHA succeed response cannot certify an old public snapshot',async()=>{
 let live=0;
 await deployPages({receipt,artifact:55,token:'test',oidc:async()=>'oidc-test',sleep:async()=>{},attempts:5,fetch:async(url,options={})=>{
  if(options.method==='POST')return json({id:sha},201);
  if(new URL(url).origin==='https://api.github.com')return json({status:'succeed'});
  return json(++live===1?{...receipt,nonce:'d'.repeat(32)}:receipt);
 }});
 assert.equal(live,2);
});
test('ambiguous create errors and non-busy 400 responses never replay a POST',async()=>{
 for(const failure of ['network',500,400]){
  let posts=0;
  await assert.rejects(deployPages({receipt,artifact:55,token:'test',oidc:async()=>'oidc-test',sleep:async()=>{},attempts:3,fetch:async()=>{posts++;if(failure==='network')throw Error('lost response');return json({message:'other error'},failure);}}));
  assert.equal(posts,1);
 }
});
test('busy timeout and never-current public snapshot fail closed without cancellation',async()=>{
 let posts=0;
 await assert.rejects(deployPages({receipt,artifact:55,token:'test',oidc:async()=>'oidc-test',sleep:async()=>{},attempts:2,fetch:async(url,options={})=>{
  if(options.method==='POST'){posts++;return json({message:`Deployment request failed for ${sha} due to in progress deployment. Please cancel ${storage} first or wait for it to complete.`},400);}
  return json({status:'deployment_in_progress'});
 }}),/budget|timed out/);
 assert.equal(posts,1);
 await assert.rejects(deployPages({receipt,artifact:55,token:'test',oidc:async()=>'oidc-test',sleep:async()=>{},attempts:2,fetch:async(url,options={})=>options.method==='POST'?json({id:sha},201):new URL(url).origin==='https://api.github.com'?json({status:'succeed'}):json({...receipt,storage:sha})}),/budget|timed out/);
});
import {optimizePlan,notificationNumbers} from '../scripts/pages/reconciliation.mjs';
const planned=()=>({production:{sha,run:20,status:'success'},entries:[{number:7,sha,run:30,action:'deploy',status:'success'}]});
test('no-op requires exact production, preview and live combined storage proof',()=>{
 const current={storage,published:receipt,production:{sha,run:20},previews:{7:{sha,run:30}}};
 assert.deepEqual([optimizePlan(planned(),current).early,optimizePlan(planned(),current).previews],[false,false]);
 assert.equal(optimizePlan(planned(),{...current,published:null}).early,true);
 assert.equal(optimizePlan(planned(),{...current,storage:sha}).early,true,'storage updated after failed publication must be retried');
 assert.equal(optimizePlan(planned(),{...current,production:{sha,run:19}}).early,true);
 assert.equal(optimizePlan(planned(),{...current,previews:{7:{sha,run:29}}}).previews,true);
 assert.equal(optimizePlan({...planned(),entries:[{number:8,action:'remove'}]},current).previews,true);
});
test('notification candidates retain closed cleanup and bootstrap comments without historical scanning afterward',()=>{
 assert.deepEqual(notificationNumbers({pulls:[{number:4,head:{repo:{full_name:'wstein/cubistry'}},labels:[{name:'preview'}]},{number:99,labels:[]}],inventory:[8],published:{tracked:[7]},bootstrap:[6]}),[4,6,7,8]);
});
import {trustedPublisher,parseNotification,currentNotification} from '../scripts/pages/notification.mjs';
const publisher={id:123,run_attempt:1,head_sha:sha,head_branch:'main',path:'.github/workflows/pages-publish.yml',repository:{full_name:'wstein/cubistry'},head_repository:{full_name:'wstein/cubistry'},event:'workflow_dispatch',status:'completed'};
const note={schema:1,run:123,attempt:1,sha,numbers:[7],proof:receipt};
test('detached notification accepts only trusted main publisher provenance and bounded exact receipt schema',()=>{
 assert.equal(trustedPublisher(publisher),true);assert.deepEqual(parseNotification(JSON.stringify(note),publisher),note);
 for(const run of [{...publisher,event:'pull_request'},{...publisher,head_branch:'feature'},{...publisher,path:'.github/workflows/other.yml'},{...publisher,head_repository:{full_name:'fork/cubistry'}}])assert.throws(()=>parseNotification(JSON.stringify(note),run));
 for(const value of [{...note,run:124},{...note,attempt:2},{...note,numbers:[-1]},{...note,extra:true},{...note,proof:{...receipt,nonce:'x'}}])assert.throws(()=>parseNotification(JSON.stringify(value),publisher));
});
const runsPath=path=>path.startsWith('actions/workflows/pages-publish.yml/runs?');
const pageOf=path=>Number(new URL(`https://x/${path}`).searchParams.get('page')||1);
test('detached notification rejects newer publishers and changed storage or live receipt before writing',async()=>{
 const api=({newer=false,tree=storage}={})=>({request:async path=>runsPath(path)?{workflow_runs:newer?[{id:124,event:'workflow_dispatch'}]:[publisher]}:path.startsWith('actions/runs/')?publisher:path==='commits/gh-pages'?{sha:commitSha,commit:{tree:{sha:tree}}}:{sha:commitSha}});
 assert.equal(await currentNotification(api(),note,{fetch:async()=>json(receipt)}),true);
 assert.equal(await currentNotification(api({newer:true}),note,{fetch:async()=>json(receipt)}),false);
 assert.equal(await currentNotification(api({tree:sha}),note,{fetch:async()=>json(receipt)}),false);
 assert.equal(await currentNotification(api(),note,{fetch:async()=>json({...receipt,nonce:'d'.repeat(32)})}),false);
});
test('freshness check reads only the newest run page once the receipt run is reached',async()=>{
 const run=id=>({id,event:'workflow_run',conclusion:'success'});
 const make=pages=>{const reads=[];return {reads,request:async path=>{
  if(runsPath(path)){reads.push(pageOf(path));assert.ok(reads.length<=pages.length,'read beyond the last page');return {workflow_runs:pages[pageOf(path)-1]};}
  return path.startsWith('actions/runs/')?publisher:path==='commits/gh-pages'?{sha:commitSha,commit:{tree:{sha:storage}}}:{sha:commitSha};
 }};};
 // Newest-first page of 100 that includes the receipt run (123): one request, no further paging.
 const first=Array.from({length:100},(_,i)=>run(123-i));
 const a=make([first,Array.from({length:100},(_,i)=>run(23-i)),[]]);
 assert.equal(await currentNotification(a,note,{fetch:async()=>json(receipt)}),true);
 assert.deepEqual(a.reads,[1]);
 // A newer publisher on the first page ends the check at once.
 const b=make([[run(124),...first.slice(0,99)],first]);
 assert.equal(await currentNotification(b,note,{fetch:async()=>json(receipt)}),false);
 assert.deepEqual(b.reads,[1]);
 // Correctness first: 100 newer skipped runs hide a newer real run on page 2; the receipt run is not yet reached.
 const skipped=Array.from({length:100},(_,i)=>({id:400-i,event:'workflow_run',conclusion:'skipped'}));
 const c=make([skipped,[run(200),run(123)]]);
 assert.equal(await currentNotification(c,note,{fetch:async()=>json(receipt)}),false);
 assert.deepEqual(c.reads,[1,2]);
});
test('deployment budget includes request latency rather than only polling count',async()=>{
 let time=0,posts=0;
 await assert.rejects(deployPages({receipt,artifact:55,token:'test',oidc:async()=>'oidc-test',now:()=>time,timeout:10,sleep:async ms=>{time+=ms;},attempts:60,fetch:async(url,options={})=>{time+=8;if(options.method==='POST'){posts++;return json({id:sha},201);}return json({status:'deployment_in_progress'});}}),/budget/);
 assert.equal(posts,1);
});
import {notifyPreviews} from '../scripts/pages/notify.mjs';
test('notification iterates only receipt candidates and suppresses writes after head/label or publisher changes',async()=>{
 const pr={number:7,state:'open',head:{sha,repo:{full_name:'wstein/cubistry'}},labels:[{name:'preview'}]};
 for(const change of ['none','head','label','publisher']){
  let reads=0,writes=0;
  const api={pages:async path=>path.startsWith('issues/')?[]:[],request:async(path,options={})=>{
   if(options.method){writes++;return {};}
   if(path==='pulls/7'){reads++;return reads===1||change==='none'||change==='publisher'?pr:change==='head'?{...pr,head:{...pr.head,sha:storage}}:{...pr,labels:[]};}
   return null;
  }};
  await notifyPreviews(api,{...note,proof:null},{fresh:async()=>change!=='publisher'});
  assert.equal(writes,change==='none'?1:0);
 }
});
test('pending previews persist their candidate identity even before a directory exists',()=>{
 const value={production:{sha,run:20,status:'pending'},entries:[{number:8,action:'none',status:'pending'}]};
 assert.equal(optimizePlan(value,{storage,published:receipt}).early,true,'a pending-only preview must remain discoverable after later closure');
});
import {retainNotificationCandidates} from '../scripts/pages/reconciliation.mjs';
test('cleanup candidates survive notification failure and supersession until matching live receipt acknowledgement',async()=>{
 const closed={number:7,state:'closed',head:{sha,repo:{full_name:'wstein/cubistry'}},labels:[]};
 const old='<!-- cubistry-pr-preview -->\nPreview pending or publication/validation failed.';
 let body=old;
 const api={request:async()=>closed,pages:async()=>[{user:{login:'github-actions[bot]'},body}]};
 const args={numbers:[7],pulls:[],inventory:[],published:receipt};
 assert.deepEqual(await retainNotificationCandidates(api,args),[7],'failed detached notifier must retain cleanup for next run');
 assert.deepEqual(await retainNotificationCandidates(api,args),[7],'superseded detached notifier must retain cleanup again');
 body='<!-- cubistry-pr-preview -->\nPreview removed after this PR closed or merged.\n<!-- cubistry-pr-preview-receipt:'+('d'.repeat(32))+' -->';
 assert.deepEqual(await retainNotificationCandidates(api,args),[7],'an older snapshot acknowledgement cannot discharge current cleanup');
 body='<!-- cubistry-pr-preview -->\nPreview removed after this PR closed or merged.\n<!-- cubistry-pr-preview-receipt:'+receipt.nonce+' -->';
 assert.deepEqual(await retainNotificationCandidates(api,args),[]);
 assert.deepEqual(await retainNotificationCandidates(api,{...args,inventory:[7]}),[7],'remaining storage prevents acknowledgement');
});
test('candidate tracking drops a nonexistent comment obligation but preserves reopened and pending-only previews',async()=>{
 const pr={number:7,state:'closed',head:{sha,repo:{full_name:'wstein/cubistry'}},labels:[]};
 const api={request:async()=>pr,pages:async()=>[]};
 assert.deepEqual(await retainNotificationCandidates(api,{numbers:[7],pulls:[],inventory:[],published:receipt}),[]);
 assert.deepEqual(await retainNotificationCandidates(api,{numbers:[7],pulls:[{...pr,state:'open',labels:[{name:'preview'}]}],inventory:[],published:receipt}),[7]);
});
test('actual cleanup notification supplies the durable acknowledgement consumed by next reconciliation',async()=>{
 const pr={number:7,state:'closed',head:{sha,repo:{full_name:'wstein/cubistry'}},labels:[]};let body;
 const api={pages:async()=>[{id:8,user:{login:'github-actions[bot]'},body:'<!-- cubistry-pr-preview --> old'}],request:async(path,options={})=>{
  if(options.method){body=JSON.parse(options.body).body;return {};}
  return path.startsWith('pulls/')?pr:null;
 }};
 await notifyPreviews(api,note,{fresh:async()=>true});
 assert.match(body,/Preview removed after this PR closed or merged\./);
 const next={request:async()=>pr,pages:async()=>[{user:{login:'github-actions[bot]'},body}]};
 assert.deepEqual(await retainNotificationCandidates(next,{numbers:[7],pulls:[],inventory:[],published:receipt}),[]);
});
test('unacknowledged candidate backlog fails closed at its explicit bound',async()=>{
 const pulls=Array.from({length:401},(_,i)=>({number:i+1,head:{repo:{full_name:'wstein/cubistry'}},labels:[{name:'preview'}]}));
 await assert.rejects(retainNotificationCandidates({}, {numbers:[],pulls,inventory:[],published:null}),/Too many pending/);
});
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
test('prepare repairs an untrusted live receipt instead of overriding the planner provenance rejection',()=>{
 const dir=mkdtempSync('/tmp/cubistry-prepare-trust-');
 try{
  mkdirSync(join(dir,'bin'));mkdirSync(join(dir,'combined-site'));
  writeFileSync(join(dir,'bin/git'),`#!/bin/sh\nprintf '%s\\n' '${storage}'\n`,{mode:0o755});
  const live={...receipt,tracked:[]};
  writeFileSync(join(dir,'mock.mjs'),`globalThis.fetch=async(url)=>new Response(JSON.stringify(String(url).startsWith('https://wstein.github.io/')?${JSON.stringify(live)}:String(url).includes('/actions/runs/')?{event:'pull_request'}:String(url).endsWith('/commits/gh-pages')?{sha:'${commitSha}',commit:{tree:{sha:'${storage}'}}}:{sha:'${commitSha}',tree:[],truncated:false}));`);
  execFileSync(process.execPath,['--import',join(dir,'mock.mjs'),resolve('scripts/pages/publish.mjs'),'prepare'],{cwd:dir,env:{...process.env,PATH:`${dir}/bin:/usr/bin:/bin`,GH_TOKEN:'test-only',GITHUB_RUN_ID:'200',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha,GITHUB_OUTPUT:join(dir,'out'),TRACKED:'[]'},stdio:'pipe'});
  assert.match(readFileSync(join(dir,'out'),'utf8'),/publish=true/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('OIDC acquisition receives the remaining deadline and stops without creating after expiry',async()=>{
 let time=0,posts=0,received;
 await assert.rejects(deployPages({receipt,artifact:55,token:'test',timeout:10,now:()=>time,oidc:async(options)=>{received=options;assert.equal(options.timeout,10);assert(options.signal instanceof AbortSignal);time+=options.timeout;throw Error('OIDC deadline expired');},fetch:async()=>{posts++;return json({id:sha},201);}}),/deadline/);
 assert.equal(received.timeout,10);assert.equal(time,10);assert.equal(posts,0);
});
import {readVerifiedPublication} from '../scripts/pages/publication.mjs';
test('both no-op boundaries require source provenance and permit only their own active publisher context',async()=>{
 const api=run=>({request:async()=>run});
 const options={fetch:async()=>json(receipt)};
 assert.deepEqual(await readVerifiedPublication(api(publisher),options),receipt);
 assert.equal(await readVerifiedPublication(api({...publisher,event:'pull_request'}),options),null);
 assert.equal(await readVerifiedPublication(api({...publisher,run_attempt:2}),options),null);
 assert.equal(await readVerifiedPublication(api({...publisher,status:'in_progress'}),options),null);
 assert.deepEqual(await readVerifiedPublication(api({...publisher,status:'in_progress'}),{...options,context:{run:123,attempt:1,sha}}),receipt);
 assert.equal(await readVerifiedPublication(api({...publisher,status:'in_progress'}),{...options,context:{run:124,attempt:1,sha}}),null);
});

function runPublish(mode,{live,treeSha=storage,env={}}){
 const dir=mkdtempSync('/tmp/cubistry-publish-mode-');
 try{
  mkdirSync(join(dir,'bin'));mkdirSync(join(dir,'combined-site'));
  writeFileSync(join(dir,'bin/git'),`#!/bin/sh\nprintf '%s\\n' '${storage}'\n`,{mode:0o755});
  writeFileSync(join(dir,'mock.mjs'),`globalThis.fetch=async(url)=>new Response(JSON.stringify(String(url).startsWith('https://wstein.github.io/')?${JSON.stringify(live)}:String(url).includes('/actions/runs/')?${JSON.stringify(publisher)}:String(url).endsWith('/commits/gh-pages')?{sha:'${commitSha}',commit:{tree:{sha:'${treeSha}'}}}:{sha:'${commitSha}',tree:[],truncated:false}));`);
  execFileSync(process.execPath,['--import',join(dir,'mock.mjs'),resolve('scripts/pages/publish.mjs'),mode],{cwd:dir,env:{...process.env,PATH:`${dir}/bin:/usr/bin:/bin`,GH_TOKEN:'test-only',GITHUB_RUN_ID:'200',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha,GITHUB_OUTPUT:join(dir,'out'),...env},stdio:'pipe'});
  const read=name=>existsSync(join(dir,name))?readFileSync(join(dir,name),'utf8'):'';
  return {out:read('out'),notification:read('notification.json')};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('prepare skips publication only when storage and the tracked preview set both match the live receipt',()=>{
 const live={...receipt,tracked:[7]};
 assert.match(runPublish('prepare',{live,env:{TRACKED:'[7]'}}).out,/publish=false/);
 assert.match(runPublish('prepare',{live,env:{TRACKED:'[7,8]'}}).out,/publish=true/,'a changed tracked set must publish');
 assert.match(runPublish('prepare',{live,env:{TRACKED:'[]'}}).out,/publish=true/,'a removed tracked preview must publish');
});
test('notification receipt carries the live proof only when its storage matches the gh-pages tree',()=>{
 const proof=value=>JSON.parse(value.notification).proof;
 assert.deepEqual(proof(runPublish('receipt',{live:receipt,env:{NOTIFY:'[7]'}})),receipt);
 assert.equal(proof(runPublish('receipt',{live:receipt,treeSha:sha,env:{NOTIFY:'[7]'}})),null,'a proof for other storage is dropped');
});
test('freshness pagination stops exactly at the receipt run or at a short page',async()=>{
 const make=pages=>{const reads=[];return {reads,request:async path=>{
  if(runsPath(path)){reads.push(pageOf(path));assert.ok(reads.length<=pages.length,'read beyond the last page');return {workflow_runs:pages[pageOf(path)-1]};}
  return path.startsWith('actions/runs/')?publisher:path==='commits/gh-pages'?{sha:commitSha,commit:{tree:{sha:storage}}}:{sha:commitSha};
 }};};
 // The receipt run (123) is the last entry of a full page: that page ends the scan.
 const full=Array.from({length:100},(_,i)=>({id:222-i,event:'workflow_run',conclusion:'skipped'}));
 assert.equal(full.at(-1).id,123);
 const a=make([full]);
 assert.equal(await currentNotification(a,note,{fetch:async()=>json(receipt)}),true);
 assert.deepEqual(a.reads,[1]);
 // A short page without the receipt run is the last page: no further read.
 const short=Array.from({length:5},(_,i)=>({id:400-i,event:'workflow_run',conclusion:'skipped'}));
 const b=make([short]);
 assert.equal(await currentNotification(b,note,{fetch:async()=>json(receipt)}),true);
 assert.deepEqual(b.reads,[1]);
});
