// SPDX-License-Identifier: AGPL-3.0-or-later
// Play mode, pure part 3: the gesture state machines (one finger or mouse, two fingers).
// Immutable values in, new values out. No DOM, no WebGL, no clock: the caller feeds pointer positions
// (screen px) and applies the returned commit once, on release.
import {
  DEAD_ZONE_PX, checkSize, hitCell, mapDrag, wideRangeFromOne,
  type Axis, type AxisScreen, type DragDecision, type Face, type Hit, type Vec2,
} from "./play-gesture-map.ts";
import { MAGNET_DEG, angleFromProgress, displayAngle, netQuarters, reduceQuarters } from "./play-gesture-turn.ts";

export type Phase = "pending" | "turning" | "invalid" | "released" | "cancelled";

/** The one move a gesture commits: layers from..to (inclusive, from the negative side) about axis. */
export interface Commit {
  readonly axis: Axis;
  readonly from: number;
  readonly to: number;
  /** Right-hand quarter turns about the positive axis: 1, 2 (half) or -1. Never 0. */
  readonly quarters: 1 | 2 | -1;
}
export interface Highlight { readonly face: Face; readonly cell: readonly [number, number, number] }
export interface Lock { readonly axis: Axis; readonly layer: number; readonly from: number; readonly to: number; readonly screenDir: Vec2 }

export interface GestureOptions {
  readonly n: number;
  readonly hit: Hit;
  /** Pointer-down position in screen px. */
  readonly point: Vec2;
  readonly axes: AxisScreen;
  /** Screen px of finger travel that equal a quarter turn. */
  readonly pxPerQuarter: number;
  readonly deadZonePx?: number;
  readonly magnetDeg?: number;
  /** Mouse Shift+drag: wide turn from the touched layer to the nearest outer layer. */
  readonly wide?: boolean;
}
export interface Gesture {
  readonly phase: Phase;
  readonly opts: GestureOptions;
  readonly pos: Vec2;
  readonly highlight: Highlight | null;
  readonly lock: Lock | null;
  /** Free angle in degrees, right-hand positive. */
  readonly rawDeg: number;
  /** Angle to show: the raw angle, or exactly a multiple of 90 inside the magnet window. */
  readonly displayDeg: number;
  /** Net quarter turns if released now (before reduction mod 4). */
  readonly netQuarters: number;
}
export interface Released<G> { readonly gesture: G; readonly commit: Commit | null }

function toCommit(lock: Lock | null, net: number): Commit | null {
  if (!lock) return null;
  const quarters = reduceQuarters(net);
  return quarters === 0 ? null : { axis: lock.axis, from: lock.from, to: lock.to, quarters: quarters as 1 | 2 | -1 };
}

export function beginGesture(opts: GestureOptions): Gesture {
  checkSize(opts.n);
  angleFromProgress(0, opts.pxPerQuarter); // validates pxPerQuarter
  const cell = hitCell(opts.hit, opts.n);
  return {
    phase: cell ? "pending" : "invalid", opts, pos: opts.point,
    highlight: cell ? { face: opts.hit.face, cell } : null,
    lock: null, rawDeg: 0, displayDeg: 0, netQuarters: 0,
  };
}

export function moveGesture(g: Gesture, pos: Vec2): Gesture {
  if (g.phase !== "pending" && g.phase !== "turning") return g;
  const o = g.opts, drag: Vec2 = [pos[0] - o.point[0], pos[1] - o.point[1]];
  let lock = g.lock, phase: Phase = g.phase;
  if (!lock) {
    const d: DragDecision | null = mapDrag(o.hit, o.n, drag, o.axes, o.deadZonePx ?? DEAD_ZONE_PX);
    if (!d) return { ...g, pos };
    const [from, to] = o.wide ? wideRangeFromOne(d.layer, o.n) : [d.layer, d.layer];
    lock = { axis: d.axis, layer: d.layer, from, to, screenDir: d.screenDir };
    phase = "turning";
  }
  const progress = drag[0] * lock.screenDir[0] + drag[1] * lock.screenDir[1];
  const rawDeg = angleFromProgress(progress, o.pxPerQuarter);
  return { ...g, phase, pos, lock, rawDeg, displayDeg: displayAngle(rawDeg, o.magnetDeg ?? MAGNET_DEG), netQuarters: netQuarters(rawDeg) };
}

