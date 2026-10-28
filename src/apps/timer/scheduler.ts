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
  private lastBucket: number | null = null;
  private missedBoundary = false;
  private initial: { target: number; total: number; preferred: number; deadline: number; effective: number; feasible: boolean } | null = null;
  private readonly refresh: () => void;
  private readonly readClock?: () => ClockSnapshot;
  constructor(refresh: () => void = () => {}, readClock?: () => ClockSnapshot) {
    this.refresh = refresh; this.readClock = readClock;
  }
  warning: "" | "Budget infeasible" | "Late" = "";
  invalidate(): void {
    if (this.wake !== null) clearTimeout(this.wake);
    this.wake = null; this.plan = null; this.warning = "";
    this.lastBucket = null; this.missedBoundary = false; this.initial = null;
  }
  /** A future target is intentional only while it remains the next clock bucket. */
  presentationTarget(snapshot: ClockSnapshot): number | null {
    const p = this.plan;
    return p && p.target === snapshot.next?.target ? p.target : null;
  }
  tick(snapshot: ClockSnapshot, controller: TimerController, preferred: number,
    setDuration: (duration: number) => void): void {
    const { bucket, next } = snapshot;
    let at = snapshot.at;
    const crossedBoundary = this.lastBucket !== null && bucket !== this.lastBucket;
    this.lastBucket = bucket;
    if (crossedBoundary && controller.currentValue !== bucket && controller.currentValue !== next?.target)
      this.missedBoundary = true;
    let p = this.plan;
    const intentional = p && (p.target === bucket || p.target === next?.target);
    if (!snapshot.running) {
      const missedDeadline = this.missedBoundary || this.warning === "Late" || !!(p && at >= p.deadline);
      this.invalidate();
      if (missedDeadline && (controller.currentValue !== bucket || controller.busy)) this.warning = "Late";
      setDuration(missedDeadline && (controller.currentValue !== bucket || controller.busy) ? MIN_MOVE_MS : preferred);
      if (controller.currentValue !== bucket || controller.busy) this.request(controller, bucket);
      return;
    }
    if (p && !intentional) { this.plan = p = null; }
    if (controller.busy) {
      if (p?.started && controller.progress.target === p.target && intentional) {
        const changedDeadline = next?.target === p.target && Math.abs(p.deadline - next.deadline) > 0.01;
        if (changedDeadline || preferred !== p.preferred) {
          if (changedDeadline && next) { p.deadline = next.deadline; p.interval = next.interval; }
          const remaining = Math.max(1, controller.progress.total - controller.progress.completed);
          const revised = planSequence(remaining, preferred, p.interval, p.deadline - at);
          p.effective = Math.min(p.effective, revised.effective);
          p.feasible = revised.feasible;
          p.preferred = preferred;
        }
        // Keep a faster preference unchanged during ordinary playback. Rebudget only
        // after user changes, rather than counting an in-progress move as unstarted.
        setDuration(at >= p.deadline ? MIN_MOVE_MS : p.effective);
        this.warning = !p.feasible ? "Budget infeasible" : at >= p.deadline ? "Late" : "";
      } else {
        if (!this.missedBoundary && next && controller.progress.target === bucket) {
          const remaining = Math.max(1, controller.progress.total - controller.progress.completed);
          const initial = this.initial;
          if (!initial || initial.target !== bucket || initial.total !== controller.progress.total ||
            initial.preferred !== preferred || Math.abs(initial.deadline - next.deadline) > 0.01) {
            const budget = planSequence(remaining, preferred, next.interval, next.deadline - at);
            this.initial = { target: bucket, total: controller.progress.total, preferred,
              deadline: next.deadline, effective: budget.effective, feasible: budget.feasible };
          }
          setDuration(this.initial!.effective);
          this.warning = this.initial!.feasible ? "" : "Budget infeasible";
        } else {
          setDuration(MIN_MOVE_MS);
          this.warning = this.missedBoundary ? "Late" : "";
        }
        this.request(controller, bucket);
      }
      return;
    }
    this.initial = null;
    if (controller.currentValue !== bucket && controller.currentValue !== next?.target) {
      this.plan = null;
      this.warning = this.missedBoundary ? "Late" : "";
      setDuration(MIN_MOVE_MS);
      this.request(controller, bucket);
      return;
    }
    this.missedBoundary = false;
    if (!next) return;
    if (controller.currentValue === next.target) {
      this.warning = p && !p.feasible ? "Budget infeasible" : "";
      return; // Already ready for the boundary; never turn back to the old bucket.
    }
    if (!p || p.started || p.target !== next.target || Math.abs(p.deadline - next.deadline) > 0.01 || p.preferred !== preferred || !controller.state || !stateEquals(p.source, controller.state)) {
      const moves = controller.prepare(next.target).length;
      const fresh = this.readClock?.() ?? snapshot;
      if (!fresh.running || fresh.bucket !== bucket || fresh.next?.target !== next.target ||
        Math.abs(fresh.next.deadline - next.deadline) > 0.01) {
        this.invalidate();
        this.wake = setTimeout(() => { this.wake = null; this.refresh(); }, 0);
        return;
      }
      at = fresh.at;
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
