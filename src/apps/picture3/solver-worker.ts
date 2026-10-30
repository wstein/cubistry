import { KPattern } from "cubing/kpuzzle";
import { puzzles } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters, setSearchDebug } from "cubing/search";
import { createTransitionOptimizer } from "../calendar/transition/planner.mjs";
import { solveExactPicture } from "./solver-core.ts";
import type { Cube3Design, State } from "./model.ts";
setSearchDebug({ prioritizeEsbuildWorkaroundForWorkerInstantiation: true, logPerf: false });
self.onmessage = async (event: MessageEvent<{ design: Cube3Design; from: State }>) => {
  try {
    const { design, from } = event.data;
    const adapter = createTransitionOptimizer({ printing: design.printing, kpuzzle: await puzzles["3x3x3"].kpuzzle(),
      KPattern, solve: experimentalSolve3x3x3IgnoringCenters, corrections: [] });
    const word = await solveExactPicture(design, from, async aligned =>
      (await experimentalSolve3x3x3IgnoringCenters(adapter.toPattern(aligned))).toString());
    self.postMessage({ word });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Exact solver unavailable." }); }
};
