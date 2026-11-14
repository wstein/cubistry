// SPDX-License-Identifier: AGPL-3.0-or-later
import { demand, type Vec3 } from "@cubistry/cube-core";
import { layerCenters, layerEdge, type LayerWidths } from "./layer-widths.ts";

/**
 * Pure UV rule of the "Projected" picture mode. Six beamers, one per face, each project that face's own image face-on
 * (orthographic) onto its own face. The image rectangle is the full face extent (no margin: the image reaches the face
 * edge, g = 0), so every sticker or body face lies inside the image. Only the gaps, bevels and seams cut it away, and the
 * outline of a sticker comes from its own geometry. A sticker's UV window is a linear map of its own 0..1 sticker UV into
 * the face image.
 */
export type FaceKey = "U" | "R" | "F" | "D" | "L" | "B";
export const FACE_KEYS: readonly FaceKey[] = ["U", "R", "F", "D", "L", "B"];
/** Face frames of the cube model: `up` is the direction of the image's top, the image's right is `up x normal`. */
export const PROJECTED_FACES: Readonly<Record<FaceKey, { readonly normal: Vec3; readonly up: Vec3 }>> = Object.freeze({
  R: { normal: [1, 0, 0], up: [0, 1, 0] },
  L: { normal: [-1, 0, 0], up: [0, 1, 0] },
  U: { normal: [0, 1, 0], up: [0, 0, -1] },
  D: { normal: [0, -1, 0], up: [0, 0, 1] },
  F: { normal: [0, 0, 1], up: [0, 1, 0] },
  B: { normal: [0, 0, -1], up: [0, 1, 0] },
});
/** A sticker is this share of its cell (PRESENTATION_PRESET.stickerWidth over the pitch 1). */
export const STICKER_SHARE = 0.87;

export function faceOfNormal(normal: Vec3): FaceKey {
  const key = FACE_KEYS.find((k) => PROJECTED_FACES[k].normal.every((c, i) => c === normal[i]));
  demand(key !== undefined, "Unknown face normal");
  return key!;
}

/** Side of the projected image in scene units: the whole face extent. */
export const imageExtent = (widths: LayerWidths): number => layerEdge(widths);

/**
 * The map of one sticker (or body face) into its face texture, texture origin bottom-left (`v` up) as the shared asset
 * loader delivers: `tu = offsetU + scaleU * u`, `tv = offsetV + scaleV * v` for the surface UV `u` (right) and `v` (up) in 0..1.
 * `col` counts from the image's left, `row` from its top.
 */
export interface StickerWindow {
  readonly col: number;
  readonly row: number;
  readonly scaleU: number;
  readonly offsetU: number;
  readonly scaleV: number;
  readonly offsetV: number;
}

/**
 * Window of the sticker of `face` on the cubie with the world layer indices `layerIndex` (0..n-1 per axis, increasing with
 * the world coordinate). `share` is the part of the cell the surface covers (the sticker 0.87, a body face 0.99); `size` (right x up,
 * scene units) replaces it where the surface is not that share of the cell (a sticker narrowed by a larger bevel radius).
 */
export function stickerWindow(widths: LayerWidths, share: number, face: FaceKey, layerIndex: Vec3, size?: readonly [number, number]): StickerWindow {
  const frame = PROJECTED_FACES[face];
  demand(frame !== undefined, "Unknown face");
  demand(share > 0, "Invalid projection geometry");
  const n = widths.length;
  demand(layerIndex.length === 3 && layerIndex.every((i) => Number.isInteger(i) && i >= 0 && i < n), "Layer index outside the cube");
  const centers = layerCenters(widths), img = imageExtent(widths);
  const right: Vec3 = [
    frame.up[1] * frame.normal[2] - frame.up[2] * frame.normal[1],
    frame.up[2] * frame.normal[0] - frame.up[0] * frame.normal[2],
    frame.up[0] * frame.normal[1] - frame.up[1] * frame.normal[0],
  ];
  const along = (dir: Vec3) => {
    const axis = dir.findIndex((c) => c !== 0), sign = dir[axis];
    return { index: layerIndex[axis], sign, size: widths[layerIndex[axis]], center: sign * centers[layerIndex[axis]] };
  };
  const r = along(right), u = along(frame.up);
  const sizeU = size ? size[0] : share * r.size, sizeV = size ? size[1] : share * u.size;
  return {
    col: r.sign > 0 ? r.index : n - 1 - r.index,
    row: u.sign > 0 ? n - 1 - u.index : u.index,
    scaleU: sizeU / img,
    offsetU: (r.center - sizeU / 2) / img + 0.5,
    scaleV: sizeV / img,
    offsetV: (u.center - sizeV / 2) / img + 0.5,
  };
}

/** Texture coordinates (origin bottom-left) of the surface point `u`, `v` in a sticker window. */
export const windowUv = (win: StickerWindow, u: number, v: number): [number, number] => [win.offsetU + win.scaleU * u, win.offsetV + win.scaleV * v];
