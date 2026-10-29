import {
  demand,
  deepFreeze,
  record,
  validatePrint,
  validateTarget,
  type CubeState,
  type DisplayTarget,
  type PrintDefinition,
} from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  matchesTarget,
  parseAlg,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import { validateAssets, type AssetManifest } from "@cubistry/cube-assets";
export const CATEGORY_IDS = ["build", "test", "analyze", "review"] as const;
export const STATE_IDS = ["open", "running", "ok", "error", "blocked"] as const;
export type Snapshot = readonly string[];
export const FRONT = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
] as const;
export interface WorkflowEvent {
  readonly id: string;
  readonly label: string;
  readonly from: readonly string[];
  readonly to: string;
}
export interface StatusDefinition {
  readonly id: string;
  readonly categories: readonly { id: string; label: string }[];
  readonly states: readonly { id: string; label: string; word: string }[];
  readonly initial: Snapshot;
  readonly print: PrintDefinition;
  readonly assets: AssetManifest;
  readonly edges: readonly (readonly string[])[];
  readonly events: readonly WorkflowEvent[];
  readonly demonstration: readonly { category: string; event: string }[];
  readonly targets: readonly {
    states: Snapshot;
    setup: string;
    state: CubeState;
    target: DisplayTarget;
    physicalStateSHA256: string;
  }[];
  readonly policy: {
    researchCommit: string;
    certificateURL: string;
    certificateSHA256: string;
    catalogSHA256: string;
    domain: number;
    singleCategoryMaximum: number;
    arbitraryMaximum: number;
  };
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function snapshotValue(snapshot: Snapshot): number {
  demand(
    snapshot.length === 4 &&
      snapshot.every((s) =>
        STATE_IDS.includes(s as (typeof STATE_IDS)[number]),
      ),
    "Invalid quality snapshot",
  );
  return snapshot.reduce(
    (v, s) => v * 5 + STATE_IDS.indexOf(s as (typeof STATE_IDS)[number]),
    0,
  );
}
export function valueSnapshot(value: number): Snapshot {
  demand(
    Number.isInteger(value) && value >= 0 && value < 625,
    "Invalid quality value",
  );
  const result = Array<string>(4);
  for (let i = 3; i >= 0; i--) {
    result[i] = STATE_IDS[value % 5];
    value = Math.floor(value / 5);
  }
  return Object.freeze(result);
}
export function displayTarget(snapshot: Snapshot): DisplayTarget {
  snapshotValue(snapshot);
  return validateTarget({
    schema: "cubistry.target",
    version: 1,
    facelets: FRONT.map((position, i) => ({
      position,
      normal: [0, 0, 1],
      up: [0, 1, 0],
      assetId: `quality-${CATEGORY_IDS[i]}-${snapshot[i]}`,
      matching: "exact",
    })),
  });
}
export function frontSnapshot(
  print: PrintDefinition,
  state: CubeState,
): Snapshot | null {
  const poses = stickerPoses(print, state),
    result: string[] = [];
  for (let i = 0; i < 4; i++) {
    const pose = poses.find((p) => same(p.p, FRONT[i]) && same(p.n, [0, 0, 1]));
    const prefix = `quality-${CATEGORY_IDS[i]}-`;
    if (!pose || !same(pose.up, [0, 1, 0]) || !pose.assetId.startsWith(prefix))
      return null;
    const id = pose.assetId.slice(prefix.length);
    if (!STATE_IDS.includes(id as (typeof STATE_IDS)[number])) return null;
    result.push(id);
  }
  return Object.freeze(result);
}
const expectedEdges = [
  ["open", "running"],
  ["running", "ok"],
  ["running", "error"],
  ["error", "running"],
  ["ok", "running"],
  ["open", "error"],
  ...STATE_IDS.slice(1).map((s) => [s, "open"]),
  ["open", "blocked"],
  ["running", "blocked"],
  ["blocked", "running"],
];
/** Strict app-local ingress; physical replay and geometry remain shared contracts. */
export function validateStatusDefinition(raw: unknown): StatusDefinition {
  const d = record(raw, "quality application");
  demand(
    d.schema === "cubistry.quality-application" && d.version === 1,
    "Unsupported quality application",
  );
  demand(d.id === "ci-quality-cube", "Invalid application ID");
  demand(
    same(
      d.categories,
      CATEGORY_IDS.map((id) => ({ id, label: id.toUpperCase() })),
    ),
    "Invalid fixed categories",
  );
  demand(
    same(
      d.states,
      STATE_IDS.map((id, i) => ({
        id,
        label: ["Open", "Running", "OK", "Error", "Blocked"][i],
        word: ["OFFEN", "LÄUFT", "OK", "FEHLER", "BLOCKIERT"][i],
      })),
    ),
    "Invalid physical state words",
  );
  demand(
    same(d.initial, ["open", "open", "open", "open"]),
    "Invalid initial snapshot",
  );
  const print = validatePrint(d.print),
    assets = validateAssets(d.assets, [print]);
  demand(
    print.topology.size === 2 && print.stickers.length === 24,
    "Quality print requires 24 fixed 2x2 stickers",
  );
  const sourcePositions = [-1, 1].flatMap((x) =>
    [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])),
  );
  demand(
    same(
      print.cubies,
      sourcePositions.map((position, id) => ({ id, position })),
    ),
    "Quality catalog requires pinned body IDs and source order",
  );
  const pairs = [
    [3, 2],
    [7, 6],
    [1, 0],
    [5, 4],
  ];
  const pattern = ["open", "open", "running", "ok", "error", "blocked"];
  demand(
    print.stickers.every(
      (sticker, id) =>
        sticker.id === id &&
        sticker.cubie === pairs[Math.floor(id / 6)][Math.floor((id % 6) / 3)] &&
        sticker.assetId ===
          `quality-${CATEGORY_IDS[Math.floor(id / 6)]}-${pattern[id % 6]}` &&
        same(sticker.equivalentQuarterTurns, [0]),
    ),
    "Quality print differs from reviewed fixed pairing",
  );
  demand(
    assets.images.length === 20 &&
      assets.images.every((a) => a.kind === "image" && a.format === "svg"),
    "Quality artwork requires 20 fixed vector images",
  );
  demand(same(d.edges, expectedEdges), "Invalid allowed quality edges");
  demand(
    Array.isArray(d.events) && d.events.length === 5,
    "Invalid event table",
  );
  const events = d.events.map((raw) => {
    const e = record(raw, "event");
    demand(
      typeof e.id === "string" &&
        /^[a-z]+$/.test(e.id) &&
        typeof e.label === "string" &&
        e.label.length > 0 &&
        e.label.length < 80,
      "Invalid event",
    );
    demand(
      Array.isArray(e.from) &&
        e.from.length > 0 &&
        new Set(e.from).size === e.from.length,
      "Invalid event sources",
    );
    demand(
      e.from.every((s) =>
        expectedEdges.some(([a, b]) => a === s && b === e.to),
      ),
      "Event violates allowed edges",
    );
    return {
      id: e.id,
      label: e.label,
      from: e.from as string[],
      to: e.to as string,
    };
  });
  demand(
    new Set(events.map((e) => e.id)).size === events.length,
    "Duplicate events",
  );
  const actualEdges = events
    .flatMap((e) => e.from.map((s) => [s, e.to].join(":")))
    .sort();
  demand(
    same(actualEdges, expectedEdges.map((e) => e.join(":")).sort()),
    "Incomplete event edge table",
  );
  demand(
    Array.isArray(d.demonstration) &&
      d.demonstration.length > 0 &&
      d.demonstration.length <= 24,
    "Invalid demonstration",
  );
  const demo = d.demonstration.map((raw) => {
    const step = record(raw, "demo step");
    demand(
      CATEGORY_IDS.includes(step.category as (typeof CATEGORY_IDS)[number]) &&
        events.some((e) => e.id === step.event),
      "Invalid demo references",
    );
    return { category: step.category as string, event: step.event as string };
  });
  const requested = ["open", "open", "open", "open"];
  for (const step of demo) {
    const c = CATEGORY_IDS.indexOf(
        step.category as (typeof CATEGORY_IDS)[number],
      ),
      e = events.find((e) => e.id === step.event)!;
    demand(e.from.includes(requested[c]), "Invalid demo transition");
    requested[c] = e.to;
  }
  demand(
    Array.isArray(d.targets) && d.targets.length === 625,
    "All 625 target witnesses required",
  );
  const values = new Set<number>();
  const targets = d.targets
    .map((raw) => {
      const t = record(raw, "quality target");
      demand(Array.isArray(t.states), "Invalid target snapshot");
      const states = t.states as string[],
        value = snapshotValue(states);
      demand(!values.has(value), "Duplicate target");
      values.add(value);
      demand(
        typeof t.setup === "string" && t.setup.length < 100,
        "Invalid target setup",
      );
      const moves = parseAlg(t.setup);
      demand(moves.length <= 7, "Target setup exceeds certificate bound");
      const state = applyMoves(initialState(print), moves),
        target = displayTarget(states);
      demand(
        matchesTarget(print, state, target),
        "Unreachable upright quality target",
      );
      demand(
        typeof t.physicalStateSHA256 === "string" &&
          /^[a-f0-9]{64}$/.test(t.physicalStateSHA256),
        "Invalid pose evidence hash",
      );
      return {
        states,
        setup: t.setup,
        state,
        target,
        physicalStateSHA256: t.physicalStateSHA256,
      };
    })
    .sort((a, b) => snapshotValue(a.states) - snapshotValue(b.states));
  const p = record(d.policy, "quality policy");
  demand(
    p.researchCommit === "6058f4dc59e36ce226f5840c2e3f5ca635a96b4a" &&
      p.certificateSHA256 ===
        "f56224ee1b76e2bdaac4bb8441df5881e6b7c9a51dd6a14e62eff58e78e396d6" &&
      p.certificateURL === "/assets/quality/distances.u8" &&
      p.domain === 136080 &&
      p.singleCategoryMaximum === 6 &&
      p.arbitraryMaximum === 7,
    "Invalid reviewed policy provenance",
  );
  demand(
    typeof p.catalogSHA256 === "string" &&
      /^[a-f0-9]{64}$/.test(p.catalogSHA256),
    "Invalid catalog hash",
  );
  return deepFreeze({
    id: d.id,
    categories: d.categories,
    states: d.states,
    initial: d.initial,
    print,
    assets,
    edges: d.edges,
    events,
    demonstration: demo,
    targets,
    policy: p,
  }) as unknown as StatusDefinition;
}
/** Manual selections permit all combinations; events enforce the declared edges on requested fields. */
export class StatusWorkflow {
  readonly definition: StatusDefinition;
  requested: Snapshot;
  private entries: string[] = [];
  constructor(definition: StatusDefinition) {
    this.definition = definition;
    this.requested = definition.initial;
  }
  get history(): readonly string[] {
    return Object.freeze([...this.entries]);
  }
  get fault(): string | null {
    return this.requested.includes("error")
      ? "An attempt failed. Retry the affected category."
      : this.requested.includes("blocked")
        ? "A prerequisite is unavailable. Resume when it is available."
        : null;
  }
  private note(s: string): void {
    this.entries = [...this.entries.slice(-11), s];
  }
  select(category: string, state: string): void {
    const i = this.definition.categories.findIndex((c) => c.id === category);
    demand(i >= 0, "Unknown category");
    const next = [...this.requested];
    next[i] = state;
    snapshotValue(next);
    this.requested = Object.freeze(next);
    this.note(`Manual: ${category} → ${state}`);
  }
  selectSnapshot(snapshot: Snapshot): void {
    snapshotValue(snapshot);
    this.requested = Object.freeze([...snapshot]);
  }
  dispatch(category: string, id: string): void {
    const i = this.definition.categories.findIndex((c) => c.id === category),
      event = this.definition.events.find((e) => e.id === id);
    demand(i >= 0, "Unknown category");
    demand(event, "Unknown simulated event");
    demand(
      event.from.includes(this.requested[i]),
      `${event.label} is not allowed while ${category} is ${this.requested[i]}`,
    );
    const next = [...this.requested];
    next[i] = event.to;
    this.requested = Object.freeze(next);
    this.note(`${category}: ${event.label}`);
  }
}
