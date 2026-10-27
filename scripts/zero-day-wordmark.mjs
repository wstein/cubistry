// New joint printing: no leading-day-space witness is presumed to work.
import {readFileSync,writeFileSync} from 'node:fs';
import * as G from '../src/Geometry.res.mjs';
import {chirality} from './experiment.mjs';
import {printing,projectedTargets} from './german-design.mjs';
import {inkAt,printQuarter} from './palette-analysis.mjs';
const source=JSON.parse(readFileSync('results/german-wordmark.json','utf8'));
const pairs=[];
const add=(a,c,b,d)=>pairs.push([{symbol:c,slots:a},{symbol:d,slots:b}]);
// Three duplicated A types pair with six mutually exclusive hour-unit types.
for(const [a,c,digits] of [[[15],' ','01'],[[23],'0','23'],[[23],'1','45']])
  for(const d of digits)add(a,c,[21],d);
// February and day tens 3 never coexist in the actual calendar.
add([9],'B',[5],'3');
// Every remaining doubled B digit pairs with mutually exclusive A roles.
for(const [slot,chars,b,d] of [[1,'AR',5,'0'],[1,'OI',5,'1'],[9,'TL',5,'2'],[9,'VR',21,'6'],[9,'GN',21,'7'],[23,'23',21,'8'],[23,'45',21,'9']])
  for(const c of chars)add([slot],c,[b],d);
// Both outer B blanks are simultaneous; three copies suffice because their
// partners are three mutually exclusive month-ending letters.
for(const c of 'IZP')add([9],c,[3,19],' ');
if(pairs.length!==24)throw Error('24 physical wings required');
const r={status:'UNKNOWN',language:'DE',dayPadding:'zero',hourPadding:'zero',separatorStyle:'three',
  validDates:10958,totalDisplays:10958*1440,palette:source.palette,glyphModel:source.glyphModel,
  row4Artwork:source.row4Artwork,wordmark:source.wordmark,
  conventions:{layout:'Zero-padded day and hour; blank, three upright immutable logo images, blank in row 4.',printing:'One fixed glyph/image, ink, and print frame per labeled sticker; no recoloring.'},
  sourceDesign:'german-wordmark.json; all wing printing jointly replaced',
  proof:'docs/ZERO_DAY_WORDMARK.md',design:structuredClone(source.design)};
const physical=[...Map.groupBy(r.design.stickers.filter(s=>G.orbit(s.position)==='wings'),s=>s.position.join(',')).values()];
physical.forEach((stickers,i)=>{
  stickers.sort((a,b)=>chirality(b)-chirality(a));
  stickers.forEach((s,j)=>{
    const t=pairs[i][j],p=printing(s,t);
    p.ink=inkAt(r.palette,t.slots[0],t.symbol);
    r.design.stickers[s.id]=p;
  });
});
r.design.packings.wings.pieces=pairs;
for(const klass of Object.keys(r.design.packings))r.design.packings[klass].projectedTargets=projectedTargets(klass,{dayPadding:'zero',hourPadding:'zero',separatorStyle:'three'}).length;
writeFileSync('results/german-zero-day-wordmark.json',JSON.stringify(r,null,2)+'\n');
const initial=G.solved(),quote=x=>'"'+String(x).replaceAll('"','""')+'"';
const csv=['id,face,row,col,image_or_glyph,ink_or_image_asset_group,print_rotation_ccw_degrees,planned_front_slots',...r.design.stickers.map(s=>[s.id,['U','D','F','B','R','L'][Math.floor(s.id/25)],Math.floor(s.id%25/5)+1,s.id%5+1,s.symbol===' '?'BLANK':s.symbol,s.ink,90*printQuarter(initial[s.id],s),s.targetSlots.map(i=>`${Math.floor(i/5)+1}:${i%5+1}`).join('|')].map(quote).join(','))].join('\n')+'\n';
writeFileSync('results/german-zero-day-wordmark-printing.csv',csv);
console.log('Generated zero-padded German date, distinct original inks, upright three-piece wordmark candidate.');
