import {
  demand,
  stateEquals,
  type CubeState,
  type LegalMove,
} from "@cubistry/cube-core";
import { matchesTarget } from "@cubistry/cube-mechanics";
import { loadAssets } from "@cubistry/cube-assets";
import {
  PhysicalPlayback,
  type PhysicalView,
  type MoveProgress,
} from "../shared/playback.ts";
import {
  displayTarget,
  snapshotValue,
  valueSnapshot,
  type Snapshot,
  type StatusDefinition,
} from "./definition.ts";
import { QualityPolicy, type QualityPlan } from "./policy.ts";
/** Numeric snapshot adapter over existing complete-pose playback; no shared runtime changes. */
export class StatusController extends PhysicalPlayback {
  readonly definition: StatusDefinition;
  private readonly resolveAssets: typeof loadAssets;
  private readonly resolvePolicy: () => Promise<QualityPolicy>;
  private policy: QualityPolicy | null = null;
  private pending: {
    source: CubeState;
    value: number;
    plan: QualityPlan;
  } | null = null;
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
    resolvePolicy: () => Promise<QualityPolicy> = () =>
      QualityPolicy.load(definition),
  ) {
    super(view, changed);
    this.definition = definition;
    this.resolveAssets = resolveAssets;
    this.resolvePolicy = resolvePolicy;
  }
  protected get maximumValue(): number {
    return 624;
  }
  get currentStatus(): Snapshot {
    return valueSnapshot(this.currentValue);
  }
  requestStatus(snapshot: Snapshot): void {
    demand(
      !this.failed,
      "Physical playback failed. Reload before requesting another snapshot.",
    );
    this.request(snapshotValue(snapshot));
  }
  protected targetState(value: number): CubeState {
    demand(this.policy && this.state, "Quality policy is not configured");
    const plan = this.policy.plan(this.state, valueSnapshot(value));
    this.pending = { source: this.state, value, plan };
    return plan.state;
  }
  protected targetMoves(
    from: CubeState,
    target: CubeState,
    value: number,
  ): readonly LegalMove[] {
    const p = this.pending;
    demand(
      p &&
        p.value === value &&
        stateEquals(p.source, from) &&
        stateEquals(p.plan.state, target),
      "Quality endpoint plan cache is out of sync",
    );
    return p.plan.moves;
  }
  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(
      this.definition.print,
      state,
      displayTarget(valueSnapshot(value)),
    );
  }
  async configure(): Promise<void> {
    demand(
      !this.busy && !this.configuring,
      "Wait for current quality playback",
    );
    this.configuring = true;
    let assets;
    try {
      const policy = await this.resolvePolicy();
      assets = await this.resolveAssets(this.definition.assets, [
        this.definition.print,
      ]);
      const value = snapshotValue(this.definition.initial),
        target = this.definition.targets[value];
      this.install(this.definition.print, target.state, assets, value);
      this.policy = policy;
      assets = undefined;
    } finally {
      assets?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}
