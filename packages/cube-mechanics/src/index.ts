import {
  AXES,
  IDENTITY,
  deepFreeze,
  demand,
  eq,
  dot,
  cross,
  rotate,
  validateState,
  stateEquals,
  type Vec3,
  type Rotation,
  type LegalMove,
  type Face,
  type PrintDefinition,
  type CubeState,
  type StickerPose,
  type DisplayTarget,
} from "@cubistry/cube-core";
export { eq, dot, cross, rotate };
export const FACE_LAYERS: Readonly<
  Record<Face, readonly [0 | 1 | 2, -1 | 1, -1 | 1]>
> = {
  R: [0, 1, -1],
  L: [0, -1, 1],
  U: [1, 1, -1],
  D: [1, -1, 1],
  F: [2, 1, -1],
  B: [2, -1, 1],
};
export const ROTATIONS: readonly Rotation[] = AXES.flatMap((x) =>
  AXES.filter((y) => dot(x, y) === 0).map(
    (y) => [x, y, cross(x, y)] as Rotation,
  ),
);
export const POSITIONS: readonly Vec3[] = [-1, 1].flatMap((x) =>
  [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as Vec3)),
);
export function quarter(v: Vec3, axis: 0 | 1 | 2): Vec3 {
  const u = AXES[axis * 2];
  return cross(u, v).map(
    (x, i) => x + u[i] * dot(u, v) || 0,
  ) as unknown as Vec3;
}
export function parseMove(text: unknown): LegalMove {
  demand(typeof text === "string", "Move must be a string");
  const m = /^([RLUDFB])(2|')?$/.exec(text);
  demand(m, "Unsupported move notation");
  return deepFreeze({
    face: m[1] as Face,
    turns: m[2] === "2" ? 2 : m[2] === "'" ? -1 : 1,
  });
}
export function validateMove(raw: unknown): LegalMove {
  demand(raw !== null && typeof raw === "object", "Invalid move");
  const m = raw as LegalMove;
  demand(
    Object.hasOwn(FACE_LAYERS, m.face) && [1, 2, -1].includes(m.turns),
    "Unsupported legal move",
  );
  return deepFreeze({ face: m.face, turns: m.turns });
}
export function parseAlg(text: unknown): readonly LegalMove[] {
  demand(
    typeof text === "string" && text.length <= 4096,
    "Invalid or excessive algorithm",
  );
  return deepFreeze(text.trim() ? text.trim().split(/\s+/).map(parseMove) : []);
}
export function serializeMove(m: LegalMove): string {
  validateMove(m);
  return m.face + (m.turns === 2 ? "2" : m.turns === -1 ? "'" : "");
}
export function inverseMoves(
  moves: readonly LegalMove[],
): readonly LegalMove[] {
  return deepFreeze(
    [...moves]
      .reverse()
      .map(
        (m) =>
          ({ face: m.face, turns: m.turns === 2 ? 2 : -m.turns }) as LegalMove,
      ),
  );
}
export function turnVector(v: Vec3, move: LegalMove): Vec3 {
  const [axis, , direction] = FACE_LAYERS[move.face];
  let out = v;
  for (let n = 0; n < (move.turns * direction + 4) % 4; n++)
    out = quarter(out, axis);
  return out;
}
export function initialState(print: PrintDefinition): CubeState {
  return validateState(
    {
      schema: "cubistry.state",
      version: 1,
      printId: print.id,
      topology: print.topology,
      cubies: print.cubies.map((c) => ({
        id: c.id,
        position: c.position,
        orientation: IDENTITY,
      })),
    },
    print,
  );
}
export function applyMove(state: CubeState, raw: LegalMove): CubeState {
  const move = validateMove(raw),
    [axis, layer] = FACE_LAYERS[move.face];
  demand(state.topology.size === 2, "Only size 2 mechanics are implemented");
  return deepFreeze({
    ...state,
    cubies: state.cubies.map((c) =>
      c.position[axis] !== layer
        ? c
        : {
            ...c,
            position: turnVector(c.position, move),
            orientation: c.orientation.map((v) =>
              turnVector(v, move),
            ) as unknown as Rotation,
          },
    ),
  });
}
export function applyMoves(
  state: CubeState,
  moves: readonly LegalMove[],
): CubeState {
  return moves.reduce(applyMove, state);
}
export function stickerPoses(
  print: PrintDefinition,
  state: CubeState,
): readonly StickerPose[] {
  demand(state.printId === print.id, "State/print mismatch");
  return deepFreeze(
    print.stickers.map((s) => {
      const c = state.cubies.find((c) => c.id === s.cubie)!;
      return {
        id: s.id,
        cubie: s.cubie,
        p: c.position,
        n: rotate(s.normal, c.orientation),
        up: rotate(s.up, c.orientation),
        assetId: s.assetId,
        materialId: s.materialId,
      };
    }),
  );
}
export function matchesTarget(
  print: PrintDefinition,
  state: CubeState,
  target: DisplayTarget,
): boolean {
  const poses = stickerPoses(print, state);
  return target.facelets.every((f) =>
    poses.some((s) => {
      if (!eq(s.p, f.position) || !eq(s.n, f.normal) || s.assetId !== f.assetId)
        return false;
      if (f.matching !== "equivalent") return eq(s.up, f.up);
      const source = print.stickers.find((v) => v.id === s.id)!;
      return source.equivalentQuarterTurns.some((q) => {
        let up = s.up;
        for (let i = 0; i < q; i++) up = cross(s.n, up);
        return eq(up, f.up);
      });
    }),
  );
}
export interface MovePresentation {
  readonly from: CubeState;
  readonly to: CubeState;
  readonly move: LegalMove;
}
export function presentMove(
  state: CubeState,
  move: LegalMove,
): MovePresentation {
  return deepFreeze({ from: state, to: applyMove(state, move), move });
}
export function validatePresentation(
  p: MovePresentation,
  print: PrintDefinition,
): MovePresentation {
  const from = validateState(p.from, print),
    to = validateState(p.to, print),
    move = validateMove(p.move);
  demand(
    stateEquals(applyMove(from, move), to),
    "Move presentation is not a legal state transition",
  );
  return deepFreeze({ from, to, move });
}
/** Explicit legacy facelet adapter: the same turnVector implements both paths. */
export interface LegacySticker {
  id: number;
  cubie: number;
  p: Vec3;
  n: Vec3;
  up: Vec3;
  image?: string;
  slot?: number;
}
export function legacyMove<T extends LegacySticker>(
  state: readonly T[],
  notation: string,
): T[] {
  const move = parseMove(notation),
    [axis, layer] = FACE_LAYERS[move.face];
  return state.map((s) =>
    s.p[axis] !== layer
      ? s
      : {
          ...s,
          p: turnVector(s.p, move),
          n: turnVector(s.n, move),
          up: turnVector(s.up, move),
        },
  );
}
export const MECHANICS_CAPABILITIES = deepFreeze({
  supportedSizes: [2],
  notation: "single-layer outer-face R L U D F B with prime/2",
  wideMoves: false,
  sliceMoves: false,
  wholeCubeMoveNotation: false,
  search: false,
});
