/** Executable bounded catalog prototype, not a general partial-target solver. */
import {performance} from 'node:perf_hooks';
import {stateEquals,printEquals,targetEquals,validateTarget,validatePrint,validateState,deepFreeze,type PrintDefinition,type CubeState,type LegalMove} from '@cubistry/cube-core';
import {applyMoves,initialState,inverseMoves,parseAlg,matchesTarget} from '@cubistry/cube-mechanics';
import {targetFor,type CounterDesign} from '../../../src/apps/counter/design.ts';
import type {SolveRequest} from './service-contracts.ts';
export type CatalogResult={status:'UNKNOWN';reason:string}|{status:'solution';moves:readonly LegalMove[];metric:'HTM';optimality:'unknown';replayVerified:true;frame:'exact';goalKind:'complete-source'|'known-counter-display';preparationMs:number;estimatedCatalogBytes:number;budgetPolicy:string};
export class WitnessCatalogBackend {
 readonly capabilities=deepFreeze({sizes:[2],completeSource:'catalog states only',partialImage:'only the 100 registered complete front goals',frame:'exact',optimality:'unknown',generalPartialSearch:false});
 private readonly states:readonly CubeState[];private readonly print:PrintDefinition;private readonly design:CounterDesign;private readonly padded:boolean;private readonly source:CubeState;private readonly preparationMs:number;private readonly bytes:number;
 constructor(design:CounterDesign,padded=true){const start=performance.now();this.design=design;this.padded=padded;this.print=design.prints[padded?'padded':'unpadded'];this.source=initialState(this.print);this.states=deepFreeze(design.witnesses.map(w=>applyMoves(this.source,parseAlg(w.word))));this.bytes=new TextEncoder().encode(JSON.stringify(this.states)).length;this.preparationMs=performance.now()-start;}
 async solve(request:SolveRequest):Promise<CatalogResult>{
  const unknown=(reason:string):CatalogResult=>({status:'UNKNOWN',reason});const start=performance.now();
  if(request.signal.aborted)return unknown('cancelled before bounded catalog work');
  if(!request.budget||!['coldStartMs','searchMs','maxMemoryBytes'].every(k=>{const value=request.budget[k as keyof typeof request.budget];return typeof value==='number'&&Number.isFinite(value)&&value>=0;})||request.budget.searchMs<=0||request.budget.coldStartMs<this.preparationMs||request.budget.maxMemoryBytes<this.bytes)return unknown('catalog preparation/search/data budget is insufficient');
  let state:CubeState;try{const print=validatePrint(request.print);if(!printEquals(print,this.print))return unknown('unregistered physical print');state=validateState(request.state,print);}catch{return unknown('unsupported topology, schema, or state');}
  const index=this.states.findIndex(s=>stateEquals(s,state)),source=stateEquals(state,this.source);if(index<0&&!source)return unknown('state is outside the registered catalog');
  let goal=-1,kind:'complete-source'|'known-counter-display';
  if(request.goal.kind==='classical-solved'){if(request.goal.frame!=='exact')return unknown('only exact reference-frame completion is registered');kind='complete-source';}
  else{if(request.goal.frame!=='exact')return unknown('counter display requires exact frame');let target;try{target=validateTarget(request.goal.target);}catch{return unknown('invalid partial target');}goal=this.design.witnesses.findIndex(w=>targetEquals(targetFor(w.value,this.padded),target));if(goal<0)return unknown('general partial-image search is not implemented');kind='known-counter-display';}
  if(request.signal.aborted||performance.now()-start>request.budget.searchMs)return unknown('cancelled or bounded search time expired');
  const moves=[...(source?[]:inverseMoves(parseAlg(this.design.witnesses[index].word))),...(goal<0?[]:parseAlg(this.design.witnesses[goal].word))];const reached=applyMoves(state,moves);if(goal<0?!stateEquals(reached,this.source):!matchesTarget(this.print,reached,targetFor(goal,this.padded)))return unknown('replay rejected generated path');
  return{status:'solution',moves,metric:'HTM',optimality:'unknown',replayVerified:true,frame:'exact',goalKind:kind,preparationMs:this.preparationMs,estimatedCatalogBytes:this.bytes,budgetPolicy:'Bounded 101-state catalog and cooperative cancellation; memory is serialized-data estimate, not a hard JavaScript heap limit.'};
 }
}
