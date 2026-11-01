import {
  demand,
  deepFreeze,
  record,
  stateEquals,
  validatePrint,
  type LegalMove,
  type PrintDefinition,
} from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  matchesTarget,
  parseAlg,
} from "@cubistry/cube-mechanics";
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
import { hsmTarget } from "../hsm/design.ts";

export type MsLetter = "M" | "S";
export const MS_LETTERS: readonly MsLetter[] = ["M", "S"];
/** Owner's limit, in HTM, for every saved increment (and so every decrement). */
export const MS_EDGE_LIMIT = 4;
/** Values 00..59 for both letters. */
export const MS_MODULUS = 60;
export const MS_RUNTIME_FILE = "ms-counter.v1.json";

/** The display: blank upper-left, the letter upper-right, tens and units below. */
export const msTarget = (letter: MsLetter, value: number) =>
  hsmTarget(letter, value);

/**
 * One closed counting run of a print (research PR #138). Node `i` shows
 * `i mod 60`; `words[i]` leads from node `i` to node `i + 1` and the last word
 * returns to node 0. `laps` is the minimal number of 00..59 laps after which the
 * full pose (hidden stickers included) repeats: S3's seconds need two.
 * Decrements are the exact inverse traversal of this period.
 */
export interface MsRun {
  readonly letter: MsLetter;
  /** Route from the solved print to node 0, which shows 00. */
  readonly setup: string;
  readonly laps: number;
  readonly periodHTM: number;
  readonly maximumHTM: number;
  readonly words: readonly string[];
  /** Research lower bound of each edge (four tracked front stickers). */
  readonly lowerBounds: readonly number[];
}
export interface MsPrint {
  readonly id: string;
  readonly label: string;
  readonly print: PrintDefinition;
  readonly maximumHTM: number;
  readonly runs: Readonly<Record<MsLetter, MsRun>>;
}
/** The application runtime: print S3 of research PR #138 (M3 is not in the app). */
export interface MsDesign {
  readonly edgeLimitHTM: number;
  readonly source: Readonly<{ pullRequest: number; commit: string }>;
  readonly print: MsPrint;
}

function validateRun(print: PrintDefinition, raw: unknown): MsRun {
  const r = record(raw, "M/S run");
  demand(
    MS_LETTERS.includes(r.letter as MsLetter) &&
      typeof r.setup === "string" &&
      Number.isInteger(r.laps) &&
      (r.laps as number) >= 1 &&
      Array.isArray(r.words) &&
      r.words.length === MS_MODULUS * (r.laps as number) &&
      r.words.every((w) => typeof w === "string" && w.length > 0) &&
      Array.isArray(r.lowerBounds) &&
      r.lowerBounds.length === r.words.length &&
      r.lowerBounds.every((b) => Number.isInteger(b) && b >= 0),
    "Invalid M/S run",
  );
  const letter = r.letter as MsLetter,
    words = r.words as string[],
    laps = r.laps as number;
  const start = applyMoves(initialState(print), parseAlg(r.setup as string));
  let state = start,
    total = 0,
    maximum = 0;
  words.forEach((word, i) => {
    demand(
      matchesTarget(print, state, msTarget(letter, i % MS_MODULUS)),
      "M/S period node shows the wrong value",
    );
    const moves: readonly LegalMove[] = parseAlg(word);
    demand(
      moves.length >= 1 &&
        moves.length <= MS_EDGE_LIMIT &&
        moves.length >= (r.lowerBounds as number[])[i],
      "M/S period edge outside its bounds",
    );
    total += moves.length;
    maximum = Math.max(maximum, moves.length);
    state = applyMoves(state, moves);
    // The claimed number of laps is minimal: no earlier lap closes.
    if ((i + 1) % MS_MODULUS === 0 && i + 1 < words.length)
      demand(!stateEquals(state, start), "M/S period closes early");
  });
  demand(stateEquals(state, start), "M/S period does not close");
  demand(
    total === r.periodHTM && maximum === r.maximumHTM,
    "M/S period length mismatch",
  );
  return deepFreeze({
    letter,
    setup: r.setup as string,
    laps,
    periodHTM: total,
    maximumHTM: maximum,
    words,
    lowerBounds: r.lowerBounds as number[],
  });
}

function validateMsPrint(raw: unknown): MsPrint {
  const p = record(raw, "M/S print");
  demand(
    typeof p.id === "string" &&
      /^[a-z0-9]+$/.test(p.id) &&
      typeof p.label === "string" &&
      p.printId === `ms_counter_${p.id}` &&
      Array.isArray(p.printing) &&
      p.printing.length === 24 &&
      Array.isArray(p.runs) &&
      p.runs.length === 2,
    "Invalid M/S print",
  );
  const printing = p.printing as Record<string, unknown>[];
  const cubies = Array.from({ length: 8 }, (_, id) => ({
    id,
    position: printing.find((s) => s.cubie === id)?.p,
  }));
  const print = validatePrint({
    schema: "cubistry.print",
    version: 1,
    id: p.printId,
    topology: { kind: "cube", size: 2 },
    cubies,
    stickers: printing.map((s, i) => {
      demand(
        s.id === i &&
          typeof s.image === "string" &&
          (s.image === "" || /^[0-9MS]$/.test(s.image)),
        "Invalid immutable M/S glyph",
      );
      demand(
        JSON.stringify(s.p) ===
          JSON.stringify(cubies.find((c) => c.id === s.cubie)?.position),
        "M/S body mismatch",
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
  const runs = (p.runs as unknown[]).map((r) => validateRun(print, r));
  demand(
    runs[0].letter === "M" && runs[1].letter === "S",
    "M/S print needs one M and one S run",
  );
  const maximumHTM = Math.max(...runs.map((r) => r.maximumHTM));
  demand(maximumHTM === p.maximumHTM, "M/S print maximum mismatch");
  return deepFreeze({
    id: p.id,
    label: p.label,
    print,
    maximumHTM,
    runs: { M: runs[0], S: runs[1] },
  });
}

export function validateMsDesign(raw: unknown): MsDesign {
  const d = record(raw, "M/S counter");
  demand(
    d.schema === "cubistry.ms-runtime" &&
      d.version === 1 &&
      d.edgeLimitHTM === MS_EDGE_LIMIT &&
      !("prints" in d),
    "Invalid M/S runtime",
  );
  const source = record(d.source, "M/S source");
  demand(
    Number.isInteger(source.pullRequest) &&
      typeof source.commit === "string" &&
      /^[0-9a-f]{40}$/.test(source.commit),
    "Invalid M/S source",
  );
  return deepFreeze({
    edgeLimitHTM: MS_EDGE_LIMIT,
    source: {
      pullRequest: source.pullRequest as number,
      commit: source.commit as string,
    },
    print: validateMsPrint(d.print),
  });
}

export async function loadMsDesign(
  basePath: string,
  expectedHash: string,
): Promise<MsDesign> {
  const response = await fetch(
    `${deploymentBasePath(basePath)}${MS_RUNTIME_FILE}`,
  );
  demand(response.ok, "Unable to load M/S print");
  const bytes = await response.arrayBuffer();
  demand(
    bytes.byteLength < 65536 &&
      (await sha256(new Uint8Array(bytes))) === expectedHash,
    "M/S print integrity mismatch",
  );
  return validateMsDesign(JSON.parse(new TextDecoder().decode(bytes)));
}
