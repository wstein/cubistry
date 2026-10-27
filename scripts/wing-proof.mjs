import * as D from '../src/Display.res.mjs';
import {counts,requirements,wingRoles} from './experiment.mjs';

export function wingTargets(language,dayPadding='zero') {
  const dates=new Set(),times=new Set();
  for(let ms=Date.UTC(2020,0,1);ms<Date.UTC(2050,0,1);ms+=86400000) {
    const d=new Date(ms),f=[...D.rowsWithDayPadding(language,(d.getUTCDay()+6)%7,d.getUTCDate(),d.getUTCMonth(),d.getUTCFullYear(),0,dayPadding==='space').join('')];
    dates.add([1,9,15,3,5,19].map(i=>f[i]).join(''));
  }
  for(let minute=0;minute<1440;minute++) {
    const t=[...D.rows(language,0,1,0,2020,minute)[4]];
    times.add(t[3]+t[1]);
  }
  return [...dates].flatMap(d=>[...times].map(t=>[...d.slice(0,3),t[0],...d.slice(3),t[1]]));
}
// Orientation-free: give every printed glyph all in-plane rotations. Each
// physical sticker still has exactly one symbol and belongs to one sign orbit.
export function peakProof(language,dayPadding='zero') {
  const r=requirements(wingRoles,[language],dayPadding);
  const A=r.orbits.positive.symbols,B=r.orbits.negative.symbols;
  const coexists=new Set();
  const targets=wingTargets(language,dayPadding);
  for(const t of targets) {
    const a=counts(t.slice(0,4)),b=counts(t.slice(4));
    for(const x of Object.keys(a)) if(a[x]===A[x]) for(const y of Object.keys(b)) if(b[y]===B[y]) coexists.add(JSON.stringify([x,y]));
  }
  const missing=[];
  for(const a of Object.keys(A)) for(const b of Object.keys(B)) if(!coexists.has(JSON.stringify([a,b]))) missing.push([a,b]);
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
  const largest=(o,n,exclude)=>Object.entries(o).filter(([k])=>k!==exclude).map(([,v])=>v).sort((a,b)=>b-a).slice(0,n).reduce((a,b)=>a+b,0);
  const N=24,slackA=N-sum(A),slackB=N-sum(B);
  const maximumNonTightA=slackA+largest(A,slackA);
  if(missing.length!==1 || missing[0][0]!=='B' || missing[0][1]!=='3') throw new Error('Peak proof needs exactly the verified February exception');
  const branches=[false,true].map(threeTight=>{
    const minimumTightB=sum(B)-largest(B,slackB,threeTight?'3':undefined);
    const exceptionalPairs=threeTight?Math.min(A.B,B['3']):0;
    return {threeTight,minimumTightB,maximumNonTightA,maximumExceptionalPairs:exceptionalPairs,contradiction:minimumTightB>maximumNonTightA+exceptionalPairs};
  });
  return {model:'orientation-free single-symbol wing stickers',requiredA:A,requiredB:B,slackA,slackB,projectedTargets:targets.length,peakNeverCooccurs:missing,branches,contradiction:branches.every(b=>b.contradiction)};
}
