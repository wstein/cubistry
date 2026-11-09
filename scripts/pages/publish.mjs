// SPDX-License-Identifier: AGPL-3.0-or-later
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {GitHub} from './api.mjs';
import {previewInventory} from './policy.mjs';
import {PUBLICATION_PATH,readPublication,readVerifiedPublication,parsePublication,deployPages} from './publication.mjs';
const api=new GitHub();
const run=Number(process.env.GITHUB_RUN_ID),attempt=Number(process.env.GITHUB_RUN_ATTEMPT),sha=process.env.GITHUB_SHA;
const numbers=text=>{const value=JSON.parse(text||'[]');if(!Array.isArray(value)||value.length>400||value.some(x=>!Number.isSafeInteger(x)||x<1))throw Error('Invalid notification numbers');return value;};
const mode=process.argv[2];
if(mode==='prepare'){
 const storage=execFileSync('git',['-C','site','rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
 const tree=await api.request('git/trees/gh-pages?recursive=1');
 if(tree?.sha!==storage)throw Error('Storage changed while preparing publication');
 const live=await readVerifiedPublication(api,{context:{run,attempt,sha}});
 const tracked=[...new Set([...previewInventory(tree),...numbers(process.env.TRACKED)])].sort((a,b)=>a-b);
 const publish=live?.storage!==storage||JSON.stringify(live?.tracked)!==JSON.stringify(tracked);
 if(publish){
  const receipt={schema:1,run,attempt,sha,storage,nonce:randomBytes(16).toString('hex'),tracked};
  parsePublication(JSON.stringify(receipt));
  await writeFile(`combined-site/${PUBLICATION_PATH}`,JSON.stringify(receipt));
  await writeFile('publication.json',JSON.stringify(receipt));
 }
 await appendFile(process.env.GITHUB_OUTPUT,`publish=${publish}\n`);
}else if(mode==='deploy'){
 const receipt=parsePublication(await readFile('publication.json','utf8'));
 if(receipt.run!==run||receipt.attempt!==attempt||receipt.sha!==sha)throw Error('Publication context mismatch');
 const artifacts=await api.pages(`actions/runs/${run}/artifacts`,'artifacts');
 const matches=artifacts.filter(x=>x.name===process.env.ARTIFACT_NAME&&!x.expired&&x.workflow_run?.id===run);
 if(matches.length!==1)throw Error('Expected one current Pages artifact');
 await deployPages({receipt,artifact:matches[0].id,token:process.env.GH_TOKEN,oidc:async({signal})=>{
  const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.actions.githubusercontent.com'))throw Error('Invalid OIDC service origin');
  // Match actions/deploy-pages: core.getIDToken() uses the runtime's default audience.
  const response=await fetch(url,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},redirect:'error',signal});
  if(!response.ok)throw Error('OIDC request failed');
  const data=await response.json();if(typeof data.value!=='string'||!data.value)throw Error('Missing OIDC token');return data.value;
 }});
}else if(mode==='receipt'){
 const proof=await readPublication();
 const tree=await api.request('git/trees/gh-pages?recursive=1');
 const value={schema:1,run,attempt,sha,numbers:numbers(process.env.NOTIFY),proof:proof?.storage===tree?.sha?proof:null};
 await writeFile('notification.json',JSON.stringify(value));
}else throw Error('Unknown publication mode');
