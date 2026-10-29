import {
  demand,
  stateEquals,
  type CubeState,
  type LegalMove,
  type PrintDefinition,
} from "@cubistry/cube-core";
import { presentMove, type MovePresentation } from "@cubistry/cube-mechanics";
import type { MotionTimingSource } from "@cubistry/cube-viewer";
import { type LoadedAssets } from "@cubistry/cube-assets";
export interface PhysicalView {
  configure(
    print: PrintDefinition,
    state: CubeState,
    assets: LoadedAssets,
  ): void;
  animate(presentation: MovePresentation, timing?: MotionTimingSource): Promise<void>;
  resetCamera(): void;
}
/** HTM counts each already-validated outer-face token once, including half turns. */
export const countHtmMoves = (moves: readonly LegalMove[]): number =>
  moves.length;
export interface MoveProgress {
  readonly sessionTotal: number;
  readonly completed: number;
  readonly total: number;
  readonly target: number | null;
  readonly queuedTarget: number | null;
  readonly status:
    | "idle"
    | "playing"
    | "stopping"
    | "completed"
    | "stopped"
    | "failed";
}

/** One authoritative state and bounded active/latest queue, shared by display apps. */
export abstract class PhysicalPlayback {
  protected print: PrintDefinition | null = null;
  protected authoritative: CubeState | null = null;
  protected assets: LoadedAssets | null = null;
  protected configuring = false;
  protected desired = 0;
  protected current = 0;
  protected queued = false;
  protected failed = false;
  protected activeTarget: number | null = null;
  protected stopping = false;
  private betweenTargets = false;
  protected playback: MoveProgress = Object.freeze({
    sessionTotal: 0,
    completed: 0,
    total: 0,
    target: null,
    queuedTarget: null,
    status: "idle",
  });
  protected readonly view: PhysicalView;
  protected readonly onState: (
    value: number,
    busy: boolean,
    error?: Error,
    progress?: MoveProgress,
  ) => void;
  constructor(
    view: PhysicalView,
    onState: (
      value: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
  ) {
    this.view = view;
    this.onState = onState;
  }
  protected abstract get maximumValue(): number;
  protected abstract targetState(value: number): CubeState;
  protected abstract targetMoves(
    from: CubeState,
    target: CubeState,
    value: number,
  ): readonly LegalMove[];
  protected abstract matchesDisplay(state: CubeState, value: number): boolean;
  get state(): CubeState | null {
    return this.authoritative;
  }
  get progress(): MoveProgress {
    return this.playback;
  }
  get busy(): boolean {
    return this.queued;
  }
  get currentValue(): number {
    return this.current;
  }
  resetCamera(): void {
    this.view.resetCamera();
  }
  dispose(): void {
    demand(
      !this.queued && !this.configuring,
      "Wait for current work before releasing a display",
    );
    this.assets?.dispose();
    this.assets = null;
    this.print = null;
    this.authoritative = null;
  }
  resetSessionMoves(): void {
    demand(
      !this.queued && !this.configuring,
      "Wait for current work before resetting session moves",
    );
    this.progressUpdate({ sessionTotal: 0 });
  }
  protected notify(error?: Error): void {
    this.onState(this.current, this.queued, error, this.playback);
  }
  protected progressUpdate(patch: Partial<MoveProgress>): void {
    this.playback = Object.freeze({ ...this.playback, ...patch });
    this.notify();
  }
  protected install(
    print: PrintDefinition,
    state: CubeState,
    assets: LoadedAssets,
    value: number,
  ): void {
    this.view.configure(print, state, assets);
    const previous = this.assets;
    this.assets = assets;
    previous?.dispose();
    this.print = print;
    this.authoritative = state;
    this.current = this.desired = value;
    this.failed = false;
    this.activeTarget = null;
    this.stopping = false;
    this.betweenTargets = false;
    this.playback = Object.freeze({
      sessionTotal: 0,
      completed: 0,
      total: 0,
      target: value,
      queuedTarget: null,
      status: "idle",
    });
  }
  request(value: number): void {
    demand(!this.configuring, "Print configuration is still loading");
    demand(
      Number.isInteger(value) && value >= 0 && value <= this.maximumValue,
      "Invalid display value",
    );
    demand(this.authoritative && this.print, "Display is not configured");
    this.desired = value;
    this.stopping = false;
    if (!this.queued && !this.failed && value === this.current) {
      this.progressUpdate({
        completed: 0,
        total: 0,
        target: value,
        queuedTarget: null,
        status: "completed",
      });
      return;
    }
    if (this.queued)
      this.progressUpdate({
        status: "playing",
        queuedTarget: value === this.activeTarget ? null : value,
      });
    if (!this.queued && !this.failed) void this.drain();
  }
  /** Cancel queued work by finishing the active value, never an idle partial face. */
  stopAfterCurrent(): number | null {
    if (!this.queued || this.activeTarget === null) return null;
    this.desired = this.activeTarget;
    this.stopping = true;
    this.progressUpdate({ status: "stopping", queuedTarget: null });
    return this.activeTarget;
  }
  protected animateMove(presentation: MovePresentation): Promise<void> {
    return this.view.animate(presentation);
  }
  private async drain(): Promise<void> {
    demand(this.print && this.authoritative, "Display is not configured");
    this.queued = true;
    try {
      // A superseded route can leave a legal intermediate pose even when the
      // latest requested number equals the last completed display.
      while (this.current !== this.desired || this.betweenTargets) {
        const target = this.desired;
        const targetState = this.targetState(target);
        const moves = this.targetMoves(this.authoritative, targetState, target);
        this.activeTarget = target;
        this.progressUpdate({
          completed: 0,
          total: countHtmMoves(moves),
          target,
          queuedTarget: null,
          status: "playing",
        });
        let superseded = false;
        for (const move of moves) {
          if (this.desired !== target) {
            superseded = true;
            break;
          }
          const presentation = presentMove(this.authoritative, move);
          await this.animateMove(presentation);
          this.authoritative = presentation.to;
          this.progressUpdate({
            completed: this.playback.completed + 1,
            sessionTotal: this.playback.sessionTotal + 1,
          });
        }
        // Requests may change during an awaited turn or its progress callback.
        // Commit that turn once, then replan directly from its complete state.
        if (superseded || this.desired !== target) {
          this.betweenTargets = true;
          this.activeTarget = null;
          continue;
        }
        demand(
          stateEquals(this.authoritative, targetState),
          "Incorrect completed physical counter state",
        );
        demand(
          this.matchesDisplay(this.authoritative, target),
          "Incorrect completed display target",
        );
        this.current = target;
        this.betweenTargets = false;
        this.activeTarget = null;
        this.progressUpdate({
          status: this.stopping ? "stopped" : "completed",
          queuedTarget: this.desired === target ? null : this.desired,
        });
      }
    } catch (e) {
      this.failed = true;
      this.playback = Object.freeze({
        ...this.playback,
        status: "failed",
        queuedTarget: null,
      });
      this.queued = false;
      this.onState(
        this.current,
        false,
        e instanceof Error ? e : Error(String(e)),
        this.playback,
      );
    } finally {
      this.queued = false;
      if (!this.failed) this.notify();
    }
  }
}
