/** DOM-free, versioned physical contracts. Runtime support is deliberately size 2. */
export type Vec3 = readonly [number, number, number];
export type Rotation = readonly [Vec3, Vec3, Vec3];
export type Face = "R" | "L" | "U" | "D" | "F" | "B";
export interface Topology {
  readonly kind: "cube";
  readonly size: number;
}
export interface LegalMove {
  readonly face: Face;
  readonly turns: 1 | 2 | -1;
}
export interface SourceCubie {
  readonly id: number;
  readonly position: Vec3;
}
export interface SourceSticker {
  readonly id: number;
  readonly cubie: number;
  readonly normal: Vec3;
  readonly up: Vec3;
  readonly assetId: string;
  readonly materialId: string;
  /** Optical equality only: never a replacement for the actual physical frame. */
  readonly equivalentQuarterTurns: readonly (0 | 1 | 2 | 3)[];
}
export interface PrintDefinition {
  readonly schema: "cubistry.print";
  readonly version: 1;
  readonly id: string;
  readonly topology: Topology;
  readonly cubies: readonly SourceCubie[];
  readonly stickers: readonly SourceSticker[];
}
export interface CubieState {
  readonly id: number;
  readonly position: Vec3;
  readonly orientation: Rotation;
}
export interface CubeState {
  readonly schema: "cubistry.state";
  readonly version: 1;
  readonly printId: string;
  readonly topology: Topology;
  readonly cubies: readonly CubieState[];
}
export interface StickerPose {
  readonly id: number;
  readonly cubie: number;
  readonly p: Vec3;
  readonly n: Vec3;
  readonly up: Vec3;
  readonly assetId: string;
  readonly materialId: string;
}
export interface TargetFacelet {
  readonly position: Vec3;
  readonly normal: Vec3;
  readonly assetId: string;
  readonly up: Vec3;
  readonly matching?: "exact" | "equivalent";
}
export interface DisplayTarget {
  readonly schema: "cubistry.target";
  readonly version: 1;
  readonly facelets: readonly TargetFacelet[];
}
export const AXES: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export const IDENTITY: Rotation = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
export function demand(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
export const eq = (a: Vec3, b: Vec3): boolean => a.every((x, i) => x === b[i]);
export const dot = (a: Vec3, b: Vec3): number =>
  a.reduce((s, x, i) => s + x * b[i], 0);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const rotate = (v: Vec3, r: Rotation): Vec3 =>
  [0, 1, 2].map(
    (i) => v.reduce((s, x, j) => s + x * r[j][i], 0) || 0,
  ) as unknown as Vec3;
export function record(value: unknown, name: string): Record<string, unknown> {
  demand(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `Invalid ${name}`,
  );
  return value as Record<string, unknown>;
}
export function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,96}$/.test(value);
}
export function vec(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}
export function axis(value: unknown): value is Vec3 {
  return vec(value) && AXES.some((v) => eq(v, value));
}
export function corner(value: unknown): value is Vec3 {
  return vec(value) && value.every((x) => x === -1 || x === 1);
}
export function topology(value: unknown): Topology {
  const t = record(value, "topology");
  demand(
    t.kind === "cube" && t.size === 2,
    "Unsupported topology: only cube size 2 is implemented",
  );
  return deepFreeze({ kind: "cube", size: 2 });
}
export function properRotation(value: unknown): value is Rotation {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(axis) &&
    eq(cross(value[0], value[1]), value[2]) &&
    dot(value[0], value[1]) === 0
  );
}
export function validatePrint(value: unknown): PrintDefinition {
  const p = record(value, "print");
  demand(
    p.schema === "cubistry.print" && p.version === 1,
    "Unsupported print schema/version",
  );
  topology(p.topology);
  demand(identifier(p.id), "Invalid print ID");
  demand(
    Array.isArray(p.cubies) && p.cubies.length === 8,
    "A 2x2 print needs eight cubies",
  );
  demand(
    Array.isArray(p.stickers) && p.stickers.length === 24,
    "A 2x2 print needs 24 stickers",
  );
  const positions = new Map<number, Vec3>();
  for (const raw of p.cubies) {
    const c = record(raw, "source cubie");
    demand(
      Number.isInteger(c.id) &&
        Number(c.id) >= 0 &&
        Number(c.id) < 8 &&
        !positions.has(Number(c.id)) &&
        corner(c.position),
      "Invalid source cubie",
    );
    positions.set(Number(c.id), c.position);
  }
  demand(
    new Set([...positions.values()].map((v) => JSON.stringify(v))).size === 8,
    "Source cubies must occupy distinct positions",
  );
  const ids = new Set<number>(),
    faces = new Set<string>();
  for (const raw of p.stickers) {
    const s = record(raw, "source sticker");
    demand(
      Number.isInteger(s.id) &&
        Number(s.id) >= 0 &&
        Number(s.id) < 24 &&
        !ids.has(Number(s.id)),
      "Invalid or duplicate sticker ID",
    );
    ids.add(Number(s.id));
    demand(
      Number.isInteger(s.cubie) && Number(s.cubie) >= 0 && Number(s.cubie) < 8,
      "Sticker cubie ID must be an integer",
    );
    const position = positions.get(s.cubie as number);
    demand(
      position &&
        axis(s.normal) &&
        axis(s.up) &&
        dot(s.normal, s.up) === 0 &&
        dot(position, s.normal) === 1,
      "Invalid source sticker frame",
    );
    demand(
      identifier(s.assetId) && identifier(s.materialId),
      "Invalid sticker asset/material reference",
    );
    demand(
      Array.isArray(s.equivalentQuarterTurns) &&
        s.equivalentQuarterTurns.length > 0 &&
        s.equivalentQuarterTurns.includes(0) &&
        new Set(s.equivalentQuarterTurns).size ===
          s.equivalentQuarterTurns.length &&
        s.equivalentQuarterTurns.every(
          (v) => Number.isInteger(v) && v >= 0 && v <= 3,
        ) &&
        ["0", "0,2", "0,1,2,3"].includes(
          [...s.equivalentQuarterTurns].sort().join(","),
        ),
      "Invalid optical symmetry",
    );
    faces.add(JSON.stringify([s.cubie, s.normal]));
  }
  demand(faces.size === 24, "Duplicate physical source face");
  return deepFreeze(structuredClone(p)) as unknown as PrintDefinition;
}
export function validateState(
  value: unknown,
  print: PrintDefinition,
): CubeState {
  const s = record(value, "state");
  demand(
    s.schema === "cubistry.state" && s.version === 1,
    "Unsupported state schema/version",
  );
  topology(s.topology);
  demand(
    s.printId === print.id,
    "State does not belong to this immutable print",
  );
  demand(
    Array.isArray(s.cubies) && s.cubies.length === 8,
    "State needs eight cubies",
  );
  const ids = new Set<number>(),
    positions = new Set<string>();
  for (const raw of s.cubies) {
    const c = record(raw, "cubie state");
    demand(
      Number.isInteger(c.id) &&
        Number(c.id) >= 0 &&
        Number(c.id) < 8 &&
        !ids.has(Number(c.id)) &&
        corner(c.position) &&
        properRotation(c.orientation),
      "Invalid physical cubie state",
    );
    ids.add(Number(c.id));
    positions.add(JSON.stringify(c.position));
    const source = print.cubies.find((v) => v.id === c.id)!;
    demand(
      eq(rotate(source.position, c.orientation), c.position),
      "Cubie orientation and position disagree",
    );
  }
  demand(positions.size === 8, "Two physical cubies cannot share a position");
  let twist = 0;
  for (const raw of s.cubies) {
    const c = raw as unknown as CubieState;
    const source = print.cubies.find((v) => v.id === c.id)!;
    const ud = rotate([0, source.position[1], 0], c.orientation);
    const [x, y, z] = c.position;
    const order: Vec3[] =
      x * y * z === 1
        ? [
            [0, y, 0],
            [x, 0, 0],
            [0, 0, z],
          ]
        : [
            [0, y, 0],
            [0, 0, z],
            [x, 0, 0],
          ];
    const index = order.findIndex((n) => eq(n, ud));
    demand(index >= 0, "Invalid corner twist frame");
    twist += index;
  }
  demand(twist % 3 === 0, "Unreachable size-2 corner twist sum");
  return deepFreeze({
    schema: "cubistry.state",
    version: 1,
    printId: print.id,
    topology: print.topology,
    cubies: (s.cubies as unknown as CubieState[])
      .map((c) => ({
        id: c.id,
        position: [...c.position] as unknown as Vec3,
        orientation: c.orientation.map((v) => [...v]) as unknown as Rotation,
      }))
      .sort((a, b) => a.id - b.id),
  });
}
export function validateTarget(value: unknown): DisplayTarget {
  const t = record(value, "target");
  demand(
    t.schema === "cubistry.target" &&
      t.version === 1 &&
      Array.isArray(t.facelets) &&
      t.facelets.length > 0 &&
      t.facelets.length <= 24,
    "Invalid target schema or facelet count",
  );
  for (const raw of t.facelets) {
    const f = record(raw, "target facelet");
    demand(
      corner(f.position) &&
        axis(f.normal) &&
        axis(f.up) &&
        dot(f.normal, f.up) === 0 &&
        dot(f.position, f.normal) === 1 &&
        identifier(f.assetId) &&
        (f.matching === undefined ||
          f.matching === "exact" ||
          f.matching === "equivalent"),
      "Invalid target facelet",
    );
  }
  demand(
    new Set(
      t.facelets.map((v) => {
        const f = record(v, "facelet");
        return JSON.stringify([f.position, f.normal]);
      }),
    ).size === t.facelets.length,
    "Duplicate target position",
  );
  return deepFreeze(structuredClone(t)) as unknown as DisplayTarget;
}

