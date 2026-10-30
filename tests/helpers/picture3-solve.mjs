import assert from "node:assert/strict";
import { createCube3Design, apply, scrambleWord } from "../../src/apps/picture3/model.ts";
import { solveExactPicture } from "../../src/apps/picture3/solver-core.ts";
import { createTransitionOptimizer } from "../../src/apps/calendar/transition/planner.mjs";
import { apply as independentApply } from "../../src/apps/calendar/transition/geometry.mjs";
import { scramble } from "../../src/apps/playground/model.ts";
import { centerKernelReference } from "@puzlwerk/solver-3x3-picture";
import { KPattern } from "cubing/kpuzzle";
import { puzzles } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters as solve } from "cubing/search";
const watchdog = setTimeout(() => { console.error("exact solver probe exceeded deadline"); process.exit(1); }, 20000);
const design = createCube3Design(), adapter = createTransitionOptimizer({ printing: design.printing,
  kpuzzle: await puzzles["3x3x3"].kpuzzle(), KPattern, solve, corrections: [] });
const result=[];
for(const word of [scrambleWord(scramble(44,20)), centerKernelReference([1,1,0,0,0,0]).moves.join(" "), "x y R U2 F' B L x'"]) {
  const from=apply(design.printing,word), before=JSON.stringify(from);
  const route=await solveExactPicture(design,from,async aligned=>(await solve(adapter.toPattern(aligned))).toString());
  assert.deepEqual(independentApply(from,route),design.printing);
  assert.equal(JSON.stringify(from),before);
  result.push({inputMoves:word.split(/\s+/).length,solutionMoves:route.split(/\s+/).filter(Boolean).length,all54Exact:true});
}
clearTimeout(watchdog);console.log(JSON.stringify(result));process.exit(0);
