// SPDX-License-Identifier: AGPL-3.0-or-later
import { REPOSITORY } from './policy.mjs';
export const PUBLICATION_PATH = '.cubistry-publication.json';
export const PUBLICATION_URL = `https://wstein.github.io/cubistry/${PUBLICATION_PATH}`;
const hash = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value > 0;
export function parsePublication(text) {
  if (Buffer.byteLength(text) > 32768) throw Error('Publication receipt exceeds budget');
  const value = JSON.parse(text);
  if (!value || Object.keys(value).sort().join(',') !== 'attempt,nonce,run,schema,sha,storage,tracked' || value.schema !== 1 || !integer(value.run) || !integer(value.attempt) || !hash(value.sha) || !hash(value.storage) || !/^[a-f0-9]{32}$/.test(value.nonce) || !Array.isArray(value.tracked) || value.tracked.length > 200 || value.tracked.some(x => !integer(x)) || new Set(value.tracked).size !== value.tracked.length) throw Error('Invalid publication receipt');
  return value;
}
export function samePublication(a, b) {
  return Boolean(a && b && JSON.stringify(a) === JSON.stringify(b));
}
export async function readPublication({fetch: request = fetch,timeout=15000} = {}) {
  try {
    const response = await request(`${PUBLICATION_URL}?receipt=${crypto.randomUUID()}`, {redirect:'error', cache:'no-store', signal:AbortSignal.timeout(Math.min(15000,timeout))});
    if (!response.ok) return null;
    const reader = response.body.getReader(), parts = []; let size = 0;
    for (;;) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.length;
      if (size > 32768) { await reader.cancel(); return null; }
      parts.push(value);
    }
    return parsePublication(Buffer.concat(parts).toString('utf8'));
  } catch { return null; }
}
const terminalFailure = new Set(['deployment_failed','deployment_content_failed','deployment_cancelled','deployment_lost']);
/** Reattempt only a server-confirmed rejection. An ambiguous POST is never replayed. */
export async function deployPages({receipt,artifact,token,oidc,fetch:request=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=60,now=()=>performance.now(),timeout=600000}) {
  parsePublication(JSON.stringify(receipt));
  if (!integer(artifact) || !token || typeof oidc !== 'function') throw Error('Invalid deployment inputs');
  let remaining=attempts;
  const deadline=now()+timeout;
  const budget=()=>{const left=deadline-now();if(left<=0)throw Error('Pages deployment wait budget exhausted');return Math.max(1,Math.min(30000,Math.floor(left)));};
  const pause = async () => { if (--remaining <= 0) throw Error('Pages deployment wait budget exhausted'); await sleep(Math.min(10000,budget()));budget(); };
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const status = async id => {
    const response=await request(`https://api.github.com/repos/${REPOSITORY}/pages/deployments/${id}`,{headers,redirect:'error',signal:AbortSignal.timeout(budget())});
    if(!response.ok)throw Error(`Pages status request failed (${response.status})`);
    const data=await response.json();
    if(terminalFailure.has(data.status))throw Error('Pages deployment failed');
    return data.status;
  };
  let id;
  for (;;) {
    const idToken=await oidc();
    const response=await request(`https://api.github.com/repos/${REPOSITORY}/pages/deployments`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(budget()),body:JSON.stringify({artifact_id:artifact,pages_build_version:receipt.sha,oidc_token:idToken})});
    const data=await response.json();
    if(response.ok){ id=data.id; if(!hash(id))throw Error('Invalid Pages deployment identity'); break; }
    const busy = response.status===400 && typeof data.message==='string' && new RegExp(`^Deployment request failed for ${receipt.sha} due to in progress deployment\\. Please cancel ([a-f0-9]{40}) first or wait for it to complete\\.$`).exec(data.message);
    if(!busy)throw Error(`Pages creation failed (${response.status}); request not replayed`);
    do { await pause(); } while(await status(busy[1])!=='succeed');
  }
  for (;;) {
    if(await status(id)==='succeed' && samePublication(await readPublication({fetch:request,timeout:budget()}),receipt)) return receipt;
    await pause();
  }
}
