import * as G from '../src/Geometry.res.mjs';
import * as D from '../src/Display.res.mjs';
import {chirality} from './experiment.mjs';

export const frontSlots={corners:[0,4,20,24],middleEdges:[2,10,14,22],axialCenters:[7,11,13,17],diagonalCenters:[6,8,16,18],wings:[1,9,15,23,3,5,19,21]};
export function projectedTargets(pieceClass) {
  const slots=frontSlots[pieceClass],date=new Set(),time=new Set();
  for(let ms=Date.UTC(2020,0,1);ms<Date.UTC(2050,0,1);ms+=86400000) {
    const d=new Date(ms), f=[...D.rows('DE',(d.getUTCDay()+6)%7,d.getUTCDate(),d.getUTCMonth(),d.getUTCFullYear(),0).join('')];
    date.add(slots.filter(i=>i<20).map(i=>f[i]).join(''));
  }
  for(let minute=0;minute<1440;minute++) {
    const f=[...D.rows('DE',0,1,0,2020,minute)[4]];
    time.add(slots.filter(i=>i>=20).map(i=>f[i-20]).join(''));
  }
  // Keep tuple order according to slots even if time/date slots interleave.
  return [...date].flatMap(d=>[...time].map(t=>{let di=0,ti=0;return slots.map(i=>[i,i<20?d[di++]:t[ti++]]);}));
}
const tokenKey=t=>JSON.stringify(t);
export function matchPieces(pieces,target) {
  const candidates=target.map(([slot,symbol])=>pieces.flatMap((tokens,i)=>tokens.some(t=>t.symbol===symbol&&t.slots.includes(slot))?[i]:[]));
  const order=candidates.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length);
  const used=new Set(),solution=Array(target.length);
  const dfs=k=>{
    if(k===order.length)return true;
    const i=order[k];
    for(const p of candidates[i])if(!used.has(p)){
      used.add(p);solution[i]=p;
      if(dfs(k+1))return true;
      used.delete(p);
    }
    return false;
  };
  return dfs(0)?solution:null;
}
function pack(pieceClass,width,n) {
  const targets=projectedTargets(pieceClass);
  const domain=[...new Set(targets.flat().map(tokenKey))].sort().map(JSON.parse);
  const inventory=domain.map(([slot,symbol])=>({symbol,slots:[slot]}));
  let seed=26052020;
  const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let attempt=0;attempt<50000;attempt++) {
    const bag=[...inventory];
    while(bag.length<width*n)bag.push(inventory[random(inventory.length)]);
    for(let i=bag.length-1;i>0;i--){const j=random(i+1);[bag[i],bag[j]]=[bag[j],bag[i]];}
    const pieces=Array.from({length:n},(_,i)=>bag.slice(i*width,(i+1)*width));
    if(targets.every(t=>matchPieces(pieces,t)!==null))return {pieces,attempts:attempt+1,projectedTargets:targets.length};
  }
  throw new Error(`No ${pieceClass} packing found; no UNSAT conclusion`);
}
function wingPacking() {
  const pairs=[];
  const add=(a,as,b,bs)=>pairs.push([{symbol:as,slots:[a]}, {symbol:bs,slots:Array.isArray(b)?b:[b]}]);
  add(15,'─',21,'1');add(15,'─',21,'2');
  add(1,'O',21,'3');add(1,'O',21,'4');
  add(1,'I',5,'1');add(1,'I',5,'2');
  add(9,'B',5,'3');
  for(const s of ['N','R','I'])add(9,s,[5,21],'0');
  for(const s of ['A','R'])add(1,s,3,' ');
  for(const s of ['L','G'])add(9,s,19,'─');
  for(const s of ['P','T'])add(9,s,21,'5');
  for(const s of ['V','Z'])add(9,s,21,'6');
  for(const s of ['0','1'])add(23,s,21,'7');
  for(const s of ['2','3'])add(23,s,21,'8');
  for(const s of ['4','5'])add(23,s,21,'9');
  const targets=projectedTargets('wings');
  if(!targets.every(t=>matchPieces(pairs,t)!==null))throw new Error('Wing construction fails');
  return {pieces:pairs,projectedTargets:targets.length};
}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const units=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const rotations=units.flatMap(x=>units.filter(y=>dot(x,y)===0).map(y=>[x,y,cross(x,y)]));
const rotate=(v,R)=>[0,1,2].map(i=>v.reduce((s,x,j)=>s+x*R[j][i],0));
const eq=(a,b)=>a.every((x,i)=>x===b[i]);
function printing(sticker,token) {
  const slot=token.slots[0],p=[slot%5-2,2-Math.floor(slot/5),2];
  const R=rotations.find(R=>eq(rotate(sticker.position,R),p)&&eq(rotate(sticker.normal,R),[0,0,1]));
  if(!R)throw new Error('Printing role is not geometrically reachable');
  return {...sticker,symbol:token.symbol,up:R.map(col=>col[1]),targetSlots:token.slots};
}
export function constructGerman() {
  const initial=G.solved();
  const design=initial.map(s=>({...s,symbol:' ',targetSlots:[]}));
  const packings={corners:pack('corners',3,8),middleEdges:pack('middleEdges',2,12),wings:wingPacking()};
  for(const pieceClass of ['corners','middleEdges','wings']) {
    const pieces=[...Map.groupBy(initial.filter(s=>G.orbit(s.position)===pieceClass),s=>s.position.join(',')).values()];
    pieces.forEach((stickers,i)=>{
      if(pieceClass==='wings')stickers.sort((a,b)=>chirality(b)-chirality(a));
      stickers.forEach((s,j)=>{design[s.id]=printing(s,packings[pieceClass].pieces[i][j]);});
    });
  }
  for(const pieceClass of ['axialCenters','diagonalCenters']) {
    const tokens=[...new Set(projectedTargets(pieceClass).flat().map(tokenKey))].sort().map(JSON.parse);
    const stickers=initial.filter(s=>G.orbit(s.position)===pieceClass);
    tokens.forEach(([slot,symbol],i)=>{design[stickers[i].id]=printing(stickers[i],{symbol,slots:[slot]});});
    packings[pieceClass]={projectedTargets:projectedTargets(pieceClass).length};
  }
  design[62]={...design[62],symbol:'0',targetSlots:[12]};
  return {font:{zero:'centered circular ring, invariant under every in-plane quarter turn',otherGlyphs:'distinct single symbols, used only upright; no 6/9 substitution',O:'distinct from the circular zero, e.g. an elongated oval'},stickers:design,packings};
}
