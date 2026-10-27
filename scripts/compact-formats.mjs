import {readFileSync,writeFileSync} from 'node:fs';
import * as G from '../src/Geometry.res.mjs';
import {chirality} from './experiment.mjs';
import {inkAt,printQuarter} from './palette-analysis.mjs';
import {wingTargets,peakProof} from './wing-proof.mjs';

export const fields=['weekdayLetters','monthLetters','dateDigits','yearDigits','timeDigits','separator','colon'];
export const finePalette=Object.fromEntries(fields.map(f=>[f,f+'-ink']));
export function reserveWitness(de) {
  const ignored=de.design.stickers.filter(s=>s.symbol===' '&&(['axialCenters','diagonalCenters'].includes(G.orbit(s.position)) || G.orbit(s.position)==='fixedCenters'&&s.id!==62)).map(s=>s.id);
  if(de.separatorStyle==='three') {
    const spare=de.design.stickers.find(s=>s.symbol===' '&&G.orbit(s.position)==='wings'&&chirality(s)===-1);
    if(!spare)throw new Error('No candidate blank-wing reserve');
    ignored.push(spare.id);
  }
  return {status:'UNKNOWN',ignoredStickerIds:ignored.sort((a,b)=>a-b),count:ignored.length,globallyMaximized:false};
}

export function fineWitness(de) {
  const stickerInks=de.design.stickers.map(s=>{
    if(s.symbol===' ')return 'none';
    const inks=new Set(s.targetSlots.map(slot=>inkAt(finePalette,slot,s.symbol)));
    if(inks.size!==1)throw new Error('The source design needs another component ink constraint');
    return [...inks][0];
  });
  return {status:'UNKNOWN',palette:finePalette,inkCount:7,stickerInks};
}

