// SPDX-License-Identifier: AGPL-3.0-or-later
export function optimizePlan(result, {storage, published, production, previews={}}) {
  if (result.production.status==='success' && production?.sha===result.production.sha && production?.run===result.production.run)
    result.production={...result.production,status:'current'};
  result.entries=result.entries.map(entry=>entry.action==='deploy' && previews[entry.number]?.sha===entry.sha && previews[entry.number]?.run===entry.run?{...entry,action:'none',status:'current'}:entry);
  const tracked=[...new Set(result.entries.map(x=>x.number))].sort((a,b)=>a-b);
  const baseline=Boolean(published && published.storage===storage && JSON.stringify(published.tracked)===JSON.stringify(tracked));
  return {...result,early:result.production.status==='success'||!baseline,previews:result.entries.some(x=>x.action==='deploy'||x.action==='remove')};
}
export const commentMarker='<!-- cubistry-pr-preview -->';
export function notificationNumbers({pulls,inventory,published,bootstrap=[]}) {
  const numbers=new Set([...inventory,...(published?.tracked??[]),...bootstrap]);
  for(const pr of pulls)if(pr.head?.repo?.full_name==='wstein/cubistry'&&pr.labels?.some(x=>x.name==='preview'))numbers.add(pr.number);
  return [...numbers].sort((a,b)=>a-b);
}
