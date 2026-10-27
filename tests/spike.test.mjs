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
