// How well a picture set works as a puzzle, measured on its stickers. The pure functions here are
// shared by the playground's live suitability display and by scripts/check-pastel-garden-tiles.mjs
// (its --sizes mode), so both use one definition of "flat", "rotation symmetric" and "identical".
// A sticker is an SAMPLE x SAMPLE RGBA buffer (the caller renders it; this module never touches the
// DOM). The result ADVISES only: nothing here blocks a design.
export const SAMPLE = 80; // edge of the sampled sticker in pixels
export const MIN_DETAIL = 0.08; // share of pixels that are not the sticker's dominant color
export const MIN_ROT_DIFF = 0.03; // share of pixels that change under the least-different rotation
const PIXEL_TOLERANCE = 24; // per-channel difference that counts as "different"

export interface TileMeasure {
  /** Share of pixels that are not the dominant (quantized) color; low means mostly flat. */
  readonly detail: number;
  /** Share of changed pixels for the rotations by 90, 180 and 270 degrees. */
  readonly rotations: readonly [number, number, number];
  /** Smallest of `rotations`; low means the sticker looks like one of its own rotations. */
  readonly minRot: number;
  /** Hash of the raw pixels: equal hashes mean identical stickers. */
  readonly hash: string;
}

const rotate90 = (n: number) => (x: number, y: number): [number, number] => [n - 1 - y, x];
const rotate180 = (n: number) => (x: number, y: number): [number, number] => [n - 1 - x, n - 1 - y];
const rotate270 = (n: number) => (x: number, y: number): [number, number] => [y, n - 1 - x];

/** Measures one n x n RGBA sticker (n = SAMPLE unless stated). */
export function measureRgba(d: ArrayLike<number>, n = SAMPLE): TileMeasure {
  const q = (i: number) => `${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`;
  const hist = new Map<string, number>();
  for (let i = 0; i < d.length; i += 4) hist.set(q(i), (hist.get(q(i)) ?? 0) + 1);
  const detail = 1 - Math.max(...hist.values()) / (n * n);
  const px = (x: number, y: number) => (y * n + x) * 4;
  const diff = (a: number, b: number) => {
    for (let c = 0; c < 3; c++) if (Math.abs(d[a + c] - d[b + c]) > PIXEL_TOLERANCE) return 1;
    return 0;
  };
  const rotations = [rotate90(n), rotate180(n), rotate270(n)].map((m) => {
    let k = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const [u, v] = m(x, y);
        k += diff(px(x, y), px(u, v));
      }
    return k / (n * n);
  }) as [number, number, number];
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < d.length; i++) {
    h1 = Math.imul(h1 ^ d[i], 0x01000193);
    h2 = Math.imul(h2 + d[i], 0x85ebca6b) ^ (h2 >>> 13);
  }
  return { detail, rotations, minRot: Math.min(...rotations), hash: h1 + ":" + h2 };
}

export type Symmetry = 1 | 2 | 4;
/** Rotational symmetry order: 4 = looks the same turned by 90 degrees, 2 = by 180 degrees only, 1 = none. */
export function symmetryOf(m: TileMeasure): Symmetry {
  const [r90, r180, r270] = m.rotations;
  if (Math.min(r90, r270) < MIN_ROT_DIFF) return 4;
  return r180 < MIN_ROT_DIFF ? 2 : 1;
}
export const isFlat = (m: TileMeasure) => m.detail < MIN_DETAIL;

/** Coarse copy of a sticker (block averages), enough to compare rotations of different stickers. */
const COARSE = 20;
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
const rotCoarse = [
  (x: number, y: number): [number, number] => [x, y],
  (x: number, y: number): [number, number] => [COARSE - 1 - y, x],
  (x: number, y: number): [number, number] => [COARSE - 1 - x, COARSE - 1 - y],
  (x: number, y: number): [number, number] => [y, COARSE - 1 - x],
];
/** Share of coarse pixels that differ between a and b turned by `quarter` quarter turns. */
function twinDiff(a: Uint8ClampedArray, b: Uint8ClampedArray, quarter: number, limit: number): number {
  let k = 0;
  const max = limit * COARSE * COARSE;
  for (let y = 0; y < COARSE; y++)
    for (let x = 0; x < COARSE; x++) {
      const [u, v] = rotCoarse[quarter](x, y),
        pa = (y * COARSE + x) * 4,
        pb = (v * COARSE + u) * 4;
      for (let c = 0; c < 3; c++)
        if (Math.abs(a[pa + c] - b[pb + c]) > PIXEL_TOLERANCE) {
          k++;
          break;
        }
      if (k > max) return 1;
    }
  return k / (COARSE * COARSE);
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
  const measures = stickers.map((s) => measureRgba(s.data));
  const flatSet = new Set<string>(),
    symmetric2: string[] = [],
    symmetric4: string[] = [],
    byHash = new Map<string, string[]>();
  stickers.forEach((s, i) => {
    const m = measures[i];
    if (isFlat(m)) flatSet.add(s.id);
    const sym = symmetryOf(m);
    if (sym === 4) symmetric4.push(s.id);
    else if (sym === 2) symmetric2.push(s.id);
    byHash.set(m.hash, [...(byHash.get(m.hash) ?? []), s.id]);
  });
  const identicalGroups = [...byHash.values()].filter((g) => g.length > 1);
  const identicalOf = new Map<string, string>();
  identicalGroups.forEach((g) => g.forEach((id) => identicalOf.set(id, g[0])));
  // Rotation twins: one sticker is another turned by a quarter, half or three-quarter turn. Flat
  // stickers and exact copies are reported elsewhere, so only distinct, detailed stickers are paired.
  const candidates = stickers
    .map((s, i) => ({ id: s.id, hash: measures[i].hash, c: coarse(s.data, SAMPLE), flat: isFlat(measures[i]) }))
    .filter((t) => !t.flat);
  const parent = new Map<string, string>();
  const find = (a: string): string => (parent.get(a) === a || !parent.has(a) ? a : find(parent.get(a)!));
  const inTwin = new Set<string>();
  for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i],
        b = candidates[j];
      if (a.hash === b.hash) continue;
      for (let q = 1; q < 4; q++)
        if (twinDiff(a.c, b.c, q, MIN_ROT_DIFF) < MIN_ROT_DIFF) {
          inTwin.add(a.id).add(b.id);
          for (const id of [a.id, b.id]) if (!parent.has(id)) parent.set(id, id);
          parent.set(find(a.id), find(b.id));
          break;
        }
    }
  const groups = new Map<string, string[]>();
  for (const id of inTwin) groups.set(find(id), [...(groups.get(find(id)) ?? []), id]);
  const order = new Map(stickers.map((s, i) => [s.id, i] as const));
  const bySticker = (a: string, b: string) => order.get(a)! - order.get(b)!;
  const twinGroups = [...groups.values()].map((g) => g.sort(bySticker));
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
