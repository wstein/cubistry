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
import { applyMoves, matchesTarget } from "@cubistry/cube-mechanics";
import { loadAssets, type AssetManifest } from "@cubistry/cube-assets";
import { msTarget, MS_MODULUS, type MsLetter, type MsPrint } from "./design.ts";
import { MsPeriod } from "./period.ts";

/**
 * M/S counter on one research print (PR #138). Every turn it plays belongs to
 * a saved period edge of the selected letter: +1 plays the node's word, -1 the
 * previous word inverted, and a jump (Set, Reset, catch-up after an
 * interruption) walks the period the cheaper way round.
 */
export class MsController extends PhysicalPlayback {
  readonly msPrint: MsPrint;
  readonly letter: MsLetter;
  readonly period: MsPeriod;
  private readonly manifest: AssetManifest;
  private readonly resolveAssets: typeof loadAssets;
  private planned: readonly LegalMove[] = [];
  private prepared: {
    source: CubeState;
    value: number;
    moves: readonly LegalMove[];
    target: CubeState;
  } | null = null;
  constructor(
    view: PhysicalView,
    msPrint: MsPrint,
    manifest: AssetManifest,
    letter: MsLetter,
    onState: (
      v: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
  ) {
    super(view, onState);
    demand(letter === "M" || letter === "S", "Invalid M/S letter");
    this.msPrint = msPrint;
    this.letter = letter;
    this.manifest = manifest;
    this.resolveAssets = resolveAssets;
    this.period = new MsPeriod(msPrint.print, msPrint.runs[letter]);
  }
  protected get maximumValue(): number {
    return MS_MODULUS - 1;
  }
  /** Settled period node, or -1 while a route is between two turns. */
  get node(): number {
    return this.state ? this.period.nodeOf(this.state) : -1;
  }
  /** One-based lap of the settled node within the period, and the lap count. */
  get lap(): { readonly lap: number; readonly laps: number } {
    const node = this.node;
    return {
      lap: node < 0 ? 0 : Math.floor(node / MS_MODULUS) + 1,
      laps: this.period.run.laps,
    };
  }
  /** Planned moves from the settled pose to `value`, without playing them. */
  prepare(value: number): readonly LegalMove[] {
    demand(!this.busy, "M/S counter must be settled before preparation");
    this.prepareTarget(value);
    return this.planned;
  }
  protected targetState(value: number): CubeState {
    return this.prepareTarget(value);
  }
  private prepareTarget(value: number): CubeState {
    demand(this.state, "M/S counter not configured");
    if (
      this.prepared?.value === value &&
      stateEquals(this.prepared.source, this.state)
    ) {
      this.planned = this.prepared.moves;
      return this.prepared.target;
    }
    const route = this.period.route(this.state, value);
    demand(route, "M/S pose is not on the saved period");
    this.planned = route.moves;
    const target = applyMoves(this.state, route.moves);
    demand(
      stateEquals(target, this.period.nodes[route.node]),
      "M/S route missed its period node",
    );
    this.prepared = { source: this.state, value, moves: route.moves, target };
    return target;
  }
  protected targetMoves(): readonly LegalMove[] {
    return this.planned;
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(
      this.msPrint.print,
      state,
      msTarget(this.letter, value),
    );
  }
  /** Install the first-lap period node that shows `value`. */
  async configure(value = 0): Promise<void> {
    demand(!this.busy && !this.configuring, "Wait for M/S motion");
    this.configuring = true;
    let assets;
    try {
      const state = this.period.poseFor(value);
      demand(
        matchesTarget(this.msPrint.print, state, msTarget(this.letter, value)),
        "M/S node shows the wrong value",
      );
      assets = await this.resolveAssets(this.manifest, [this.msPrint.print]);
      this.prepared = null;
      this.install(this.msPrint.print, state, assets, value);
      assets = undefined;
    } finally {
      assets?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
