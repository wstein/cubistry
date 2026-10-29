import {
  demand,
  deepFreeze,
  record,
  validatePrint,
  validateTarget,
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
} from "@cubistry/cube-mechanics";
import { validateAssets, type AssetManifest } from "@cubistry/cube-assets";

export interface WorkflowStatus {
  readonly id: string;
  readonly label: string;
  readonly faceLabel: string;
  readonly setup: string;
  readonly assetIds: readonly string[];
  readonly moves: readonly LegalMove[];
  readonly target: DisplayTarget;
  readonly state: CubeState;
}
export interface WorkflowEvent {
  readonly id: string;
  readonly label: string;
  readonly from: readonly string[];
  readonly to: string;
  readonly fault?: string;
}
export interface StatusDefinition {
  readonly id: string;
  readonly initial: string;
  readonly print: PrintDefinition;
  readonly assets: AssetManifest;
  readonly statuses: readonly WorkflowStatus[];
  readonly events: readonly WorkflowEvent[];
  readonly demonstration: readonly string[];
}
const positions = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
] as const;
function text(value: unknown, name: string, maximum = 80): string {
  demand(
    typeof value === "string" && value.length > 0 && value.length <= maximum,
    `Invalid ${name}`,
  );
  return value;
}
function unique(values: readonly string[], name: string): void {
  demand(new Set(values).size === values.length, `Duplicate ${name}`);
}
/** App-local declarative ingress; shared contracts remain the only physical model. */
export function validateStatusDefinition(raw: unknown): StatusDefinition {
  const d = record(raw, "status application");
  demand(
    d.schema === "cubistry.status-application" && d.version === 1,
    "Unsupported status application",
  );
  const print = validatePrint(d.print),
    assets = validateAssets(d.assets, [print]);
  demand(
    print.topology.size === 2,
    "Status application requires the existing 2x2 profile",
  );
  demand(
    Array.isArray(d.statuses) &&
      d.statuses.length > 1 &&
      d.statuses.length <= 8,
    "Invalid workflow statuses",
  );
  const statuses = d.statuses.map((raw): WorkflowStatus => {
    const s = record(raw, "workflow status"),
      id = text(s.id, "status ID", 32);
    demand(/^[a-z][a-z0-9-]*$/.test(id), "Invalid status ID");
    const label = text(s.label, "status label"),
      faceLabel = text(s.faceLabel, "physical face label", 4);
    demand(
      faceLabel.length === 4 && /^[A-Z]{4}$/.test(faceLabel),
      "Status faces require four fixed glyphs",
    );
    demand(
      typeof s.setup === "string" && s.setup.length <= 100,
      "Invalid status setup",
    );
    const moves = parseAlg(s.setup);
    demand(moves.length <= 8, "Excessive status setup");
    demand(
      Array.isArray(s.assetIds) && s.assetIds.length === 4,
      "Four fixed status assets required",
    );
    const assetIds = s.assetIds.map((a) => text(a, "status asset", 64));
    unique(assetIds, "status assets");
    const target = validateTarget({
      schema: "cubistry.target",
      version: 1,
      facelets: assetIds.map((assetId, i) => ({
        position: positions[i],
        normal: [0, 0, 1],
        up: [0, 1, 0],
        assetId,
        matching: "exact",
      })),
    });
    const state = applyMoves(initialState(print), moves);
    demand(
      matchesTarget(print, state, target),
      `Unreachable upright status: ${id}`,
    );
    assetIds.forEach((assetId, slot) => {
      const image = assets.images.find((i) => i.id === assetId);
      demand(
        image?.kind === "text",
        "Status glyphs must use the declared fixed text images",
      );
      const document = assets.documents.find((v) => v.id === image.documentId);
      demand(
        document?.text === faceLabel[slot],
        "Physical face label does not match its fixed artwork",
      );
    });
    return {
      id,
      label,
      faceLabel,
      setup: s.setup,
      assetIds,
      moves,
      target,
      state,
    };
  });
  const ids = statuses.map((s) => s.id);
  unique(ids, "status IDs");
  unique(
    statuses.flatMap((s) => s.assetIds),
    "physical status tiles",
  );
  demand(
    ids.includes(text(d.initial, "initial status", 32)),
    "Unknown initial status",
  );
  demand(
    Array.isArray(d.events) && d.events.length > 0 && d.events.length <= 24,
    "Invalid workflow events",
  );
  const events = d.events.map((raw): WorkflowEvent => {
    const e = record(raw, "workflow event"),
      id = text(e.id, "event ID", 40),
      label = text(e.label, "event label");
    demand(/^[a-z][a-z0-9.-]*$/.test(id), "Invalid event ID");
    demand(
      Array.isArray(e.from) && e.from.length > 0 && e.from.length <= ids.length,
      "Invalid event source states",
    );
    const from = e.from.map((s) => text(s, "event source", 32));
    unique(from, "event source states");
    const to = text(e.to, "event target", 32);
    demand(
      from.every((s) => ids.includes(s)) && ids.includes(to),
      "Unknown event state reference",
    );
    return {
      id,
      label,
      from,
      to,
      ...(e.fault === undefined
        ? {}
        : { fault: text(e.fault, "event fault", 160) }),
    };
  });
  unique(
    events.map((e) => e.id),
    "event IDs",
  );
  demand(
    Array.isArray(d.demonstration) &&
      d.demonstration.length > 0 &&
      d.demonstration.length <= 24,
    "Invalid demo sequence",
  );
  const demonstration = d.demonstration.map((e) => text(e, "demo event", 40));
  let current = d.initial;
  for (const id of demonstration) {
    const event = events.find((e) => e.id === id);
    demand(
      event && event.from.includes(current as string),
      "Invalid declarative demo transition",
    );
    current = event.to;
  }
  return deepFreeze({
    id: text(d.id, "application ID", 40),
    initial: d.initial as string,
    print,
    assets,
    statuses,
    events,
    demonstration,
  });
}

/** Logical events coalesce independently from the slower, committed physical display. */
export class StatusWorkflow {
  readonly definition: StatusDefinition;
  requested: string;
  fault: string | null = null;
  private entries: string[] = [];
  constructor(definition: StatusDefinition) {
    this.definition = definition;
    this.requested = definition.initial;
  }
  get history(): readonly string[] {
    return Object.freeze([...this.entries]);
  }
  private note(message: string): void {
    this.entries = [...this.entries.slice(-11), message];
  }
  select(id: string): void {
    demand(
      this.definition.statuses.some((s) => s.id === id),
      "Unknown manual status",
    );
    this.requested = id;
    this.fault = null;
    this.note(`Manual: ${id}`);
  }
  dispatch(id: string): void {
    const event = this.definition.events.find((e) => e.id === id);
    demand(event, "Unknown simulated event");
    demand(
      event.from.includes(this.requested),
      `${event.label} is not allowed while ${this.requested}`,
    );
    this.requested = event.to;
    this.fault = event.fault ?? null;
    this.note(event.label);
  }
}
