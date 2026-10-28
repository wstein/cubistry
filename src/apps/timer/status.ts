/** Presentation only: an active turn is not evidence of a catch-up backlog. */
export function timerMotion({
  physical,
  logical,
  busy,
  activeTarget,
  anticipatedTarget = null,
}: {
  physical: number;
  logical: number;
  busy: boolean;
  activeTarget: number | null;
  anticipatedTarget?: number | null;
}): "idle" | "moving" | "synchronizing" {
  if (!busy) return physical === logical || physical === anticipatedTarget ? "idle" : "synchronizing";
  return activeTarget !== null && activeTarget !== logical && activeTarget !== anticipatedTarget
    ? "synchronizing"
    : "moving";
}
