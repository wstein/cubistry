/**
 * The calendar's route planner: one call of the front-goal solver per request.
 * The result is a route word for the controller, which replays and verifies
 * every word itself. No center repair and no reference word are produced: the
 * front goal leaves the hidden cubies free.
 */
import { solveFront3x3 } from "@puzlwerk/solver-3x3-front";
import type { CalendarPlanningContext } from "./controller.ts";
import { planFrontRoute, type FrontSolve } from "./front-goal.ts";

/** Table build budget, search budget and node cap of one front solve. */
export const FRONT_LIMITS = Object.freeze({
  tableMs: 3000,
  searchMs: 4000,
  maxNodes: 5_000_000,
});

export interface FrontPlanReply {
  readonly word: string;
  readonly diagnostics: Readonly<Record<string, unknown>>;
}

/**
 * Plan one route. A solver answer other than "ok" returns the checked baseline
 * word, so the controller keeps it as its fallback route.
 */
export function planCalendarRoute(
  context: CalendarPlanningContext,
  solve: FrontSolve = solveFront3x3,
): FrontPlanReply {
  const started = performance.now();
  const plan = planFrontRoute(
    context.design.printing,
    context.from,
    context.target,
    solve,
    {
      ...FRONT_LIMITS,
    },
  );
  const elapsedMs = Math.round(performance.now() - started);
  if (plan.status !== "ok")
    return {
      word: context.fallbackWord,
      diagnostics: {
        backendUsed: "front",
        solverStatus: plan.status,
        detail: plan.detail,
        elapsedMs,
      },
    };
  return {
    word: plan.word,
    diagnostics: {
      backendUsed: "front",
      solverStatus: "solved",
      nodes: plan.nodes,
      tablesMs: plan.tablesMs,
      elapsedMs,
      chosenMoves: plan.word.split(/\s+/).filter(Boolean).length,
    },
  };
}
