// How well a picture set works as a puzzle, measured on its stickers. The pure functions here are
// shared by the playground's live suitability display and by scripts/check-pastel-garden-tiles.mjs
// (its --sizes mode), so both use one definition of "flat", "rotation symmetric" and "identical".
// That definition is the shared classifier in packages/cube-appearance at its LOOSE level (owner
// decisions D3 and D8): this module keeps the traffic light and the display wording but owns no pixel
// comparison of its own. Resolution: flatness and rotational symmetry are measured on the full SAMPLE x
// SAMPLE sticker (same as the check script); only the identical and rotation-twin GROUPS, which compare
// every pair, run on a COARSE block-average copy to keep N = 7 (294 stickers) tolerable. A sticker is an SAMPLE x SAMPLE RGBA buffer (the caller renders it; this module
// never touches the DOM). The result ADVISES only: nothing here blocks a design, and it must not feed
// solver decisions (solvers use the strict level or exact thresholds).
import {
  LOOSE_THRESHOLDS,
  classifyTiles,
  detailOf,
  differingShare,
  rotateRgb,
  symmetryOrder,
  tileHash,
  toRgb,
  type Classification,
  type SymmetryOrder,
} from "@cubistry/cube-appearance";

export const SAMPLE = 80; // edge of the sampled sticker in pixels
export const MIN_DETAIL = 0.08; // share of pixels that are not the sticker's dominant color
export const MIN_ROT_DIFF = LOOSE_THRESHOLDS.share; // share of pixels that may change under a rotation (loose level)
/** Edge of the copy the groups are compared on (block averages); keeps N = 7 (294 stickers) interactive. */
export const COARSE = 20;

export interface TileMeasure {
  /** Share of pixels that are not the dominant (quantized) color; low means mostly flat. */
  readonly detail: number;
  /** Share of changed pixels for the rotations by 90, 180 and 270 degrees. */
  readonly rotations: readonly [number, number, number];
  /** Smallest of `rotations`; low means the sticker looks like one of its own rotations. */
  readonly minRot: number;
  /** Hash of the composited pixels: equal hashes mean identical stickers. */
  readonly hash: string;
}

/** Measures one n x n RGBA sticker (n = SAMPLE unless stated) with the shared classifier's primitives. */
export function measureRgba(d: ArrayLike<number>, n = SAMPLE): TileMeasure {
  const rgb = toRgb({ id: "sticker", side: n, data: d });
  const rotations = [1, 2, 3].map((k) => differingShare(rgb, rotateRgb(rgb, k), LOOSE_THRESHOLDS.pixelTolerance)) as [
    number,
    number,
    number,
  ];
  return { detail: detailOf(rgb), rotations, minRot: Math.min(...rotations), hash: tileHash(rgb) };
}

export type Symmetry = SymmetryOrder;
/** Rotational symmetry order: 4 = looks the same turned by 90 degrees, 2 = by 180 degrees only, 1 = none. */
export function symmetryOf(m: TileMeasure): Symmetry {
  return symmetryOrder(m.rotations, LOOSE_THRESHOLDS);
}
export const isFlat = (m: TileMeasure) => m.detail < MIN_DETAIL;

/** Coarse copy of a sticker (block averages), enough to compare different stickers and their rotations. */
function coarse(d: ArrayLike<number>, n: number): Uint8ClampedArray {
  const k = n / COARSE,
    out = new Uint8ClampedArray(COARSE * COARSE * 4);
  for (let y = 0; y < COARSE; y++)
    for (let x = 0; x < COARSE; x++)
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) sum += d[(((y * k + j) * n) + x * k + i) * 4 + c];
        out[(y * COARSE + x) * 4 + c] = sum / (k * k);
      }
  return out;
}

export interface StickerInput {
  readonly id: string;
  /** SAMPLE x SAMPLE RGBA pixels. */
  readonly data: ArrayLike<number>;
}

export type ProblemKind = "flat" | "identical" | "symmetric2" | "symmetric4" | "twin";
export interface Problem {
  readonly id: string;
  readonly kinds: readonly ProblemKind[];
}
export type TrafficLight = "green" | "yellow" | "red";

export interface Suitability {
  readonly n: number;
  readonly total: number;
  /** Stickers that are mostly one flat color. */
  readonly flat: readonly string[];
  /** Groups (two or more) of stickers that render identically. */
  readonly identicalGroups: readonly (readonly string[])[];
  /** Stickers that look the same turned by 180 degrees only / by 90 degrees (and so 180). */
  readonly symmetric2: readonly string[];
  readonly symmetric4: readonly string[];
  /** Groups of stickers where one is another turned by 90, 180 or 270 degrees (not identical to it). */
  readonly twinGroups: readonly (readonly string[])[];
  /** Stickers whose orientation is ambiguous: symmetric or in a twin group, and not already flat. */
  readonly ambiguous: readonly string[];
  /** Detailed (not flat) stickers by rotational symmetry: none, 2-fold (180 degrees), 4-fold (90 degrees). */
  readonly symmetry: { readonly none: number; readonly twoFold: number; readonly fourFold: number };
  /** Faces (letters) whose stickers are all flat: nothing on them can be told apart. */
  readonly flatFaces: readonly string[];
  /** Every sticker worth a look (flat, identical, symmetric or a turned copy), in sticker order. */
  readonly problems: readonly Problem[];
  /**
   * Only real problems set the light: flat stickers (nothing to recognize) and unusable faces. Ambiguity
   * (identical, symmetric or turned stickers) is information, not an error: the puzzle stays solvable.
   * Green: no flat sticker. Yellow: some, up to a quarter of the stickers. Red: more than a quarter, or a
   * whole face that is flat.
   */
  readonly light: TrafficLight;
}

