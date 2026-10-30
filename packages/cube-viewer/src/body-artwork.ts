import * as THREE from "three";
import { cross, dot, demand, type Vec3 } from "@cubistry/cube-core";

interface SourceFrame { readonly n: Vec3; readonly up: Vec3 }
// Three Box/RoundedBox face-group order and its native image-up vectors.
const normals: readonly Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const nativeUp: readonly Vec3[] = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
export const sourceFaceIndex = (normal: Vec3): number => {
  const axis = normal.findIndex(component => component !== 0);
  demand(axis >= 0, "Missing source face normal");
  return axis * 2 + (normal[axis] < 0 ? 1 : 0);
};
function frameTransforms(frames: readonly SourceFrame[]) {
  const transforms = Array.from({ length: 6 }, () => [1, 0, 0, 1]);
  for (const frame of frames) {
    const index = sourceFaceIndex(frame.n);
    const right = cross(frame.up, frame.n), baseRight = cross(nativeUp[index], normals[index]);
    transforms[index] = [dot(baseRight, right), dot(nativeUp[index], right),
      dot(baseRight, frame.up), dot(nativeUp[index], frame.up)];
  }
  return transforms;
}
export const bodyArtworkKey = (frames: readonly SourceFrame[]): string => frameTransforms(frames).flat().join(",");

/** Retain Three's full 0..1 arc-length parameterization around each bevel,
 * rotating its intrinsic image basis into immutable physical source right/up.
 * No crop, pixel editing, world-axis recoloring or animation-time rebuilding. */
export function orientBodyArtwork(base: THREE.BufferGeometry, frames: readonly SourceFrame[]): THREE.BufferGeometry {
  const transforms = frameTransforms(frames);
  if (transforms.every(t => t[0] === 1 && t[1] === 0 && t[2] === 0 && t[3] === 1)) return base;
  const geometry = base.clone(), uv = geometry.getAttribute("uv"), source = base.getAttribute("uv");
  for (const group of geometry.groups) {
    const [a, b, c, d] = transforms[group.materialIndex!];
    for (let i = group.start; i < group.start + group.count; i++) {
      const vertex = geometry.index?.getX(i) ?? i;
      const u = source.getX(vertex) - 0.5, v = source.getY(vertex) - 0.5;
      uv.setXY(vertex, a * u + b * v + 0.5, c * u + d * v + 0.5);
    }
  }
  return geometry;
}
