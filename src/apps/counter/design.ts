import {
  deepFreeze,
  demand,
  record,
  validatePrint,
  identifier,
  type PrintDefinition,
  type CubeState,
  type DisplayTarget,
  type Vec3,
} from "@cubistry/cube-core";
import { validateAssets, type AssetManifest } from "@cubistry/cube-assets";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
  type MovePresentation,
} from "@cubistry/cube-mechanics";
export const FRONT: readonly Vec3[] = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
export interface CounterConfig {
  readonly label: string;
  readonly padded: boolean;
  readonly wrap: boolean;
  readonly minimum: 0;
  readonly maximum: 99;
}
export function validLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().split("\n").length <= 2 &&
    value
      .trim()
      .split("\n")
      .every((l) => Array.from(l).length <= 40)
  );
}
export function validateCounterConfig(raw: unknown): CounterConfig {
  const c = record(raw, "counter configuration");
  demand(
    validLabel(c.label) &&
      typeof c.padded === "boolean" &&
      typeof c.wrap === "boolean" &&
      c.minimum === 0 &&
      c.maximum === 99,
    "Invalid counter configuration",
  );
  return deepFreeze({
    label: c.label,
    padded: c.padded,
    wrap: c.wrap,
    minimum: 0,
    maximum: 99,
  });
}
export interface CounterDesign {
  readonly schema: "cubistry.counter-design";
  readonly version: 2;
  readonly puzzle: "2x2x2";
  readonly legacyWitnessSHA256: string;
  readonly assets: AssetManifest;
  readonly prints: {
    readonly padded: PrintDefinition;
    readonly unpadded: PrintDefinition;
  };
  readonly witnesses: readonly {
    readonly value: number;
    readonly word: string;
  }[];
}
export function targetFor(value: number, padded: boolean): DisplayTarget {
  demand(
    Number.isInteger(value) && value >= 0 && value <= 99,
    "Invalid counter target",
  );
  return deepFreeze({
    schema: "cubistry.target",
    version: 1,
    facelets: FRONT.map((position, i) => ({
      position,
      normal: [0, 0, 1] as Vec3,
      up: [0, 1, 0] as Vec3,
      matching:
        i === 2 && value < 10 && !padded
          ? ("equivalent" as const)
          : ("exact" as const),
      assetId: [
        "title-left",
        "title-right",
        value < 10 && !padded ? "blank" : String(Math.floor(value / 10)),
        String(value % 10),
      ][i],
    })),
  });
}
export function validateCounterDesign(raw: unknown): CounterDesign {
  const d = record(raw, "counter design");
  demand(
    d.schema === "cubistry.counter-design" &&
      d.version === 2 &&
      d.puzzle === "2x2x2",
    "Unsupported counter design schema/version/puzzle",
  );
  demand(
    typeof d.legacyWitnessSHA256 === "string" &&
      /^[0-9a-f]{64}$/.test(d.legacyWitnessSHA256),
    "Invalid source witness provenance",
  );
  const p = record(d.prints, "prints");
  const padded = validatePrint(p.padded),
    unpadded = validatePrint(p.unpadded);
  const assets = validateAssets(d.assets, [padded, unpadded]);
  demand(
    assets.documents.some((v) => v.id === "counter-title") &&
      assets.images.some((a) => a.id === "blank") &&
      ["title-left", "title-right", ..."0123456789"].every((id) =>
        assets.images.some((a) => a.id === id),
      ),
    "Missing required counter image identities",
  );
  demand(
    Array.isArray(d.witnesses) && d.witnesses.length === 100,
    "Counter needs 100 complete witnessed targets",
  );
  const witnesses = d.witnesses.map((raw, i) => {
    const w = record(raw, "witness");
    demand(
      w.value === i && typeof w.word === "string",
      "Invalid or duplicate counter goal",
    );
    demand(
      parseAlg(w.word).length <= 64,
      "Witness exceeds bounded replay budget",
    );
    return { value: i, word: w.word };
  });
  for (const [print, padding] of [
    [padded, true],
    [unpadded, false],
  ] as const) {
    const source = initialState(print);
    for (const w of witnesses)
      demand(
        matchesTarget(
          print,
          applyMoves(source, parseAlg(w.word)),
          targetFor(w.value, padding),
        ),
        `Witness ${w.value} does not reach its exact counter target`,
      );
  }
  return deepFreeze({
    schema: "cubistry.counter-design",
    version: 2,
    puzzle: "2x2x2",
    legacyWitnessSHA256: d.legacyWitnessSHA256,
    assets,
    prints: { padded, unpadded },
    witnesses,
  });
}
/** Configure a new immutable print instance. This is never called by counting. */
export async function configurePrint(
  design: CounterDesign,
  config: CounterConfig,
): Promise<{ print: PrintDefinition; assets: AssetManifest }> {
  const base = design.prints[config.padded ? "padded" : "unpadded"];
  const assets = validateAssets(
    {
      ...design.assets,
      documents: design.assets.documents.map((d) =>
        d.id === "counter-title" ? { ...d, text: config.label } : d,
      ),
    },
    [base],
  );
  const bytes = new TextEncoder().encode(
    JSON.stringify({ print: base, assets }),
  );
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return { print: validatePrint({ ...base, id: "counter_" + hash }), assets };
}

export async function loadCounterDesign(
  signal?: AbortSignal,
): Promise<CounterDesign> {
  signal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
    : AbortSignal.timeout(10000);
  const response = await fetch("/counter-design.v2.json", {
    signal,
    redirect: "error",
    credentials: "same-origin",
  });
  demand(response.ok, "Counter design could not be loaded");
  demand(
    (response.headers.get("content-type") || "").split(";")[0] ===
      "application/json",
    "Unexpected design content type",
  );
  demand(
    Number(response.headers.get("content-length") || 0) <= 2097152,
    "Counter design too large",
  );
  demand(response.body, "Counter design body unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      count += result.value.length;
      demand(count <= 2097152, "Counter design byte limit exceeded");
      chunks.push(result.value);
    }
  } catch (e) {
    await reader.cancel();
    throw e;
  }
  const bytes = new Uint8Array(count);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return validateCounterDesign(JSON.parse(new TextDecoder().decode(bytes)));
}
