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
  type CubeState,
  type LegalMove,
} from "@cubistry/cube-core";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { loadAssets, type LoadedAssets } from "@cubistry/cube-assets";
import {
  configurePrint,
  targetFor,
  validateCounterConfig,
  type CounterDesign,
  type CounterConfig,
} from "./design.ts";
export class CounterController extends PhysicalPlayback {
  private certified: CertifiedCounter | null = null;
  private solver: CounterSolver | null = null;
  private configuration: CounterConfig | null = null;
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
      targetFor(value, this.configuration.padded),
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
      !certified || padded,
      "Certified print requires leading-zero format",
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
        matchesTarget(instance.print, state, targetFor(value, padded)),
        "Initial goal failed",
      );
      this.install(instance.print, state, fresh, value);
      fresh = null;
      this.solver = solver;
      this.certified = configuredRoute;
      this.configuration = config;
    } finally {
      fresh?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
