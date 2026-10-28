import test from"node:test";import assert from"node:assert/strict";
import{plan,validRun,selectBuild,previewPath,REPOSITORY}from"../scripts/pages/policy.mjs";
const sha=n=>String(n).padStart(40,"a");
const pr=(n,s)=>({number:n,state:"open",head:{sha:s,repo:{full_name:REPOSITORY}},base:{repo:{full_name:REPOSITORY}}});
const run=(id,s,event="pull_request",conclusion="success")=>({id,head_sha:s,event,path:".github/workflows/pages.yml",repository:{full_name:REPOSITORY},head_repository:{full_name:REPOSITORY},head_branch:"main",status:"completed",conclusion});
test("Ross reconciliation preserves two previews across two updates then independently merges/closes them",()=>{
 const first=plan({pulls:[pr(1,sha(1)),pr(2,sha(2))],inventory:[],builds:{1:[run(1,sha(1))],2:[run(2,sha(2))]},main:{sha:sha(9),runs:[run(9,sha(9),"push")]}});
 assert.deepEqual(first.entries.map(x=>[x.number,x.action]),[[1,"deploy"],[2,"deploy"]]);
 const updated=plan({pulls:[pr(1,sha(3)),pr(2,sha(4))],inventory:[1,2],builds:{1:[run(3,sha(3)),run(1,sha(1))],2:[run(4,sha(4)),run(2,sha(2))]},main:{sha:sha(9),runs:[]}});
 assert.deepEqual(updated.entries.map(x=>x.sha),[sha(3),sha(4)]);
 const merged=plan({pulls:[pr(2,sha(4))],inventory:[1,2],builds:{2:[run(4,sha(4))]},main:{sha:sha(10),runs:[run(10,sha(10),"push")]}});
 assert.deepEqual(merged.entries.map(x=>[x.number,x.action]),[[2,"deploy"],[1,"remove"]]);
 const closed=plan({pulls:[],inventory:[2],builds:{},main:{sha:sha(10),runs:[]}});assert.equal(closed.entries[0].action,"remove");
});
test("forks, stale completions, failed latest reruns and missing artifacts never gain authority",()=>{
 const fork=pr(1,sha(1));fork.head.repo.full_name="other/fork";
 assert.equal(plan({pulls:[fork],inventory:[1],builds:{1:[run(1,sha(1))]},main:{sha:sha(9),runs:[]}}).entries[0].action,"remove");
 assert.equal(selectBuild([run(1,sha(1))],sha(2),"pull_request").status,"pending");
 assert.equal(selectBuild([run(2,sha(1),"pull_request","failure"),run(1,sha(1))],sha(1),"pull_request").status,"failed");
 assert.equal(validRun({...run(1,sha(1)),path:".github/workflows/evil.yml"},sha(1),"pull_request"),false);
 assert.equal(validRun({...run(1,sha(1)),head_repository:{full_name:"other/fork"}},sha(1),"pull_request"),false);
 assert.throws(()=>previewPath("1"));assert.throws(()=>previewPath(-1));
});
