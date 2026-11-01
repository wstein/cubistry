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
import { stateEquals } from "@cubistry/cube-core";
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
export type Letter = "H" | "S" | "M";
/** Largest step, in HTM, of every saved counting period (the owner's limit). */
export const PERIOD_EDGE_LIMIT = 5;
/**
 * One counter application built on this code: which letters its print
 * carries, its counting ranges per letter, the owner's per-edge limit for the
 * saved periods, the cap for a free jump and the runtime file it loads.
 * The H/M/S counter is the default everywhere; the H/M counter (src/apps/hm)
 * is a second variant of the same controller, planner and periods.
 */
export interface HsmVariant {
  readonly id: string;
  readonly letters: readonly Letter[];
  readonly ranges: Readonly<Partial<Record<Letter, readonly number[]>>>;
  readonly printId: string;
  /** Largest step of every saved period, and the recovery step limit. */
  readonly edgeLimit: number;
  /** Cap for one free jump from a settled pose. */
  readonly jumpBound: number;
  readonly runtimeFile: string;
  /**
   * The runtime names its letters and edge limit, and every period its
   * largest step (`maximumHTM`), which validation asserts.
   */
  readonly extended: boolean;
}
export const HSM_VARIANT: HsmVariant = Object.freeze({
  id: "hsm",
  letters: Object.freeze(["H", "S", "M"] as const),
  ranges: Object.freeze({
    H: Object.freeze([59, 23, 11]),
    S: Object.freeze([59, 23, 11]),
    M: Object.freeze([59, 23, 11]),
  }),
  printId: "hsm_counter_seconds_first",
  edgeLimit: PERIOD_EDGE_LIMIT,
  jumpBound: 6,
  runtimeFile: "hsm-counter.v3.json",
  extended: false,
});
/**
 * One closed counting period of the pinned print for one counting mode. Node `i`
 * shows value `direction * i mod (maximum + 1)`; `words[i]` is the route from
 * node `i` to `i + 1`, and the last word returns to node 0. A period with
 * traversal "inverse" is the opposite direction's research period run backward
 * with every word inverted, written out in its own direction.
 */
export interface HsmPeriod {
  readonly letter: Letter;
  readonly maximum: number;
  readonly direction: 1 | -1;
  readonly traversal: "forward" | "inverse";
  /** Route from the solved print to node 0, which displays 00. */
  readonly setup: string;
  readonly periodHTM: number;
  /** Largest step of the period, in HTM. */
  readonly maximumHTM: number;
  readonly words: readonly string[];
}
export interface HsmDesign {
  readonly print: PrintDefinition;
  readonly zeroWords: Readonly<Partial<Record<Letter, string>>>;
  readonly periods: readonly HsmPeriod[];
  readonly variant: HsmVariant;
}
function validatePeriod(
  print: PrintDefinition,
  raw: unknown,
  variant: HsmVariant,
): HsmPeriod {
  const p = record(raw, "HSM period");
  demand(
    variant.letters.includes(p.letter as Letter) &&
      (variant.ranges[p.letter as Letter] ?? []).includes(
        p.maximum as number,
      ) &&
      [11, 23, 59].includes(p.maximum as number) &&
      [1, -1].includes(p.direction as number) &&
      ["forward", "inverse"].includes(p.traversal as string) &&
      typeof p.setup === "string" &&
      Array.isArray(p.words) &&
      p.words.length > 0 &&
      p.words.length % ((p.maximum as number) + 1) === 0 &&
      p.words.every((w) => typeof w === "string" && w.length > 0),
    "Invalid HSM period",
  );
  const letter = p.letter as Letter,
    modulus = (p.maximum as number) + 1,
    direction = p.direction as 1 | -1,
    words = p.words as string[];
  const start = applyMoves(initialState(print), parseAlg(p.setup as string));
  let state = start,
    total = 0,
    largest = 0;
  words.forEach((word, i) => {
    demand(
      matchesTarget(
        print,
        state,
        hsmTarget(letter, (((direction * i) % modulus) + modulus) % modulus),
      ),
      "HSM period node shows the wrong value",
    );
    const moves = parseAlg(word);
    demand(
      moves.length >= 1 && moves.length <= variant.edgeLimit,
      "HSM period edge too long",
    );
    total += moves.length;
    largest = Math.max(largest, moves.length);
    state = applyMoves(state, moves);
  });
  demand(stateEquals(state, start), "HSM period does not close");
  demand(total === p.periodHTM, "HSM period length mismatch");
  demand(
    !variant.extended || p.maximumHTM === largest,
    "HSM period maximum mismatch",
  );
  return deepFreeze({
    letter,
    maximum: p.maximum as number,
    direction,
    traversal: p.traversal as HsmPeriod["traversal"],
    setup: p.setup as string,
    periodHTM: total,
    maximumHTM: largest,
    words,
  });
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
export function validateHsmDesign(
  raw: unknown,
  variant: HsmVariant = HSM_VARIANT,
): HsmDesign {
  const d = record(raw, "HSM counter");
  demand(
    d.schema === "cubistry.hsm-runtime" &&
      d.version === 4 &&
      Array.isArray(d.printing) &&
      d.printing.length === 24,
    "Invalid HSM runtime",
  );
  demand(
    !variant.extended ||
      (JSON.stringify(d.letters) === JSON.stringify(variant.letters) &&
        d.edgeLimitHTM === variant.edgeLimit),
    "HSM runtime is for another counter variant",
  );
  const glyph = new RegExp(`^[0-9${variant.letters.join("")}]$`);
  const printing = d.printing as Record<string, unknown>[];
  const cubies = Array.from({ length: 8 }, (_, id) => ({
    id,
    position: printing.find((s) => s.cubie === id)?.p,
  }));
  const print = validatePrint({
    schema: "cubistry.print",
    version: 1,
    id: variant.printId,
    topology: { kind: "cube", size: 2 },
    cubies,
    stickers: printing.map((s, i) => {
      demand(
        s.id === i &&
          typeof s.image === "string" &&
          (s.image === "" || glyph.test(s.image)),
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
  for (const letter of variant.letters) {
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
  demand(Array.isArray(d.periods), "Missing HSM periods");
  const periods = (d.periods as unknown[]).map((p) =>
    validatePeriod(print, p, variant),
  );
  demand(
    new Set(periods.map((p) => `${p.letter}/${p.maximum}/${p.direction}`))
      .size === periods.length,
    "Duplicate HSM period",
  );
  for (const letter of variant.letters) {
    const first = periods.find((p) => p.letter === letter);
    demand(
      !first || first.setup === zero[letter],
      "HSM setup is not the first period's setup",
    );
  }
  return deepFreeze({
    print,
    zeroWords: Object.fromEntries(
      variant.letters.map((letter) => [letter, zero[letter] as string]),
    ),
    periods,
    variant,
  });
}
export async function loadHsmDesign(
  basePath: string,
  expectedHash: string,
  variant: HsmVariant = HSM_VARIANT,
): Promise<HsmDesign> {
  const response = await fetch(
    `${deploymentBasePath(basePath)}${variant.runtimeFile}`,
  );
  demand(response.ok, "Unable to load HSM print");
  const bytes = await response.arrayBuffer();
  demand(
    bytes.byteLength < 32768 &&
      (await sha256(new Uint8Array(bytes))) === expectedHash,
    "HSM print integrity mismatch",
  );
  return validateHsmDesign(
    JSON.parse(new TextDecoder().decode(bytes)),
    variant,
  );
}
