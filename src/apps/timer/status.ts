/** Presentation only: an active turn is not evidence of a catch-up backlog. */
export function timerMotion({
  physical,
  logical,
  busy,
  activeTarget,
}: {
  physical: number;
  logical: number;
  busy: boolean;
  activeTarget: number | null;
}): "idle" | "moving" | "synchronizing" {
  if (!busy) return physical === logical ? "idle" : "synchronizing";
  return activeTarget !== null && activeTarget !== logical
    ? "synchronizing"
    : "moving";
}
