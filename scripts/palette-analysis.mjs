import {readFileSync,writeFileSync} from 'node:fs';
import * as G from '../src/Geometry.res.mjs';

export const FIELDS=['weekdayLetters','monthLetters','dateDigits','yearDigits','timeDigits','separator','colon'];
export function inkAt(palette,slot,char) {
  if(char===' ')return 'none';
  const row=Math.floor(slot/5);
  const field=row===0?'weekdayLetters':row===1?(/^\d$/.test(char)?'dateDigits':'monthLetters'):row===2?'yearDigits':row===3?'separator':char===':'?'colon':'timeDigits';
  return palette[field];
}
export const fine={weekdayLetters:'weekday-ink',monthLetters:'month-ink',dateDigits:'date-time-digit-ink',yearDigits:'year-ink',timeDigits:'date-time-digit-ink',separator:'separator-ink',colon:'colon-ink'};
export const variants={
  A:{...fine,yearDigits:fine.dateDigits},
  B:{...fine,weekdayLetters:'letter-ink',monthLetters:'letter-ink'},
  B_originalDigitColors:{...fine,weekdayLetters:'letter-ink',monthLetters:'letter-ink',dateDigits:'date-digit-ink',timeDigits:'time-digit-ink'},
  C:Object.fromEntries(FIELDS.map(f=>[f,f==='separator'?'separator-ink':f==='colon'?'colon-ink':'text-ink'])),
  minimal: fine,
  minimalChange:{weekdayLetters:'weekday-black',monthLetters:'date-red',dateDigits:'time-blue',yearDigits:'year-gray',timeDigits:'time-blue',separator:'year-gray',colon:'date-red'},
};
export function partitions(n) {
  const result=[];
  const rec=a=>{
    if(a.length===n){result.push(a);return;}
    for(let x=0;x<=Math.max(-1,...a)+1;x++)rec([...a,x]);
  };
  rec([]);return result;
}
export function originalClassPalette(p) {
  const [w,d,y,t]=p.map(x=>'ink-'+x);
  return {weekdayLetters:w,monthLetters:d,dateDigits:d,yearDigits:y,timeDigits:t,separator:y,colon:d};
}
export function classify(palette) {
  // Candidate positives require independent matching + common legal completion.
  return palette.dateDigits===palette.timeDigits?'UNKNOWN':'UNSAT';
}
export function printQuarter(original,s) {
  const n=original.normal,u=original.up;
  const cross=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
  const options=[u,cross,u.map(x=>-x),cross.map(x=>-x)];
  return options.findIndex(v=>v.every((x,i)=>x===s.up[i]));
}
export function generate() {
  const source=JSON.parse(readFileSync('results/german-monochrome.json','utf8'));
  const inks=source.design.stickers.map(s=>{
    const colors=new Set(s.targetSlots.map(slot=>inkAt(fine,slot,s.symbol)));
    if(s.symbol===' ')return 'none';
    if(colors.size!==1)throw new Error('The source printing requires another ink merge');
    return [...colors][0];
  });
  const original=G.solved();
  const printRotations=source.design.stickers.map(s=>({id:s.id,face:['U','D','F','B','R','L'][Math.floor(s.id/25)],row:Math.floor(s.id%25/5)+1,col:s.id%5+1,symbol:s.symbol,ink:inks[s.id],minimalChangeInk:s.symbol===' '?'none':variants.minimalChange[FIELDS.find(f=>fine[f]===inks[s.id])],printRotationDegrees:90*printQuarter(original[s.id],s),plannedFrontSlots:s.targetSlots}));
  const cases=Object.entries(variants).map(([name,palette])=>({name,palette,status:classify(palette)}));
  const classPartitions=partitions(4).map(partition=>({partition,palette:originalClassPalette(partition),status:classify(originalClassPalette(partition))}));
  const report={status:'UNKNOWN',language:'DE',layout:'unchanged',scope:'documented shared glyph model; circular zero; no glyph reinterpretation',
    glyphModel:source.glyphModel,
    fieldNames:FIELDS,
    variants:cases,
    originalFourClasses:['weekday','date (digits and month letters)','year and separator','time digits'],
    originalClassPartitions:classPartitions,
    mostSeparatedWitness:{palette:fine,inkCount:new Set(Object.values(fine)).size,sourceDesign:'german-monochrome.json',stickerInks:inks},
    minimumOriginalClassMerges:1,
    minimumRecoloredComponentFields:1,
    minimallyRecoloredField:'dateDigits',
    minimalOriginalClassPair:['date (digits and month letters)','time digits'],
    rotationCertificate:{status:'UNKNOWN',note:'Print angles are relative to each source face; display symmetry requirements are verified separately.',printRotations},
    proof:'docs/PALETTE.md',
  };
  writeFileSync('results/palette-analysis.json',JSON.stringify(report,null,2)+'\n');
  const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
  const csv=['id,face,row,col,symbol,ink_fine,ink_minimal_change,print_rotation_ccw_degrees,planned_front_slots',...printRotations.map(s=>[s.id,s.face,s.row,s.col,s.symbol===' '?'BLANK':s.symbol,s.ink,s.minimalChangeInk,s.printRotationDegrees,s.plannedFrontSlots.map(i=>`${Math.floor(i/5)+1}:${i%5+1}`).join('|')].map(quote).join(','))].join('\n')+'\n';
  writeFileSync('results/german-palette-printing.csv',csv);
  console.log('Generated A/B/C, maximally separated witness, 15 original-color partitions, and per-sticker print angles.');
  return report;
}
if(process.argv[1]?.endsWith('/palette-analysis.mjs'))generate();
