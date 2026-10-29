import { tryCenterPortfolio, referencesForPlan } from "./center-planner.mjs";
import { KPattern } from "cubing/kpuzzle";
import { puzzles } from "cubing/puzzles";
import {
  experimentalSolve3x3x3IgnoringCenters,
  setSearchDebug,
} from "cubing/search";
import { createTransitionOptimizer } from "./transition/planner.mjs";
import corrections from "./transition/center-corrections.json";
import type { CalendarPlanningContext } from "./controller.ts";

// This worker owns cubing's nested solver worker. Terminating it also terminates
// its child workers; no timed-out solve survives in the page's task queue.
// Use cubing's bundler-aware entry URL directly; the package-relative filename
// used by import.meta.resolve is renamed in a production build.
setSearchDebug({
  prioritizeEsbuildWorkaroundForWorkerInstantiation: true,
  logPerf: false,
});
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
    let references;
    try {
      references = referencesForPlan(context, result.word);
    } catch {
      /* Keep the checked direct route if reference compaction is unavailable. */
    }
    self.postMessage({
      id,
      interimWord: result.word,
      references,
      diagnostics: {
        backendUsed: result.word !== context.fallbackWord ? "direct" : "legacy",
        solverStatus: "not-attempted",
        chosenMoves: result.word.split(/\s+/).filter(Boolean).length,
      },
    });
    const candidate = tryCenterPortfolio(context, result.word, {}, (first) => {
      let firstReferences;
      try {
        firstReferences = referencesForPlan(context, first.word);
      } catch {}
      self.postMessage({
        id,
        interimWord: first.word,
        references: firstReferences,
        diagnostics: {
          backendUsed:
            first.method === "center-aware"
              ? "center-aware"
              : result.word !== context.fallbackWord
                ? "direct"
                : "legacy",
          solverStatus: first.status ?? "not-attempted",
          attempted: first.attempted,
          attempts: first.attempts,
          directMoves: result.word.split(/\s+/).filter(Boolean).length,
          chosenMoves: first.word.split(/\s+/).filter(Boolean).length,
          maximumNodes: 100000,
          maximumAttempts: 2,
          maximumTotalNodes: 200000,
        },
      });
    });
    if (candidate.word !== result.word) {
      try {
        references = referencesForPlan(context, candidate.word);
      } catch {
        references = undefined;
      }
    }
    self.postMessage({
      id,
      word: candidate.word,
      references,
      diagnostics: {
        backendUsed:
          candidate.method === "center-aware"
            ? "center-aware"
            : result.word !== context.fallbackWord
              ? "direct"
              : "legacy",
        attempted: candidate.attempted,
        solverStatus: candidate.status ?? "not-attempted",
        reason: candidate.reason,
        directMoves: result.word.split(/\s+/).filter(Boolean).length,
        chosenMoves: candidate.word.split(/\s+/).filter(Boolean).length,
        maximumNodes: 100000,
        maximumAttempts: 2,
        maximumTotalNodes: 200000,
        attempts: candidate.attempts,
        improvementSkippedReason: candidate.improvementSkippedReason,
        maximumDepth: 24,
        centerElapsedMs: candidate.elapsedMs ?? 0,
      },
    });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error ? error.message : "Calendar planning failed",
    });
  }
};
