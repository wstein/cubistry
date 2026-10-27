import {writeFileSync, mkdirSync} from 'node:fs';
import * as Display from '../src/Display.res.mjs';
import * as Geometry from '../src/Geometry.res.mjs';

export const names = ['corners', 'wings', 'middleEdges', 'axialCenters', 'diagonalCenters', 'fixedCenters'];
export const capacities = {corners: 24, wings: 48, middleEdges: 24, axialCenters: 24, diagonalCenters: 24, fixedCenters: 1};
export const slots = Object.fromEntries(names.map(name => [name, Array.from({length: 25}, (_, i) => i).filter(i => Display.orbit(Math.floor(i / 5), i % 5) === name)]));
export const counts = chars => {
  const result = {};
  for (const char of chars) result[char] = (result[char] ?? 0) + 1;
  return result;
};
const mergeMax = (a, b) => {
  for (const [char, n] of Object.entries(b)) a[char] = Math.max(a[char] ?? 0, n);
};
export function requirements(selectedSlots = slots, languages = ['DE', 'EN']) {
  if (!languages.length || languages.some(l => !['DE','EN'].includes(l))) throw new Error('Unsupported locale selection');
  const groupNames = Object.keys(selectedSlots);
  const dateMax = Object.fromEntries(groupNames.map(n => [n, {}]));
  const timeMax = Object.fromEntries(groupNames.map(n => [n, {}]));
  const datePatterns = Object.fromEntries(groupNames.map(n => [n, new Set()]));
  const timePatterns = Object.fromEntries(groupNames.map(n => [n, new Set()]));
  let dates = 0;
  const start = Date.UTC(2020, 0, 1), end = Date.UTC(2050, 0, 1);
  for (let ms = start; ms < end; ms += 86400000) {
    dates++;
    const d = new Date(ms);
    for (const language of languages) {
      const chars = [...Display.rows(language, (d.getUTCDay() + 6) % 7, d.getUTCDate(), d.getUTCMonth(), d.getUTCFullYear(), 0).slice(0, 4).join('')];
      if (chars.length !== 20) throw new Error('Bad Unicode row width');
      for (const name of groupNames) {
        const projection = selectedSlots[name].filter(i => i < 20).map(i => chars[i]);
        mergeMax(dateMax[name], counts(projection));
        datePatterns[name].add(projection.join(''));
      }
    }
  }
  for (let minute = 0; minute < 1440; minute++) {
    const chars = [...Display.rows('EN', 0, 1, 0, 2020, minute)[4]];
    for (const name of groupNames) {
      const projection = selectedSlots[name].filter(i => i >= 20).map(i => chars[i - 20]);
      mergeMax(timeMax[name], counts(projection));
      timePatterns[name].add(projection.join(''));
    }
  }
  // Exact for this necessary bound: dates (including locale) and minutes
  // vary independently. Max_d,t (a_d + b_t) = max_d a_d + max_t b_t.
  const orbits = Object.fromEntries(groupNames.map(name => {
    const symbols = Object.fromEntries([...new Set([...Object.keys(dateMax[name]), ...Object.keys(timeMax[name])])].sort().map(char => [char, (dateMax[name][char] ?? 0) + (timeMax[name][char] ?? 0)]));
    return [name, {frontSlots: selectedSlots[name], availableStickers: capacities[name], symbols, lowerBound: Object.values(symbols).reduce((a,b) => a+b, 0), dateProjections: datePatterns[name].size, timeProjections: timePatterns[name].size}];
  }));
  return {dates, languages, orbits, datePatterns, timePatterns};
}

