/** Cube geometry shared by the builder, the checker and the sketch tool (pure, no I/O).
 * Face naming and net layout follow the Pastel Garden set: U above F; L F R B in a row; D below F.
 * The deliverable of a theme is six whole faces; the cube size N (2..7) is chosen at runtime and the face is sliced
 * into N x N tiles of S / N px. Tile files exist only as on-demand previews.
 */
export const FACE_NAMES = ["U", "L", "F", "R", "B", "D"];
export const BELT = ["L", "F", "R", "B"];
export const NET_POS = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
export const MIN_N = 2;
export const MAX_N = 7;
/** Face size in px that every N = 2..7 divides evenly (lcm of 2..7 = 420), so tiles are whole pixels. */
export const DEFAULT_FACE_SIZE = 420;
export const tileSize = (S, n) => S / n;

/** Throws unless n is an integer in 2..5. */
export function assertSupportedN(n) {
  if (!Number.isInteger(n) || n < MIN_N || n > MAX_N) {
    throw new RangeError(`N must be an integer from ${MIN_N} to ${MAX_N}, got ${n}`);
  }
  return n;
}

export const stickerCount = (n) => 6 * n * n;
export const tileId = (face, r, c) => `${face}_${r}_${c}`;

/** All tile ids F_r_c (r, c in 0..N-1) for an N x N cube, in FACE_NAMES order. */
export function tileIds(n) {
  assertSupportedN(n);
  const ids = [];
  for (const f of FACE_NAMES) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) ids.push(tileId(f, r, c));
  return ids;
}

export const parseTileId = (id) => {
  const m = /^([ULFRBD])_(\d+)_(\d+)$/.exec(id);
  return m ? { face: m[1], r: Number(m[2]), c: Number(m[3]) } : null;
};

/** viewBox string of the tile at row r, column c of a face whose stickers are `tile` px. */
export const tileViewBox = (r, c, tile) => `${c * tile} ${r * tile} ${tile} ${tile}`;

/**
 * The 12 shared edges. Every side of every face appears exactly once.
 * `sideA`/`sideB` name the face side; strips are read in canonical order
 * (top/bottom: x = 0..S-1; left/right: y = 0..S-1). When `rev` is true, strip B is read backwards.
 * Derived from the Pastel Garden seam check (L|F, F|R, R|B, B|L belt; U and D to the belt).
 */
export const EDGES = [
  { name: "L|F", a: ["L", "right"], b: ["F", "left"], rev: false },
  { name: "F|R", a: ["F", "right"], b: ["R", "left"], rev: false },
  { name: "R|B", a: ["R", "right"], b: ["B", "left"], rev: false },
  { name: "B|L", a: ["B", "right"], b: ["L", "left"], rev: false },
  { name: "U|F", a: ["U", "bottom"], b: ["F", "top"], rev: false },
  { name: "U|L", a: ["U", "left"], b: ["L", "top"], rev: false },
  { name: "U|R", a: ["U", "right"], b: ["R", "top"], rev: true },
  { name: "U|B", a: ["U", "top"], b: ["B", "top"], rev: true },
  { name: "D|F", a: ["D", "top"], b: ["F", "bottom"], rev: false },
  { name: "D|L", a: ["D", "left"], b: ["L", "bottom"], rev: true },
  { name: "D|R", a: ["D", "right"], b: ["R", "bottom"], rev: false },
  { name: "D|B", a: ["D", "bottom"], b: ["B", "bottom"], rev: true },
];

/** Pixel [x, y] of position i (0..S-1) along a face side. */
export function sidePoint(side, i, S) {
  switch (side) {
    case "top": return [i, 0];
    case "bottom": return [i, S - 1];
    case "left": return [0, i];
    case "right": return [S - 1, i];
    default: throw new Error(`unknown side ${side}`);
  }
}

/** For edge position i (0..S-1) the matching pixels [[x, y] on A, [x, y] on B]. */
export function edgePixelPair(edge, i, S) {
  const j = edge.rev ? S - 1 - i : i;
  return [sidePoint(edge.a[1], i, S), sidePoint(edge.b[1], j, S)];
}

/** Splits S positions along an edge into n equal sticker segments, returns [start, end) pairs. */
export function edgeSegments(S, n) {
  const w = S / n;
  return Array.from({ length: n }, (_, k) => [Math.round(k * w), Math.round((k + 1) * w)]);
}

/** Cube sizes to examine: --n 3 gives [3]; --n-range 2-7 (or "2..5") gives that range; default 2..7. */
export function parseNSpec(n, range) {
  if (n != null) return [assertSupportedN(Number(n))];
  if (range == null) return Array.from({ length: MAX_N - MIN_N + 1 }, (_, i) => MIN_N + i);
  const m = /^(\d+)(?:-|\.\.)(\d+)$/.exec(String(range));
  if (!m) throw new Error(`bad --n-range "${range}", expected e.g. 2-7`);
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a > b) throw new Error(`bad --n-range "${range}": start is above end`);
  assertSupportedN(a); assertSupportedN(b);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
