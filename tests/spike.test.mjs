import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/Display.res.mjs';
import * as G from '../src/Geometry.res.mjs';
import {chirality, stickerComponents, requirements} from '../scripts/experiment.mjs';
const key = s => JSON.stringify([s.position,s.normal]);
const dot = (a,b) => a.reduce((n,x,i)=>n+x*b[i],0);

test('display convention: example, umlaut, leap day, time extremes', () => {
  assert.deepEqual(D.rows('DE',0,26,9,2026,14*60+37), ['MON  ','26OKT',' 2026','─────','14:37']);
  assert.equal(D.rows('DE',4,6,2,2020,0)[1],'06MÄR');
  assert.equal(D.rows('EN',5,29,1,2020,1439)[1],'29FEB');
  assert.equal(D.rows('EN',5,29,1,2020,1439)[4],'23:59');
  assert.equal(D.rows('EN',0,1,0,2020,0)[4],'00:00');
});

test('all generators are rigid, bijective, order four, and preserve chirality', () => {
  const initial=G.solved(), slots=new Set(initial.map(key));
  assert.equal(slots.size,150);
  for(let axis=0;axis<3;axis++) for(const layer of [-2,-1,1,2]) {
    const moved=G.turn(initial,axis,layer), groups=new Map();
    assert.equal(new Set(moved.map(key)).size,150);
    for(const s of moved) {
      const original=initial[s.id];
      assert.ok(slots.has(key(s)));
      assert.equal(G.orbit(s.position),G.orbit(original.position));
      assert.equal(dot(s.up,s.normal),0);
      assert.equal(dot(s.up,s.up),1);
      const piece=original.position.join(',');
      if(groups.has(piece)) assert.deepEqual(s.position,groups.get(piece));
      groups.set(piece,s.position);
      if(G.orbit(s.position)==='wings') assert.equal(chirality(s),chirality(original));
      if(G.orbit(s.position)==='fixedCenters') assert.deepEqual(s.position,original.position);
    }
    let state=moved;
    for(let i=0;i<3;i++) state=G.turn(state,axis,layer);
    assert.deepEqual(state,initial);
  }
});

test('wing coupling has opposite chirality; swapping its stickers is forbidden', () => {
  const wings=G.solved().filter(s=>G.orbit(s.position)==='wings');
  const groups=Map.groupBy(wings,s=>s.position.join(','));
  assert.equal(groups.size,24);
  for(const piece of groups.values()) {
    assert.equal(piece.length,2);
    assert.equal(chirality(piece[0]),-chirality(piece[1]));
  }
});

test('labeled sticker action splits wings into two 24-sticker orbits', () => {
  const components=stickerComponents();
  assert.equal(components.reduce((n,c)=>n+c.size,0),150);
  assert.deepEqual(components.filter(c=>c.pieceClass==='wings').map(c=>[c.size,c.frontSlots]),[[24,[1,9,15,23]],[24,[3,5,19,21]]]);
});

test('refined inventory catches obstruction hidden by pooled 115 estimate', () => {
  const req=requirements({positive:[1,9,15,23]});
  assert.equal(req.dates,10958);
  assert.equal(req.orbits.positive.lowerBound,26);
  assert.equal(req.orbits.positive.symbols.I,2);
  assert.equal(req.orbits.positive.symbols.R,2);
});

test('single-language inventory selection does not accidentally mix locales', async () => {
  const {coupledRequirements} = await import('../scripts/experiment.mjs');
  const english=coupledRequirements('EN');
  const german=coupledRequirements('DE');
  assert.equal(english.counting.positiveRequiredTokens,23);
  assert.equal(german.counting.positiveRequiredTokens,21);
  for(const r of [english,german]) {
    assert.equal(r.counting.negativeRequiredTokens,16);
    assert.deepEqual(r.neverCooccurs,[{positive:[9,'B'],negative:[5,'3']}]);
    assert.equal(r.counting.contradiction,true);
  }
  assert.throws(()=>requirements(undefined,[]),/locale/);
  assert.throws(()=>requirements(undefined,['FR']),/locale/);
});

test('English peak-inventory proof survives completely unrestricted rotations', async () => {
  const {peakProof}=await import('../scripts/wing-proof.mjs');
  const en=peakProof('EN'),de=peakProof('DE');
  assert.equal(en.contradiction,true);
  assert.deepEqual(en.branches.map(b=>[b.minimumTightB,b.maximumNonTightA+b.maximumExceptionalPairs]),[[4,3],[5,4]]);
  assert.equal(de.contradiction,false);
});

