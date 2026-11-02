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
import { deploymentBasePath, loadAssets, type AssetManifest } from "@cubistry/cube-assets";
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
import tenthTransitionsData from "./tenth-transitions.json" with { type: "json" };

/** Values 0..9 for the tenth-of-a-second cube. */
export const TENTH_MODULUS = 10;

/** Fixed turn duration for the 1/10-second cube: 50 ms per QTM move. */
export const TENTH_MOVE_MS = 50;

/**
 * Hardwired step intervals and corresponding turn speeds for the 1/10-second counter:
 *   100ms step -> 50ms turn
 *   500ms step -> 100ms turn
 *   1s step (1000ms) -> 250ms turn
 *   2s step (2000ms) -> 500ms turn
 */
export const TENTH_STEP_INTERVALS = Object.freeze([2000, 1000, 500, 100] as const);
export const DEFAULT_TENTH_STEP_INTERVAL = 1000;

export const TENTH_HARDWIRED_TURN_SPEEDS: Readonly<Record<number, number>> = Object.freeze({
  100: 50,
  500: 100,
  1000: 250,
  2000: 500,
});

export function tenthTurnSpeedForInterval(intervalMs: number): number {
  return TENTH_HARDWIRED_TURN_SPEEDS[intervalMs] ?? 250;
}

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

/** One optimal transition between digits 0..9 on the 1/10 cube. */
export interface TenthTransition {
  readonly from: number;
  readonly to: number;
  readonly alg: string;
  readonly htm: number;
  readonly qtm: number;
}

export interface TenthTransitionsFile {
  readonly schema: "cubistry.tenth-transitions";
  readonly version: number;
  readonly generator: string;
  readonly frontCells: Readonly<Record<string, string>>;
  readonly totalTransitions: number;
  readonly transitions: readonly TenthTransition[];
}

/**
 * All 90 optimal shortest transitions between any digit (0..9) on the 1/10 cube,
 * keeping the stationary "1/10" (T) sticker at r1c2 and the blank front cells intact.
 * 87 of 90 transitions are <= 3 HTM (average: 1.91 moves).
 */
export const TENTH_OPTIMAL_TRANSITIONS: readonly TenthTransition[] = deepFreeze(
  (tenthTransitionsData as TenthTransitionsFile).transitions,
);

const TENTH_OPTIMAL_MAP: readonly (readonly LegalMove[])[] = (() => {
  const map: LegalMove[][] = Array.from({ length: 100 }, () => []);
  for (const t of TENTH_OPTIMAL_TRANSITIONS) {
    map[t.from * 10 + t.to] = parseAlg(t.alg) as LegalMove[];
  }
  return deepFreeze(map);
})();

/**
 * Returns the optimal shortest move sequence from digit `from` to digit `to` (0..9)
 * loaded from `tenth-transitions.json`.
 * 87 of 90 transitions are <= 3 moves (average 1.91 moves).
 */
export function tenthOptimalMoves(
  from: number,
  to: number,
): readonly LegalMove[] {
  demand(
    Number.isInteger(from) &&
      from >= 0 &&
      from < TENTH_MODULUS &&
      Number.isInteger(to) &&
      to >= 0 &&
      to < TENTH_MODULUS,
    "Invalid tenth transition index",
  );
  if (from === to) return [];
  return TENTH_OPTIMAL_MAP[from * 10 + to];
}

/**
 * Exact shortest paths between canonical period nodes S_i -> S_j on TENTH_PRINT.
 * Every transition lands exactly on this.period.nodes[j], preserving Period-1
 * state closure and never leaving the closed counting period.
 */
export const TENTH_CANONICAL_SHORTEST_PATHS: readonly (readonly string[])[] =
  Object.freeze([
    Object.freeze(["", "L", "L2", "L2 B L", "L2 B L B L", "L2 B L B L D", "D' L' D' L' B'", "D' L' D'", "D' L'", "D'"]),
    Object.freeze(["L'", "", "L", "L B L", "L B L B L", "L B L B L D", "L' D' L' D' L' B'", "L' D' L' D'", "L' D' L'", "L' D'"]),
    Object.freeze(["L2", "L'", "", "B L", "B L B L", "B L B L D", "L2 D' L' D' L' B'", "L2 D' L' D'", "L2 D' L'", "L2 D'"]),
    Object.freeze(["L' B' L2", "L' B' L'", "L' B'", "", "B L", "B L D", "L D B D L", "D' L' D2 B' D2", "L' B' L2 D' L'", "L' B' L2 D'"]),
    Object.freeze(["L' B' L' B' L2", "L' B' L' B' L'", "L' B' L' B'", "L' B'", "", "D", "D B D", "D B D B L", "L B2 D B2 L B'", "L' B' L' B' L2 D'"]),
    Object.freeze(["L B D B L2 D", "L B2 D L2 B D", "D' L' B' L' B'", "D' L' B'", "D'", "", "B D", "B D B L", "L B D B L", "L B D B L2"]),
    Object.freeze(["B L D L D", "L D2 B L2 D B'", "L' D' B' D' L2 B'", "L' D' B' D' L'", "D' B' D'", "D' B'", "", "B L", "B L D", "B L D L"]),
    Object.freeze(["D L D", "D L D L", "D L D L2", "D2 B D2 L D", "L' B' D' B' D'", "L' B' D' B'", "L' B'", "", "D", "D L"]),
    Object.freeze(["L D", "L D L", "L D L2", "L D L2 B L", "L' B' D' B' L' D'", "L' B' D' B' L'", "D' L' B'", "D'", "", "L"]),
    Object.freeze(["D", "D L", "D L2", "D L2 B L", "L2 B' D' B' L' D'", "L2 B' D' B' L'", "L' D' L' B'", "L' D'", "L'", ""]),
  ]);

