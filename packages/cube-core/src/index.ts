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

/** Checked JS interop: implementation and ingress guards are ReScript-owned. */
import * as Core from "../res/PwCore.res.mjs";
export const AXES = Core.axes;
export const IDENTITY = Core.identity;
export const demand: (condition: unknown, message: string) => asserts condition = Core.demand;
export const deepFreeze = Core.deepFreeze;
export const eq = Core.eq;
export const dot = Core.dot;
export const cross = Core.cross;
export const rotate = Core.rotate;
export const record = Core.record;
export const identifier = Core.identifier;
export const vec = Core.vec;
export const axis = Core.axis;
export const corner = Core.corner;
export const topology = Core.topology;
export const properRotation = Core.properRotation;
export const validatePrint = Core.validatePrint;
export const validateState = Core.validateState;
export const validateTarget = Core.validateTarget;
export const stateEquals = Core.stateEquals;
export const printEquals = Core.printEquals;
export const targetEquals = Core.targetEquals;
