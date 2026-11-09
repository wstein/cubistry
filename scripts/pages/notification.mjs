// SPDX-License-Identifier: AGPL-3.0-or-later
import {readFile,lstat,readdir,appendFile} from 'node:fs/promises';
import {GitHub} from './api.mjs';
import {REPOSITORY} from './policy.mjs';
import {parsePublication,readPublication,samePublication} from './publication.mjs';
export const PUBLISH_WORKFLOW='.github/workflows/pages-publish.yml';
export function trustedPublisher(run){
 return Boolean(run&&Number.isSafeInteger(run.id)&&run.id>0&&Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0&&run.repository?.full_name===REPOSITORY&&run.head_repository?.full_name===REPOSITORY&&run.path===PUBLISH_WORKFLOW&&run.head_branch==='main'&&/^[a-f0-9]{40}$/.test(run.head_sha)&&['workflow_dispatch','workflow_run'].includes(run.event)&&run.status==='completed');
}
export function parseNotification(text,run){
 if(Buffer.byteLength(text)>65536)throw Error('Notification receipt exceeds budget');
 const value=JSON.parse(text);
 if(!trustedPublisher(run)||!value||Object.keys(value).sort().join(',')!=='attempt,numbers,proof,run,schema,sha'||value.schema!==1||value.run!==run.id||value.attempt!==run.run_attempt||value.sha!==run.head_sha||!Array.isArray(value.numbers)||value.numbers.length>400||value.numbers.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(value.numbers).size!==value.numbers.length)throw Error('Invalid notification receipt');
 if(value.proof!==null){parsePublication(JSON.stringify(value.proof));if(value.proof.run>value.run)throw Error('Future publication proof');}
 return value;
}
export async function currentNotification(api,receipt,{fetch:request=fetch}={}){
 const current=await api.request(`actions/runs/${receipt.run}`);
 if(!trustedPublisher(current)||current.run_attempt!==receipt.attempt||current.head_sha!==receipt.sha)return false;
 const latest=await api.pages('actions/workflows/pages-publish.yml/runs?branch=main','workflow_runs');
 if(latest.some(x=>x.id>receipt.run&&x.conclusion!=='skipped'&&['workflow_run','workflow_dispatch'].includes(x.event)))return false;
 const tree=await api.request('git/trees/gh-pages?recursive=1');
 const live=await readPublication({fetch:request});
 if(receipt.proof){
  const source=await api.request(`actions/runs/${receipt.proof.run}`);
  if(!trustedPublisher(source)||source.run_attempt!==receipt.proof.attempt||source.head_sha!==receipt.proof.sha)return false;
 }
 return receipt.proof===null || Boolean(receipt.proof.storage===tree?.sha&&samePublication(receipt.proof,live));
}
export async function loadNotification(api,runId){
 const run=await api.request(`actions/runs/${runId}`);
 if(!trustedPublisher(run))throw Error('Untrusted publisher run');
 const files=await readdir('receipt');if(files.length!==1||files[0]!=='notification.json')throw Error('Unexpected receipt files');
 const info=await lstat('receipt/notification.json');if(!info.isFile()||info.isSymbolicLink()||info.size>65536)throw Error('Invalid receipt file');
 return parseNotification(await readFile('receipt/notification.json','utf8'),run);
}
if(process.argv[1]?.endsWith('/notification.mjs')){
 const api=new GitHub(),event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 const id=event.workflow_run?.id;
 if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid publisher event');
 const run=await api.request(`actions/runs/${id}`);
 if(!trustedPublisher(run)){
  if(run?.path===PUBLISH_WORKFLOW&&run.repository?.full_name===REPOSITORY&&run.event==='pull_request_target'){await appendFile(process.env.GITHUB_OUTPUT,'eligible=false\n');process.exit(0);}
  throw Error('Untrusted publisher event');
 }
 const artifacts=await api.pages(`actions/runs/${id}/artifacts`,'artifacts');
 const name=`pages-notification-${run.run_attempt}`;
 const matches=artifacts.filter(x=>x.name===name&&!x.expired&&x.workflow_run?.id===id);
 if(matches.length>1)throw Error('Ambiguous notification artifact');
 if(matches.length===1&&(!Number.isSafeInteger(matches[0].size_in_bytes)||matches[0].size_in_bytes>65536))throw Error('Notification artifact exceeds budget');
 await appendFile(process.env.GITHUB_OUTPUT,`eligible=${matches.length===1}\nrun=${id}\nname=${name}\n`);
}