export const formats=[
  {name:'hour-space',hourPadding:'space',separatorStyle:'five'},
  {name:'short-separator',hourPadding:'zero',separatorStyle:'three'},
  {name:'compact',hourPadding:'space',separatorStyle:'three'},
];
export function constructCompact(base,format) {
  const r=structuredClone(base);
  r.status='UNKNOWN';r.reason='Requested format changes await independent colored matching and legal completion.';
  r.hourPadding=format.hourPadding;r.separatorStyle=format.separatorStyle;r.sourceDayReference='german-space-padded.json';
  r.conventions.layout='five fixed rows; requested day/hour padding and separator style explicitly tagged';
  r.proof='docs/COMPACT_FORMAT.md';
  delete r.reachabilityCertificate;delete r.displayRotationCertificate;delete r.fixedWingGlyphChanges;
  for(const s of r.design.stickers) {
    if(format.hourPadding==='space' && s.symbol==='0' && s.targetSlots.length===1 && s.targetSlots[0]===20)s.symbol=' ';
    if(format.separatorStyle==='three') {
      if(s.symbol==='─'&&G.orbit(s.position)==='wings')s.symbol=' ';
      if(s.symbol===' '&&G.orbit(s.position)==='wings'&&chirality(s)===-1)s.targetSlots=[3,5,19];
    }
    const inks=new Set(s.targetSlots.map(slot=>inkAt(r.palette,slot,s.symbol)));
    if(s.symbol===' ')s.ink='none';
    else {if(inks.size!==1)throw new Error('A new ink merge is needed');s.ink=[...inks][0];}
  }
  for(const pair of r.design.packings.corners.pieces)for(const t of pair)if(format.hourPadding==='space'&&t.slots[0]===20&&t.symbol==='0')t.symbol=' ';
  if(format.separatorStyle==='three')for(const pair of r.design.packings.wings.pieces)for(const t of pair) {
    if(t.symbol==='─')t.symbol=' ';
    if(t.symbol===' '&&t.slots.some(s=>[3,5,19].includes(s)))t.slots=[3,5,19];
  }
  r.additionalPrintChanges=r.design.stickers.flatMap(s=>{
    const old=base.design.stickers.find(v=>v.id===s.id);
    return s.symbol!==old.symbol?[{id:s.id,from:old.symbol,to:s.symbol}]:[];
  });
  return r;
}
const typeKey=(slot,symbol)=>JSON.stringify([symbol===' '?-1:slot,symbol]);
export function compactEnglishProof() {
  const maxima={A:{},B:{}},coexists=new Set();
  const targets=wingTargets('EN','space','three');
  const hist=t=>t.reduce((m,[slot,c])=>{const k=typeKey(slot,c);m[k]=(m[k]??0)+1;return m;},{});
  const slots=[1,9,15,23,3,5,19,21];
  const states=targets.map(t=>({A:hist(t.slice(0,4).map((c,i)=>[slots[i],c])),B:hist(t.slice(4).map((c,i)=>[slots[i+4],c]))}));
  for(const state of states)for(const side of ['A','B'])for(const [key,n]of Object.entries(state[side]))maxima[side][key]=Math.max(maxima[side][key]??0,n);
  for(const {A,B} of states)for(const a of Object.keys(A))if(A[a]===maxima.A[a])for(const b of Object.keys(B))if(B[b]===maxima.B[b])coexists.add(JSON.stringify([a,b]));
  const missing=[];for(const a of Object.keys(maxima.A))for(const b of Object.keys(maxima.B))if(!coexists.has(JSON.stringify([a,b])))missing.push([JSON.parse(a),JSON.parse(b)]);
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0),largest=(o,n)=>Object.values(o).sort((a,b)=>b-a).slice(0,n).reduce((a,b)=>a+b,0);
  const slackA=24-sum(maxima.A),slackB=24-sum(maxima.B),looseA=slackA+largest(maxima.A,slackA),tightB=sum(maxima.B)-largest(maxima.B,slackB);
  const exception=missing.reduce((n,[a,b])=>n+Math.min(maxima.A[JSON.stringify(a)],maxima.B[JSON.stringify(b)]),0);
  return {model:'glyph-aware role types; blank roles share a type; all ink distinctions ignored',required:maxima,peakNeverCooccurs:missing,
    counting:{slackA,slackB,maximumLooseA:looseA,minimumTightB:tightB,maximumExceptionalPairs:exception,contradiction:tightB>looseA+exception},projectedTargets:targets.length};
}
export function generateCompact() {
  const base=JSON.parse(readFileSync('results/german-space-padded.json','utf8'));
  const comparison={status:'UNKNOWN',dayPadding:'space',inkPolicy:'original distinct row colors; no merges',cases:[{name:'baseline',hourPadding:'zero',separatorStyle:'five',DE:'UNKNOWN',EN:'UNKNOWN',combined:'UNKNOWN',DEfile:'german-space-padded.json',ENfile:'english-space-padded.json',mostSeparatedWitness:fineWitness(base),reserveWitness:reserveWitness(base)}],proof:'docs/COMPACT_FORMAT.md'};
  for(const format of formats) {
    const de=constructCompact(base,format);
    const en={language:'EN',dayPadding:'space',hourPadding:format.hourPadding,separatorStyle:format.separatorStyle,status:'UNKNOWN',validDates:10958,totalDisplays:10958*1440,glyphModel:base.glyphModel,proof:'docs/COMPACT_FORMAT.md'};
    if(format.separatorStyle==='five')en.orientationFreeWingProof=peakProof('EN','space');
    else en.glyphAwareWingProof=compactEnglishProof();
    writeFileSync(`results/german-${format.name}.json`,JSON.stringify(de,null,2)+'\n');
    writeFileSync(`results/english-${format.name}.json`,JSON.stringify(en,null,2)+'\n');
    comparison.cases.push({...format,DE:'UNKNOWN',EN:'UNKNOWN',combined:'UNKNOWN',DEfile:`german-${format.name}.json`,ENfile:`english-${format.name}.json`,mostSeparatedWitness:fineWitness(de),reserveWitness:reserveWitness(de)});
    {
      const initial=G.solved(),quote=x=>'"'+String(x).replaceAll('"','""')+'"';
      const csv=['id,face,row,col,symbol,ink,print_rotation_ccw_degrees,planned_front_slots',...de.design.stickers.map(s=>[s.id,['U','D','F','B','R','L'][Math.floor(s.id/25)],Math.floor(s.id%25/5)+1,s.id%5+1,s.symbol===' '?'BLANK':s.symbol,s.ink,90*printQuarter(initial[s.id],s),s.targetSlots.map(i=>`${Math.floor(i/5)+1}:${i%5+1}`).join('|')].map(quote).join(','))].join('\n')+'\n';
      writeFileSync(`results/german-${format.name}-printing.csv`,csv);
    }
  }
  writeFileSync('results/format-comparison.json',JSON.stringify(comparison,null,2)+'\n');
  console.log('Generated hour-space, short-separator, and combined compact candidates with unchanged row inks.');
}
if(process.argv[1]?.endsWith('/compact-formats.mjs'))generateCompact();