export function releaseGesture(g: Gesture): Released<Gesture> {
  if (g.phase !== "pending" && g.phase !== "turning") return { gesture: g, commit: null };
  return { gesture: { ...g, phase: "released", highlight: null }, commit: g.phase === "turning" ? toCommit(g.lock, g.netQuarters) : null };
}

export function cancelGesture(g: Gesture): Gesture {
  return g.phase === "released" || g.phase === "cancelled" ? g : { ...g, phase: "cancelled", highlight: null };
}

// Two fingers: generalized wide turn.

export interface PairOptions {
  readonly n: number;
  readonly a: { readonly hit: Hit; readonly point: Vec2 };
  readonly b: { readonly hit: Hit; readonly point: Vec2 };
  readonly axes: AxisScreen;
  readonly pxPerQuarter: number;
  readonly deadZonePx?: number;
  readonly magnetDeg?: number;
}
export interface PairGesture {
  readonly phase: Phase;
  readonly opts: PairOptions;
  readonly a: Gesture;
  readonly b: Gesture;
  readonly highlights: readonly Highlight[];
  /** Same axis, layers min..max of both fingers, once both fingers decided. */
  readonly lock: Lock | null;
  readonly rawDeg: number;
  readonly displayDeg: number;
  readonly netQuarters: number;
}

export function beginPair(o: PairOptions): PairGesture {
  const common = { n: o.n, axes: o.axes, pxPerQuarter: o.pxPerQuarter, deadZonePx: o.deadZonePx, magnetDeg: o.magnetDeg };
  const a = beginGesture({ ...common, hit: o.a.hit, point: o.a.point });
  const b = beginGesture({ ...common, hit: o.b.hit, point: o.b.point });
  return derivePair({ phase: "pending", opts: o, a, b, highlights: [], lock: null, rawDeg: 0, displayDeg: 0, netQuarters: 0 });
}

function derivePair(p: PairGesture): PairGesture {
  if (p.phase === "invalid" || p.phase === "released" || p.phase === "cancelled") return p;
  const { a, b } = p;
  const highlights = [a.highlight, b.highlight].filter((h): h is Highlight => h !== null);
  if (a.phase === "invalid" || b.phase === "invalid") return { ...p, phase: "invalid", highlights: [] };
  if (!a.lock || !b.lock) return { ...p, phase: "pending", highlights };
  if (a.lock.axis !== b.lock.axis) return { ...p, phase: "invalid", highlights: [], lock: null };
  const from = Math.min(a.lock.layer, b.lock.layer), to = Math.max(a.lock.layer, b.lock.layer);
  const lock: Lock = { axis: a.lock.axis, layer: from, from, to, screenDir: a.lock.screenDir };
  const rawDeg = (a.rawDeg + b.rawDeg) / 2;
  return {
    ...p, phase: "turning", highlights, lock, rawDeg,
    displayDeg: displayAngle(rawDeg, p.opts.magnetDeg ?? MAGNET_DEG), netQuarters: netQuarters(rawDeg),
  };
}

export function movePair(p: PairGesture, posA: Vec2, posB: Vec2): PairGesture {
  if (p.phase !== "pending" && p.phase !== "turning") return p;
  return derivePair({ ...p, a: moveGesture(p.a, posA), b: moveGesture(p.b, posB) });
}

export function releasePair(p: PairGesture): Released<PairGesture> {
  if (p.phase !== "pending" && p.phase !== "turning") return { gesture: p, commit: null };
  return { gesture: { ...p, phase: "released", highlights: [] }, commit: p.phase === "turning" ? toCommit(p.lock, p.netQuarters) : null };
}

export function cancelPair(p: PairGesture): PairGesture {
  return p.phase === "released" || p.phase === "cancelled" ? p : { ...p, phase: "cancelled", highlights: [] };
}
