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

/**
 * Planar UV of the exterior faces for the projected stickerless look: `u = ±position / extent + 0.5` along the face's image
 * right and up, so a linear texture window (`stickerWindow`) lands exactly where the image belongs. Three's arc-length UV is
 * not linear in position, which shifted the image by up to 0.007 pitch against the seam. The bevel arcs project along the
 * face normal (no smear: they end at 0 and 1). `groups` are the face groups to map (the faces that carry the image); the
 * others and the geometry itself stay as they are. Keeps each face's orientation, read from its existing UV.
 */
export function planarBodyUv(base: THREE.BufferGeometry, extent: Vec3, groups: ReadonlySet<number>): THREE.BufferGeometry {
  const geometry = base.clone(), uv = geometry.getAttribute("uv"), pos = geometry.getAttribute("position");
  for (const group of geometry.groups) {
    if (!groups.has(group.materialIndex!)) continue;
    const inPlane = [0, 1, 2].filter(axis => axis !== Math.floor(group.materialIndex! / 2));
    const vertices = new Set<number>();
    for (let i = group.start; i < group.start + group.count; i++) vertices.add(geometry.index?.getX(i) ?? i);
    // Which in-plane axis (and sign) the existing UV follows: the sign of the correlation of UV and position.
    const follow = (component: "getX" | "getY"): [number, number] => {
      const sums = inPlane.map(() => 0);
      for (const vertex of vertices) inPlane.forEach((axis, k) => {
        sums[k] += (uv[component](vertex) - 0.5) * pos.getComponent(vertex, axis);
      });
      const k = Math.abs(sums[0]) > Math.abs(sums[1]) ? 0 : 1;
      return [inPlane[k], Math.sign(sums[k])];
    };
    const [uAxis, uSign] = follow("getX"), [vAxis, vSign] = follow("getY");
    for (const vertex of vertices)
      uv.setXY(vertex, uSign * pos.getComponent(vertex, uAxis) / extent[uAxis] + 0.5,
        vSign * pos.getComponent(vertex, vAxis) / extent[vAxis] + 0.5);
  }
  return geometry;
}
