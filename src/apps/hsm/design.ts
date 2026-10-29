import {
  demand,
  deepFreeze,
  record,
  validatePrint,
  type PrintDefinition,
  type DisplayTarget,
  type Vec3,
} from "@cubistry/cube-core";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
export type Letter = "H" | "S" | "M";
export interface HsmDesign {
  readonly print: PrintDefinition;
  readonly zeroWords: Readonly<Record<Letter, string>>;
}
export const positions: readonly Vec3[] = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
export function hsmTarget(letter: Letter, value: number): DisplayTarget {
  demand(
    ["H", "S", "M"].includes(letter) &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < 60,
    "Invalid HSM display",
  );
  return deepFreeze({
    schema: "cubistry.target",
    version: 1,
    facelets: ["blank", letter, ...String(value).padStart(2, "0")].map(
      (assetId, i) => ({
        position: positions[i],
        normal: [0, 0, 1],
        up: [0, 1, 0],
        assetId,
        // The unprinted sticker's up vector has no visible meaning.
        matching: assetId === "blank" ? "equivalent" : "exact",
      }),
    ),
  });
}
export function validateHsmDesign(raw: unknown): HsmDesign {
  const d = record(raw, "HSM counter");
  demand(
    d.schema === "cubistry.hsm-runtime" &&
      d.version === 2 &&
      Array.isArray(d.printing) &&
      d.printing.length === 24,
    "Invalid HSM runtime",
  );
  const printing = d.printing as Record<string, unknown>[];
  const cubies = Array.from({ length: 8 }, (_, id) => ({
    id,
    position: printing.find((s) => s.cubie === id)?.p,
  }));
  const print = validatePrint({
    schema: "cubistry.print",
    version: 1,
    id: "hsm_counter_blank",
    topology: { kind: "cube", size: 2 },
    cubies,
    stickers: printing.map((s, i) => {
      demand(
        s.id === i &&
          typeof s.image === "string" &&
          (s.image === "" || /^[0-9HSM]$/.test(s.image)),
        "Invalid immutable HSM glyph",
      );
      demand(
        JSON.stringify(s.p) ===
          JSON.stringify(cubies.find((c) => c.id === s.cubie)?.position),
        "HSM body mismatch",
      );
      return {
        id: s.id,
        cubie: s.cubie,
        normal: s.n,
        up: s.up,
        assetId: s.image || "blank",
        materialId: "sticker",
        equivalentQuarterTurns: s.image ? [0] : [0, 1, 2, 3],
      };
    }),
  });
  const zero = record(d.zeroWords, "HSM setups");
  for (const letter of ["H", "S", "M"] as const) {
    demand(typeof zero[letter] === "string", "Missing HSM setup");
    demand(
      matchesTarget(
        print,
        applyMoves(initialState(print), parseAlg(zero[letter])),
        hsmTarget(letter, 0),
      ),
      "Invalid HSM setup",
    );
  }
  return deepFreeze({ print, zeroWords: zero as Record<Letter, string> });
}
export async function loadHsmDesign(
  basePath: string,
  expectedHash: string,
): Promise<HsmDesign> {
  const response = await fetch(
    `${deploymentBasePath(basePath)}hsm-counter.v2.json`,
  );
  demand(response.ok, "Unable to load HSM print");
  const bytes = await response.arrayBuffer();
  demand(
    bytes.byteLength < 20000 &&
      (await sha256(new Uint8Array(bytes))) === expectedHash,
    "HSM print integrity mismatch",
  );
  return validateHsmDesign(JSON.parse(new TextDecoder().decode(bytes)));
}
