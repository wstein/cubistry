import {
  demand,
  deepFreeze,
  stateEquals,
  validatePrint,
  type CubeState,
  type DisplayTarget,
  type LegalMove,
  type PrintDefinition,
} from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  matchesTarget,
  parseAlg,
  type MovePresentation,
} from "@cubistry/cube-mechanics";
import { loadAssets, type AssetManifest } from "@cubistry/cube-assets";
import {
  PhysicalPlayback,
  type MoveProgress,
  type PhysicalView,
} from "../shared/playback.ts";
import { routeTurnTiming } from "../shared/turn-timing.ts";
import { positions } from "../hsm/design.ts";
import type { MsRun } from "../ms/design.ts";
import { MsPeriod } from "../ms/period.ts";
import type { ClockSnapshot } from "../timer/clock.ts";
import { ENDPOINT_TOLERANCE_MS, type TimerCube } from "../timer/scheduler.ts";

/** Values 0..9 for the tenth-of-a-second cube. */
export const TENTH_MODULUS = 10;

/** Fixed turn duration for the 1/10-second cube: 50 ms per QTM move. */
export const TENTH_MOVE_MS = 50;

/**
 * Period-1 closed {L, D, B} cycle for the 0..9 digit at r2c1 ((-1,-1,1)),
 * keeping r1c2 ((1,1,1)) stationary with the "1/10" ("T") unit sticker:
 *   L | L | B L | B L | D | B D | B L | D | L | D  (6×L + 4×D, 14 QTM).
 */
export const TENTH_WORDS: readonly string[] = Object.freeze([
  "L",
  "L",
  "B L",
  "B L",
  "D",
  "B D",
  "B L",
  "D",
  "L",
  "D",
]);

/** The "1/10" word sticker asset matching the Noto Sans 600 bottom-aligned HSM word style. */
export const TENTH_WORD_IMAGE = Object.freeze({
  id: "T",
  kind: "image" as const,
  format: "svg" as const,
  url: "/assets/hsm/words/T.svg",
  sha256: "0a1f78e209ae05bece7da56700a14e0c256b1e758bc3f5bb64b08fee766de070",
});

/** Display target for the 1/10-second cube: blank at r1c1 & r2c2, "T" (1/10) at r1c2, digit at r2c1. */
export function tenthTarget(value: number): DisplayTarget {
  demand(
    Number.isInteger(value) && value >= 0 && value < TENTH_MODULUS,
    "Invalid tenth-second display",
  );
  return deepFreeze({
    schema: "cubistry.target",
    version: 1,
    facelets: ["blank", "T", String(value), "blank"].map((assetId, i) => ({
      position: positions[i],
      normal: [0, 0, 1],
      up: [0, 1, 0],
      assetId,
      matching: assetId === "blank" ? "equivalent" : "exact",
    })),
  });
}

const RAW_TENTH_STICKERS = [
  { id: 0, cubie: 0, n: [-1, 0, 0], up: [0, 1, 0], image: "" },
  { id: 1, cubie: 0, n: [0, 1, 0], up: [0, 0, -1], image: "1" },
  { id: 2, cubie: 0, n: [0, 0, 1], up: [0, 1, 0], image: "" },
  { id: 3, cubie: 1, n: [1, 0, 0], up: [0, 1, 0], image: "" },
  { id: 4, cubie: 1, n: [0, 1, 0], up: [0, 0, -1], image: "" },
  { id: 5, cubie: 1, n: [0, 0, 1], up: [0, 1, 0], image: "T" },
  { id: 6, cubie: 2, n: [-1, 0, 0], up: [0, 0, -1], image: "6" },
  { id: 7, cubie: 2, n: [0, -1, 0], up: [1, 0, 0], image: "8" },
  { id: 8, cubie: 2, n: [0, 0, 1], up: [0, 1, 0], image: "0" },
  { id: 9, cubie: 3, n: [1, 0, 0], up: [0, 1, 0], image: "9" },
  { id: 10, cubie: 3, n: [0, -1, 0], up: [0, 0, 1], image: "" },
  { id: 11, cubie: 3, n: [0, 0, 1], up: [0, 1, 0], image: "" },
  { id: 12, cubie: 4, n: [-1, 0, 0], up: [0, 1, 0], image: "" },
  { id: 13, cubie: 4, n: [0, 1, 0], up: [0, 0, -1], image: "" },
  { id: 14, cubie: 4, n: [0, 0, -1], up: [0, -1, 0], image: "2" },
  { id: 15, cubie: 5, n: [1, 0, 0], up: [0, 1, 0], image: "" },
  { id: 16, cubie: 5, n: [0, 1, 0], up: [0, 0, -1], image: "" },
  { id: 17, cubie: 5, n: [0, 0, -1], up: [-1, 0, 0], image: "4" },
  { id: 18, cubie: 6, n: [-1, 0, 0], up: [0, 1, 0], image: "5" },
  { id: 19, cubie: 6, n: [0, -1, 0], up: [0, 0, 1], image: "3" },
  { id: 20, cubie: 6, n: [0, 0, -1], up: [0, 1, 0], image: "" },
  { id: 21, cubie: 7, n: [1, 0, 0], up: [0, 1, 0], image: "" },
  { id: 22, cubie: 7, n: [0, -1, 0], up: [0, 0, 1], image: "" },
  { id: 23, cubie: 7, n: [0, 0, -1], up: [0, 1, 0], image: "7" },
] as const;

