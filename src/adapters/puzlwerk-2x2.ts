import { create2x2Solver, TABLE_URL } from "@puzlwerk/solver-2x2";
import {
  demand,
  stateEquals,
  type CubeState,
  type PrintDefinition,
  type LegalMove,
} from "@cubistry/cube-core";
import { applyMoves, parseAlg } from "@cubistry/cube-mechanics";

export interface CounterSolver {
  solve(from: CubeState, target: CubeState): readonly LegalMove[];
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
  return Object.freeze({
    solve(from: CubeState, target: CubeState) {
      const result = solver.solve2x2(wireState(from), wireState(target), {
        mode: "exactPhysical",
      });
      demand(
        result.metric === "HTM" && result.mode === "exactPhysical",
        "Shared solver returned an incompatible result",
      );
      const moves = parseAlg(result.moves.join(" "));
      demand(
        moves.length === result.moveCount,
        "Shared solver move count mismatch",
      );
      // Replay through Cubistry's independent physical mechanics, not the
      // provider's corner coordinates or just the visible front predicate.
      demand(
        stateEquals(applyMoves(from, moves), target),
        "Shared solver failed complete physical replay",
      );
      return moves;
    },
  });
}
