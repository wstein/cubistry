import { sha256Bytes } from "./sha256.ts";

/**
 * One rendered sticker as seen from outside the cube, upright: a `side` x `side` RGBA bitmap, row-major,
 * four bytes per pixel. The caller renders it (this package never touches the DOM) and uses the
 * sticker's asset id as `id`.
 */
export interface Tile {
  readonly id: string;
  readonly side: number;
  readonly data: ArrayLike<number>;
}

/** Rotational symmetry order: how many of the four quarter turns look identical. 1 none, 2 half turn, 4 quarter turn. */
export type SymmetryOrder = 1 | 2 | 4;
/** Quarter-turn index, counterclockwise as seen from outside the cube. */
export type Turn = 0 | 1 | 2 | 3;

/**
 * Pixel thresholds. Two pixels differ when their largest channel difference exceeds `pixelTolerance`
 * (0..255); two tiles are "within tolerance" when at most `share` of their pixels differ. `share` 0 with
 * `pixelTolerance` 0 means exact pixel equality (use it for vector themes).
 */
export interface Thresholds {
  readonly pixelTolerance: number;
  readonly share: number;
}

/** Opaque RGB view of a tile (alpha composited over white), the form all comparisons use. */
export interface Rgb {
  readonly side: number;
  readonly rgb: Uint8Array;
}

/** Integer-only compositing over white, so every JavaScript engine yields identical bytes. */
export function toRgb(tile: Tile): Rgb {
  const { side, data } = tile;
  if (!Number.isInteger(side) || side < 1) throw new Error(`Tile ${tile.id}: invalid side`);
  if (data.length !== side * side * 4) throw new Error(`Tile ${tile.id}: expected ${side * side * 4} RGBA bytes`);
  const rgb = new Uint8Array(side * side * 3);
  for (let i = 0, j = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    for (let c = 0; c < 3; c++) rgb[j++] = Math.floor((data[i + c] * a + 255 * (255 - a) + 127) / 255);
  }
  return { side, rgb };
}

/** Counterclockwise quarter turns as seen by a viewer of the tile: the top-left pixel moves to the bottom-left. */
export function rotateRgb(t: Rgb, turns: number): Rgb {
  const k = ((turns % 4) + 4) % 4;
  if (k === 0) return t;
  const n = t.side;
  const out = new Uint8Array(t.rgb.length);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      // rotation by one quarter: new[r][c] = old[c][n - 1 - r]
      let sr = r,
        sc = c;
      for (let s = 0; s < k; s++) [sr, sc] = [sc, n - 1 - sr];
      for (let ch = 0; ch < 3; ch++) out[(r * n + c) * 3 + ch] = t.rgb[(sr * n + sc) * 3 + ch];
    }
  return { side: n, rgb: out };
}

/** Share of pixels (0..1) whose largest channel difference exceeds `tolerance`. */
export function differingShare(a: Rgb, b: Rgb, tolerance: number): number {
  if (a.side !== b.side) throw new Error("Tiles must have the same side");
  let k = 0;
  const px = a.side * a.side;
  for (let i = 0; i < px; i++) {
    const o = i * 3;
    if (
      Math.abs(a.rgb[o] - b.rgb[o]) > tolerance ||
      Math.abs(a.rgb[o + 1] - b.rgb[o + 1]) > tolerance ||
      Math.abs(a.rgb[o + 2] - b.rgb[o + 2]) > tolerance
    )
      k++;
  }
  return k / px;
}

/** Hash of the composited pixels: equal hashes mean visually identical stickers. */
export const tileHash = (t: Rgb): string => {
  const head = new TextEncoder().encode(`rgb:${t.side}:`);
  const bytes = new Uint8Array(head.length + t.rgb.length);
  bytes.set(head);
  bytes.set(t.rgb, head.length);
  return sha256Bytes(bytes);
};

/** Share of pixels that are not the tile's dominant (4-bit quantized) color; low means mostly flat. */
export function detailOf(t: Rgb): number {
  const hist = new Map<number, number>();
  for (let i = 0; i < t.rgb.length; i += 3) {
    const key = ((t.rgb[i] >> 4) << 8) | ((t.rgb[i + 1] >> 4) << 4) | (t.rgb[i + 2] >> 4);
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  return 1 - Math.max(...hist.values()) / (t.side * t.side);
}

/** Whether `share` is within the threshold. The tiny epsilon only absorbs division rounding. */
export const within = (share: number, th: Thresholds): boolean => share <= th.share + 1e-12;
