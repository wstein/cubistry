/** Fixed wall-clock application cadence; no animation-dependent interval queue. */
export class CounterAuto {
  enabled = false;
  start(value, direction, now) {
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > 99 ||
      ![1, -1].includes(direction) ||
      !Number.isFinite(now)
    )
      throw Error("Invalid Auto origin");
    this.origin = value;
    this.direction = direction;
    this.epoch = now;
    this.enabled = true;
  }
  stop() {
    this.enabled = false;
  }
  value(now, wrap = false) {
    if (!this.enabled) return null;
    if (!Number.isFinite(now)) throw Error("Invalid Auto clock");
    const ticks = Math.max(0, Math.floor((now - this.epoch) / 1000));
    const target = this.origin + this.direction * ticks;
    return wrap
      ? ((target % 100) + 100) % 100
      : Math.max(0, Math.min(99, target));
  }
}
