import { Quaternion, Vector3 } from "three";
/** Friction adapted from CubeAssembler DragInertia.res at
 * 01ff47f7018182994283b201d67edbd82fb499c3, MIT © 2026 Werner Stein.
 * See the adjacent CUBE_ASSEMBLER_LICENSE.txt file. All time units here are seconds. */
export const ROTATION_TUNING = Object.freeze({
  dampingSeconds: .24, stopSpeed: .03, maximumSpeed: 6, velocityFilterSeconds: .04,
  staleReleaseSeconds: .1, toleranceRadians: 25 * Math.PI / 180,
  idleSeconds: 5, returnSeconds: 1,
});
export type RotationMode = "smart" | "free" | "classic";
export type RotationPhase = "idle" | "dragging" | "coasting" | "awaiting-return" | "returning";
export const rotationModes: readonly RotationMode[] = ["smart", "free", "classic"];
const smooth = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
/** Presentation only: no renderer, puzzle state, camera, scheduler or DOM ownership. */
export class SmartRotation {
  readonly quaternion: Quaternion;
  readonly anchor: Quaternion;
  private readonly initial: Quaternion;
  private readonly velocity = new Vector3();
  private readonly delta = new Quaternion();
  private readonly axis = new Vector3();
  private readonly input = new Vector3();
  private readonly returnFrom = new Quaternion();
  private phaseValue: RotationPhase = "idle";
  private modeValue: RotationMode;
  private reduced = false;
  private suspended = false;
  private disposed = false;
  private lastTime: number | null = null;
  private lastSample = 0;
  private lastMotion: number | null = null;
  private returnAt: number | null = null;
  constructor(initial: Quaternion, mode: RotationMode = "smart", reducedMotion = false) {
    if (![initial.x, initial.y, initial.z, initial.w].every(Number.isFinite) || initial.lengthSq() < 1e-12 || !rotationModes.includes(mode))
      throw Error("Invalid presentation orientation or mode");
    this.initial = initial.clone().normalize(); this.quaternion = this.initial.clone(); this.anchor = this.initial.clone();
    this.modeValue = mode; this.reduced = reducedMotion;
  }
  get phase(): RotationPhase { return this.phaseValue; }
  get mode(): RotationMode { return this.modeValue; }
  get reducedMotion(): boolean { return this.reduced; }
  get angularSpeed(): number { return this.velocity.length(); }
  get returnDeadline(): number | null { return this.returnAt; }
  private time(at: number): void { if (!Number.isFinite(at) || at < 0) throw Error("Invalid rotation time"); }
  private rotate(vector: Vector3, scale = 1): void {
    const angle = vector.length() * scale;
    if (angle === 0) return;
    this.axis.copy(vector).normalize(); this.delta.setFromAxisAngle(this.axis, angle);
    this.quaternion.premultiply(this.delta).normalize();
  }
  private stop(): void { this.velocity.set(0, 0, 0); this.returnAt = null; }
  private settle(at: number): void {
    this.stop(); this.phaseValue = "idle";
    if (this.modeValue !== "smart" || this.reduced || this.suspended || this.disposed) return;
    if (this.quaternion.angleTo(this.anchor) <= ROTATION_TUNING.toleranceRadians + 1e-12) this.anchor.copy(this.quaternion);
    else { this.phaseValue = "awaiting-return"; this.returnAt = at + ROTATION_TUNING.idleSeconds; }
  }
  /** Freeze the last displayed quaternion immediately, including a below-threshold click. */
  down(at: number): void {
    this.time(at); if (this.disposed || this.suspended) return;
    this.stop(); this.phaseValue = "dragging"; this.lastTime = this.lastSample = at; this.lastMotion = null;
  }
  /** View-space angular increments: +X follows downward drag, +Y follows rightward drag. */
  drag(pitch: number, yaw: number, at: number): void {
    this.time(at); if (![pitch, yaw].every(Number.isFinite)) throw Error("Invalid rotation input");
    if (this.phaseValue !== "dragging" || this.disposed || this.suspended) return;
    if (at < this.lastSample) return;
    const elapsed = at - this.lastSample; this.lastSample = at; this.lastTime = at;
    const input = this.input.set(pitch, yaw, 0);
    this.rotate(input);
    if (input.lengthSq() > 0) this.lastMotion = at;
    if (elapsed <= 0 || this.modeValue === "classic" || this.reduced) { this.velocity.set(0, 0, 0); return; }
    // No 8 ms floor: a real 144 Hz input stream must estimate the same speed.
    const measured = input.multiplyScalar(1 / elapsed);
    if (measured.length() > ROTATION_TUNING.maximumSpeed) measured.setLength(ROTATION_TUNING.maximumSpeed);
    this.velocity.lerp(measured, 1 - Math.exp(-elapsed / ROTATION_TUNING.velocityFilterSeconds));
    if (this.velocity.length() > ROTATION_TUNING.maximumSpeed) this.velocity.setLength(ROTATION_TUNING.maximumSpeed);
  }
  up(at: number, cancelled = false): void {
    this.time(at); if (this.phaseValue !== "dragging" || this.disposed || this.suspended) return;
    const age = this.lastMotion === null ? Infinity : Math.max(0, at - this.lastMotion);
    if (age >= ROTATION_TUNING.staleReleaseSeconds || cancelled || this.modeValue === "classic" || this.reduced) this.velocity.set(0, 0, 0);
    else this.velocity.multiplyScalar(Math.exp(-age / ROTATION_TUNING.velocityFilterSeconds));
    this.lastTime = at;
    if (this.velocity.length() > ROTATION_TUNING.stopSpeed) this.phaseValue = "coasting";
    else this.settle(at);
  }
  /** Advance analytic coast/settle/return boundaries even when one frame spans several phases. */
  step(at: number): void {
    this.time(at); if (this.disposed || this.suspended) return;
    const previous = this.lastTime; if (previous !== null && at < previous) return;
    this.lastTime = at;
    if (previous === null || this.phaseValue === "dragging" || this.phaseValue === "idle") return;
    if (this.phaseValue === "coasting") {
      const speed = this.velocity.length(), elapsed = at - previous;
      const untilStop = Math.max(0, ROTATION_TUNING.dampingSeconds * Math.log(speed / ROTATION_TUNING.stopSpeed));
      const span = Math.min(elapsed, untilStop), decay = Math.exp(-span / ROTATION_TUNING.dampingSeconds);
      this.rotate(this.velocity, ROTATION_TUNING.dampingSeconds * (1 - decay));
      this.velocity.multiplyScalar(decay);
      if (elapsed + 1e-12 >= untilStop) this.settle(previous + span);
      else return;
    }
    if (this.phaseValue === "awaiting-return" && this.returnAt !== null && at >= this.returnAt) {
      this.returnFrom.copy(this.quaternion); this.phaseValue = "returning";
    }
    if (this.phaseValue === "returning" && this.returnAt !== null) {
      const fraction = Math.max(0, Math.min(1, (at - this.returnAt) / ROTATION_TUNING.returnSeconds));
      this.quaternion.slerpQuaternions(this.returnFrom, this.anchor, smooth(fraction)).normalize();
      if (fraction === 1) { this.quaternion.copy(this.anchor); this.phaseValue = "idle"; this.returnAt = null; }
    }
  }
  /** Explicit zoom/settings interaction stops automatic motion without changing orientation. */
  interact(at: number): void {
    this.time(at); if (this.disposed || this.suspended) return;
    this.lastTime = at; this.stop();
    if (this.phaseValue === "dragging") { this.lastSample = at; this.lastMotion = null; }
    else this.settle(at);
  }
  setMode(mode: RotationMode, at: number): void {
    if (!rotationModes.includes(mode)) throw Error("Invalid rotation mode");
    this.modeValue = mode; this.interact(at);
  }
  setReducedMotion(reduced: boolean, at: number): void { this.reduced = reduced; this.interact(at); }
  suspend(at: number): void {
    this.time(at); if (this.disposed) return;
    this.suspended = true; this.stop(); this.phaseValue = "idle"; this.lastTime = at;
  }
  resume(at: number): void {
    this.time(at); if (this.disposed) return;
    this.suspended = false; this.lastTime = at; this.settle(at);
  }
  reset(at: number): void {
    this.time(at); if (this.disposed) return;
    this.stop(); this.quaternion.copy(this.initial); this.anchor.copy(this.initial);
    this.phaseValue = "idle"; this.lastTime = at; this.lastMotion = null;
  }
  dispose(): void { this.stop(); this.phaseValue = "idle"; this.disposed = true; }
}