export const TENTH_PRINT: PrintDefinition = validatePrint({
  schema: "cubistry.print",
  version: 1,
  id: "ms_timer_tenth_r2c1",
  topology: { kind: "cube", size: 2 },
  cubies: [
    { id: 0, position: [-1, 1, 1] },
    { id: 1, position: [1, 1, 1] },
    { id: 2, position: [-1, -1, 1] },
    { id: 3, position: [1, -1, 1] },
    { id: 4, position: [-1, 1, -1] },
    { id: 5, position: [1, 1, -1] },
    { id: 6, position: [-1, -1, -1] },
    { id: 7, position: [1, -1, -1] },
  ],
  stickers: RAW_TENTH_STICKERS.map((s) => ({
    id: s.id,
    cubie: s.cubie,
    normal: s.n,
    up: s.up,
    assetId: s.image || "blank",
    materialId: "sticker",
    equivalentQuarterTurns: s.image ? [0] : [0, 1, 2, 3],
  })),
});

export const TENTH_RUN: MsRun = (() => {
  const start = initialState(TENTH_PRINT);
  let state = start;
  let total = 0;
  let maximum = 0;
  TENTH_WORDS.forEach((word, i) => {
    demand(
      matchesTarget(TENTH_PRINT, state, tenthTarget(i)),
      "Tenth-second period node shows the wrong value",
    );
    const moves = parseAlg(word);
    total += moves.length;
    maximum = Math.max(maximum, moves.length);
    state = applyMoves(state, moves);
  });
  demand(
    stateEquals(state, start),
    "Tenth-second period does not close after 10 steps",
  );
  return deepFreeze({
    letter: "S" as const,
    setup: "",
    laps: 1,
    periodHTM: total,
    maximumHTM: maximum,
    words: TENTH_WORDS,
    lowerBounds: TENTH_WORDS.map(() => 1),
  });
})();

/**
 * The 1/10-second cube of the M/S Timer: replays the Period-1 closed {L, D, B}
 * sequence `L | L | B L | B L | D | B D | B L | D | L | D` on `TENTH_PRINT`
 * and animates turns against tenth-second deadlines at 50 ms per QTM.
 */
export class MsTimerTenthCube extends PhysicalPlayback implements TimerCube {
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
  private timing: {
    target: number;
    endAt: number;
    durationMs: number;
    revision: number;
  } | null = null;
  private timingRevision = 0;
  private route: readonly LegalMove[] = [];
  private waiters: (() => void)[] = [];

  constructor(
    view: PhysicalView,
    manifest: AssetManifest,
    onState: (
      v: number,
      busy: boolean,
      error?: Error,
      progress?: MoveProgress,
    ) => void,
    resolveAssets: typeof loadAssets = loadAssets,
  ) {
    super(view, (v, busy, error, progress) => {
      onState(v, busy, error, progress);
      if (!busy && this.waiters.length) {
        for (const resolve of this.waiters.splice(0)) resolve();
      }
    });
    this.manifest = manifest;
    this.resolveAssets = resolveAssets;
    this.period = new MsPeriod(TENTH_PRINT, TENTH_RUN, TENTH_MODULUS);
  }