/** Share of flat stickers up to which the light is yellow instead of red. */
export const YELLOW_LIMIT = 0.25;

export function analyzeStickers(stickers: readonly StickerInput[], n: number): Suitability {
  const flatSet = new Set<string>(),
    symmetric2: string[] = [],
    symmetric4: string[] = [];
  const c: Classification | null = stickers.length
    ? classifyTiles(stickers.map((s) => ({ id: s.id, side: COARSE, data: coarse(s.data, SAMPLE) })))
    : null;
  stickers.forEach((s) => {
    // Flatness and symmetry come from the full-size sticker; only the groups use the coarse copy.
    const m = measureRgba(s.data);
    if (isFlat(m)) flatSet.add(s.id);
    const order = symmetryOf(m);
    if (order === 4) symmetric4.push(s.id);
    else if (order === 2) symmetric2.push(s.id);
  });
  // Identical: stickers of one loose identical class (a superset of exact pixel copies).
  // Rotation twins: one sticker is another turned by a quarter, half or three-quarter turn. Flat stickers and
  // identical copies are reported elsewhere, so only classes of two or more distinct, detailed pictures count.
  const order = new Map(stickers.map((s, i) => [s.id, i] as const));
  const bySticker = (a: string, b: string) => order.get(a)! - order.get(b)!;
  const inSticker = (groups: string[][]) => groups.map((g) => g.sort(bySticker)).sort((a, b) => bySticker(a[0], b[0]));
  const identicalGroups = inSticker((c?.loose.identical ?? []).filter((g) => g.members.length > 1).map((g) => [...g.members]));
  const identicalOf = new Set(identicalGroups.flat());
  const twinMembers = (c?.loose.twins ?? [])
    .filter((g) => g.identical.length > 1)
    .map((g) => g.members.map((m) => m.id).filter((id) => !flatSet.has(id)))
    .filter((ids) => new Set(ids.map((id) => c!.loose.identical.findIndex((i) => i.members.includes(id)))).size > 1);
  const inTwin = new Set(twinMembers.flat());
  const twinGroups = inSticker(twinMembers.map((g) => [...g]));
  const ambiguousSet = new Set<string>();
  for (const id of [...symmetric2, ...symmetric4, ...inTwin]) if (!flatSet.has(id)) ambiguousSet.add(id);
  const problems: Problem[] = [];
  const sym2 = new Set(symmetric2),
    sym4 = new Set(symmetric4);
  for (const s of stickers) {
    const kinds: ProblemKind[] = [];
    if (flatSet.has(s.id)) kinds.push("flat");
    if (identicalOf.has(s.id)) kinds.push("identical");
    if (sym4.has(s.id) && !flatSet.has(s.id)) kinds.push("symmetric4");
    if (sym2.has(s.id) && !flatSet.has(s.id)) kinds.push("symmetric2");
    if (inTwin.has(s.id)) kinds.push("twin");
    if (kinds.length) problems.push({ id: s.id, kinds });
  }
  const faceOf = (id: string) => id.split("_")[0];
  const flatFaces = [...new Set(stickers.map((s) => faceOf(s.id)))].filter((face) =>
    stickers.filter((s) => faceOf(s.id) === face).every((s) => flatSet.has(s.id)),
  );
  const light: TrafficLight =
    flatSet.size === 0
      ? "green"
      : flatSet.size / stickers.length > YELLOW_LIMIT || flatFaces.length > 0
        ? "red"
        : "yellow";
  const detailed = stickers.filter((s) => !flatSet.has(s.id)).length;
  const symmetry = {
    none: detailed - symmetric2.filter((id) => !flatSet.has(id)).length - symmetric4.filter((id) => !flatSet.has(id)).length,
    twoFold: symmetric2.filter((id) => !flatSet.has(id)).length,
    fourFold: symmetric4.filter((id) => !flatSet.has(id)).length,
  };
  return {
    n,
    total: stickers.length,
    flat: stickers.filter((s) => flatSet.has(s.id)).map((s) => s.id),
    identicalGroups,
    symmetric2,
    symmetric4,
    twinGroups,
    ambiguous: stickers.filter((s) => ambiguousSet.has(s.id)).map((s) => s.id),
    symmetry,
    flatFaces,
    problems,
    light,
  };
}

/** "Rotation symmetry: 40 none, 6 2-fold, 2 4-fold". */
export function describeSymmetry(s: Suitability): string {
  return `Rotation symmetry of the detailed stickers: ${s.symmetry.none} none, ${s.symmetry.twoFold} 2-fold, ${s.symmetry.fourFold} 4-fold`;
}

/** One line: "12 stickers flat, 4 identical groups, 9 rotation-ambiguous". */
export function describeSuitability(s: Suitability): string {
  const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [
    `${plural(s.flat.length, "sticker", "stickers")} flat`,
    `${plural(s.identicalGroups.length, "identical group", "identical groups")}`,
    `${s.ambiguous.length} rotation-ambiguous`,
  ].join(", ");
}
