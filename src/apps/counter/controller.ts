import {
  demand,
  type CubeState,
  type PrintDefinition,
} from "@cubistry/cube-core";
import {
  initialState,
  applyMoves,
  parseAlg,
  inverseMoves,
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
/** Product target selection and queue live here, outside the generic viewer. */
export class CounterController {
  private print: PrintDefinition | null = null;
  private authoritative: CubeState | null = null;
  private configuration: CounterConfig | null = null;
  private assets: LoadedAssets | null = null;
  private configuring = false;
  private desired = 15;
  private current = 15;
  private queued = false;
  private failed = false;
  private readonly view: CounterView;
  private readonly design: CounterDesign;
  private readonly onState: (
    value: number,
    busy: boolean,
    error?: Error,
  ) => void;
  private readonly resolveAssets: typeof loadAssets;
  constructor(
    view: CounterView,
    design: CounterDesign,
    onState: (value: number, busy: boolean, error?: Error) => void,
    resolveAssets: typeof loadAssets = loadAssets,
  ) {
    this.view = view;
    this.design = design;
    this.onState = onState;
    this.resolveAssets = resolveAssets;
  }
  get state(): CubeState | null {
    return this.authoritative;
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
  async configure(label: string, padded: boolean, value = 15): Promise<void> {
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
      this.authoritative = state;
      this.configuration = config;
      this.current = this.desired = value;
      this.failed = false;
      this.onState(value, false);
    } finally {
      fresh?.dispose();
      this.configuring = false;
    }
  }

  request(value: number): void {
    demand(!this.configuring, "Print configuration is still loading");
    demand(
      Number.isInteger(value) && value >= 0 && value <= 99,
      "Invalid counter value",
    );
    this.desired = value;
    if (!this.queued && !this.failed) void this.drain();
  }
  private async drain(): Promise<void> {
    demand(
      this.print && this.authoritative && this.configuration,
      "Counter is not configured",
    );
    this.queued = true;
    this.onState(this.current, true);
    try {
      while (this.current !== this.desired) {
        const target = this.desired;
        const moves = [
          ...inverseMoves(parseAlg(this.design.witnesses[this.current].word)),
          ...parseAlg(this.design.witnesses[target].word),
        ];
        for (const move of moves) {
          const presentation = presentMove(this.authoritative, move);
          await this.view.animate(presentation);
          this.authoritative = presentation.to;
        }
        demand(
          matchesTarget(
            this.print,
            this.authoritative,
            targetFor(target, this.configuration.padded),
          ),
          "Incorrect completed counter target",
        );
        this.current = target;
        this.onState(target, true);
      }
    } catch (e) {
      this.failed = true;
      this.onState(
        this.current,
        false,
        e instanceof Error ? e : Error(String(e)),
      );
    } finally {
      this.queued = false;
      if (!this.failed) this.onState(this.current, false);
    }
  }
}
