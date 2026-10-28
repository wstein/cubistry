import { create2x2Solver, TABLE_URL } from "@puzlwerk/solver-2x2";
import {
  demand,
  stateEquals,
  type CubeState,
  type PrintDefinition,
  type LegalMove,
} from "@cubistry/cube-core";
import { applyMoves, parseAlg, initialState } from "@cubistry/cube-mechanics";

export interface CounterSolver {
  solve(from: CubeState, target: CubeState, options?: { coordinateFrames: boolean }): readonly LegalMove[];
}
let sharedTable: Promise<Uint8Array> | undefined;
async function loadTable(): Promise<Uint8Array> {
  sharedTable ??= fetch(TABLE_URL, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
    credentials: "same-origin",
  })
    .then(async (response) => {
      demand(response.ok, "Shared solver table could not be loaded");
      return new Uint8Array(await response.arrayBuffer());
    })
    .catch((error) => {
      sharedTable = undefined;
      throw error;
    });
  return sharedTable;
}
/** A typed profile boundary, not a second solver or physical state model. */
export async function createCounterSolver(
  print: PrintDefinition,
  table: () => Promise<Uint8Array> = loadTable,
): Promise<CounterSolver> {
  demand(
    print.topology.kind === "cube" && print.topology.size === 2,
    "Shared solver requires the physical 2x2 profile",
  );
  const solver = await create2x2Solver(await table(), {
    ...print,
    topology: { kind: "cube", size: 2 },
  });
  const wireState = (state: CubeState) => {
    demand(
      state.topology.kind === "cube" && state.topology.size === 2,
      "Shared solver requires the physical 2x2 profile",
    );
    return {
      ...state,
      topology: { kind: "cube" as const, size: 2 as const },
    };
  };
  // Re-express both endpoints in the 24 proper cube frames. These are virtual
  // coordinates only: no regrip/setup is animated or added to the physical path.
  const normals = { R:[1,0,0], L:[-1,0,0], U:[0,1,0], D:[0,-1,0], F:[0,0,1], B:[0,0,-1] } as const;
  const source = initialState(print), frames: {word: readonly LegalMove[]; rotation: CubeState["cubies"][number]["orientation"]}[] = [];
  const queue: (readonly LegalMove[])[] = [[]], seen = new Set<string>();
  for (let at=0; at<queue.length; at++) {
    const word=queue[at], rotation=applyMoves(source,word).cubies[0].orientation;
    const key=JSON.stringify(rotation); if(seen.has(key))continue;
    seen.add(key);frames.push({word,rotation});
    for(const regrip of ["R L'","U D'","F B'"])queue.push([...word,...parseAlg(regrip)]);
  }
  demand(frames.length===24,"Invalid coordinate-frame catalog");
  const inverse = (moves: readonly LegalMove[]): readonly LegalMove[] => [...moves].reverse().map(m=>({face:m.face,turns:m.turns===2?2:m.turns===1?-1:1}));
  // Opposite faces commute; combine/cancel adjacent same-axis blocks without
  // changing physical endpoints or counting half turns as two HTM.
  const normalize = (moves: readonly LegalMove[]): readonly LegalMove[] => {
    const blocks: {axis: number; moves: Map<LegalMove["face"],number>}[]=[];
    for(const m of moves){const axis="RL".includes(m.face)?0:"UD".includes(m.face)?1:2;let b=blocks.at(-1);if(!b||b.axis!==axis)blocks.push(b={axis,moves:new Map()});b.moves.set(m.face,((b.moves.get(m.face)||0)+m.turns+4)%4);if([...b.moves.values()].every(n=>n===0))blocks.pop();}
    return blocks.flatMap(b=>[...b.moves].filter(([,n])=>n!==0).map(([face,n])=>({face,turns:(n===3?-1:n) as LegalMove["turns"]})));
  };
  return Object.freeze({
    solve(from: CubeState, target: CubeState, options?: { coordinateFrames: boolean }) {
      if(stateEquals(from,target))return [];
      let best: readonly LegalMove[] | null=null;
      for(const frame of options?.coordinateFrames ? frames : frames.slice(0,1)){
        const rotatedFrom=wireState(applyMoves(from,frame.word)), rotatedTarget=wireState(applyMoves(target,frame.word));
        for(const reverse of options?.coordinateFrames ? [false,true] : [false]){
          const result=solver.solve2x2(reverse?rotatedTarget:rotatedFrom,reverse?rotatedFrom:rotatedTarget,{mode:"exactPhysical"});
          demand(result.metric==="HTM"&&result.mode==="exactPhysical","Shared solver returned an incompatible result");
          const raw=parseAlg(result.moves.join(" "));
          demand(raw.length===result.moveCount,"Shared solver move count mismatch");
          const mapped=raw.map(m=>{
            const n=normals[m.face];
            const original=frame.rotation.map(column=>column.reduce((sum,v,i)=>sum+v*n[i],0));
            const face=(Object.keys(normals) as LegalMove["face"][]).find(f=>normals[f].every((v,i)=>v===original[i]));
            demand(face,"Invalid mapped physical face");return {face,turns:m.turns};
          });
          const oriented = reverse?inverse(mapped):mapped;
          const candidate=options?.coordinateFrames ? normalize(oriented) : oriented;
          demand(stateEquals(applyMoves(from,candidate),target),"Shared solver failed complete physical replay");
          if(best===null||candidate.length<best.length)best=candidate;
        }
      }
      demand(best!==null,"No complete physical route");return best;
    },
  });
}