export function moveEvidence() {
  const initial = Geometry.solved();
  const key = v => v.join(',');
  const cubies = [...new Map(initial.map(s => [key(s.position), s.position])).values()];
  const byOrbit = Object.fromEntries(names.map(name => [name, cubies.filter(p => Geometry.orbit(p) === name)]));
  const parity = perm => {
    let n = 0;
    for (let i=0;i<perm.length;i++) for (let j=i+1;j<perm.length;j++) n ^= Number(perm[i]>perm[j]);
    return n;
  };
  const generators = [];
  for (let axis=0;axis<3;axis++) for (const layer of [-2,-1,1,2]) {
    const moved = Geometry.turn(initial,axis,layer);
    const signs = {};
    for (const name of names) {
      const positions = byOrbit[name].map(key);
      const destinations = new Map(moved.map(s => [key(initial[s.id].position),key(s.position)]));
      signs[name] = parity(positions.map(p => positions.indexOf(destinations.get(p))));
    }
    generators.push({axis,layer,parity:signs});
  }
  return {cubieCounts:Object.fromEntries(names.map(n => [n,byOrbit[n].length])), stickerCount:initial.length,generators};
}
// A wing sticker has chirality det(n,m,q), where n is its outward
// normal, m is its cubie's other outward normal, and q=p-2n-2m.
// Every legal turn is a proper rotation, preserving this determinant.
export function chirality(sticker) {
  const {position:p, normal:n} = sticker;
  if (Geometry.orbit(p) !== 'wings') throw new Error('Not a wing');
  const m = p.map((v,i) => Math.abs(v) === 2 && n[i] === 0 ? Math.sign(v) : 0);
  const q = p.map((v,i) => v - 2*n[i] - 2*m[i]);
  return n[0]*(m[1]*q[2]-m[2]*q[1]) + n[1]*(m[2]*q[0]-m[0]*q[2]) + n[2]*(m[0]*q[1]-m[1]*q[0]);
}
export function stickerComponents() {
  const initial = Geometry.solved();
  const key = s => JSON.stringify([s.position,s.normal]);
  const index = new Map(initial.map((s,i) => [key(s),i]));
  const generators = [];
  for (let axis=0;axis<3;axis++) for (const layer of [-2,-1,1,2])
    generators.push(Geometry.turn(initial,axis,layer).map(s => index.get(key(s))));
  const seen = new Set(), components = [];
  for (let i=0;i<150;i++) if (!seen.has(i)) {
    const ids=[i]; seen.add(i);
    for (let k=0;k<ids.length;k++) for (const g of generators) {
      const j=g[ids[k]];
      if (!seen.has(j)) {seen.add(j);ids.push(j);}
    }
    components.push({pieceClass:Geometry.orbit(initial[i].position),size:ids.length,stickerIds:ids.sort((a,b)=>a-b),frontSlots:ids.filter(j=>j>=50&&j<75).map(j=>j-50).sort((a,b)=>a-b)});
  }
  return components;
}
export function run() {
  const req = requirements();
  const components = stickerComponents();
  const wingComponents = components.filter(c=>c.pieceClass==='wings');
  const refined = requirements(Object.fromEntries(wingComponents.map((c,i)=>['wing'+i,c.frontSlots])));
  const wingStickerOrbits = wingComponents.map((c,i)=>({...c,...refined.orbits['wing'+i],availableStickers:c.size,chirality:chirality(Geometry.solved()[c.stickerIds[0]])}));
  const obstruction = wingStickerOrbits.find(o=>o.lowerBound>o.availableStickers);
  if (!obstruction) throw new Error('Expected capacity obstruction was not reproduced');
  const report = {
    status:'UNSAT',
    reason:'An invariant wing-sticker orbit has only 24 stickers but requires at least 26 immutable printed symbols.',
    conventions:{blank:' ',separator:'─',glyphs:'upright; obstruction holds even if glyph rotation is ignored',frame:'fixed core; front is +Z',weekdaysDE:Display.weekdaysDE,weekdaysEN:Display.weekdaysEN,monthsDE:Display.monthsDE,monthsEN:Display.monthsEN},
    validDates:req.dates,
    totalDisplays:req.dates * 2 * 1440,
    orbits:req.orbits,
    pooledInventoryLowerBound:Object.values(req.orbits).reduce((a,o)=>a+o.lowerBound,0),
    totalPhysicalStickers:150,
    fixedCentersNotUsedOnFront:5,
    wingStickerOrbits,
    obstruction:{chirality:obstruction.chirality,frontSlots:obstruction.frontSlots,required:obstruction.lowerBound,available:obstruction.availableStickers},
    geometry:moveEvidence(),
    stickerComponents:components,
    proof:'docs/FEASIBILITY.md',
  };
  mkdirSync('results',{recursive:true});
  writeFileSync('results/feasibility.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,validDates:report.validDates,totalDisplays:report.totalDisplays,pooledLowerBound:report.pooledInventoryLowerBound,obstruction:report.obstruction},null,2));
  return report;
}


// A fixed upright sticker can serve at most one front slot: p·up and
// p·(up×normal) are invariant under every rigid turn. Once normal=+Z and
// up=+Y, they uniquely determine the front row and column.
export const wingRoles = {positive:[1,9,15,23], negative:[3,5,19,21]};
const token = (slot, symbol) => JSON.stringify([slot,symbol]);
export function coupledRequirements(language) {
  if (!['EN','DE'].includes(language)) throw new Error('Unsupported locale');
  const domains = {positive:new Set(),negative:new Set()};
  const dateDomains = {positive:new Set(),negative:new Set()};
  const timeDomains = {positive:new Set(),negative:new Set()};
  const cooccurs = new Set();
  const pairKey = (a,b) => JSON.stringify([a,b]);
  const record = (text, isTime) => {
    const active = {};
    for(const side of ['positive','negative']) {
      active[side] = wingRoles[side].filter(i=>(i>=20)===isTime).map(i=>token(i,text[isTime?i-20:i]));
      for(const t of active[side]) {
        domains[side].add(t);
        (isTime?timeDomains:dateDomains)[side].add(t);
      }
    }
    for(const a of active.positive) for(const b of active.negative) cooccurs.add(pairKey(a,b));
  };
  let validDates = 0;
  for(let ms=Date.UTC(2020,0,1);ms<Date.UTC(2050,0,1);ms+=86400000) {
    validDates++;
    const d=new Date(ms);
    record([...Display.rows(language,(d.getUTCDay()+6)%7,d.getUTCDate(),d.getUTCMonth(),d.getUTCFullYear(),0).slice(0,4).join('')],false);
  }
  for(let minute=0;minute<1440;minute++) record([...Display.rows(language,0,1,0,2020,minute)[4]],true);
  // Cross date/time pairs are possible because all minutes are required for
  // every valid date. Date/date and time/time correlations were kept above.
  for(const a of dateDomains.positive) for(const b of timeDomains.negative) cooccurs.add(pairKey(a,b));
  for(const a of timeDomains.positive) for(const b of dateDomains.negative) cooccurs.add(pairKey(a,b));
  const positive=[...domains.positive].sort().map(JSON.parse);
  const negative=[...domains.negative].sort().map(JSON.parse);
  const neverCooccurs=[];
  for(const a of positive) for(const b of negative) if(!cooccurs.has(pairKey(JSON.stringify(a),JSON.stringify(b)))) neverCooccurs.push({positive:a,negative:b});
  const exceptionalNegativeTokens=new Set(neverCooccurs.map(p=>JSON.stringify(p.negative))).size;
  const N=24, a=positive.length, b=negative.length;
  const minimumNegativeSingletons=2*b-N;
  const maximumNonessentialPositiveStickers=2*(N-a);
  const maximumNegativeSingletons=maximumNonessentialPositiveStickers+exceptionalNegativeTokens;
  return {validDates,positive,negative,neverCooccurs,exceptionalNegativeTokens,
    counting:{physicalWingCubies:N,positiveRequiredTokens:a,negativeRequiredTokens:b,positiveSlack:N-a,
      minimumNegativeSingletons,maximumNonessentialPositiveStickers,maximumNegativeSingletons,
      contradiction:minimumNegativeSingletons>maximumNegativeSingletons}};
}
if (process.argv[1]?.endsWith('/experiment.mjs')) run();
