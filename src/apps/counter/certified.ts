import { demand, deepFreeze, record, validatePrint, stateEquals, type PrintDefinition, type CubeState, type LegalMove } from "@cubistry/cube-core";
import { initialState, applyMoves, parseAlg, matchesTarget } from "@cubistry/cube-mechanics";
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
import { targetFor, type CounterDesign, type CounterVariant } from "./design.ts";
/**
 * One stored counting route on one permanent print. The titled route has 99
 * edges (00..99, no wrap); a cyclic route has 100 edges including 99->00, and
 * its states close on the exact start state.
 */
export interface CertifiedCounter {
  readonly print: PrintDefinition;
  readonly states: readonly CubeState[];
  readonly increments: readonly (readonly LegalMove[])[];
  readonly variant: CounterVariant;
  /** Display format of this route's targets: false is the blank-top NZ mode. */
  readonly padded: boolean;
  readonly cyclic: boolean;
}
export const inverseMoves = (moves: readonly LegalMove[]): readonly LegalMove[] =>
  [...moves].reverse().map(m => ({face:m.face, turns: m.turns === 2 ? 2 : m.turns === 1 ? -1 : 1}));
/** Eligibility uses every cubie position and body frame, never the visible digits. */
export function certifiedStep(route: CertifiedCounter, from: CubeState, value: number, target: number): readonly LegalMove[] | null {
  if (!stateEquals(from,route.states[value])) return null;
  if (Math.abs(target-value)===1) return target>value ? route.increments[value] : inverseMoves(route.increments[target]);
  // A cyclic route also stores the 99->00 edge; its decrement is the exact inverse.
  if (route.cyclic && value===99 && target===0) return route.increments[99];
  if (route.cyclic && value===0 && target===99) return inverseMoves(route.increments[99]);
  return null;
}
export function validateCertifiedCounter(raw: unknown, design: CounterDesign): CertifiedCounter {
  const d=record(raw,"certified counter");
  demand(d.schema==="cubistry.certified-counter" && d.version===1 && d.puzzle==="2x2x2", "Unsupported certified counter");
  demand(Array.isArray(d.printing)&&d.printing.length===24,"Certified print requires 24 permanent stickers");
  const base=design.prints.padded;
  const printing=d.printing as Record<string,unknown>[];
  const print=validatePrint({...base,id:"certified_00_99",stickers:printing.map((s,i)=>{
    const original=base.stickers[i];
    demand(s.id===original.id && s.cubie===original.cubie,"Certified sticker identity mismatch");
    const cubie=base.cubies.find(c=>c.id===s.cubie)!;
    demand(JSON.stringify(s.p)===JSON.stringify(cubie.position),"Certified source position mismatch");
    demand(typeof s.image==="string" && ["title-left","title-right",..."0123456789"].includes(s.image),"Invalid certified image");
    return {...original,normal:s.n,up:s.up,assetId:s.image};
  })});
  demand(typeof d.zeroWord==="string" && parseAlg(d.zeroWord).length===5,"Invalid canonical zero setup");
  demand(Array.isArray(d.increments)&&d.increments.length===99,"Certified route needs 99 edges");
  const increments=(d.increments as unknown[]).map(w=>{demand(typeof w==="string","Invalid certified word");return parseAlg(w);});
  demand(d.totalHTM===339&&d.maximumHTM===5&&increments.reduce((n,w)=>n+w.length,0)===339&&Math.max(...increments.map(w=>w.length))===5,"Invalid certified route statistics");
  const states=[applyMoves(initialState(print),parseAlg(d.zeroWord))];
  demand(matchesTarget(print,states[0],targetFor(0,true)),"Incorrect canonical zero");
  for(let i=0;i<99;i++) {
    const next=applyMoves(states[i],increments[i]);
    demand(matchesTarget(print,next,targetFor(i+1,true)),"Incorrect certified display");
    demand(stateEquals(applyMoves(next,inverseMoves(increments[i])),states[i]),"Certified inverse mismatch");
    states.push(next);
  }
  return deepFreeze({print,states,increments,variant:"titled" as const,padded:true,cyclic:false});
}
const CERTIFIED_SHA256="022da9eea3cf4b0f046251e89983700b41efdd9ce7c60a4d280be016e995ae2f";
export async function loadCertifiedCounter(design: CounterDesign, basePath="/"): Promise<CertifiedCounter> {
  const response=await fetch(`${deploymentBasePath(basePath)}counter-certified.v1.json`,{signal:AbortSignal.timeout(10000),redirect:"error",credentials:"same-origin"});
  demand(response.ok,"Certified route could not be loaded");
  demand((response.headers.get("content-type")||"").split(";")[0]==="application/json","Unexpected certified content type");
  const reader=response.body?.getReader();demand(reader,"Missing certified response body");
  const parts:Uint8Array[]=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>262144){await reader.cancel();throw Error("Certified route too large");}parts.push(value);}
  const bytes=new Uint8Array(length);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
  demand(await sha256(bytes)===CERTIFIED_SHA256,"Certified route integrity check failed");
  return validateCertifiedCounter(JSON.parse(new TextDecoder().decode(bytes)),design);
}
