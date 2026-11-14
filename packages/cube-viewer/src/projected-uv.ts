// SPDX-License-Identifier: AGPL-3.0-or-later
import { demand, type Vec3 } from "@cubistry/cube-core";
import { layerCenters, layerEdge, validateLayerWidths, type LayerWidths } from "./layer-widths.ts";

/**
 * Pure UV rule of the "Projected" picture mode. Six beamers, one per face, each project that face's own image face-on
 * (orthographic) onto its own face. Only the stickers carry the image; bodies, bevels and the gaps between stickers stay
 * plastic, so the image runs across the sticker area and the gaps cut it away.
 *
 * The image covers the face extent minus one gap width g on every side. g is derived from the real sticker geometry: a
 * sticker is `share` (0.87) of its cell, so two neighbors of the cells i and i + 1 are (1 - share) (w_i + w_i+1) / 2 apart,
 * and g is the mean of these n - 1 gaps (0.13 pitch for uniform widths, where the image side is n - 2 g). A sticker's UV
 * window is a linear map of its own 0..1 sticker UV into the face image; outside 0..1 the surface shows plastic.
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

/** Mean gap between neighboring stickers along an axis; defined for n >= 2 layers. */
export function gapWidth(widths: LayerWidths, share: number): number {
  validateLayerWidths(widths);
  demand(widths.length >= 2 && share > 0 && share < 1, "Invalid projection geometry");
  let sum = 0;
  for (let i = 0; i + 1 < widths.length; i++) sum += ((1 - share) * (widths[i] + widths[i + 1])) / 2;
  return sum / (widths.length - 1);
}

/** Side of the projected image in scene units: the face extent minus one gap width on each side. */
export const imageExtent = (widths: LayerWidths, share: number): number => layerEdge(widths) - 2 * gapWidth(widths, share);

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
 * the world coordinate). `share` is the part of the cell the surface covers (the sticker 0.87, a body face 0.99); the gap
 * and the image always come from the sticker share given by `gapShare` (default `share` for the stickers).
 */
export function stickerWindow(widths: LayerWidths, share: number, face: FaceKey, layerIndex: Vec3, gapShare: number = STICKER_SHARE): StickerWindow {
  const frame = PROJECTED_FACES[face];
  demand(frame !== undefined, "Unknown face");
  demand(share > 0, "Invalid projection geometry");
  const n = widths.length;
  demand(layerIndex.length === 3 && layerIndex.every((i) => Number.isInteger(i) && i >= 0 && i < n), "Layer index outside the cube");
  const centers = layerCenters(widths), img = imageExtent(widths, gapShare);
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
  const sizeU = share * r.size, sizeV = share * u.size;
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
