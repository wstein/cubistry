import {
  cross,
  dot,
  deepFreeze,
  stateEquals,
  validatePrint,
  type CubeState,
  type Vec3,
  type LegalMove,
} from "@cubistry/cube-core";
import {
  POSITIONS,
  initialState,
  applyMoves,
  parseAlg,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import type { AssetManifest } from "@cubistry/cube-assets";
import { pictureImages } from "./picture-assets.ts";
export type Style = "classic" | "picture";
const faces = [
  { face: "R", normal: [1, 0, 0], up: [0, 1, 0], color: "#e94538" },
  { face: "L", normal: [-1, 0, 0], up: [0, 1, 0], color: "#ff922e" },
  { face: "U", normal: [0, 1, 0], up: [0, 0, -1], color: "#f7f6e9" },
  { face: "D", normal: [0, -1, 0], up: [0, 0, 1], color: "#ffd635" },
  { face: "F", normal: [0, 0, 1], up: [0, 1, 0], color: "#24ab72" },
  { face: "B", normal: [0, 0, -1], up: [0, 1, 0], color: "#3384e5" },
] as const;
export const ALLOWED_MOVES: readonly LegalMove[] = deepFreeze(
  faces.flatMap(({ face }) =>
    ([1, -1, 2] as const).map((turns) => ({ face, turns })),
  ),
);
export const CAPABILITY = deepFreeze({
  size: 2,
  moves: ALLOWED_MOVES,
  metric: "HTM",
  goal: "exactPhysical",
  size3:
    "Unsupported: this playground uses the shared size-2 mechanics and viewer profile.",
});
export function createDesign(style: Style) {
  if (!["classic", "picture"].includes(style))
    throw Error("Unsupported playground design");
  const print = validatePrint({
    schema: "cubistry.print",
    version: 1,
    id: `playground_${style}_v1`,
    topology: { kind: "cube", size: 2 },
    cubies: POSITIONS.map((position, id) => ({ id, position })),
    stickers: faces.flatMap(({ face, normal, up }, f) => {
      const right = cross(up, normal);
      return POSITIONS.map((position, cubie) => ({ position, cubie }))
        .filter((c) => dot(c.position, normal) === 1)
        .map(({ position, cubie }) => {
          const col = dot(position, right) > 0 ? 1 : 0,
            row = dot(position, up) > 0 ? 0 : 1;
          return {
            id: f * 4 + row * 2 + col,
            cubie,
            normal,
            up,
            assetId: style === "classic" ? face : `${face}_${row}_${col}`,
            materialId: "sticker",
            equivalentQuarterTurns: style === "classic" ? [0, 1, 2, 3] : [0],
          };
        });
    }),
  });
  const assets: AssetManifest = deepFreeze({
    schema: "cubistry.assets",
    version: 1,
    fonts: [],
    documents: [],
    materials: [
      { id: "plastic", color: "#1b2431", roughness: 0.45 },
      { id: "sticker", color: "#ffffff", roughness: 0.65 },
    ],
    images:
      style === "classic"
        ? faces.map(({ face, color }) => ({
            id: face,
            kind: "color" as const,
            color,
          }))
        : pictureImages,
  });
  const target = initialState(print);
  // Whole-cube frames are constructed using legal opposite face turns. They
  // classify a pose only; neither camera input nor Solve normalizes the state.
  const equivalents: CubeState[] = [],
    queue: CubeState[] = [target];
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i];
    if (equivalents.some((s) => stateEquals(s, state))) continue;
    equivalents.push(state);
    for (const word of ["R L'", "U D'", "F B'"])
      queue.push(applyMoves(state, parseAlg(word)));
  }
  if (equivalents.length !== 24) throw Error("Invalid complete frame catalog");
  return deepFreeze({ style, print, assets, target, equivalents });
}
export type PlaygroundDesign = ReturnType<typeof createDesign>;
export function classify(design: PlaygroundDesign, state: CubeState) {
  return {
    exact: stateEquals(state, design.target),
    rotationEquivalent: design.equivalents.some((s) => stateEquals(state, s)),
  };
}
export function fullGoal(design: PlaygroundDesign, state: CubeState) {
  if (!stateEquals(state, design.target)) return false;
  const poses = stickerPoses(design.print, state),
    goal = stickerPoses(design.print, design.target);
  return (
    poses.length === 24 &&
    goal.every((g) => {
      const s = poses.find((s) => s.id === g.id);
      return (
        s &&
        s.cubie === g.cubie &&
        s.assetId === g.assetId &&
        ["p", "n", "up"].every((k) =>
          (s[k as "p"] as Vec3).every((v, i) => v === g[k as "p"][i]),
        )
      );
    })
  );
}
/** Recorded legal words, not uniform random states. The additive PRNG accepts seed 0. */
export function scramble(seed: number, count: number): readonly LegalMove[] {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100
  )
    throw Error("Use a seed from 0 to 4294967295 and 1–100 moves.");
  let value = seed >>> 0;
  const next = () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result: LegalMove[] = [];
  for (let i = 0; i < count; i++) {
    const choices = faces.filter((f) => f.face !== result.at(-1)?.face);
    result.push({
      face: choices[Math.floor(next() * choices.length)].face,
      turns: ([1, 2, -1] as const)[Math.floor(next() * 3)],
    });
  }
  return deepFreeze(result);
}
