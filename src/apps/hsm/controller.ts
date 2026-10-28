import {
  PhysicalPlayback,
  type PhysicalView,
  type MoveProgress,
} from "../shared/playback.ts";
import { demand, type CubeState, type LegalMove } from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { loadAssets, type AssetManifest } from "@cubistry/cube-assets";
import { hsmTarget, type HsmDesign, type Letter } from "./design.ts";
import { HsmPlanner } from "./planner.ts";
export class HsmController extends PhysicalPlayback {
  private readonly design: HsmDesign;
  private readonly manifest: AssetManifest;
  private readonly resolveAssets: typeof loadAssets;
  private readonly planner = new HsmPlanner();
  private planned: readonly LegalMove[] = [];
  readonly letter: Letter;
  private range = 59;
  private direction = 1;
  setMode(range: number, direction: number): void {
    demand(
      [11, 23, 59].includes(range) && [1, -1].includes(direction),
      "Invalid HSM counting mode",
    );
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
    demand(this.state, "HSM counter not configured");
    const next = (value + this.direction + this.range + 1) % (this.range + 1);
    this.planned = this.planner.plan(
      this.design.print,
      this.state,
      this.letter,
      value,
      next,
    );
    return applyMoves(this.state, this.planned);
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
  async configure(): Promise<void> {
    demand(!this.busy && !this.configuring, "Wait for HSM motion");
    this.configuring = true;
    let assets;
    try {
      assets = await this.resolveAssets(this.manifest, [this.design.print]);
      const state = applyMoves(
        initialState(this.design.print),
        parseAlg(this.design.zeroWords[this.letter]),
      );
      this.install(this.design.print, state, assets, 0);
      assets = undefined;
    } finally {
      assets?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
