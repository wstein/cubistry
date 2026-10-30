import * as THREE from "three";
import { addPresentationLighting, PRESENTATION_PRESET } from "./presentation-preset.ts";

export const STUDIO_BACKGROUND =
  "radial-gradient(ellipse at 48% 28%, #fffdf7 0%, transparent 65%), " +
  "linear-gradient(180deg, #e9e0d2 0%, #f6f0e5 48%, #d8cabb 100%)";

/** One receiving surface and one shadow-casting key per viewport, never per cube.
 * Only the upper floor face renders, so below-floor orbits can inspect bottoms. */
export function createPresentationStudio(
  scene: THREE.Scene | THREE.Group,
  halfCubeExtent = 1,
  horizontalExtent = halfCubeExtent,
  host?: HTMLElement,
  presentationRadius = Math.SQRT2 * halfCubeExtent,
) {
  const lights = addPresentationLighting(scene, Math.max(halfCubeExtent, horizontalExtent, presentationRadius) * 1.7 + 1,
    PRESENTATION_PRESET.shadowSoftness * halfCubeExtent);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    // ShadowMaterial is transparent outside actual geometric occlusion. A
    // uniformly tinted plane would create a horizon against the CSS gradient.
    new THREE.ShadowMaterial({ color: "#302b26", opacity: PRESENTATION_PRESET.shadowOpacity,
      depthWrite: false, side: THREE.FrontSide }));
  floor.name = "studio-shadow-receiver";
  floor.rotation.x = -Math.PI / 2;
  // Keep the receiver below the entire rigid assembly, including local turn sweeps.
  floor.position.y = -presentationRadius - 0.08;
  floor.receiveShadow = true;
  scene.add(floor);
  const backgrounds = new Map<HTMLElement, string>();
  for (const element of [host, host?.closest<HTMLElement>(".cube-card, .clock-stage, .calendar-stage, .status-stage, .stage")]) {
    if (!element || backgrounds.has(element)) continue;
    backgrounds.set(element, element.style.background);
    element.style.background = STUDIO_BACKGROUND;
  }
  // Reused Clock-only fitting scratch. Single-cube callers retain the original rig.
  const lightCenter = new THREE.Vector3();
  const direction = lights.key.position.clone().normalize();
  return {
    floor,
    /** Fit one conservative caster union after its final rigid pose/scale.
     * Light-space side bounds also contain receiver intersections: shadow rays
     * are parallel to the directional camera depth axis. No mesh traversal. */
    fitCasters(centers: readonly THREE.Vector3[], radius: number, clearance: number) {
      if (!centers.length || !Number.isFinite(radius) || radius <= 0 ||
          !Number.isFinite(clearance) || clearance < 0) throw Error("Invalid studio caster bounds");
      const key = lights.key, camera = key.shadow.camera;
      let floorY = Infinity;
      for (const center of centers) floorY = Math.min(floorY, center.y - radius - clearance);
      floor.position.y = floorY;
      // Preserve the existing illumination direction; only shadow projection changes.
      key.position.copy(direction).multiplyScalar(20);
      key.updateMatrixWorld();
      camera.position.copy(key.position);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
      let near = Infinity, far = -Infinity;
      for (const center of centers) {
        lightCenter.copy(center).applyMatrix4(camera.matrixWorldInverse);
        left = Math.min(left, lightCenter.x - radius); right = Math.max(right, lightCenter.x + radius);
        bottom = Math.min(bottom, lightCenter.y - radius); top = Math.max(top, lightCenter.y + radius);
        near = Math.min(near, -lightCenter.z - radius);
        // The furthest ground intersection comes from the upper support point.
        far = Math.max(far, -lightCenter.z + radius + (center.y + radius - floorY) / direction.y);
      }
      // Square coverage keeps isotropic PCF softness. Padding exceeds its
      // cube-scaled filter footprint, so edge casters retain their penumbra.
      const padding = .12 * radius, half = Math.max(right - left, top - bottom) / 2 + padding;
      const cx = (left + right) / 2, cy = (bottom + top) / 2;
      camera.left = cx - half; camera.right = cx + half;
      camera.bottom = cy - half; camera.top = cy + half;
      camera.near = Math.max(.01, near - padding); camera.far = far + padding;
      camera.updateProjectionMatrix();
      key.shadow.radius = Math.max(2, Math.min(24,
        PRESENTATION_PRESET.shadowSoftness * (radius / Math.sqrt(3)) * PRESENTATION_PRESET.shadowMapSize /
        Math.max(camera.right - camera.left, camera.top - camera.bottom)));
    },
    dispose() {
      floor.removeFromParent(); floor.geometry.dispose(); floor.material.dispose();
      lights.dispose();
      for (const [element, previous] of backgrounds) element.style.background = previous;
    },
  };
}
