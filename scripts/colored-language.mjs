import {writeFileSync} from 'node:fs';
import {coupledRequirements} from './experiment.mjs';

// Distinct physical ink categories from the user's binding reference image.
// The colon uses date red; blank stickers have no printed ink.
export function targetInk(slot,symbol) {
  if(symbol===' ')return 'none';
  const row=Math.floor(slot/5);
  return row===0?'weekday-black':row===1?'date-red':row===2?'year-gray':row===3?'separator-lavender':symbol===':'?'date-red':'time-blue';
}
export function coloredProof(language) {
  const r=coupledRequirements(language);
  const convert=([slot,symbol])=>[slot,symbol,targetInk(slot,symbol)];
  const positive=r.positive.map(convert),negative=r.negative.map(convert);
  for(const tokens of [positive,negative]) {
    const types=new Set(tokens.map(([,glyph,color])=>JSON.stringify([glyph,color])));
    if(types.size!==tokens.length)throw new Error('Different roles share a colored glyph; the singleton proof would be invalid');
  }
  const {positiveRequiredTokens:a,negativeRequiredTokens:b,physicalWingCubies:n}=r.counting;
  const lower=Math.ceil((2*(a+b)-r.exceptionalNegativeTokens)/3);
  if(!r.counting.contradiction||lower<=n)throw new Error('No colored wing-cubie contradiction');
  return {
    status:'UNSAT',language,scope:'binding row colors; unchanged layout and abbreviations',
    reason:`At least ${lower} coupled wing cubies are necessary, but a 5x5 has only ${n}.`,
    opticalRelaxation:'All rotations of each glyph are permitted in this impossibility proof; ink color and character identity stay fixed.',
    inkConventions:{weekday:'weekday-black',dateAndMonth:'date-red',year:'year-gray',separators:'separator-lavender',timeDigits:'time-blue',colon:'date-red',blank:'none'},
    validDates:r.validDates,totalDisplays:r.validDates*1440,
    positive,negative,
    neverCooccurs:r.neverCooccurs.map(p=>({positive:convert(p.positive),negative:convert(p.negative)})),
    exceptionalNegativeTokens:r.exceptionalNegativeTokens,
    counting:{...r.counting,minimumWingCubies:lower},
    relaxedMonochromeResult:{file:language==='EN'?'english-monochrome.json':'german-monochrome.json',status:language==='EN'?'UNSAT':'SAT',appliesToRequiredColors:false},
    proof:'docs/SINGLE_LANGUAGE.md',
  };
}
if(process.argv[1]?.endsWith('/colored-language.mjs'))for(const lang of ['EN','DE']) {
  const r=coloredProof(lang),file=lang==='EN'?'english':'german';
  writeFileSync(`results/${file}.json`,JSON.stringify(r,null,2)+'\n');
  console.log(`${lang} with required colors: UNSAT (needs at least ${r.counting.minimumWingCubies} wing cubies; available 24)`);
}