test('one shared glyph model and a fixed full German design', async () => {
  const glyphs=await import('../src/Glyphs.res.mjs');
  const {constructGerman,matchPieces,projectedTargets}=await import('../scripts/german-design.mjs');
  assert.deepEqual(glyphs.quarterTurns('0'),[0,1,2,3]);
  assert.deepEqual(glyphs.quarterTurns('O'),[0,2]);
  assert.deepEqual(glyphs.quarterTurns('I'),[0,2]);
  assert.deepEqual(glyphs.quarterTurns('R'),[0]);
  const d=constructGerman();
  assert.equal(d.stickers.length,150);
  assert.equal(new Set(d.stickers.map(s=>s.id)).size,150);
  for(const target of projectedTargets('wings'))assert.ok(matchPieces(d.packings.wings.pieces,target));
  assert.equal(d.packings.wings.projectedTargets,9360);
});

test('binding ink colors forbid reusing red zero as blue zero, without banning rotations', async () => {
  const {coloredProof,targetInk}=await import('../scripts/colored-language.mjs');
  assert.notEqual(targetInk(5,'0'),targetInk(21,'0'));
  assert.equal(targetInk(22,':'),'date-red');
  const en=coloredProof('EN'),de=coloredProof('DE');
  assert.equal(en.status,'UNSAT');
  assert.equal(de.status,'UNSAT');
  assert.equal(en.counting.minimumWingCubies,26);
  assert.equal(de.counting.minimumWingCubies,25);
  assert.equal(de.counting.minimumNegativeSingletons,8);
  assert.equal(de.counting.maximumNegativeSingletons,7);
});

test('palette variants share only the required date/time digits and keep year optional', async () => {
  const {variants,inkAt,classify}=await import('../scripts/palette-analysis.mjs');
  assert.equal(inkAt(variants.minimal,5,'0'),inkAt(variants.minimal,21,'0'));
  assert.notEqual(inkAt(variants.minimal,12,'0'),inkAt(variants.minimal,21,'0'));
  assert.notEqual(inkAt(variants.minimal,1,'I'),inkAt(variants.minimal,9,'I'));
  assert.equal(classify(variants.B_originalDigitColors),'UNSAT');
  assert.equal(classify(variants.B),'UNKNOWN');
  assert.equal(classify(variants.A),'UNKNOWN'); // no SAT before independent physical verification
  assert.equal(classify(variants.C),'UNKNOWN');
  assert.deepEqual([variants.minimalChange.monthLetters,variants.minimalChange.dateDigits],['date-red','time-blue']);
});

test('all original four-color coarsenings are covered on one branch of the palette analysis', async () => {
  const {partitions,originalClassPalette,classify}=await import('../scripts/palette-analysis.mjs');
  const all=partitions(4);
  assert.equal(all.length,15);
  assert.equal(new Set(all.map(JSON.stringify)).size,15);
  const candidates=all.filter(p=>classify(originalClassPalette(p))==='UNKNOWN');
  assert.equal(candidates.length,5);
  assert.deepEqual(candidates.filter(p=>new Set(p).size===3),[[0,1,2,1]]);
});

test('space-padded days preserve five columns, real day digits, and the original zero mode', () => {
  const row=day=>D.rowsWithDayPadding('DE',5,day,9,2026,14*60+37,true)[1];
  assert.equal(row(1),' 1OKT');
  assert.equal(row(3),' 3OKT');
  assert.equal(row(9),' 9OKT');
  assert.equal(row(10),'10OKT');
  assert.equal(row(31),'31OKT');
  assert.equal(D.rows('DE',5,3,9,2026,0)[1],'03OKT');
});

test('the space-day print is immutable and moves the shared wing resource from zeros to blanks', async () => {
  const {constructSpaceDay}=await import('../scripts/space-day.mjs');
  const {constructGerman}=await import('../scripts/german-design.mjs');
  const base={design:constructGerman(),conventions:{}};
  const before=JSON.stringify(base);
  const variant=constructSpaceDay(base);
  assert.equal(JSON.stringify(base),before);
  assert.equal(variant.status,'UNKNOWN');
  assert.equal(variant.fixedWingGlyphChanges.length,5);
  const blank=variant.fixedWingGlyphChanges.filter(c=>c.to===' ');
  assert.equal(blank.length,3);
  for(const c of blank)assert.equal(variant.design.stickers[c.id].ink,'none');
  const zeros=variant.fixedWingGlyphChanges.filter(c=>c.to==='0');
  assert.equal(zeros.length,2);
  for(const c of zeros)assert.equal(variant.design.stickers[c.id].ink,'time-blue');
  assert.notEqual(variant.palette.dateDigits,variant.palette.timeDigits);
});

