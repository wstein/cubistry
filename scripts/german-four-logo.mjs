// Candidate only. The independent Python checker decides the proof verdict.
import * as D from '../src/Display.res.mjs';
const slots={A:[1,9,15,23],B:[3,5,19,21]};
const dates=new Map(),times=new Map();let validDates=0;
for(let ms=Date.UTC(1900,0,1);ms<Date.UTC(2100,0,1);ms+=86400000){
  const d=new Date(ms),rows=D.rowsWithFormat('DE',(d.getUTCDay()+6)%7,d.getUTCDate(),d.getUTCMonth(),d.getUTCFullYear(),0,false,false,true);
  rows[2]=D.splitYearRow(d.getUTCFullYear());
  const chars=[...rows.slice(0,3).join(''),' ','wordmark4:1','wordmark4:2','wordmark4:3','wordmark4:4'];
  const projection=[1,9,15,3,5,19].map(i=>chars[i]);
  dates.set(JSON.stringify(projection),projection);validDates++;
}
for(let minute=0;minute<1440;minute++){
 const text=D.rows('DE',0,1,0,2000,minute)[4],p=[text[3],text[1]];times.set(JSON.stringify(p),p);
}
const token=(slot,c)=>JSON.stringify([c===' '?-1:slot,c]);
const maxima={A:{},B:{}},states=[];
for(const d of dates.values())for(const t of times.values()){
 const chars=[...d.slice(0,3),t[0],...d.slice(3),t[1]],state={A:{},B:{}};
 for(const side of ['A','B'])for(const [i,slot]of slots[side].entries()){
  const k=token(slot,chars[i+(side==='B'?4:0)]);state[side][k]=(state[side][k]??0)+1;
 }
 for(const side of ['A','B'])for(const [k,n]of Object.entries(state[side]))maxima[side][k]=Math.max(maxima[side][k]??0,n);
 states.push(state);
}
const coexist=new Set();
for(const {A,B}of states)for(const [a,n]of Object.entries(A))if(n===maxima.A[a])for(const [b,m]of Object.entries(B))if(m===maxima.B[b])coexist.add(JSON.stringify([a,b]));
const missing=[];
for(const a of Object.keys(maxima.A).sort())for(const b of Object.keys(maxima.B).sort())if(!coexist.has(JSON.stringify([a,b])))missing.push([JSON.parse(a),JSON.parse(b)]);
const inventory=Object.fromEntries(['A','B'].map(side=>[side,Object.keys(maxima[side]).sort().map(k=>({token:JSON.parse(k),demand:maxima[side][k]}))]));
const sum=o=>Object.values(o).reduce((s,n)=>s+n,0),top=(o,n)=>Object.values(o).sort((a,b)=>b-a).slice(0,n).reduce((s,x)=>s+x,0);
const slackA=24-sum(maxima.A),slackB=24-sum(maxima.B);
const counting={requiredA:sum(maxima.A),requiredB:sum(maxima.B),slackA,slackB,maximumLooseA:slackA+top(maxima.A,slackA),minimumTightB:sum(maxima.B)-top(maxima.B,slackB),maximumExceptionalPairs:missing.reduce((s,[a,b])=>s+Math.min(maxima.A[JSON.stringify(a)],maxima.B[JSON.stringify(b)]),0)};
const model={language:'DE',years:[1900,2099],calendar:'proleptic Gregorian',weekdays:[...D.weekdaysDE],months:[...D.monthsDE],dayPadding:'zero',hourPadding:'zero',minutePadding:'zero',yearLayout:'thousands,hundreds,blank,tens,units',row4:[' ','wordmark4:1','wordmark4:2','wordmark4:3','wordmark4:4'],palette:{weekdayLetters:'weekday-black',monthLetters:'date-red',dateDigits:'date-red',yearDigits:'year-gray',timeDigits:'time-blue',colon:'date-red',wordmark:'immutable multicolor images',blank:'none'},opticalRelaxation:'all rotations allowed for every glyph; no character substitutions',legalMoves:'12 noncentral single-layer quarter turns on a labeled 5x5; inverses and compositions'};
console.log(JSON.stringify({claimedOutcome:'UNSAT',model,validDates,totalDisplays:validDates*1440,dateWingProjections:dates.size,timeWingProjections:times.size,combinedWingProjections:states.length,inventory,peakNeverCooccurs:missing,counting},null,2));
