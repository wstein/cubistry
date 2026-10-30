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
  return {
    floor,
    dispose() {
      floor.removeFromParent(); floor.geometry.dispose(); floor.material.dispose();
      lights.dispose();
      for (const [element, previous] of backgrounds) element.style.background = previous;
    },
  };
}
