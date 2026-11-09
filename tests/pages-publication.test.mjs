import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
const workflow=readFileSync('.github/workflows/pages-publish.yml','utf8');
const jobs=new Map([...workflow.matchAll(/^  ([a-z][a-z0-9-]*):\n([\s\S]*?)(?=^  [a-z][a-z0-9-]*:\n|$(?![\s\S]))/gm)].map(m=>[m[1],m[2]]));
function needs(id){const value=jobs.get(id).match(/^    needs: (.*)$/m)?.[1];return value?value.replace(/[\[\]]/g,'').split(',').map(s=>s.trim()):[];}
const sha='b'.repeat(40),old='a'.repeat(40),repo={id:100,full_name:'wstein/cubistry'};
function notify({deployOK,metadata=sha,closed=false,remaining=false,unlabeled=false,comment=closed,leftover=false}){
 const dir=mkdtempSync(join(tmpdir(),'pages-notify-'));
 try{
  const pr={number:1,state:closed?'closed':'open',labels:unlabeled?[{name:'e2e'}]:[{name:'preview'}],head:{sha,repo},base:{repo}};
  const run={id:99,head_sha:sha,event:'pull_request',path:'.github/workflows/pages.yml',repository:repo,head_repository:repo,
   pull_requests:[{number:1,head:{sha,repo},base:{repo}}],status:'completed',conclusion:'success'};
  const proof={schema:1,run:123,attempt:1,sha,storage:'c'.repeat(40),nonce:'d'.repeat(32),tracked:[1]};
  const publisher={id:123,run_attempt:1,head_sha:sha,head_branch:'main',path:'.github/workflows/pages-publish.yml',repository:repo,head_repository:repo,event:'workflow_dispatch',status:'completed'};
  mkdirSync(join(dir,'receipt'));writeFileSync(join(dir,'receipt/notification.json'),JSON.stringify({schema:1,run:123,attempt:1,sha,numbers:[1],proof:deployOK?proof:null}));
  const responses={
   'pulls/1':pr,
   'actions/runs/123':publisher,
   'actions/workflows/pages-publish.yml/runs?branch=main&per_page=100&page=1':{workflow_runs:[publisher]},
   'git/trees/gh-pages?recursive=1':{sha:proof.storage},
   'issues/1/comments?per_page=100&page=1':comment?[{id:7,user:{login:'github-actions[bot]'},body:'<!-- cubistry-pr-preview --> old'}]:[],
   [`actions/workflows/pages.yml/runs?event=pull_request&head_sha=${sha}&per_page=100&page=1`]:{workflow_runs:[run]},
   'contents/pr-preview/pr-1/preview-info.json?ref=gh-pages':{content:Buffer.from(JSON.stringify({sha:metadata})).toString('base64')},
   'contents/pr-preview/pr-1?ref=gh-pages':remaining?[{name:'.nojekyll'},{name:'index.html'}]:leftover?[{name:'.nojekyll'}]:null,
  };
  writeFileSync(join(dir,'mock.mjs'),`import{writeFileSync}from'node:fs';const responses=${JSON.stringify(responses)};globalThis.fetch=async(url,options={})=>{if(String(url).startsWith('https://wstein.github.io/'))return new Response(${JSON.stringify(JSON.stringify(proof))});const path=String(url).split('/repos/wstein/cubistry/')[1];if(options.method==='POST'||options.method==='PATCH'){writeFileSync(${JSON.stringify(join(dir,'comment'))},options.body);return new Response('{}');}if(!(path in responses))throw Error('Unexpected API request '+path);return new Response(JSON.stringify(responses[path]),{status:responses[path]===null?404:200});};`);
  execFileSync(process.execPath,['--import',join(dir,'mock.mjs'),resolve('scripts/pages/notify.mjs')],{cwd:dir,env:{...process.env,GH_TOKEN:'unit-test-only',PUBLISH_RUN:'123'},stdio:'pipe'});
  return JSON.parse(readFileSync(join(dir,'comment'),'utf8')).body;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
function publication({previewFailure=false,previewCancelled=false,earlyFailure=false,finalFailure=false}={}){
 const dir=mkdtempSync(join(tmpdir(),'pages-order-')),storage=join(dir,'storage'),results=new Map();let published,cancelled=false;
 mkdirSync(join(storage,'pr-preview/pr-1'),{recursive:true});mkdirSync(join(storage,'pr-preview/pr-2'));writeFileSync(join(storage,'pr-preview/pr-2/.nojekyll'),'');writeFileSync(join(storage,'pr-preview/pr-2/index.html'),'old preview');
 writeFileSync(join(storage,'index.html'),'verified production');
 writeFileSync(join(storage,'pr-preview/pr-1/preview-info.json'),JSON.stringify({sha:old}));
 function run(id){
  if(results.has(id))return;for(const dependency of needs(id))run(dependency);
  const body=jobs.get(id),jobIf=body.match(/^    if: (.*)$/m)?.[1]??'',always=/always\(\)/.test(jobIf);
  const conditions=[...jobIf.matchAll(/needs\.([a-z-]+)\.result == '([^']+)'/g)];
  if((/!cancelled\(\)/.test(jobIf)&&cancelled)||(!always&&needs(id).some(n=>results.get(n)!=='success'))||conditions.some(m=>results.get(m[1])!==m[2])||[...jobIf.matchAll(/contains\(fromJSON\('\["success","skipped"\]'\), needs\.([a-z-]+)\.result\)/g)].some(m=>!['success','skipped'].includes(results.get(m[1])))){results.set(id,'skipped');return;}
  if(id==='previews'){
   writeFileSync(join(storage,'pr-preview/pr-1/preview-info.json'),JSON.stringify({sha}));for(const f of ['index.html','preview-info.json'])rmSync(join(storage,'pr-preview/pr-2',f),{force:true});/* rsync keeps the protected .nojekyll */
   if(previewCancelled)cancelled=true;results.set(id,previewCancelled?'cancelled':previewFailure?'failure':'success');return;
  }
  if(/run: python3 code\/scripts\/pages\/snapshot.py site combined-site/.test(body)){
   const destination=join(dir,id);execFileSync('python3',['scripts/pages/snapshot.py',storage,destination]);
   const failed=id==='deploy'?earlyFailure:finalFailure;
   if(!failed)published=destination;results.set(id,failed?'failure':'success');return;
  }
  results.set(id,'success');
 }
 try{
  run('receipt');assert.equal(results.get('receipt'),'success','status notification must still run after a publication failure/cancellation');
  const gate='deploy-previews';assert(needs('receipt').includes(gate),'receipt must wait for the final deployment');
  return {published:published&&JSON.parse(readFileSync(join(published,'pr-preview/pr-1/preview-info.json'))).sha,
   removed:published&&!existsSync(join(published,'pr-preview/pr-2/index.html')),leftover:published&&existsSync(join(published,'pr-preview/pr-2/.nojekyll')),results,comment:notify({deployOK:results.get(gate)==='success'})};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('production publishes first, then the completed preview snapshot is actually deployed before availability is announced',()=>{
 const result=publication();assert.equal(result.published,sha,'the early production snapshot still contained the old preview');assert.equal(result.removed,true);assert.equal(result.leftover,true,'simulation must leave .nojekyll like rsync');
 assert.match(result.comment,/Open non-production PR preview/);
});
test('partial preview failures cannot delay production and successful changes still reach the final deployment',()=>{
 const result=publication({previewFailure:true});assert.equal(result.results.get('deploy'),'success');assert.equal(result.published,sha);assert.match(result.comment,/Open non-production PR preview/);
});
test('failed final deployment never claims fresh availability from newer storage metadata',()=>{
 const result=publication({finalFailure:true});assert.equal(result.results.get('deploy'),'success');assert.equal(result.published,old);assert.doesNotMatch(result.comment,/Open non-production PR preview/);assert.match(result.comment,/pending|failed/);
 const early=publication({earlyFailure:true});assert.equal(early.results.get('previews'),'skipped');assert.doesNotMatch(early.comment,/Open non-production PR preview/);
});
test('notification separately requires the final deployment and matching metadata, including closed cleanup',()=>{
 assert.doesNotMatch(notify({deployOK:true,metadata:old}),/Open non-production PR preview/);
 assert.doesNotMatch(notify({deployOK:false,closed:true}),/^.*Preview removed/m);
 assert.match(notify({deployOK:true,unlabeled:true,comment:true}),/Preview removed because the `preview` label is gone/);
 assert.doesNotMatch(notify({deployOK:true,unlabeled:true,comment:true,remaining:true}),/^.*Preview removed/m);
 assert.match(notify({deployOK:true,closed:true}),/Preview removed/);
 assert.match(notify({deployOK:true,closed:true,leftover:true}),/Preview removed/,'a .nojekyll-only directory is a removed preview');
 assert.doesNotMatch(notify({deployOK:false,closed:true,leftover:true}),/^.*Preview removed/m);
 assert.doesNotMatch(notify({deployOK:true,closed:true,remaining:true}),/^.*Preview removed/m);
});

test('final snapshot preserves trusted-main boundary, distinct immutable artifact identity and production-first ordering',()=>{
 assert.deepEqual(needs('deploy'),['plan','production']);
 assert(needs('previews').includes('deploy'));
 const final=jobs.get('deploy-previews');assert(final);
 for(const id of ['plan','production','deploy','previews'])assert(needs('deploy-previews').includes(id));
 assert.match(final,/if: always\(\).*needs\.plan\.outputs\.previews == 'true'/);
 for(const dependency of ['production','deploy'])assert(final.includes(`contains(fromJSON('["success","skipped"]'), needs.${dependency}.result)`));
 assert.doesNotMatch(final,/needs\.previews\.result == 'success'/);
 const refs=[...final.matchAll(/          ref: (.+)/g)].map(m=>m[1]);assert.deepEqual(refs,['main','gh-pages']);
 assert.match(final,/permissions:\n      contents: read\n      pages: write\n      id-token: write/);
 assert.doesNotMatch(final,/head_ref|pull_request\.head|npm |matrix\./);
 const upload=final.match(/name: (github-pages[^\n]+)/)?.[1],deployment=final.match(/ARTIFACT_NAME: ([^\n]+)/)?.[1];
 assert(upload&&upload!=='github-pages');assert.equal(upload,deployment);
 // Expected pins come from pages.yml, so a Dependabot bump needs no test edit. Both must be full commit SHAs and equal.
 const pagesYml=readFileSync('.github/workflows/pages.yml','utf8');
 for(const action of ['actions/upload-pages-artifact']){
  const re=new RegExp(`${action}@([^\\s#]+)`);
  const expected=pagesYml.match(re)?.[1];
  assert.match(expected??'',/^[0-9a-f]{40}$/,`${action} in pages.yml must be pinned to a commit SHA`);
  assert.equal(final.match(re)?.[1],expected,`${action} in pages-publish.yml must use the same commit SHA as pages.yml`);
 }
 assert(!jobs.has('notify'),'comment writers must not retain the publication lock');
 assert.match(final,/run: node code\/scripts\/pages\/publish\.mjs deploy/);
 assert(needs('receipt').includes('deploy-previews'));
});

test('operator cancellation after early production prevents final publication and fresh availability or cleanup claims',()=>{
 const result=publication({previewCancelled:true});assert.equal(result.results.get('deploy'),'success');
 assert.equal(result.results.get('deploy-previews'),'skipped');assert.equal(result.published,old);
 assert.doesNotMatch(result.comment,/Open non-production PR preview/);assert.match(result.comment,/pending|failed/);
 const final=jobs.get('deploy-previews');assert.match(final,/if: always\(\) && !cancelled\(\)/);
 assert.doesNotMatch(notify({deployOK:false,closed:true}),/^.*Preview removed/m);
});
