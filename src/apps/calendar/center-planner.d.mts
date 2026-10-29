import type {
  CalendarPlanningContext,
  CalendarRoutePlanner,
} from "./controller.ts";
export interface CenterOptions {
  backend?: "direct" | "center-aware";
  maximumNodes?: number;
  maximumDepth?: number;
  threshold?: number;
}
export function pictureRequest(context: CalendarPlanningContext): {
  alignment: string;
  facelets: string;
  centerOrientations: number[];
  symmetry: (1 | 4)[];
};
export function referencesForPlan(
  context: CalendarPlanningContext,
  word: string,
): {
  fromReferenceWord: string;
  endReferenceWord: string;
  maximumKernelMoves: number;
};
export function tryCenterAware(
  context: CalendarPlanningContext,
  directWord: string,
  options?: CenterOptions,
): {
  word: string;
  method: string;
  attempted: boolean;
  status?: string;
  reason?: string;
  elapsedMs?: number;
};
export function createPlanner(options: {
  design: CalendarPlanningContext["design"];
  appRoot?: string;
  options?: CenterOptions;
}): Promise<CalendarRoutePlanner>;
