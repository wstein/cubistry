import {
  PhysicalPlayback,
  type PhysicalView,
  type MoveProgress,
} from "../shared/playback.ts";
import {
  demand,
  stateEquals,
  type CubeState,
  type LegalMove,
} from "@cubistry/cube-core";
import type { MovePresentation } from "@cubistry/cube-mechanics";
import {
  applyMoves,
  initialState,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { loadAssets, type AssetManifest } from "@cubistry/cube-assets";
import { hsmTarget, type HsmDesign, type Letter } from "./design.ts";
import { HsmPlanner } from "./planner.ts";
import { routeTurnTiming } from "../shared/turn-timing.ts";
export class HsmController extends PhysicalPlayback {
  private readonly design: HsmDesign;
  private readonly manifest: AssetManifest;
  private readonly resolveAssets: typeof loadAssets;
  private readonly planner = new HsmPlanner();
  private planned: readonly LegalMove[] = [];
  readonly letter: Letter;
  private range = 59;
  private direction = 1;
  private prepared: {
    source: CubeState;
    value: number;
    moves: readonly LegalMove[];
    target: CubeState;
  } | null = null;
  private timing: {
    target: number;
    endAt: number;
    quarterDurationMs: number;
    revision: number;
  } | null = null;
  private revision = 0;
  /** Clock-only angular schedule; standalone counting keeps its existing speed contract. */
  setDeadline(target: number, endAt: number, quarterDurationMs: number): void {
    demand(
      Number.isFinite(endAt) &&
        Number.isFinite(quarterDurationMs) &&
        quarterDurationMs >= 10,
      "Invalid HSM angular deadline",
    );
    if (
      this.timing?.target === target &&
      this.timing.endAt === endAt &&
      this.timing.quarterDurationMs === quarterDurationMs
    )
      return;
    this.timing = {
      target,
      endAt,
      quarterDurationMs,
      revision: ++this.revision,
    };
  }
  clearDeadline(): void {
    this.timing = null;
    this.revision++;
  }
  protected animateMove(presentation: MovePresentation): Promise<void> {
    const index = this.playback.completed;
    return this.view.animate(
      presentation,
      this.timing
        ? () =>
            this.timing?.target === this.playback.target
              ? routeTurnTiming(
                  this.planned,
                  index,
                  this.timing.endAt,
                  this.timing.quarterDurationMs,
                  this.timing.revision,
                )
              : null
        : undefined,
    );
  }
  prepare(value: number): readonly LegalMove[] {
    demand(!this.busy, "HSM must be settled before preparation");
    this.prepareTarget(value);
    return this.planned;
  }
  setMode(range: number, direction: number): void {
    demand(
      [11, 23, 59].includes(range) && [1, -1].includes(direction),
      "Invalid HSM counting mode",
    );
    if (this.range !== range || this.direction !== direction)
      this.prepared = null;
    this.range = range;
    this.direction = direction;
  }
  constructor(
    view: PhysicalView,
    design: HsmDesign,
    manifest: AssetManifest,
    letter: Letter,
    onState: (
      v: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
  ) {
    super(view, onState);
    this.design = design;
    this.manifest = manifest;
    this.letter = letter;
    this.resolveAssets = resolveAssets;
  }
  protected get maximumValue(): number {
    return 59;
  }
  protected targetState(value: number): CubeState {
    return this.prepareTarget(value);
  }
  private prepareTarget(value: number): CubeState {
    demand(this.state, "HSM counter not configured");
    demand(
      Number.isInteger(value) && value >= 0 && value <= 59,
      "Invalid HSM target",
    );
    if (
      this.prepared?.value === value &&
      stateEquals(this.prepared.source, this.state)
    ) {
      this.planned = this.prepared.moves;
      return this.prepared.target;
    }
    const next = (value + this.direction + this.range + 1) % (this.range + 1);
    this.planned = this.planner.plan(
      this.design.print,
      this.state,
      this.letter,
      value,
      next,
      this.letter === "M" && this.range === 59 && this.direction === -1
        ? 1
        : 13,
    );
    const target = applyMoves(this.state, this.planned);
    this.prepared = { source: this.state, value, moves: this.planned, target };
    return target;
  }
  protected targetMoves(): readonly LegalMove[] {
    return this.planned;
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(
      this.design.print,
      state,
      hsmTarget(this.letter, value),
    );
  }
  async configure(value = 0): Promise<void> {
    demand(!this.busy && !this.configuring, "Wait for HSM motion");
    demand(
      Number.isInteger(value) && value >= 0 && value <= 59,
      "Invalid HSM initial value",
    );
    this.configuring = true;
    let assets;
    try {
      assets = await this.resolveAssets(this.manifest, [this.design.print]);
      let state = applyMoves(
        initialState(this.design.print),
        parseAlg(this.design.zeroWords[this.letter]),
      );
      if (value !== 0)
        state = applyMoves(
          state,
          this.planner.plan(this.design.print, state, this.letter, value),
        );
      this.prepared = null;
      this.clearDeadline();
      this.install(this.design.print, state, assets, value);
      assets = undefined;
    } finally {
      assets?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
