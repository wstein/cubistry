import {
  demand,
  stateEquals,
  type CubeState,
  type LegalMove,
} from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  inverseMoves,
  matchesTarget,
  serializeMove,
  type MovePresentation,
} from "@cubistry/cube-mechanics";
import { loadAssets } from "@cubistry/cube-assets";
import {
  PhysicalPlayback,
  type PhysicalView,
  type MoveProgress,
} from "../shared/playback.ts";
import type { StatusDefinition } from "./definition.ts";

/** Status composition uses the existing committed-pose playback, not a second runtime. */
export class StatusController extends PhysicalPlayback {
  readonly definition: StatusDefinition;
  private reference: readonly LegalMove[] = [];
  private readonly resolveAssets: typeof loadAssets;
  constructor(
    view: PhysicalView,
    definition: StatusDefinition,
    changed: (
      value: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
  ) {
    super(view, changed);
    this.definition = definition;
    this.resolveAssets = resolveAssets;
  }
  protected get maximumValue(): number {
    return this.definition.statuses.length - 1;
  }
  get currentStatus(): string {
    return this.definition.statuses[this.currentValue].id;
  }
  get sourceReference(): readonly LegalMove[] {
    return Object.freeze([...this.reference]);
  }
  requestStatus(id: string): void {
    demand(
      !this.failed,
      "Physical playback failed. Reload before requesting another status.",
    );
    const value = this.definition.statuses.findIndex((s) => s.id === id);
    demand(value >= 0, "Unknown physical workflow status");
    this.request(value);
  }
  protected targetState(value: number): CubeState {
    return this.definition.statuses[value].state;
  }
  protected targetMoves(
    from: CubeState,
    target: CubeState,
    value: number,
  ): readonly LegalMove[] {
    if (stateEquals(from, target)) return Object.freeze([]);
    const source = initialState(this.definition.print);
    demand(
      stateEquals(applyMoves(source, this.reference), from),
      "Committed status reference is out of sync",
    );
    const moves = [
      ...inverseMoves(this.reference),
      ...this.definition.statuses[value].moves,
    ];
    demand(
      stateEquals(applyMoves(from, moves), target),
      "Status route failed exact physical replay",
    );
    return Object.freeze(moves);
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(
      this.definition.print,
      state,
      this.definition.statuses[value].target,
    );
  }
  protected async animateMove(presentation: MovePresentation): Promise<void> {
    await this.view.animate(presentation);
    // Track only completed turns. A rejected or superseded in-flight turn is
    // never guessed to have completed. Route inversion peels this stack back.
    const last = this.reference.at(-1),
      inverse = inverseMoves([presentation.move])[0];
    this.reference =
      last && serializeMove(last) === serializeMove(inverse)
        ? this.reference.slice(0, -1)
        : [...this.reference, presentation.move];
  }
  protected notify(error?: Error): void {
    const status = this.definition.statuses[this.currentValue];
    if (this.state && stateEquals(this.state, status.state))
      this.reference = status.moves;
    super.notify(error);
  }
  async configure(): Promise<void> {
    demand(!this.busy && !this.configuring, "Wait for current status playback");
    this.configuring = true;
    let assets;
    try {
      assets = await this.resolveAssets(this.definition.assets, [
        this.definition.print,
      ]);
      const value = this.definition.statuses.findIndex(
        (s) => s.id === this.definition.initial,
      );
      const status = this.definition.statuses[value];
      this.install(this.definition.print, status.state, assets, value);
      this.reference = status.moves;
      assets = undefined;
    } finally {
      assets?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
