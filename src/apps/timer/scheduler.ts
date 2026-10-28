import { stateEquals, type CubeState } from "@cubistry/cube-core";
import type { ClockSnapshot } from "./clock.ts";
import type { TimerController } from "./controller.ts";

/** Foreground calibration allowances, not browser/OS scheduling guarantees. */
export const FRAME_ALLOWANCE_MS = 75;
export const WAKE_ALLOWANCE_MS = 8;
export const MIN_MOVE_MS = 10;
export function planSequence(moves: number, preferred: number, interval: number, available = interval) {
  const budget = Math.min(interval / 2, Math.max(0, available));
  const overhead = WAKE_ALLOWANCE_MS + moves * FRAME_ALLOWANCE_MS;
  const feasible = overhead + moves * MIN_MOVE_MS <= budget;
  const effective = moves === 0 ? preferred : Math.min(preferred,
    Math.max(MIN_MOVE_MS, (budget - overhead) / moves));
  return { effective, duration: moves === 0 ? 0 : overhead + moves * effective, feasible };
}
interface Plan {
  target: number;
  source: CubeState;
  deadline: number;
  interval: number;
  preferred: number;
  moves: number;
  effective: number;
  duration: number;
  feasible: boolean;
  started: boolean;
}
/** Predictive Timer presentation; playback retains sole ownership of physical state. */
export class TimerScheduler {
  private plan: Plan | null = null;
  private wake: ReturnType<typeof setTimeout> | null = null;
  private readonly refresh: () => void;
  constructor(refresh: () => void = () => {}) { this.refresh = refresh; }
  warning: "" | "Budget infeasible" | "Late" = "";
  invalidate(): void {
    if (this.wake !== null) clearTimeout(this.wake);
    this.wake = null; this.plan = null; this.warning = "";
  }
  /** A future target is intentional only while it remains the next clock bucket. */
  presentationTarget(snapshot: ClockSnapshot): number | null {
    const p = this.plan;
    return p && p.target === snapshot.next?.target ? p.target : null;
  }
  tick(snapshot: ClockSnapshot, controller: TimerController, preferred: number,
    setDuration: (duration: number) => void): void {
    const { at, bucket, next } = snapshot;
    let p = this.plan;
    const intentional = p && (p.target === bucket || p.target === next?.target);
    if (!snapshot.running) {
      this.invalidate();
      if (controller.currentValue !== bucket || controller.busy) this.warning = "Late";
      setDuration(preferred);
      if (controller.currentValue !== bucket || controller.busy) this.request(controller, bucket);
      return;
    }
    if (p && !intentional) { this.plan = p = null; }
    if (controller.busy) {
      if (p?.started && controller.progress.target === p.target && intentional) {
        if (next?.target === p.target && Math.abs(p.deadline - next.deadline) > 0.01) {
          p.deadline = next.deadline;
          p.interval = next.interval;
          const revised = planSequence(p.moves, preferred, next.interval, next.deadline - at);
          p.effective = revised.effective; p.feasible = revised.feasible;
        }
        const remaining = Math.max(1, controller.progress.total - controller.progress.completed);
        // Rebudget live changes once against the fixed deadline, never half the remaining time.
        const remainingBudget = Math.max(0, p.deadline - at - FRAME_ALLOWANCE_MS);
        const effective = Math.min(preferred, p.effective,
          Math.max(MIN_MOVE_MS, remainingBudget / remaining - FRAME_ALLOWANCE_MS));
        setDuration(effective);
        this.warning = !p.feasible ? "Budget infeasible" : at >= p.deadline ? "Late" : "";
      } else {
        setDuration(MIN_MOVE_MS);
        this.warning = "Late";
        this.request(controller, bucket);
      }
      return;
    }
    if (controller.currentValue !== bucket && controller.currentValue !== next?.target) {
      this.plan = null;
      this.warning = "Late";
      setDuration(MIN_MOVE_MS);
      this.request(controller, bucket);
      return;
    }
    if (!next) return;
    if (controller.currentValue === next.target) {
      this.warning = p && !p.feasible ? "Budget infeasible" : "";
      return; // Already ready for the boundary; never turn back to the old bucket.
    }
    if (!p || p.started || p.target !== next.target || Math.abs(p.deadline - next.deadline) > 0.01 || p.preferred !== preferred || !controller.state || !stateEquals(p.source, controller.state)) {
      const moves = controller.prepare(next.target).length;
      p = this.plan = { ...next, source: controller.state!, preferred, moves,
        ...planSequence(moves, preferred, next.interval, next.deadline - at), started: false };
      if (this.wake !== null) clearTimeout(this.wake);
      this.wake = setTimeout(() => { this.wake = null; this.refresh(); },
        Math.max(0, Math.ceil(p.deadline - p.duration - at)));
    }
    this.warning = p.feasible ? "" : "Budget infeasible";
    setDuration(p.effective);
    if (at >= p.deadline - p.duration) {
      p.started = true;
      controller.request(p.target);
    }
  }
  private request(controller: TimerController, target: number): void {
    if (controller.busy && controller.progress.target === target && controller.progress.queuedTarget === null) return;
    if (controller.progress.queuedTarget !== target) controller.request(target);
  }
}
