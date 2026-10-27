export function parseValue(text) {
  const value = String(text).trim();
  if (!/^\d{1,2}$/.test(value))
    throw Error("Enter a whole number from 0 to 99.");
  const n = Number(value);
  if (n < 0 || n > 99) throw Error("Enter a whole number from 0 to 99.");
  return n;
}
export function shifted(value, delta, wrap = false) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 99 ||
    !Number.isInteger(delta)
  )
    throw Error("Invalid counter operation.");
  return wrap
    ? (((value + delta) % 100) + 100) % 100
    : Math.max(0, Math.min(99, value + delta));
}
export class MinuteTimer {
  constructor() {
    this.state = "idle";
    this.initialMinutes = 15;
    this.remainingMs = 15 * 60000;
    this.deadline = null;
  }
  start(minutes, now = Date.now()) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 99)
      throw Error("Timer must be between 0 and 99 minutes.");
    if (this.state !== "paused") {
      this.initialMinutes = minutes;
      this.remainingMs = minutes * 60000;
    }
    this.deadline = now + this.remainingMs;
    this.state = this.remainingMs > 0 ? "running" : "finished";
    return this.value(now);
  }
  value(now = Date.now()) {
    const remaining =
      this.state === "running"
        ? Math.max(0, this.deadline - now)
        : this.remainingMs;
    if (this.state === "running" && remaining === 0) {
      this.remainingMs = 0;
      this.deadline = null;
      this.state = "finished";
    }
    return Math.min(99, Math.max(0, Math.ceil(remaining / 60000)));
  }
  pause(now = Date.now()) {
    if (this.state === "running") {
      this.remainingMs = Math.max(0, this.deadline - now);
      this.deadline = null;
      this.state = this.remainingMs > 0 ? "paused" : "finished";
    }
    return this.value(now);
  }
  reset(minutes = this.initialMinutes) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 99)
      throw Error("Timer must be between 0 and 99 minutes.");
    this.initialMinutes = minutes;
    this.remainingMs = minutes * 60000;
    this.deadline = null;
    this.state = "idle";
    return minutes;
  }
  serialize() {
    return {
      state: this.state,
      initialMinutes: this.initialMinutes,
      remainingMs: this.remainingMs,
      deadline: this.deadline,
    };
  }
  restore(data) {
    if (
      !data ||
      !["idle", "running", "paused", "finished"].includes(data.state) ||
      !Number.isInteger(data.initialMinutes) ||
      data.initialMinutes < 0 ||
      data.initialMinutes > 99 ||
      !Number.isFinite(data.remainingMs) ||
      data.remainingMs < 0 ||
      data.remainingMs > 99 * 60000 ||
      (data.state === "running" && !Number.isFinite(data.deadline))
    )
      return false;
    this.state = data.state;
    this.initialMinutes = data.initialMinutes;
    this.remainingMs = data.remainingMs;
    this.deadline = data.state === "running" ? data.deadline : null;
    if (this.state === "finished") this.remainingMs = 0;
    this.value();
    return true;
  }
}