  /** Walk to `value` along the saved period and resolve once settled. */
  set(value: number): Promise<void> {
    this.request(value);
    if (!this.busy) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  protected get maximumValue(): number {
    return TENTH_MODULUS - 1;
  }

  get node(): number {
    return this.state ? this.period.nodeOf(this.state) : -1;
  }

  prepare(value: number): readonly LegalMove[] {
    demand(!this.busy, "Tenth-second cube must be settled before preparation");
    this.prepareTarget(value);
    return this.planned;
  }

  protected targetState(value: number): CubeState {
    return this.prepareTarget(value);
  }

  private prepareTarget(value: number): CubeState {
    demand(this.state, "Tenth-second cube not configured");
    if (
      this.prepared?.value === value &&
      stateEquals(this.prepared.source, this.state)
    ) {
      this.planned = this.prepared.moves;
      return this.prepared.target;
    }
    const route = this.period.route(this.state, value);
    demand(route, "Tenth-second pose is not on the saved period");
    this.planned = route.moves;
    const target = applyMoves(this.state, route.moves);
    demand(
      stateEquals(target, this.period.nodes[route.node]),
      "Tenth-second route missed its period node",
    );
    this.prepared = { source: this.state, value, moves: route.moves, target };
    return target;
  }

  protected targetMoves(): readonly LegalMove[] {
    return (this.route = this.planned);
  }

  protected matchesDisplay(state: CubeState, value: number): boolean {
    return matchesTarget(TENTH_PRINT, state, tenthTarget(value));
  }

  setDeadline(target: number, endAt: number, durationMs: number): void {
    if (
      this.timing?.target === target &&
      this.timing.endAt === endAt &&
      this.timing.durationMs === durationMs
    )
      return;
    this.timing = {
      target,
      endAt,
      durationMs,
      revision: ++this.timingRevision,
    };
  }

  clearDeadline(): void {
    this.timing = null;
    this.timingRevision++;
  }

  protected animateMove(presentation: MovePresentation): Promise<void> {
    const index = this.progress.completed,
      route = this.route,
      target = this.progress.target;
    return this.view.animate(presentation, () =>
      this.timing?.target === target
        ? routeTurnTiming(
            route,
            index,
            this.timing.endAt,
            this.timing.durationMs,
            this.timing.revision,
            "quarter",
          )
        : null,
    );
  }

  async configure(value = 0): Promise<void> {
    demand(!this.busy && !this.configuring, "Wait for tenth-second motion");
    this.configuring = true;
    let assets;
    try {
      const state = this.period.poseFor(value);
      demand(
        matchesTarget(TENTH_PRINT, state, tenthTarget(value)),
        "Tenth-second node shows the wrong value",
      );
      assets = await this.resolveAssets(this.manifest, [TENTH_PRINT]);
      this.prepared = null;
      this.install(TENTH_PRINT, state, assets, value);
      assets = undefined;
    } finally {
      assets?.dispose();
      this.configuring = false;
    }
    this.notify();
  }
}

/**
 * Predictive scheduler for the 1/10-second cube at 50 ms per QTM move.
 * Each 1-QTM step takes 50 ms and each 2-QTM step takes 100 ms, ending at the
 * 100 ms boundary.
 */
export class TenthScheduler {
  private plan: {
    target: number;
    source: CubeState;
    deadline: number;
    duration: number;
    started: boolean;
  } | null = null;
  private controller: TimerCube | null = null;
  private wake: ReturnType<typeof setTimeout> | null = null;
  private readonly refresh: () => void;

  constructor(refresh: () => void = () => {}) {
    this.refresh = refresh;
  }

  invalidate(): void {
    this.controller?.clearDeadline();
    if (this.wake !== null) clearTimeout(this.wake);
    this.wake = null;
    this.plan = null;
  }

  tick(
    snapshot: ClockSnapshot,
    controller: TimerCube,
    setDuration: (ms: number) => void,
  ): void {
    this.controller = controller;
    const { bucket, next, at } = snapshot;
    let p = this.plan;
    const intentional =
      p && (p.target === bucket || p.target === next?.target);
    if (!snapshot.running) {
      if (p?.started && p.target === bucket && controller.busy) {
        controller.setDeadline(p.target, p.deadline, TENTH_MOVE_MS);
        setDuration(TENTH_MOVE_MS);
        return;
      }
      this.invalidate();
      setDuration(TENTH_MOVE_MS);
      if (controller.currentValue !== bucket || controller.busy)
        this.request(controller, bucket);
      return;
    }
    if (p && !intentional) this.plan = p = null;
    if (controller.busy) {
      if (p?.started && controller.progress.target === p.target && intentional) {
        if (next?.target === p.target && Math.abs(p.deadline - next.deadline) > 0.01) {
          p.deadline = next.deadline;
        }
        controller.setDeadline(p.target, p.deadline, TENTH_MOVE_MS);
        setDuration(
          at > p.deadline + ENDPOINT_TOLERANCE_MS ? 10 : TENTH_MOVE_MS,
        );
      } else {
        controller.clearDeadline();
        setDuration(TENTH_MOVE_MS);
        this.request(controller, bucket);
      }
      return;
    }
    controller.clearDeadline();
    if (
      controller.currentValue !== bucket &&
      controller.currentValue !== next?.target
    ) {
      this.plan = null;
      setDuration(TENTH_MOVE_MS);
      this.request(controller, bucket);
      return;
    }
    if (!next || controller.currentValue === next.target) return;
    if (
      !p ||
      p.started ||
      p.target !== next.target ||
      Math.abs(p.deadline - next.deadline) > 0.01 ||
      !controller.state ||
      !stateEquals(p.source, controller.state)
    ) {
      const moves = controller.prepare(next.target).length;
      const duration = moves * TENTH_MOVE_MS;
      p = this.plan = {
        target: next.target,
        source: controller.state!,
        deadline: next.deadline,
        duration,
        started: false,
      };
      if (this.wake !== null) clearTimeout(this.wake);
      this.wake = setTimeout(
        () => {
          this.wake = null;
          this.refresh();
        },
        Math.max(0, Math.ceil(p.deadline - p.duration - at)),
      );
    }
    setDuration(TENTH_MOVE_MS);
    if (at + 0.01 >= p.deadline - p.duration) {
      p.started = true;
      controller.setDeadline(p.target, p.deadline, TENTH_MOVE_MS);
      controller.request(p.target);
    }
  }

  private request(controller: TimerCube, target: number): void {
    if (
      controller.busy &&
      controller.progress.target === target &&
      controller.progress.queuedTarget === null
    )
      return;
    if (controller.progress.queuedTarget !== target) controller.request(target);
  }
}
