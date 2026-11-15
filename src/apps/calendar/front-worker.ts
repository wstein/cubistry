import type { CalendarPlanningContext } from "./controller.ts";
import { planCalendarRoute } from "./front-planner.ts";

// One solve per message. The solve is synchronous; the page enforces the
// deadline and cancels by terminating this worker.
self.onmessage = (
  event: MessageEvent<{ id: number; context: CalendarPlanningContext }>,
) => {
  const { id, context } = event.data;
  try {
    const { word, diagnostics } = planCalendarRoute(context);
    self.postMessage({ id, word, diagnostics });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error ? error.message : "Calendar planning failed",
    });
  }
};
