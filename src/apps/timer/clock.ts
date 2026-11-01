/** Monotonic deadline clock. Physical playback is deliberately not a clock. */
export type TimerMode = "countdown" | "stopwatch";
export interface TimerProfile {
  readonly stepSeconds: number;
  readonly maxSeconds: number;
  readonly defaultSeconds: number;
  readonly stepName: string;
}
export const TEN_SECOND_TIMER: TimerProfile = Object.freeze({
  stepSeconds: 10,
  maxSeconds: 3590,
  defaultSeconds: 900,
  stepName: "ten-second",
});
export const FIVE_SECOND_TIMER: TimerProfile = Object.freeze({
  stepSeconds: 5,
  maxSeconds: 2395,
  defaultSeconds: 1800,
  stepName: "five-second",
});
/** M/S Timer: whole seconds, 00:00–59:59, Countdown default 15:00. */
export const ONE_SECOND_TIMER: TimerProfile = Object.freeze({
  stepSeconds: 1,
  maxSeconds: 3599,
  defaultSeconds: 900,
  stepName: "one-second",
});
const durationError = (p: TimerProfile) =>
  `Duration must be 00:00–${formatTimer(p.maxSeconds / p.stepSeconds, p)} in ${p.stepName} steps`;

export interface ClockSnapshot {
  readonly at: number;
  readonly bucket: number;
  readonly liveSeconds: number;
  readonly running: boolean;
  readonly next: null | { target: number; deadline: number; interval: number };
}
/** One anchored virtual clock for both directions; animation never changes its rate. */
export class WorkshopClock {
  private anchor = 0;
  private frozen = 900000;
  private active = false;
  private duration = 900;
  private multiplier = 1;
  private direction: TimerMode = "countdown";
  private readonly now: () => number;
  readonly profile: TimerProfile;
  constructor(
    now: () => number = () => performance.now(),
    profile: TimerProfile = TEN_SECOND_TIMER,
  ) {
    this.now = now;
    this.profile = profile;
    this.duration = profile.defaultSeconds;
    this.frozen = this.duration * 1000;
  }
  get mode(): TimerMode {
    return this.direction;
  }
  get speed(): number {
    return this.multiplier;
  }
  get valueMs(): number {
    return this.valueAt(this.now());
  }
  /** Read every deadline field from one monotonic sample; never advance anchors. */
  snapshot(): ClockSnapshot {
    const at = this.now(),
      value = this.valueAt(at);
    const bucket =
      this.direction === "countdown"
        ? Math.ceil(value / (this.profile.stepSeconds * 1000))
        : Math.floor(value / (this.profile.stepSeconds * 1000));
    const running =
      this.active &&
      (this.direction === "countdown"
        ? value > 0
        : value < this.profile.maxSeconds * 1000);
    const target = bucket + (this.direction === "countdown" ? -1 : 1);
    const distance =
      this.direction === "countdown"
        ? value - target * (this.profile.stepSeconds * 1000)
        : target * (this.profile.stepSeconds * 1000) - value;
    return {
      at,
      bucket,
      liveSeconds:
        this.direction === "countdown"
          ? Math.ceil(value / 1000)
          : Math.floor(value / 1000),
      running,
      next: running
        ? {
            target,
            deadline: at + distance / this.multiplier,
            interval: (this.profile.stepSeconds * 1000) / this.multiplier,
          }
        : null,
    };
  }
  private valueAt(at: number): number {
    const delta = this.active ? (at - this.anchor) * this.multiplier : 0;
    return Math.max(
      0,
      Math.min(
        this.profile.maxSeconds * 1000,
        this.frozen + (this.direction === "countdown" ? -delta : delta),
      ),
    );
  }
  get running(): boolean {
    return this.active && !this.elapsed;
  }
  get remainingMs(): number {
    return this.valueMs;
  }
  get bucket(): number {
    return this.direction === "countdown"
      ? Math.ceil(this.valueMs / (this.profile.stepSeconds * 1000))
      : Math.floor(this.valueMs / (this.profile.stepSeconds * 1000));
  }
  get elapsed(): boolean {
    return this.direction === "countdown"
      ? this.valueMs === 0
      : this.valueMs === this.profile.maxSeconds * 1000;
  }
  configure(seconds: number): void {
    if (
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds > this.profile.maxSeconds ||
      seconds % this.profile.stepSeconds !== 0
    )
      throw Error(durationError(this.profile));
    this.duration = seconds;
    this.reset();
  }
  setMode(mode: TimerMode): void {
    if (mode !== "countdown" && mode !== "stopwatch")
      throw Error("Invalid timer mode");
    this.direction = mode;
    this.reset();
  }
  setSpeed(rate: number): void {
    if (![1, 10, 20, 50, 100].includes(rate))
      throw Error("Invalid timer speed");
    const at = this.now();
    const value = this.valueAt(at);
    this.anchor = at;
    this.frozen = value;
    this.multiplier = rate;
  }
  start(): void {
    if (this.running || this.elapsed) return;
    this.anchor = this.now();
    this.active = true;
  }
  pause(): void {
    this.frozen = this.valueMs;
    this.active = false;
  }
  reset(): void {
    this.active = false;
    this.frozen = this.direction === "countdown" ? this.duration * 1000 : 0;
  }
}
export function formatTimer(
  bucket: number,
  profile: TimerProfile = TEN_SECOND_TIMER,
): string {
  if (
    !Number.isInteger(bucket) ||
    bucket < 0 ||
    bucket > profile.maxSeconds / profile.stepSeconds
  )
    throw Error("Invalid timer bucket");
  return formatLiveTimer(bucket * profile.stepSeconds, profile.maxSeconds);
}
/** One-second control-panel readout; physical targets use application-specific buckets. */
export function formatLiveTimer(seconds: number, maxSeconds = 3590): string {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > maxSeconds)
    throw Error("Invalid live timer seconds");
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function parseDuration(
  text: string,
  profile: TimerProfile = TEN_SECOND_TIMER,
): number {
  if (!/^\d{1,2}:[0-5]\d$/.test(text))
    throw Error(`Enter MM:SS in ${profile.stepName} steps`);
  const [m, s] = text.split(":").map(Number);
  const seconds = m * 60 + s;
  if (seconds > profile.maxSeconds || seconds % profile.stepSeconds !== 0)
    throw Error(durationError(profile));
  return seconds;
}
