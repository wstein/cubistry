import { KPattern } from "cubing/kpuzzle";
import { puzzles } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import { createTransitionOptimizer } from "./transition/planner.mjs";
import corrections from "./transition/center-corrections.json";
import type { CalendarPlanningContext } from "./controller.ts";

// This worker owns cubing's nested solver worker. Terminating it also terminates
// its child workers; no timed-out solve survives in the page's task queue.
const optimizers = new Map<
  string,
  ReturnType<typeof createTransitionOptimizer>
>();
self.onmessage = async (
  event: MessageEvent<{ id: number; context: CalendarPlanningContext }>,
) => {
  const { id, context } = event.data;
  try {
    let optimizer = optimizers.get(context.design.id);
    if (!optimizer) {
      optimizer = createTransitionOptimizer({
        printing: context.design.printing,
        kpuzzle: await puzzles["3x3x3"].kpuzzle(),
        KPattern,
        solve: experimentalSolve3x3x3IgnoringCenters,
        corrections: corrections.witnesses,
      });
      optimizers.set(context.design.id, optimizer);
    }
    const result = await optimizer.plan(
      context.from,
      context.target,
      context.fallbackWord,
      {
        maxAttempts: 6,
        timeBudgetMs: 500,
      },
    );
    self.postMessage({ id, word: result.word });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error ? error.message : "Calendar planning failed",
    });
  }
};
