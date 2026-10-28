/** Monotonic deadline clock. Physical playback is deliberately not a clock. */
export class WorkshopClock {
  private deadline = 0;
  private frozen = 900000;
  private active = false;
  private duration = 900;
  private readonly now: () => number;
  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }
  get running(): boolean {
    return this.active;
  }
  get remainingMs(): number {
    return this.active ? Math.max(0, this.deadline - this.now()) : this.frozen;
  }
  get bucket(): number {
    return Math.ceil(this.remainingMs / 10000);
  }
  get elapsed(): boolean {
    return this.remainingMs === 0;
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
  start(): void {
    if (this.active) return;
    this.deadline = this.now() + this.frozen;
    this.active = true;
  }
  pause(): void {
    this.frozen = this.remainingMs;
    this.active = false;
  }
  reset(): void {
    this.active = false;
    this.frozen = this.duration * 1000;
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
