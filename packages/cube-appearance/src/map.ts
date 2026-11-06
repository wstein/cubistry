import { deepFreeze } from "@cubistry/cube-core";
import { canonicalSha256 } from "./canonical.ts";
import type { Classification, Level } from "./classify.ts";
import type { SymmetryOrder, Thresholds, Turn } from "./tiles.ts";

export const APPEARANCE_MODULE = "@cubistry/cube-appearance";
/** Bump when the measuring or grouping rules change in a way that can alter a map. */
export const CLASSIFIER_VERSION = 1;

/**
 * Frozen output of the classifier: data, not code. Solvers and the Julia/Flix checkers read it and never
 * see pixels. Two class levels exist side by side:
 *
 * - `identical` (ids `i#`): tiles that look the same upright. `turn` does not apply at this level.
 * - `twin` (ids `t#`): tiles that are one another turned by quarter turns. `turn` is the quarter-turn
 *   offset: the asset upright equals the class representative turned counterclockwise by `turn`.
 *
 * `classes[x].order` is the rotational symmetry order (1, 2 or 4); turns are compared modulo `4 / order`.
 * Which level counts is a per-print policy (see `AppearancePolicy.rotationTwins`).
 */
export interface AppearanceMap {
  readonly schema: "cubistry.appearance";
  readonly version: 2;
  readonly printId: string;
  readonly classifier: {
    readonly module: string;
    readonly version: number;
    readonly level: Level;
    readonly thresholds: Thresholds;
    /** Side of the sampled tiles in pixels. */
    readonly sample: number;
    /** Free text naming the renderer (for example a browser build or "vector"), so a drift is traceable. */
    readonly renderer: string;
    readonly inputSha256: string;
  };
  readonly classes: Readonly<Record<string, { readonly order: SymmetryOrder }>>;
  readonly assets: Readonly<Record<string, { readonly identical: string; readonly twin: string; readonly turn: Turn }>>;
}

export interface MapOptions {
  readonly printId: string;
  readonly renderer: string;
  /** Default `strict`: solvers and the "solved" badge must not use the loose, advisory grouping. */
  readonly level?: Level;
}

export function toAppearanceMap(c: Classification, o: MapOptions): AppearanceMap {
  const level = o.level ?? "strict";
  const a = c[level];
  const classes: Record<string, { order: SymmetryOrder }> = {};
  const assets: Record<string, { identical: string; twin: string; turn: Turn }> = {};
  for (const g of a.identical) classes[g.id] = { order: g.order };
  for (const g of a.twins) classes[g.id] = { order: g.order };
  for (const g of a.twins) {
    for (const m of g.members) {
      const identical = a.identical.find((x) => x.members.includes(m.id));
      if (!identical) throw new Error(`Internal: ${m.id} has no identical group`);
      assets[m.id] = { identical: identical.id, twin: g.id, turn: m.turn };
    }
  }
  return validateAppearanceMap({
    schema: "cubistry.appearance",
    version: 2,
    printId: o.printId,
    classifier: {
      module: APPEARANCE_MODULE,
      version: CLASSIFIER_VERSION,
      level,
      thresholds: { pixelTolerance: a.thresholds.pixelTolerance, share: a.thresholds.share },
      sample: c.sample,
      renderer: o.renderer,
      inputSha256: c.inputSha256,
    },
    classes,
    assets,
  });
}

const ID = /^[A-Za-z0-9_-]{1,96}$/;
const SHA = /^[0-9a-f]{64}$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function need(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`Invalid appearance map: ${message}`);
}
const exactKeys = (o: Record<string, unknown>, keys: readonly string[], what: string) => {
  const extra = Object.keys(o).filter((k) => !keys.includes(k));
  need(extra.length === 0 && keys.every((k) => k in o), `${what} must have exactly ${keys.join(", ")}`);
};

/** Strict ingress check; returns a deep-frozen copy. Mirrors `schema/cubistry.appearance-2.schema.json`. */
export function validateAppearanceMap(value: unknown): AppearanceMap {
  need(isObject(value), "not an object");
  exactKeys(value, ["schema", "version", "printId", "classifier", "classes", "assets"], "map");
  need(value.schema === "cubistry.appearance" && value.version === 2, "unsupported schema or version");
  need(typeof value.printId === "string" && ID.test(value.printId), "printId");
  const c = value.classifier;
  need(isObject(c), "classifier");
  exactKeys(c, ["module", "version", "level", "thresholds", "sample", "renderer", "inputSha256"], "classifier");
  need(typeof c.module === "string" && c.module.length > 0 && c.module.length <= 96, "classifier.module");
  need(Number.isInteger(c.version) && (c.version as number) >= 1, "classifier.version");
  need(c.level === "strict" || c.level === "loose", "classifier.level");
  need(Number.isInteger(c.sample) && (c.sample as number) >= 1, "classifier.sample");
  need(typeof c.renderer === "string" && c.renderer.length > 0 && c.renderer.length <= 96, "classifier.renderer");
  need(typeof c.inputSha256 === "string" && SHA.test(c.inputSha256), "classifier.inputSha256");
  const th = c.thresholds;
  need(isObject(th), "classifier.thresholds");
  exactKeys(th, ["pixelTolerance", "share"], "thresholds");
  need(Number.isInteger(th.pixelTolerance) && (th.pixelTolerance as number) >= 0 && (th.pixelTolerance as number) <= 255, "pixelTolerance");
  need(typeof th.share === "number" && th.share >= 0 && th.share <= 1, "share");
  const classes = value.classes;
  need(isObject(classes) && Object.keys(classes).length > 0, "classes");
  for (const [id, cl] of Object.entries(classes)) {
    need(/^[it]\d+$/.test(id), `class id ${id}`);
    need(isObject(cl), `class ${id}`);
    exactKeys(cl, ["order"], `class ${id}`);
    need(cl.order === 1 || cl.order === 2 || cl.order === 4, `class ${id} order`);
  }
  const assets = value.assets;
  need(isObject(assets) && Object.keys(assets).length > 0, "assets");
  for (const [id, a] of Object.entries(assets)) {
    need(ID.test(id), `asset id ${id}`);
    need(isObject(a), `asset ${id}`);
    exactKeys(a, ["identical", "twin", "turn"], `asset ${id}`);
    need(typeof a.identical === "string" && /^i\d+$/.test(a.identical) && a.identical in classes, `asset ${id} identical`);
    need(typeof a.twin === "string" && /^t\d+$/.test(a.twin) && a.twin in classes, `asset ${id} twin`);
    const order = (classes[a.twin as string] as { order: number }).order;
    need(Number.isInteger(a.turn) && (a.turn as number) >= 0 && (a.turn as number) < 4 / order, `asset ${id} turn`);
  }
  return deepFreeze(structuredClone(value)) as unknown as AppearanceMap;
}

/** SHA-256 of the canonical JSON of the whole map: the identity solvers and checkers pin. */
export const appearanceSha256 = (map: AppearanceMap): string => canonicalSha256(map);
