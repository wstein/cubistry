import {readFileSync,writeFileSync} from 'node:fs';
import * as G from '../src/Geometry.res.mjs';
import {printing} from './german-design.mjs';
import {inkAt,printQuarter} from './palette-analysis.mjs';
import {peakProof} from './wing-proof.mjs';

export const originalPalette={weekdayLetters:'weekday-black',monthLetters:'date-red',dateDigits:'date-red',yearDigits:'year-gray',timeDigits:'time-blue',separator:'year-gray',colon:'date-red'};
export function constructSpaceDay(base) {
  const result=structuredClone(base);
  result.dayPadding='space';
  result.conventions={...result.conventions,layout:'same 5x5 positions; leading day space replaces zero for days 1 through 9'};
  result.palette=originalPalette;
  result.status='UNKNOWN';
  result.reason='Changed day padding and fixed colored printing await independent verification.';
  delete result.reachabilityCertificate;
  delete result.orientationFreeWingProof;
  delete result.uprightOnly;
  delete result.orbits;
  delete result.wingStickerOrbits;
  delete result.pooledInventoryLowerBound;
  result.proof='docs/DAY_PADDING.md';
  result.fixedWingGlyphChanges=[];
  for(let i=0;i<result.design.stickers.length;i++) {
    const s=result.design.stickers[i];
    if(G.orbit(s.position)!=='wings')continue;
    if(s.symbol==='0'&&s.targetSlots.length===2&&s.targetSlots.includes(5)&&s.targetSlots.includes(21)) {
      result.design.stickers[i]={...s,symbol:' ',targetSlots:[3,5]};
      result.fixedWingGlyphChanges.push({id:s.id,from:'0',to:' ',frontRoles:[3,5]});
    } else if(s.symbol===' '&&s.targetSlots.length===1&&s.targetSlots[0]===3) {
      result.design.stickers[i]=printing(s,{symbol:'0',slots:[21]});
      result.fixedWingGlyphChanges.push({id:s.id,from:' ',to:'0',frontRoles:[21]});
    }
  }
  if(result.fixedWingGlyphChanges.length!==5)throw new Error('Expected exactly five one-time glyph changes');
  for(const pair of result.design.packings.wings.pieces) {
    const b=pair[1];
    if(b.symbol==='0'&&b.slots.length===2){b.symbol=' ';b.slots=[3,5];}
    else if(b.symbol===' '&&b.slots.length===1&&b.slots[0]===3){b.symbol='0';b.slots=[21];}
  }
  for(const s of result.design.stickers) {
    const inks=new Set(s.targetSlots.map(slot=>inkAt(originalPalette,slot,s.symbol)));
    if(s.symbol===' ')s.ink='none';
    else {
      if(inks.size!==1)throw new Error('Still needs a color merge');
      s.ink=[...inks][0];
    }
  }
  result.displayRotationCertificate={status:'UNKNOWN'};
  return result;
}
export function generateSpaceDay() {
  const base=JSON.parse(readFileSync('results/german-monochrome.json','utf8'));
  const de=constructSpaceDay(base);
  writeFileSync('results/german-space-padded.json',JSON.stringify(de,null,2)+'\n');
  const en={language:'EN',dayPadding:'space',status:'UNSAT',validDates:10958,totalDisplays:10958*1440,
    reason:'Even space-padded days fail the orientation-free paired-wing peak-inventory proof.',orientationFreeWingProof:peakProof('EN','space'),proof:'docs/DAY_PADDING.md'};
  if(!en.orientationFreeWingProof.contradiction)throw new Error('No English proof');
  writeFileSync('results/english-space-padded.json',JSON.stringify(en,null,2)+'\n');
  const initial=G.solved(),quote=x=>'"'+String(x).replaceAll('"','""')+'"';
  const csv=['id,face,row,col,symbol,ink,print_rotation_ccw_degrees,planned_front_slots',...de.design.stickers.map(s=>[s.id,['U','D','F','B','R','L'][Math.floor(s.id/25)],Math.floor(s.id%25/5)+1,s.id%5+1,s.symbol===' '?'BLANK':s.symbol,s.ink,printQuarter(initial[s.id],s)*90,s.targetSlots.map(i=>`${Math.floor(i/5)+1}:${i%5+1}`).join('|')].map(quote).join(','))].join('\n')+'\n';
  writeFileSync('results/german-space-padded-printing.csv',csv);
  console.log('Space-padded day: DE fixed colored candidate, EN orientation-free UNSAT; 150-sticker printing CSV generated.');
  return {de,en};
}
if(process.argv[1]?.endsWith('/space-day.mjs'))generateSpaceDay();
