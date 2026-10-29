/** Browser-safe transition prototype; all solver/model dependencies are injected. */
import * as G from './geometry.mjs';
const key=JSON.stringify,faces=['R','L','U','D','F','B'];
const need=(ok,message)=>{if(!ok)throw Error(message);};
export const tokens=word=>{const out=word.split(/\s+/).filter(Boolean);need(out.every(t=>/^[RLUDFBxyz](2|')?$/.test(t)),'Illegal transition move');return out;};
export const inverse=word=>tokens(word).reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t[0]:t+"'").join(' ');
export function simplify(word){const out=[];for(const t of tokens(word)){const prev=out.at(-1);if(prev?.[0]===t[0]){out.pop();const turns=((prev.endsWith('2')?2:prev.endsWith("'")?3:1)+(t.endsWith('2')?2:t.endsWith("'")?3:1))%4;if(turns)out.push(t[0]+(turns===2?'2':turns===3?"'":''));}else out.push(t);}return out.join(' ');}
export const count=word=>{const t=tokens(word);return {total:t.length,htm:t.filter(t=>faces.includes(t[0])).length,qtm:t.filter(t=>faces.includes(t[0])).reduce((n,t)=>n+(t.endsWith('2')?2:1),0),global:t.filter(t=>!faces.includes(t[0])).length};};
export function shows(state,cells){return G.front.every((p,i)=>{const s=state.find(s=>G.eq(s.p,p)&&G.eq(s.n,[0,0,1]));return s&&s.image===cells[i]&&(!s.image||G.eq(s.up,[0,1,0]));});}
const center=s=>s.p.filter(Boolean).length===1;
const frame=(n,u)=>[n,u,G.cross(n,u)];
const matrix=(src,dst)=>{const a=frame(src.n,src.up),b=frame(dst.n,dst.up);return G.axes.filter((_,i)=>i%2===0).map(v=>[0,1,2].map(k=>a.reduce((sum,av,j)=>sum+G.dot(v,av)*b[j][k],0)));};
export function createTransitionOptimizer({printing,kpuzzle,KPattern,solve,corrections}){
 need(printing.length===54&&new Set(printing.map(s=>s.id)).size===54,'Immutable complete print required');
 const base=kpuzzle.defaultPattern(),positions={},orientation={};
 for(const [orbit,length]of [['CORNERS',8],['EDGES',12]]){
  const ps=Array.from({length},()=>[0,0,0]);
  for(const face of faces){const [axis,layer]=G.faces[face],parts=base.applyMove(face).patternData[orbit].pieces;for(let i=0;i<length;i++)if(parts[i]!==i)ps[i][axis]=layer;}
  positions[orbit]=ps;const table=new Map();orientation[orbit]=table;
  for(let piece=0;piece<length;piece++){
   const queue=[{p:ps[piece],R:[[1,0,0],[0,1,0],[0,0,1]],pattern:base}],seen=new Set();
   for(let i=0;i<queue.length;i++){
    const {p,R,pattern}=queue[i],k=key([p,R]);if(seen.has(k))continue;seen.add(k);
    const at=ps.findIndex(q=>G.eq(q,p));table.set(key([piece,p,R]),pattern.patternData[orbit].orientation[at]);
    for(const face of faces){const marker={id:0,cubie:0,p,n:R[0],up:R[1]},next=G.apply([marker],face)[0];queue.push({p:next.p,R:[next.n,next.up,G.cross(next.n,next.up)],pattern:pattern.applyMove(face)});}
   }need(seen.size===24,'Incomplete rigid orientation mapping');
  }
 }
 const rotations=[{word:'',state:printing.filter(center)}],seen=new Set([key(printing.filter(center).map(s=>s.p))]);
 for(let i=0;i<rotations.length;i++)for(const move of ['x',"x'",'x2','y',"y'",'y2','z',"z'",'z2']){const state=G.apply(rotations[i].state,move),k=key(state.map(s=>s.p));if(!seen.has(k)){seen.add(k);rotations.push({word:[rotations[i].word,move].filter(Boolean).join(' '),state});}}
 need(rotations.length===24,'Global orientation group incomplete');
 const toPattern=state=>{
  need(state.length===54&&state.every((s,i)=>s.id===printing[i].id&&s.cubie===printing[i].cubie&&s.image===printing[i].image),'Transition state changed immutable identities');
  const data={CENTERS:base.patternData.CENTERS};
  for(const [orbit,length]of [['CORNERS',8],['EDGES',12]]){
   const ps=positions[orbit],pieces=Array(length),twists=Array(length);
   for(let piece=0;piece<length;piece++){
    const src=printing.find(s=>G.eq(s.p,ps[piece])),dst=state.find(s=>s.id===src.id),R=matrix(src,dst),at=ps.findIndex(p=>G.eq(p,dst.p));
    need(at>=0&&G.rotations.some(r=>key(r)===key(R)),'Invalid full physical cubie frame');
    for(const a of printing.filter(s=>s.cubie===src.cubie)){const b=state.find(s=>s.id===a.id);need(G.eq(b.p,dst.p)&&G.eq(G.rotate(a.n,R),b.n)&&G.eq(G.rotate(a.up,R),b.up),'Nonrigid source state');}
    pieces[at]=piece;twists[at]=orientation[orbit].get(key([piece,dst.p,R]));need(twists[at]!==undefined,'Unmapped physical orientation');
   }data[orbit]={pieces,orientation:twists};
  }
  return new KPattern(kpuzzle,data);
 };
 const normalize=alg=>simplify(alg.toString().replace(/([RLUDFBxyz])2'/g,'$12'));
 const solved=G.solved(),equalFrames=(a,b)=>a.every((s,i)=>G.eq(s.p,b[i].p)&&G.eq(s.n,b[i].n)&&G.eq(s.up,b[i].up));
 const solverFrames=['','x','y'].map(word=>{
  const transformation=kpuzzle.algToTransformation(word),map={};
  for(const face of faces){const conjugated=G.apply(solved,[word,face,inverse(word)].filter(Boolean).join(' '));map[face]=faces.flatMap(f=>[f,f+"'"]).find(f=>equalFrames(conjugated,G.apply(solved,f)));need(map[face],'Missing conjugated face map');}
  return {word,transformation,map};
 });
 const mapWord=(word,map)=>tokens(word).map(t=>{const mapped=map[t[0]],n=(mapped.endsWith("'")?3:1)*(t.endsWith('2')?2:t.endsWith("'")?3:1)%4;return mapped[0]+(n===2?'2':n===3?"'":'');}).join(' ');
 const cache=new Map();
 const cachedSolve=async(pattern)=>{const k=key([pattern.patternData.CORNERS,pattern.patternData.EDGES]);if(cache.has(k))return cache.get(k);const alg=await solve(pattern);cache.set(k,alg);if(cache.size>512)cache.delete(cache.keys().next().value);return alg;};
 return {
  async plan(from,target,fallbackWord,{maxAttempts=6,timeBudgetMs=500}={}){
   need(Number.isInteger(maxAttempts)&&maxAttempts>=1&&maxAttempts<=6&&Number.isFinite(timeBudgetMs)&&timeBudgetMs>0,'Bounded optimizer parameters required');
   const started=performance.now(),fallback=simplify(fallbackWord),baselineCounts=count(fallback);
   need(shows(G.apply(from,fallback),target.cells),'Fallback does not reach the visible date');
   let word=fallback,method='verified-fallback',attempts=0,error=null;const candidates=[];
   try{
    const goal=G.apply(printing,target.word),frontGoal=goal.find(s=>G.eq(s.p,[0,0,1])&&G.eq(s.n,[0,0,1]));
    need(shows(goal,target.cells),'Invalid canonical target');
    const align=rotations.find(row=>{const centers=G.apply(from.filter(center),row.word);return centers.every(s=>G.eq(s.p,goal.find(t=>t.id===s.id).p));});
    need(align,'Unreachable global center permutation');
    const aligned=G.apply(from,align.word),a=toPattern(aligned).experimentalToTransformation(),b=toPattern(goal).experimentalToTransformation();
    need(a&&b,'Cannot form a unique relative pattern');
    const relative=a.invert().applyTransformation(b);
    frames: for(const solverFrame of solverFrames){
     if(solverFrame.word&&count(word).total<=20)break;
     const conjugated=solverFrame.transformation.invert().applyTransformation(relative).applyTransformation(solverFrame.transformation);
     for(const reverse of [false,true]){
      if(attempts>=maxAttempts||performance.now()-started>=timeBudgetMs)break frames;
      attempts++;
      const solution=await cachedSolve((reverse?conjugated.invert():conjugated).toKPattern()),outer=mapWord(normalize(reverse?solution:solution.invert()),solverFrame.map);
     need(tokens(outer).every(t=>faces.includes(t[0])),'Solver returned a non-outer move');
     let candidate=simplify(align.word+' '+outer),state=G.apply(from,candidate),repairHTM=0;
     need(goal.filter(s=>!center(s)).every(s=>{const t=state.find(t=>t.id===s.id);return G.eq(s.p,t.p)&&G.eq(s.n,t.n)&&G.eq(s.up,t.up);}), 'Relative solver missed a canonical noncenter frame');
     // Hidden center orientations may differ; only the visible center is required.
     const front=state.find(s=>s.id===frontGoal.id);
     if(target.cells[4]&&!G.eq(front.up,[0,1,0])){
      const repair=corrections.find(c=>G.eq(G.apply([front],c.word)[0].up,[0,1,0]));need(repair,'Missing legal center correction');candidate=simplify(candidate+' '+repair.word);repairHTM=count(repair.word).htm;state=G.apply(from,candidate);
     }
     need(shows(state,target.cells),'Optimized physical route misses its target');
     candidates.push({frame:solverFrame.word,reverse,counts:count(candidate),repairHTM});
     if(count(candidate).total<count(word).total){word=candidate;method=reverse?'relative-bidirectional-plus-visible-center':'relative-canonical-cubies-plus-visible-center';}
     }
    }
   }catch(e){error=e.message;}
   return {word,optimized:word!==fallback,method,counts:count(word),baselineCounts,attempts,elapsedMs:performance.now()-started,budgetExceeded:performance.now()-started>timeBudgetMs,error,candidates};
  },
  toPattern,
 };
}
