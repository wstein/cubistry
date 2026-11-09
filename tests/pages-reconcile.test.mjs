// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { deployPages, parsePublication, readPublication } from '../scripts/pages/publication.mjs';
const sha='a'.repeat(40), storage='b'.repeat(40);
const receipt={schema:1,run:123,attempt:1,sha,storage,nonce:'c'.repeat(32),tracked:[7]};
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
test('detached notification rejects newer publishers and changed storage or live receipt before writing',async()=>{
 const api=({newer=false,tree=storage}={})=>({request:async path=>path.startsWith('actions/runs/')?publisher:{sha:tree},pages:async()=>newer?[{id:124,event:'workflow_dispatch'}]:[publisher]});
 assert.equal(await currentNotification(api(),note,{fetch:async()=>json(receipt)}),true);
 assert.equal(await currentNotification(api({newer:true}),note,{fetch:async()=>json(receipt)}),false);
 assert.equal(await currentNotification(api({tree:sha}),note,{fetch:async()=>json(receipt)}),false);
 assert.equal(await currentNotification(api(),note,{fetch:async()=>json({...receipt,nonce:'d'.repeat(32)})}),false);
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
