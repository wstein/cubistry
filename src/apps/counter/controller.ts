import {
  createCounterSolver,
  type CounterSolver,
} from "../../adapters/puzlwerk-2x2.ts";
import {
  demand,
  stateEquals,
  type CubeState,
  type LegalMove,
  type PrintDefinition,
} from "@cubistry/cube-core";
import {
  initialState,
  applyMoves,
  parseAlg,
  presentMove,
  matchesTarget,
  type MovePresentation,
} from "@cubistry/cube-mechanics";
import { loadAssets, type LoadedAssets } from "@cubistry/cube-assets";
import {
  configurePrint,
  targetFor,
  validateCounterConfig,
  type CounterDesign,
  type CounterConfig,
} from "./design.ts";
export interface CounterView {
  configure(
    print: PrintDefinition,
    state: CubeState,
    assets: LoadedAssets,
  ): void;
  animate(presentation: MovePresentation): Promise<void>;
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
/** Product target selection and queue live here, outside the generic viewer. */
export class CounterController {
  private print: PrintDefinition | null = null;
  private solver: CounterSolver | null = null;
  private authoritative: CubeState | null = null;
  private configuration: CounterConfig | null = null;
  private assets: LoadedAssets | null = null;
  private configuring = false;
  private desired = 15;
  private current = 15;
  private queued = false;
  private failed = false;
  private activeTarget: number | null = null;
  private stopping = false;
  private playback: MoveProgress = Object.freeze({
    sessionTotal: 0,
    completed: 0,
    total: 0,
    target: null,
    queuedTarget: null,
    status: "idle",
  });
  private readonly view: CounterView;
  private readonly design: CounterDesign;
  private readonly onState: (
    value: number,
    busy: boolean,
    error?: Error,
    progress?: MoveProgress,
  ) => void;
  private readonly resolveAssets: typeof loadAssets;
  private readonly prepareSolver: typeof createCounterSolver;
  constructor(
    view: CounterView,
    design: CounterDesign,
    onState: (
      value: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
    prepareSolver: typeof createCounterSolver = createCounterSolver,
  ) {
    this.view = view;
    this.design = design;
    this.onState = onState;
    this.resolveAssets = resolveAssets;
    this.prepareSolver = prepareSolver;
  }
  get state(): CubeState | null {
    return this.authoritative;
  }
  get progress(): MoveProgress {
    return this.playback;
  }
  /** Reset accounting only, never the authoritative physical state or timer. */
  resetSessionMoves(): void {
    demand(!this.queued && !this.configuring, "Wait for current work before resetting session moves");
    this.progressUpdate({ sessionTotal: 0 });
  }
  private notify(error?: Error): void {
    this.onState(this.current, this.queued, error, this.playback);
  }
  private progressUpdate(patch: Partial<MoveProgress>): void {
    this.playback = Object.freeze({ ...this.playback, ...patch });
    this.notify();
  }
  get busy(): boolean {
    return this.queued;
  }
  get currentValue(): number {
    return this.current;
  }
  get config(): CounterConfig | null {
    return this.configuration;
  }
  resetCamera(): void {
    this.view.resetCamera();
  }
  async configure(
    label: string,
    padded: boolean,
    value = 15,
  ): Promise<void> {
    demand(
      !this.queued && !this.configuring,
      "Wait for current work before applying a new print",
    );
    demand(
      Number.isInteger(value) && value >= 0 && value <= 99,
      "Invalid initial value",
    );
    this.configuring = true;
    let fresh: LoadedAssets | null = null;
    try {
      const config = validateCounterConfig({
        label,
        padded,
        wrap: false,
        minimum: 0,
        maximum: 99,
      });
      const instance = await configurePrint(this.design, config);
      fresh = await this.resolveAssets(instance.assets, [instance.print]);
      const solver = await this.prepareSolver(instance.print);
      const state = applyMoves(
        initialState(instance.print),
        parseAlg(this.design.witnesses[value].word),
      );
      demand(
        matchesTarget(instance.print, state, targetFor(value, padded)),
        "Initial goal failed",
      );
      this.view.configure(instance.print, state, fresh);
      const previous = this.assets;
      this.assets = fresh;
      fresh = null;
      previous?.dispose();
      this.print = instance.print;
      this.solver = solver;
      this.authoritative = state;
      this.configuration = config;
      this.current = this.desired = value;
      this.failed = false;
      this.activeTarget = null;
      this.stopping = false;
      this.playback = Object.freeze({
        sessionTotal: 0,
        completed: 0,
        total: 0,
        target: value,
        queuedTarget: null,
        status: "idle",
      });
    } finally {
      fresh?.dispose();
      this.configuring = false;
    }
    this.notify();
  }

  request(value: number): void {
    demand(!this.configuring, "Print configuration is still loading");
    demand(
      Number.isInteger(value) && value >= 0 && value <= 99,
      "Invalid counter value",
    );
    demand(
      this.authoritative && this.configuration,
      "Counter is not configured",
    );
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
  private async drain(): Promise<void> {
    demand(
      this.print &&
        this.authoritative &&
        this.configuration &&
        this.solver,
      "Counter is not configured",
    );
    this.queued = true;
    try {
      while (this.current !== this.desired) {
        const target = this.desired;
        const targetState = applyMoves(
          initialState(this.print),
          parseAlg(this.design.witnesses[target].word),
        );
        const moves = this.solver.solve(this.authoritative, targetState);
        this.activeTarget = target;
        this.progressUpdate({
          completed: 0,
          total: countHtmMoves(moves),
          target,
          queuedTarget: null,
          status: "playing",
        });
        for (const move of moves) {
          const presentation = presentMove(this.authoritative, move);
          await this.view.animate(presentation);
          this.authoritative = presentation.to;
          this.progressUpdate({ completed: this.playback.completed + 1, sessionTotal: this.playback.sessionTotal + 1 });
        }
        demand(
          stateEquals(this.authoritative, targetState),
          "Incorrect completed physical counter state",
        );
        demand(
          matchesTarget(
            this.print,
            this.authoritative,
            targetFor(target, this.configuration.padded),
          ),
          "Incorrect completed counter target",
        );
        this.current = target;
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
