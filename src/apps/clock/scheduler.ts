import { demand, type LegalMove } from "@cubistry/cube-core";
import { quarterTurnUnits } from "../shared/turn-timing.ts";
export type ClockValues = readonly [number, number, number];
export const localValues = (epoch: number): ClockValues => {
  const date = new Date(epoch);
  return [date.getHours(), date.getMinutes(), date.getSeconds()];
};
export const clockText = (values: ClockValues): string =>
  values.map((n) => String(n).padStart(2, "0")).join(":");
export interface ClockPort {
  readonly currentValue: number;
  readonly busy: boolean;
  prepare(value: number): readonly LegalMove[];
  request(value: number): void;
  setDeadline(target: number, endAt: number, durationMs: number): void;
  clearDeadline(): void;
}
export interface ClockUnit {
  controller: ClockPort;
  duration: number;
  /** Calculated schedule, not a measurement of browser rendering latency. */
  scheduledQuarterDuration?: number;
  setDuration: (duration: number) => void;
}
export type ClockMotion = "idle" | "moving" | "synchronizing";
interface Anticipation {
  source: number;
  target: number;
  epoch: number;
}
export function nextChange(
  epoch: number,
  unit: 0 | 1 | 2,
  read: (epoch: number) => ClockValues = localValues,
): { epoch: number; value: number } {
  demand(Number.isFinite(epoch), "Invalid clock epoch");
  const step = unit === 2 ? 1000 : 60000,
    source = read(epoch)[unit];
  let boundary = Math.floor(epoch / step) * step + step;
  // Scan local hour changes rather than assuming UTC-hour alignment or skipping DST.
  for (let n = 0; n < 1441; n++, boundary += step) {
    const value = read(boundary)[unit];
    if (value !== source) return { epoch: boundary, value };
  }
  throw Error("No local clock boundary");
}
/** One shared wall-clock snapshot, independent physical units, and no tick backlog. */
export class LiveClockScheduler {
  private previous: { epoch: number; mono: number } | null = null;
  private readonly endpoints = new Map<number, number>();
  private readonly anticipation: (Anticipation | null)[] = [null, null, null];
  private readonly read: (epoch: number) => ClockValues;
  constructor(read: (epoch: number) => ClockValues = localValues) {
    this.read = read;
  }
  tick(
    epoch: number,
    mono: number,
    units: readonly ClockUnit[],
  ): { values: ClockValues; motion: ClockMotion[] } {
    demand(
      Number.isFinite(epoch) && Number.isFinite(mono) && units.length === 3,
      "Invalid live clock snapshot",
    );
    const jump =
      this.previous !== null &&
      Math.abs(epoch - this.previous.epoch - (mono - this.previous.mono)) > 250;
    this.previous = { epoch, mono };
    if (jump) this.endpoints.clear();
    for (const boundary of this.endpoints.keys())
      if (epoch > boundary + 1000) this.endpoints.delete(boundary);
    const values = this.read(epoch),
      motion: ClockMotion[] = [];
    units.forEach((unit, i) => {
      demand(
        Number.isFinite(unit.duration) &&
          unit.duration >= 10 &&
          unit.duration <= 2000,
        "Invalid clock move duration",
      );
      const c = unit.controller,
        logical = values[i];
      let planned = this.anticipation[i];
      if (
        jump ||
        (planned && logical !== planned.source && logical !== planned.target)
      ) {
        c.clearDeadline();
        this.anticipation[i] = planned = null;
      }
      if (c.busy) {
        if (!planned || epoch > planned.epoch + 100) {
          c.clearDeadline();
          this.anticipation[i] = null;
          c.request(logical);
          motion[i] = "synchronizing";
        } else motion[i] = "moving";
        return;
      }
      if (planned) {
        if (epoch < planned.epoch && c.currentValue === planned.target) {
          motion[i] = "moving";
          return;
        }
        c.clearDeadline();
        this.anticipation[i] = null;
      }
      unit.scheduledQuarterDuration = unit.duration;
      unit.setDuration(unit.duration);
      if (c.currentValue !== logical) {
        c.clearDeadline();
        const work = quarterTurnUnits(c.prepare(logical));
        // Recover the current value using at most half the remaining slot, so
        // there is time to prepare its successor. Never use an instant turn.
        const available =
          nextChange(epoch, i as 0 | 1 | 2, this.read).epoch - epoch;
        const duration = work
          ? Math.max(10, Math.min(unit.duration, available / (2 * work)))
          : unit.duration;
        unit.scheduledQuarterDuration = duration;
        unit.setDuration(duration);
        c.request(logical);
        motion[i] = "synchronizing";
        return;
      }
      const boundary = nextChange(epoch, i as 0 | 1 | 2, this.read),
        moves = c.prepare(boundary.value);
      const work = quarterTurnUnits(moves),
        remaining = boundary.epoch - epoch,
        budget = work * unit.duration;
      demand(work > 0, "Empty clock successor route");
      if (epoch >= boundary.epoch - budget) {
        if (remaining < work * 10) {
          motion[i] = "synchronizing";
          return;
        }
        // Fit the entire route, not only its final turn. Polling lateness and
        // long/slow routes reduce the shared angular period uniformly.
        const duration = Math.min(unit.duration, remaining / work);
        unit.scheduledQuarterDuration = duration;
        unit.setDuration(duration);
        const endAt =
          this.endpoints.get(boundary.epoch) ?? mono + boundary.epoch - epoch;
        this.endpoints.set(boundary.epoch, endAt);
        c.setDeadline(boundary.value, endAt, duration);
        this.anticipation[i] = {
          source: logical,
          target: boundary.value,
          epoch: boundary.epoch,
        };
        c.request(boundary.value);
        motion[i] = "moving";
      } else motion[i] = "idle";
    });
    return { values, motion };
  }
}