test('English space-day impossibility is recalculated with two blanks instead of two zeros', async () => {
  const {peakProof}=await import('../scripts/wing-proof.mjs');
  const r=peakProof('EN','space');
  assert.equal(r.requiredB['0'],1);
  assert.equal(r.requiredB[' '],2);
  assert.equal(r.contradiction,true);
  assert.equal(peakProof('EN','zero').requiredB['0'],2);
});

test('hour padding and trimmed separator retain five columns and all minute digits', () => {
  const rows=minute=>D.rowsWithFormat('DE',5,3,9,2026,minute,true,true,true);
  assert.deepEqual(rows(9*60+33),['SAM  ',' 3OKT',' 2026',' ─── ',' 9:33']);
  assert.equal(rows(0)[4],' 0:00');
  assert.equal(rows(9*60+3)[4],' 9:03');
  assert.equal(rows(10*60)[4],'10:00');
  assert.equal(rows(23*60+59)[4],'23:59');
  assert.equal(D.rowsWithFormat('DE',5,3,9,2026,9*60+33,true,false,true)[4],'09:33');
  assert.equal(D.rowsWithFormat('DE',5,3,9,2026,9*60+33,true,true,false)[3],'─────');
  for(let minute=0;minute<1440;minute++)for(const row of rows(minute))assert.equal([...row].length,5);
});

test('short separator replaces wing printing with blanks and preserves the three center dashes', async () => {
  const {constructGerman}=await import('../scripts/german-design.mjs');
  const {constructSpaceDay}=await import('../scripts/space-day.mjs');
  const {constructCompact}=await import('../scripts/compact-formats.mjs');
  const source=constructSpaceDay({design:constructGerman(),conventions:{}});
  const before=JSON.stringify(source);
  const candidate=constructCompact(source,{hourPadding:'space',separatorStyle:'three'});
  assert.equal(JSON.stringify(source),before);
  assert.equal(candidate.status,'UNKNOWN');
  const old=source.design.stickers;
  const wings=old.filter(s=>G.orbit(s.position)==='wings'&&s.symbol==='─');
  assert.equal(wings.length,4);
  for(const s of wings){assert.equal(candidate.design.stickers[s.id].symbol,' ');assert.equal(candidate.design.stickers[s.id].ink,'none');}
  const centers=old.filter(s=>G.orbit(s.position)!=='wings'&&s.symbol==='─');
  assert.equal(centers.length,3);
  for(const s of centers)assert.equal(candidate.design.stickers[s.id].symbol,'─');
  assert.notEqual(candidate.palette.dateDigits,candidate.palette.timeDigits);
});

test('trimmed-separator English proof recomputes blank multiplicity and paired-wing demand', async () => {
  const {compactEnglishProof,fields,finePalette}=await import('../scripts/compact-formats.mjs');
  const p=compactEnglishProof();
  assert.equal(p.required.A['[-1," "]'],1);
  assert.equal(p.required.B['[-1," "]'],3);
  assert.equal(p.counting.minimumTightB,6);
  assert.equal(p.counting.maximumLooseA+p.counting.maximumExceptionalPairs,3);
  assert.equal(p.counting.contradiction,true);
  assert.equal(new Set(fields.map(f=>finePalette[f])).size,7);
});

test('wordmark candidate fixes three distinct oriented center images without changing other printing', async () => {
  const {readFileSync}=await import('node:fs');
  const {constructWordmark}=await import('../scripts/wordmark.mjs');
  const source=JSON.parse(readFileSync(new URL('../results/german-short-separator.json',import.meta.url),'utf8'));
  const before=JSON.stringify(source);
  const r=constructWordmark(source);
  assert.equal(JSON.stringify(source),before);
  assert.equal(r.status,'UNKNOWN'); // branding must be independently certified
  assert.deepEqual(r.row4Artwork,['wordmark:left','wordmark:middle','wordmark:right']);
  assert.equal(r.wordmark.fragmentStickers.length,3);
  assert.deepEqual(r.wordmark.fragmentStickers.map(s=>s.pieceClass).sort(),['axialCenters','diagonalCenters','diagonalCenters']);
  const changed=r.design.stickers.filter((s,i)=>s.symbol!==source.design.stickers[i].symbol);
  assert.equal(changed.length,3);
  for(const s of changed){assert.deepEqual(r.glyphModel.quarterTurns[s.symbol],[0]);assert.deepEqual(s.up,source.design.stickers[s.id].up);}
  assert.equal(new Set(changed.map(s=>s.position.join(','))).size,3);
});

test('split-century year rows keep the fixed center blank for past and future years', () => {
  for(const [year,row] of [[1,' 0 01'],[789,' 7 89'],[1989,'19 89'],[2026,'20 26'],[2799,'27 99']]) {
    assert.equal(D.splitYearRow(year),row);
    assert.equal(row.length,5);
    assert.equal(row[2],' ');
  }
});
