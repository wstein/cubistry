/** Monotonic deadline clock. Physical playback is deliberately not a clock. */
export type TimerMode = "countdown" | "stopwatch";
const MAX_MS = 3590000;
/** One anchored virtual clock for both directions; animation never changes its rate. */
export class WorkshopClock {
  private anchor = 0;
  private frozen = 900000;
  private active = false;
  private duration = 900;
  private multiplier = 1;
  private direction: TimerMode = "countdown";
  private readonly now: () => number;
  constructor(now: () => number = () => performance.now()) {
    this.now = now;
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
  private valueAt(at: number): number {
    const delta = this.active ? (at - this.anchor) * this.multiplier : 0;
    return Math.max(
      0,
      Math.min(
        MAX_MS,
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
      ? Math.ceil(this.valueMs / 10000)
      : Math.floor(this.valueMs / 10000);
  }
  get elapsed(): boolean {
    return this.direction === "countdown"
      ? this.valueMs === 0
      : this.valueMs === MAX_MS;
  }
  configure(seconds: number): void {
    if (
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds > 3590 ||
      seconds % 10 !== 0
    )
      throw Error("Duration must be 00:00–59:50 in ten-second steps");
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
export function formatTimer(bucket: number): string {
  if (!Number.isInteger(bucket) || bucket < 0 || bucket > 359)
    throw Error("Invalid timer bucket");
  const seconds = bucket * 10;
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function parseDuration(text: string): number {
  if (!/^\d{1,2}:[0-5]\d$/.test(text))
    throw Error("Enter MM:SS in ten-second steps");
  const [m, s] = text.split(":").map(Number);
  const seconds = m * 60 + s;
  if (seconds > 3590 || seconds % 10 !== 0)
    throw Error("Duration must be 00:00–59:50 in ten-second steps");
  return seconds;
}
