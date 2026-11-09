// SPDX-License-Identifier: AGPL-3.0-or-later
export function optimizePlan(result, {storage, published, production, previews={},tracked:expectedTracked}) {
  if (result.production.status==='success' && production?.sha===result.production.sha && production?.run===result.production.run)
    result.production={...result.production,status:'current'};
  result.entries=result.entries.map(entry=>entry.action==='deploy' && previews[entry.number]?.sha===entry.sha && previews[entry.number]?.run===entry.run?{...entry,action:'none',status:'current'}:entry);
  const tracked=expectedTracked??[...new Set(result.entries.map(x=>x.number))].sort((a,b)=>a-b);
  const baseline=Boolean(published && published.storage===storage && JSON.stringify(published.tracked)===JSON.stringify(tracked));
  return {...result,early:result.production.status==='success'||!baseline,previews:result.entries.some(x=>x.action==='deploy'||x.action==='remove')};
}
export const commentMarker='<!-- cubistry-pr-preview -->';
export function notificationNumbers({pulls,inventory,published,bootstrap=[]}) {
  const numbers=new Set([...inventory,...(published?.tracked??[]),...bootstrap]);
  for(const pr of pulls)if(pr.head?.repo?.full_name==='wstein/cubistry'&&pr.labels?.some(x=>x.name==='preview'))numbers.add(pr.number);
  return [...numbers].sort((a,b)=>a-b);
}
export const receiptMarker=nonce=>`<!-- cubistry-pr-preview-receipt:${nonce} -->`;
export async function retainNotificationCandidates(api,{numbers,pulls,inventory,published}){
 const tracked=new Set(notificationNumbers({pulls,inventory,published:null}));
 for(const number of numbers){
  if(tracked.has(number))continue;
  const pr=await api.request(`pulls/${number}`);
  if(pr?.state==='open'&&pr.head?.repo?.full_name==='wstein/cubistry'&&pr.labels?.some(x=>x.name==='preview')){tracked.add(number);continue;}
  const comments=await api.pages(`issues/${number}/comments`);
  const existing=comments.find(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes(commentMarker));
  if(!existing)continue;
  const acknowledged=Boolean(published&&existing.body.includes(receiptMarker(published.nonce))&&(existing.body.includes('Preview removed after this PR closed or merged.')||existing.body.includes('Preview removed because the `preview` label is gone.')));
  if(!acknowledged)tracked.add(number);
 }
 if(tracked.size>400)throw Error('Too many pending preview acknowledgements');
 return [...tracked].sort((a,b)=>a-b);
}
