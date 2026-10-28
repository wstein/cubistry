/** Sequential numeric Run: one adjacent goal per second, gated by physical completion. */
export class CounterRun {
  target = null;
  nextAt = 0;
  get running() {
    return this.target !== null;
  }
  start(current, target, now = Date.now()) {
    this.target = current === target ? null : target;
    this.nextAt = now + 1000;
  }
  stop() {
    this.target = null;
  }
  next(current, busy, now = Date.now()) {
    if (!this.running || busy) return null;
    if (current === this.target) {
      this.stop();
      return null;
    }
    if (now < this.nextAt) return null;
    this.nextAt = now + 1000;
    return current + Math.sign(this.target - current);
  }
}
