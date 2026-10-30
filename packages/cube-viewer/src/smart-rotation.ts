import { Quaternion, Vector3 } from "three";
/** Friction adapted from CubeAssembler DragInertia.res at
 * 01ff47f7018182994283b201d67edbd82fb499c3, MIT © 2026 Werner Stein.
 * See the adjacent CUBE_ASSEMBLER_LICENSE.txt file. All time units here are seconds. */
export const ROTATION_TUNING = Object.freeze({
  dampingSeconds: .24, stopSpeed: .03, maximumSpeed: 6, velocityFilterSeconds: .04,
  staleReleaseSeconds: .1, toleranceRadians: 25 * Math.PI / 180,
  idleSeconds: 2, returnSeconds: 1, pitchLimit: Math.PI / 2 - .05,
  levelingSeconds: 1, reducedLevelingSeconds: .15,
});
export type RotationMode = "smart" | "free" | "classic";
export type RotationPhase = "idle" | "dragging" | "coasting" | "awaiting-return" | "returning" | "leveling";
export const rotationModes: readonly RotationMode[] = ["smart", "free", "classic"];
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
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
  private readonly upright = new Quaternion();
  private readonly residual = new Quaternion();
  private readonly levelTarget = new Quaternion();
  private pitch = 0;
  private yaw = 0;
  private anchorPitch = 0;
  private anchorYaw = 0;
  private returnPitch = 0;
  private returnYaw = 0;
  private levelingRequested = false;
  private levelAt = 0;
  private levelDuration = 1;
  private phaseValue: RotationPhase = "idle";
  private modeValue: RotationMode;
  private reduced = false;
  private suspended = false;
  private disposed = false;
  private lastTime: number | null = null;
  private lastSample = 0;
  private lastMotion: number | null = null;
  private returnAt: number | null = null;
  private anchorCandidate = false;
  constructor(initial: Quaternion, mode: RotationMode = "smart", reducedMotion = false) {
    if (![initial.x, initial.y, initial.z, initial.w].every(Number.isFinite) || initial.lengthSq() < 1e-12 || !rotationModes.includes(mode))
      throw Error("Invalid presentation orientation or mode");
    this.quaternion = initial.clone().normalize();
    this.closestUpright();
    this.initial = this.upright.clone(); this.anchor = this.initial.clone();
    this.anchorPitch = this.pitch; this.anchorYaw = this.yaw;
    if (mode !== "free") this.quaternion.copy(this.initial);
    this.residual.identity(); this.modeValue = mode; this.reduced = reducedMotion;
  }
  get phase(): RotationPhase { return this.phaseValue; }
  get mode(): RotationMode { return this.modeValue; }
  get reducedMotion(): boolean { return this.reduced; }
  get angularSpeed(): number { return this.velocity.length(); }
  get returnDeadline(): number | null { return this.returnAt; }
  private time(at: number): void { if (!Number.isFinite(at) || at < 0) throw Error("Invalid rotation time"); }
  /** Closest allowed Rx(pitch)Ry(yaw): maximize absolute quaternion dot.
   * The squared optimal-yaw dot is A+B*cos(pitch)+C*sin(pitch).
   * atan2 selects its maximum; clamping selects the nearest allowed endpoint.
   * Degenerate ties deterministically use atan2(0,0)=0 / the positive endpoint. */
  private closestUpright(): void {
    const { x, y, z, w } = this.quaternion;
    const pitch = Math.atan2(2 * (x * w + y * z), w * w + y * y - x * x - z * z);
    this.pitch = Math.max(-ROTATION_TUNING.pitchLimit, Math.min(ROTATION_TUNING.pitchLimit, pitch));
    const sp = Math.sin(this.pitch / 2), cp = Math.cos(this.pitch / 2);
    const yaw = 2 * Math.atan2(y * cp + z * sp, x * sp + w * cp);
    this.yaw += wrap(yaw - this.yaw);
    this.composeUpright();
  }
  private composeUpright(): void {
    const sp = Math.sin(this.pitch / 2), cp = Math.cos(this.pitch / 2);
    const sy = Math.sin(this.yaw / 2), cy = Math.cos(this.yaw / 2);
    this.upright.set(sp * cy, cp * sy, sp * sy, cp * cy).normalize();
  }
  private prepareUpright(): void {
    if (this.levelingRequested) this.composeUpright();
    else this.closestUpright();
    this.residual.copy(this.upright).invert().premultiply(this.quaternion).normalize();
    if (this.residual.angleTo(this.delta.identity()) < 1e-7) this.residual.identity();
  }
  private rotate(vector: Vector3, scale = 1): void {
    const angle = vector.length() * scale;
    if (angle === 0) return;
    if (this.modeValue === "free") {
      this.axis.copy(vector).normalize(); this.delta.setFromAxisAngle(this.axis, angle);
      this.quaternion.premultiply(this.delta).normalize();
    } else {
      this.pitch = Math.max(-ROTATION_TUNING.pitchLimit, Math.min(ROTATION_TUNING.pitchLimit, this.pitch + vector.x * scale));
      this.yaw += vector.y * scale; this.composeUpright();
      // An interrupted explicit leveling bridge carries existing roll without
      // dropping it on pointerdown. Upright input never creates a new residual.
      this.quaternion.copy(this.upright).premultiply(this.residual).normalize();
    }
  }
  private beginLevel(at: number): void {
    this.stop(); this.returnFrom.copy(this.quaternion); this.composeUpright(); this.levelTarget.copy(this.upright);
    this.levelAt = at; this.levelDuration = this.reduced ? ROTATION_TUNING.reducedLevelingSeconds : ROTATION_TUNING.levelingSeconds;
    this.phaseValue = "leveling";
  }
  private stop(): void { this.velocity.set(0, 0, 0); this.returnAt = null; }
  private settle(at: number): void {
    this.stop(); this.phaseValue = "idle";
    if (this.suspended || this.disposed) return;
    if (this.modeValue !== "free" && this.levelingRequested && this.quaternion.angleTo(this.upright) > 1e-7) {
      this.beginLevel(at); return;
    }
    this.levelingRequested = false;
    if (this.modeValue !== "smart" || this.reduced) return;
    const distance = this.quaternion.angleTo(this.anchor);
    if (this.anchorCandidate && distance <= ROTATION_TUNING.toleranceRadians + 1e-12) {
      this.anchor.copy(this.quaternion); this.anchorPitch = this.pitch; this.anchorYaw = this.yaw;
    }
    else if (distance > 1e-7) { this.phaseValue = "awaiting-return"; this.returnAt = at + ROTATION_TUNING.idleSeconds; }
    // Only an actual user rotation can propose a new anchor. Automatic
    // interpolation, taps, settings and visibility changes cannot walk it.
    this.anchorCandidate = false;
  }
  /** Freeze the last displayed quaternion immediately, including a below-threshold click. */
  down(at: number): void {
    this.time(at); if (this.disposed || this.suspended) return;
    if (this.modeValue !== "free") this.prepareUpright();
    this.stop(); this.phaseValue = "dragging"; this.lastTime = this.lastSample = at; this.lastMotion = null;
  }
  /** View-space angular increments: +X follows downward drag, +Y follows rightward drag. */
  drag(pitch: number, yaw: number, at: number): void {
    this.time(at); if (![pitch, yaw].every(Number.isFinite)) throw Error("Invalid rotation input");
    if (this.phaseValue !== "dragging" || this.disposed || this.suspended) return;
    if (at < this.lastSample) return;
    const elapsed = at - this.lastSample; this.lastSample = at; this.lastTime = at;
    const input = this.input.set(pitch, yaw, 0);
    const previousPitch = this.pitch;
    this.rotate(input);
    if (this.modeValue !== "free") input.x = this.pitch - previousPitch;
    if (input.lengthSq() > 0) { this.lastMotion = at; this.anchorCandidate = true; }
    if (elapsed <= 0 || this.modeValue === "classic" || this.reduced) { this.velocity.set(0, 0, 0); return; }
    // No 8 ms floor: a real 144 Hz input stream must estimate the same speed.
    const measured = input.multiplyScalar(1 / elapsed);
    if (measured.length() > ROTATION_TUNING.maximumSpeed) measured.setLength(ROTATION_TUNING.maximumSpeed);
    this.velocity.lerp(measured, 1 - Math.exp(-elapsed / ROTATION_TUNING.velocityFilterSeconds));
    if (this.velocity.length() > ROTATION_TUNING.maximumSpeed) this.velocity.setLength(ROTATION_TUNING.maximumSpeed);
    // A dragged boundary is already a physical presentation stop. Do not
    // retain filtered outward momentum that can overpower the next reversal.
    if (this.modeValue !== "free" &&
        ((this.pitch >= ROTATION_TUNING.pitchLimit - 1e-12 && this.velocity.x > 0) ||
         (this.pitch <= -ROTATION_TUNING.pitchLimit + 1e-12 && this.velocity.x < 0))) this.velocity.x = 0;
  }
  up(at: number, cancelled = false): void {
    this.time(at); if (this.phaseValue !== "dragging" || this.disposed || this.suspended) return;
    const age = this.lastMotion === null ? Infinity : Math.max(0, at - this.lastMotion);
    if (age >= ROTATION_TUNING.staleReleaseSeconds || cancelled || this.modeValue === "classic" || this.reduced) this.velocity.set(0, 0, 0);
    else this.velocity.multiplyScalar(Math.exp(-age / ROTATION_TUNING.velocityFilterSeconds));
    this.lastTime = at;
    if (this.modeValue !== "free" && this.levelingRequested) { this.settle(at); return; }
    if (this.velocity.length() > ROTATION_TUNING.stopSpeed) this.phaseValue = "coasting";
    else this.settle(at);
  }
  /** Advance analytic coast/settle/return boundaries even when one frame spans several phases. */
  step(at: number): void {
    this.time(at); if (this.disposed || this.suspended) return;
    const previous = this.lastTime; if (previous !== null && at < previous) return;
    this.lastTime = at;
    if (previous === null || this.phaseValue === "dragging" || this.phaseValue === "idle") return;
    let cursor = previous;
    while (this.phaseValue === "coasting") {
      const speed = this.velocity.length(), elapsed = at - cursor;
      const untilStop = speed > ROTATION_TUNING.stopSpeed
        ? ROTATION_TUNING.dampingSeconds * Math.log(speed / ROTATION_TUNING.stopSpeed) : 0;
      let untilClamp = Infinity;
      if (this.modeValue !== "free" && this.velocity.x !== 0) {
        const bound = Math.sign(this.velocity.x) * ROTATION_TUNING.pitchLimit;
        const ratio = (bound - this.pitch) / (this.velocity.x * ROTATION_TUNING.dampingSeconds);
        if (ratio >= 0 && ratio < 1) untilClamp = -ROTATION_TUNING.dampingSeconds * Math.log1p(-ratio);
      }
      const span = Math.min(elapsed, untilStop, untilClamp), decay = Math.exp(-span / ROTATION_TUNING.dampingSeconds);
      this.rotate(this.velocity, ROTATION_TUNING.dampingSeconds * (1 - decay));
      this.velocity.multiplyScalar(decay); cursor += span;
      if (untilClamp <= span + 1e-12) {
        this.pitch = Math.sign(this.velocity.x) * ROTATION_TUNING.pitchLimit;
        this.velocity.x = 0; this.composeUpright(); this.quaternion.copy(this.upright);
        if (this.velocity.length() <= ROTATION_TUNING.stopSpeed) this.settle(cursor);
        else if (cursor < at) continue;
        else return;
      } else if (untilStop <= span + 1e-12) this.settle(cursor);
      else return;
    }
    if (this.phaseValue === "leveling") {
      const fraction = at + 1e-12 >= this.levelAt + this.levelDuration ? 1
        : Math.max(0, (at - this.levelAt) / this.levelDuration);
      this.quaternion.slerpQuaternions(this.returnFrom, this.levelTarget, smooth(fraction)).normalize();
      if (fraction < 1) return;
      this.quaternion.copy(this.levelTarget); this.residual.identity(); this.levelingRequested = false;
      this.settle(this.levelAt + this.levelDuration);
    }
    if (this.phaseValue === "awaiting-return" && this.returnAt !== null && at >= this.returnAt) {
      this.returnPitch = this.pitch; this.returnYaw = this.yaw;
      this.phaseValue = "returning";
    }
    if (this.phaseValue === "returning" && this.returnAt !== null) {
      const fraction = Math.max(0, Math.min(1, (at - this.returnAt) / ROTATION_TUNING.returnSeconds));
      const eased = smooth(fraction);
      this.pitch = this.returnPitch + (this.anchorPitch - this.returnPitch) * eased;
      this.yaw = this.returnYaw + wrap(this.anchorYaw - this.returnYaw) * eased;
      this.composeUpright(); this.quaternion.copy(this.upright);
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
    const changed = mode !== this.modeValue;
    this.modeValue = mode;
    if (changed && mode !== "free") {
      this.prepareUpright();
      this.levelingRequested = this.quaternion.angleTo(this.upright) > 1e-7;
    } else if (mode === "free") this.levelingRequested = false;
    this.interact(at);
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
    this.closestUpright(); this.anchorPitch = this.pitch; this.anchorYaw = this.yaw;
    this.residual.identity(); this.levelingRequested = false;
    this.phaseValue = "idle"; this.lastTime = at; this.lastMotion = null; this.anchorCandidate = false;
  }
  dispose(): void { this.stop(); this.phaseValue = "idle"; this.disposed = true; }
}
