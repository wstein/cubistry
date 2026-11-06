// Shared fixtures for the cube-appearance tests: seeded randomness, synthetic tiles that are built with
// an independent rotation formula (so the package's own rotation is checked, not trusted), prints, and a
// tiny JSON Schema subset checker (the repository carries no JSON Schema library).
import { validatePrint } from "../../packages/cube-core/src/index.ts";

export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Counterclockwise quarter turn of a pixel coordinate: the top-left pixel (0,0) goes to the bottom-left (n-1,0). */
export const turnPixel = ([r, c], n) => [n - 1 - c, r];
export function turnSet(set, n, k) {
  let s = set;
  for (let i = 0; i < k; i++) s = s.map((p) => turnPixel(p, n));
  return s;
}

export const SIDE = 20;
const key = ([r, c]) => `${r},${c}`;
/** RGBA tile with the given dark pixels on white. */
export function tileOf(id, dark, side = SIDE) {
  const data = new Uint8Array(side * side * 4).fill(255);
  for (const [r, c] of dark) {
    const o = (r * side + c) * 4;
    data[o] = data[o + 1] = data[o + 2] = 0;
  }
  return { id, side, data };
}
export function flip(tile, pixels) {
  const data = Uint8Array.from(tile.data);
  for (const [r, c] of pixels) {
    const o = (r * tile.side + c) * 4;
    const v = data[o] === 255 ? 0 : 255;
    data[o] = data[o + 1] = data[o + 2] = v;
  }
  return { ...tile, data };
}
const darkOf = (tile) => {
  const out = [];
  for (let r = 0; r < tile.side; r++)
    for (let c = 0; c < tile.side; c++) if (tile.data[(r * tile.side + c) * 4] === 0) out.push([r, c]);
  return out;
};
export const turnTile = (id, tile, k) => tileOf(id, turnSet(darkOf(tile), tile.side, k), tile.side);

/** An asymmetric glyph (an "L" with a foot and a dot) with no rotational symmetry. */
export const ASYM = [
  ...Array.from({ length: 12 }, (_, i) => [3 + i, 4]),
  ...Array.from({ length: 6 }, (_, i) => [14, 5 + i]),
  [4, 9],
  [4, 10],
  [5, 9],
  [5, 10],
];
/** Closure of a seed shape under the first `k` quarter-turn symmetries: k = 2 gives 2-fold, 4 gives 4-fold. */
export function symmetrize(seed, order, n = SIDE) {
  const out = new Map();
  for (let t = 0; t < 4; t += 4 / order) for (const p of turnSet(seed, n, t)) out.set(key(p), p);
  return [...out.values()];
}
export const SYM1 = ASYM;
export const SYM2 = symmetrize(ASYM, 2);
export const SYM4 = symmetrize(ASYM, 4);

/** Pixels that are 0..k-1 of a fixed spread of positions away from the shapes above (clear background). */
export const spare = (k, from = 0) =>
  Array.from({ length: k }, (_, i) => [1 + ((from + i) % 2), 1 + Math.floor((from + i) / 2) * 3]);

// ---- prints ----

const NORMALS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const upFor = (n) => (n[1] !== 0 ? [0, 0, -n[1]] : [0, 1, 0]);

/**
 * A cube print of any size on the doubled-integer grid (surface cubies only). `asset(cubie, normal, index)`
 * names the sticker's asset; `turns(assetId)` gives its equivalentQuarterTurns. Size 2 is validated by the
 * real validator; other sizes are returned as plain data (the validator only supports size 2 so far).
 */
export function cubePrint(size, asset, turns = () => [0], id = "appearance-test") {
  const coords = Array.from({ length: size }, (_, i) => 2 * i - (size - 1));
  const edge = size - 1;
  const cubies = [],
    stickers = [];
  for (const x of coords)
    for (const y of coords)
      for (const z of coords) {
        if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) !== edge) continue;
        const cubie = cubies.length;
        cubies.push({ id: cubie, position: [x, y, z] });
        for (const n of NORMALS) {
          if ([x, y, z].reduce((s, v, i) => s + v * n[i], 0) !== edge) continue;
          const assetId = asset(cubie, n, stickers.length);
          stickers.push({
            id: stickers.length,
            cubie,
            normal: n,
            up: upFor(n),
            assetId,
            materialId: "sticker",
            equivalentQuarterTurns: turns(assetId),
          });
        }
      }
  const print = { schema: "cubistry.print", version: 1, id, topology: { kind: "cube", size }, cubies, stickers };
  return size === 2 ? validatePrint(print) : print;
}

// ---- JSON Schema subset ----

/** Validates a value against the schema subset used by schema/*.json; returns a list of problems. */
export function schemaProblems(schema, value, path = "$", root = schema) {
  const out = [];
  const bad = (m) => out.push(`${path}: ${m}`);
  if (schema.$ref) return schemaProblems(root.$defs[schema.$ref.split("/").pop()], value, path, root);
  if ("const" in schema && value !== schema.const) bad(`expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) bad(`not in enum`);
  const t = Array.isArray(value) ? "array" : value === null ? "null" : Number.isInteger(value) ? "integer" : typeof value;
  if (schema.type) {
    const ok = [].concat(schema.type).some((s) => s === t || (s === "number" && t === "integer"));
    if (!ok) return [...out, `${path}: expected ${schema.type}, got ${t}`];
  }
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) bad(`pattern ${schema.pattern}`);
    if (schema.minLength && value.length < schema.minLength) bad("too short");
    if (schema.maxLength && value.length > schema.maxLength) bad("too long");
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) bad("below minimum");
    if (schema.maximum !== undefined && value > schema.maximum) bad("above maximum");
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) bad("too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) bad("too many items");
    if (schema.items) value.forEach((v, i) => out.push(...schemaProblems(schema.items, v, `${path}[${i}]`, root)));
  }
  if (t === "object") {
    for (const k of schema.required ?? []) if (!(k in value)) bad(`missing ${k}`);
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) out.push(...schemaProblems(props[k], v, `${path}.${k}`, root));
      else {
        const pat = Object.entries(schema.patternProperties ?? {}).find(([p]) => new RegExp(p).test(k));
        if (pat) out.push(...schemaProblems(pat[1], v, `${path}.${k}`, root));
        else if (schema.additionalProperties === false) bad(`unexpected ${k}`);
      }
    }
  }
  return out;
}