export const TENTH_TRANSITIONS_RUNTIME_FILE = "tenth-transitions.v1.json";

/** Load the 90 tenth transitions from public runtime file via fetch. */
export async function loadTenthTransitions(
  basePath = "",
): Promise<TenthTransitionsFile> {
  const url = `${deploymentBasePath(basePath)}${TENTH_TRANSITIONS_RUNTIME_FILE}`;
  const response = await fetch(url);
  demand(response.ok, "Unable to load tenth transitions file");
  const data = (await response.json()) as TenthTransitionsFile;
  demand(
    data.schema === "cubistry.tenth-transitions" &&
      data.version === 1 &&
      Array.isArray(data.transitions) &&
      data.transitions.length === 90,
    "Invalid tenth transitions file",
  );
  return deepFreeze(data);
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

const TENTH_BFS_GENERATORS = [
  "L",
  "L'",
  "L2",
  "D",
  "D'",
  "D2",
  "B",
  "B'",
  "B2",
] as const;

const TENTH_PARSED_GENERATORS = TENTH_BFS_GENERATORS.map((m) => parseAlg(m));

function serializeCubeState(state: CubeState): string {
  return JSON.stringify(state);
}

/**
 * Finds the shortest path in {L, D, B} from any state to the canonical period node
 * (or tenthTarget(value) if periodNodes not provided), ensuring all 8 cubies match.
 */
export function findTenthRoute(
  fromState: CubeState,
  toValue: number,
  periodNodes?: readonly CubeState[],
): readonly LegalMove[] {
  demand(
    Number.isInteger(toValue) && toValue >= 0 && toValue < TENTH_MODULUS,
    "Invalid tenth target value",
  );
  const targetNode = periodNodes ? periodNodes[toValue] : null;
  if (targetNode) {
    if (stateEquals(fromState, targetNode)) return [];
  } else if (matchesTarget(TENTH_PRINT, fromState, tenthTarget(toValue))) {
    return [];
  }

  const q: Array<{ st: CubeState; path: LegalMove[] }> = [
    { st: fromState, path: [] },
  ];
  const visited = new Set<string>([serializeCubeState(fromState)]);

  while (q.length > 0) {
    const { st, path } = q.shift()!;
    if (
      targetNode
        ? stateEquals(st, targetNode)
        : matchesTarget(TENTH_PRINT, st, tenthTarget(toValue))
    ) {
      return path;
    }

    if (path.length >= 6) continue;
    for (let i = 0; i < TENTH_PARSED_GENERATORS.length; i++) {
      const parsed = TENTH_PARSED_GENERATORS[i];
      if (path.length > 0) {
        const last = path[path.length - 1];
        if (last.face === parsed[0].face) continue;
      }
      const nextSt = applyMoves(st, parsed);
      const k = serializeCubeState(nextSt);
      if (!visited.has(k)) {
        visited.add(k);
        q.push({ st: nextSt, path: [...path, parsed[0]] });
      }
    }
  }
  return [];
}

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

  /** Reset back to 0 along the period and resolve once settled. */
  reset(): Promise<void> {
    return this.set(0);
  }

  /** Step by delta along the period and resolve once settled. */
  step(delta = 1): Promise<void> {
    const next =
      ((this.currentValue + delta) % TENTH_MODULUS + TENTH_MODULUS) %
      TENTH_MODULUS;
    return this.set(next);
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
    const target = this.period.nodes[value];
    let moves: readonly LegalMove[];
    const node = this.period.nodeOf(this.state);
    if (node !== -1) {
      if (node === value) {
        moves = [];
      } else {
        moves = parseAlg(TENTH_CANONICAL_SHORTEST_PATHS[node][value]) as LegalMove[];
      }
    } else {
      const route = this.period.route(this.state, value);
      moves = (route ? route.moves : findTenthRoute(this.state, value, this.period.nodes)) as LegalMove[];
    }
    const endState = applyMoves(this.state, moves);
    demand(
      stateEquals(endState, target),
      "Tenth-second route failed to reach canonical target state (all 8 cubies matter)",
    );
    this.planned = moves;
    this.prepared = { source: this.state, value, moves, target };
    return target;
  }

  protected targetMoves(
    from: CubeState,
    _target: CubeState,
    value: number,
  ): readonly LegalMove[] {
    if (this.prepared?.value === value && stateEquals(this.prepared.source, from)) {
      return (this.route = this.planned = this.prepared.moves);
    }
    this.prepareTarget(value);
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