export function stateEquals(a: CubeState, b: CubeState): boolean {
  return (
    a.printId === b.printId &&
    a.topology.kind === b.topology.kind &&
    a.topology.size === b.topology.size &&
    a.cubies.length === b.cubies.length &&
    a.cubies.every((c) => {
      const other = b.cubies.find((v) => v.id === c.id);
      return (
        !!other &&
        eq(c.position, other.position) &&
        c.orientation.every((v, i) => eq(v, other.orientation[i]))
      );
    })
  );
}

export function printEquals(a:PrintDefinition,b:PrintDefinition):boolean {return a.id===b.id&&a.topology.kind===b.topology.kind&&a.topology.size===b.topology.size&&a.cubies.length===b.cubies.length&&a.stickers.length===b.stickers.length&&a.cubies.every(c=>{const d=b.cubies.find(v=>v.id===c.id);return !!d&&eq(c.position,d.position);})&&a.stickers.every(s=>{const t=b.stickers.find(v=>v.id===s.id);return !!t&&s.cubie===t.cubie&&eq(s.normal,t.normal)&&eq(s.up,t.up)&&s.assetId===t.assetId&&s.materialId===t.materialId&&[...s.equivalentQuarterTurns].sort().join(',')===[...t.equivalentQuarterTurns].sort().join(',');});}
export function targetEquals(a:DisplayTarget,b:DisplayTarget):boolean {return a.facelets.length===b.facelets.length&&a.facelets.every(s=>b.facelets.some(t=>eq(s.position,t.position)&&eq(s.normal,t.normal)&&eq(s.up,t.up)&&s.assetId===t.assetId&&(s.matching??'exact')===(t.matching??'exact')));}
