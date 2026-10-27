import type {Vec3,LegalMove,Face,PrintDefinition,CubeState} from "@cubistry/cube-core";
export {eq,dot,cross,rotate} from "@cubistry/cube-core";
import * as Mechanics from "../res/PwMechanics.res.mjs";
export interface MovePresentation {
  readonly from: CubeState;
  readonly to: CubeState;
  readonly move: LegalMove;
}
export interface LegacySticker {
  id: number;
  cubie: number;
  p: Vec3;
  n: Vec3;
  up: Vec3;
  image?: string;
  slot?: number;
}
export const FACE_LAYERS = Mechanics.faceLayers;
export const ROTATIONS = Mechanics.rotations;
export const POSITIONS = Mechanics.positions;
export const quarter = Mechanics.quarter;
export const parseMove = Mechanics.parseMove;
export const validateMove = Mechanics.validateMove;
export const parseAlg = Mechanics.parseAlg;
export const serializeMove = Mechanics.serializeMove;
export const inverseMoves = Mechanics.inverseMoves;
export const turnVector = Mechanics.turnVector;
export const initialState = Mechanics.initialState;
export const applyMove = Mechanics.applyMove;
export const applyMoves = Mechanics.applyMoves;
export const stickerPoses = Mechanics.stickerPoses;
export const matchesTarget = Mechanics.matchesTarget;
export const presentMove = Mechanics.presentMove;
export const validatePresentation = Mechanics.validatePresentation;
export const legacyMove = Mechanics.legacyMove;
export const MECHANICS_CAPABILITIES = Mechanics.capabilities;
