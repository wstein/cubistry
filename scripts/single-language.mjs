import {writeFileSync,mkdirSync} from 'node:fs';
import {requirements,slots,wingRoles,coupledRequirements} from './experiment.mjs';
import {peakProof} from './wing-proof.mjs';
import * as Glyphs from '../src/Glyphs.res.mjs';
import {constructGerman} from './german-design.mjs';

const args=process.argv.slice(2);
if(args.length>1 || args.some(x=>!['EN','DE'].includes(x)))throw new Error('Usage: single-language.mjs [EN|DE]');
for(const language of args.length?args:['EN','DE']) {
  const req=requirements(slots,[language]);
  const refined=requirements(wingRoles,[language]);
  const peak=peakProof(language);
  const report={
    status:peak.contradiction?'UNSAT':'UNKNOWN',language,
    reason:peak.contradiction?'Orientation-free paired wing-sticker inventory contradiction.':'Constructive design awaits independent physical-reachability certification.',
    glyphModel:{quarterTurns:Object.fromEntries([...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÄ─: '].map(s=>[s,Glyphs.quarterTurns(s)])),definitions:{'0':'centered circle','O':'centered elongated ellipse','I':'centered vertical bar','─':'centered horizontal bar',' ':'empty'},scope:'identical convention for EN and DE; additional unused symmetries may be admitted'},
    conventions:{rotation:'optically identical rotations allowed; font not otherwise fixed',symbol:'one immutable glyph; no reinterpretation as a different character',layout:'unchanged'},
    validDates:req.dates,totalDisplays:req.dates*1440,
    orbits:req.orbits,pooledInventoryLowerBound:Object.values(req.orbits).reduce((n,o)=>n+o.lowerBound,0),
    wingStickerOrbits:Object.fromEntries(Object.entries(refined.orbits).map(([name,o])=>[name,{...o,availableStickers:24}])),
    uprightOnly:{status:'UNSAT',scope:'conditional; not assumed for the primary result',...coupledRequirements(language)},
    orientationFreeWingProof:peak,
    proof:'docs/SINGLE_LANGUAGE.md',
  };
  if(language==='DE')report.design=constructGerman();
  mkdirSync('results',{recursive:true});
  const filename=language==='EN'?'english':'german';
  writeFileSync(`results/${filename}.json`,JSON.stringify(report,null,2)+'\n');
  console.log(`${language}: ${report.status}${language==='DE'?' pending independent group and design verification':''}`);
}
