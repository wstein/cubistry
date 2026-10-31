import {
  PhysicalPlayback,
  type PhysicalView,
  type MoveProgress,
} from "../shared/playback.ts";
export { countHtmMoves, type MoveProgress } from "../shared/playback.ts";
export type CounterView = PhysicalView;
import { certifiedStep, type CertifiedCounter } from "./certified.ts";
import {
  createCounterSolver,
  type CounterSolver,
} from "../../adapters/puzlwerk-2x2.ts";
import {
  demand,
  deepFreeze,
  stateEquals,
  type CubeState,
  type LegalMove,
} from "@cubistry/cube-core";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
  presentMove,
} from "@cubistry/cube-mechanics";
import { loadAssets, type LoadedAssets } from "@cubistry/cube-assets";
import {
  configurePrint,
  targetFor,
  validateCounterConfig,
  type CounterDesign,
  type CounterConfig,
  type CounterVariant,
} from "./design.ts";
/** Setup/switch accounting, kept apart from counted session moves. */
export interface ModeSwitchProgress {
  readonly active: boolean;
  readonly completed: number;
  readonly total: number;
  /** Switch moves committed since this print was configured. */
  readonly committed: number;
}
export class CounterController extends PhysicalPlayback {
  private certified: CertifiedCounter | null = null;
  private solver: CounterSolver | null = null;
  private configuration: CounterConfig | null = null;
  private switching: ModeSwitchProgress = Object.freeze({
    active: false,
    completed: 0,
    total: 0,
    committed: 0,
  });
  private readonly design: CounterDesign;
  private readonly resolveAssets: typeof loadAssets;
  private readonly prepareSolver: typeof createCounterSolver;
  constructor(
    view: PhysicalView,
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
    super(view, onState);
    this.design = design;
    this.resolveAssets = resolveAssets;
    this.prepareSolver = prepareSolver;
  }
  protected get maximumValue(): number {
    return 99;
  }
  get config(): CounterConfig | null {
    return this.configuration;
  }
  /** The permanent print variant of the configured route (titled without one). */
  get variant(): CounterVariant {
    return this.certified?.variant ?? "titled";
  }
  get modeSwitch(): ModeSwitchProgress {
    return this.switching;
  }
  override request(value: number): void {
    demand(!this.switching.active, "Wait for the mode switch to finish");
    super.request(value);
  }
  /**
   * Switch between two stored routes on the same permanent print at the
   * current value. The cube must be in the active route's canonical state for
   * that value, and the given word must reach the other route's canonical
   * state for the same value (the blank-top switch word at 00, or an empty
   * word where both routes store the identical complete state). Every turn is
   * animated and committed to the authoritative state; the turns count as
   * setup/switch moves, never as session moves or a counted step.
   */
  async switchRoute(
    next: CertifiedCounter,
    moves: readonly LegalMove[],
  ): Promise<void> {
    demand(
      !this.queued && !this.configuring && !this.failed,
      "Wait for current work before switching modes",
    );
    const route = this.certified;
    demand(route && this.print && this.authoritative, "Counter is not configured");
    demand(
      next.variant === route.variant &&
        JSON.stringify([next.print.cubies, next.print.stickers]) ===
          JSON.stringify([route.print.cubies, route.print.stickers]),
      "A mode switch must keep the same permanent print",
    );
    const value = this.current;
    demand(
      stateEquals(this.authoritative, route.states[value]),
      "Modes switch only from the active route's canonical state",
    );
    const print = this.print;
    const configured: CertifiedCounter = deepFreeze({
      ...next,
      print,
      states: next.states.map((state) => ({ ...state, printId: print.id })),
    });
    demand(
      stateEquals(applyMoves(this.authoritative, moves), configured.states[value]),
      "Switch word does not reach the other mode's canonical state",
    );
    this.queued = true;
    this.switching = Object.freeze({
      ...this.switching,
      active: true,
      completed: 0,
      total: moves.length,
    });
    this.notify();
    try {
      for (const move of moves) {
        const presentation = presentMove(this.authoritative, move);
        await this.animateMove(presentation);
        this.authoritative = presentation.to;
        this.switching = Object.freeze({
          ...this.switching,
          completed: this.switching.completed + 1,
          committed: this.switching.committed + 1,
        });
        this.notify();
      }
      demand(
        stateEquals(this.authoritative, configured.states[value]) &&
          matchesTarget(
            print,
            this.authoritative,
            targetFor(value, configured.padded, configured.variant),
          ),
        "Incorrect completed mode switch",
      );
      this.certified = configured;
      this.configuration = deepFreeze({
        ...this.configuration!,
        padded: configured.padded,
      });
      this.switching = Object.freeze({ ...this.switching, active: false });
    } catch (e) {
      this.failed = true;
      this.switching = Object.freeze({ ...this.switching, active: false });
      this.playback = Object.freeze({ ...this.playback, status: "failed", queuedTarget: null });
      this.queued = false;
      this.onState(this.current, false, e instanceof Error ? e : Error(String(e)), this.playback);
      throw e;
    } finally {
      this.queued = false;
    }
    this.notify();
  }
  protected targetState(value: number): CubeState {
    demand(this.print, "Counter is not configured");
    return (
      this.certified?.states[value] ??
      applyMoves(
        initialState(this.print),
        parseAlg(this.design.witnesses[value].word),
      )
    );
  }
  protected targetMoves(
    from: CubeState,
    target: CubeState,
    value: number,
  ): readonly LegalMove[] {
    demand(this.solver, "Counter is not configured");
    return (
      (this.certified &&
        certifiedStep(this.certified, from, this.current, value)) ??
      this.solver.solve(from, target, {
        coordinateFrames: this.certified !== null,
      })
    );
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    demand(this.print && this.configuration, "Counter is not configured");
    return matchesTarget(
      this.print,
      state,
      targetFor(value, this.configuration.padded, this.variant),
    );
  }
  async configure(
    label: string,
    padded: boolean,
    value = 15,
    certified: CertifiedCounter | null = null,
  ): Promise<void> {
    demand(
      !this.queued && !this.configuring,
      "Wait for current work before applying a new print",
    );
    demand(
      Number.isInteger(value) && value >= 0 && value <= 99,
      "Invalid initial value",
    );
    demand(
      !certified || certified.padded === padded,
      certified?.padded
        ? "Certified print requires leading-zero format"
        : "This route requires the no-leading-zero format",
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
      const instance = await configurePrint(
        this.design,
        config,
        certified?.print,
      );
      fresh = await this.resolveAssets(instance.assets, [instance.print]);
      const solver = await this.prepareSolver(instance.print);
      const configuredRoute = certified
        ? deepFreeze({
            ...certified,
            print: instance.print,
            states: certified.states.map((state) => ({
              ...state,
              printId: instance.print.id,
            })),
          })
        : null;
      const state =
        configuredRoute?.states[value] ??
        applyMoves(
          initialState(instance.print),
          parseAlg(this.design.witnesses[value].word),
        );
      demand(
        matchesTarget(
          instance.print,
          state,
          targetFor(value, padded, certified?.variant ?? "titled"),
        ),
        "Initial goal failed",
      );
      this.install(instance.print, state, fresh, value);
      fresh = null;
      this.solver = solver;
      this.certified = configuredRoute;
      this.configuration = config;
      this.switching = Object.freeze({
        active: false,
        completed: 0,
        total: 0,
        committed: 0,
      });
    } finally {
      fresh?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
