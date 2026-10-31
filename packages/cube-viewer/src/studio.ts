import * as THREE from "three";
import { addPresentationLighting, PRESENTATION_PRESET, shadowRadiusTexels } from "./presentation-preset.ts";

/** Procedural radial falloff (alpha only), no DOM or canvas needed. */
export function createContactShadowTexture(size: number = PRESENTATION_PRESET.contactShadowTextureSize) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
    const t = Math.max(0, 1 - r), i = (y * size + x) * 4;
    data.fill(255, i, i + 3);
    data[i + 3] = Math.round(255 * t * t * (3 - 2 * t)); // smoothstep, exactly 0 at the rim
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export const STUDIO_BACKGROUND =
  "radial-gradient(ellipse at 48% 28%, #fffdf7 0%, transparent 65%), " +
  "linear-gradient(180deg, #e9e0d2 0%, #f6f0e5 48%, #d8cabb 100%)";

/** One receiving surface and exactly two shadow casters (key and softer shadow fill)
 * per viewport, never per cube.
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
  const casters = [
    { light: lights.key, softness: PRESENTATION_PRESET.shadowSoftness, max: PRESENTATION_PRESET.shadowRadiusMax, direction: lights.key.position.clone().normalize() },
    { light: lights.shadowFill,
      softness: PRESENTATION_PRESET.shadowFillSoftness, max: PRESENTATION_PRESET.shadowFillRadiusMax,
      direction: lights.shadowFill.position.clone().normalize() },
  ];
  // World-space penumbra: per half-cube extent until the first fit, then per fitted cube size.
  let fitRadius = 0, fineEdges = false;
  /** PCF radius in texels from the light's CURRENT map size and frustum width. */
  const updateRadius = (c: typeof casters[number]) => {
    const camera = c.light.shadow.camera, p = PRESENTATION_PRESET;
    const world = c.softness * (fitRadius ? fitRadius / Math.sqrt(3) : halfCubeExtent) * (fineEdges ? p.fineShadowSoftnessScale : 1);
    c.light.shadow.radius = shadowRadiusTexels(world,
      Math.max(camera.right - camera.left, camera.top - camera.bottom), c.max, c.light.shadow.mapSize.x);
  };
  const setFineShadowEdges = (on: boolean) => {
    if (on === fineEdges) return;
    fineEdges = on;
    const size = on ? PRESENTATION_PRESET.fineShadowMapSize : PRESENTATION_PRESET.shadowMapSize;
    for (const c of casters) {
      const shadow = c.light.shadow;
      shadow.mapSize.set(size, size);
      // Drop the old render targets; three recreates them at the new size on the next render.
      shadow.dispose(); shadow.map = null; shadow.mapPass = null;
      updateRadius(c);
    }
  };
  // Contact shadow: allocated only while switched on, one plane per fitted cube.
  const contact = { meshes: [] as THREE.Mesh[], geometry: undefined as THREE.PlaneGeometry | undefined,
    material: undefined as THREE.MeshBasicMaterial | undefined, texture: undefined as THREE.Texture | undefined };
  let contactOn = false;
  let fitted: { centers: THREE.Vector3[]; radius: number } = { centers: [new THREE.Vector3()], radius: presentationRadius };
  const placeContact = () => {
    const p = PRESENTATION_PRESET;
    while (contact.meshes.length < fitted.centers.length) {
      const mesh = new THREE.Mesh(contact.geometry, contact.material);
      mesh.name = "studio-contact-shadow"; mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 1;
      mesh.castShadow = mesh.receiveShadow = false;
      scene.add(mesh); contact.meshes.push(mesh);
    }
    while (contact.meshes.length > fitted.centers.length) contact.meshes.pop()!.removeFromParent();
    contact.meshes.forEach((mesh, i) => {
      mesh.position.set(fitted.centers[i].x, floor.position.y + p.contactShadowLift, fitted.centers[i].z);
      mesh.scale.setScalar(fitted.radius * p.contactShadowScale);
    });
  };
  const releaseContact = () => {
    for (const mesh of contact.meshes) mesh.removeFromParent();
    contact.meshes.length = 0;
    contact.geometry?.dispose(); contact.material?.dispose(); contact.texture?.dispose();
    contact.geometry = contact.material = contact.texture = undefined;
  };
  const setContactShadow = (on: boolean) => {
    if (on === contactOn) return;
    contactOn = on;
    if (!on) { releaseContact(); return; }
    const p = PRESENTATION_PRESET;
    contact.geometry = new THREE.PlaneGeometry(1, 1);
    contact.texture = createContactShadowTexture();
    contact.material = new THREE.MeshBasicMaterial({ map: contact.texture, color: p.contactShadowColor,
      opacity: p.contactShadowOpacity, transparent: true, depthWrite: false, toneMapped: false, side: THREE.FrontSide });
    placeContact();
  };
  if (PRESENTATION_PRESET.contactShadowDefault) setContactShadow(true);
  if (PRESENTATION_PRESET.fineShadowEdgesDefault) setFineShadowEdges(true);
  return {
    floor,
    /** Soft blob under each cube; allocates nothing while off (default). */
    setContactShadow,
    /** Slightly warm key, cool fill lights; light colors only (default off). */
    setColorTemperature: lights.setColorTemperature,
    /** Opt-in 2048 maps with a slightly harder penumbra (default off). */
    setFineShadowEdges,

    /** Fit one conservative caster union after its final rigid pose/scale.
     * Light-space side bounds also contain receiver intersections: shadow rays
     * are parallel to the directional camera depth axis. No mesh traversal. */
    fitCasters(centers: readonly THREE.Vector3[], radius: number, clearance: number) {
      if (!centers.length || !Number.isFinite(radius) || radius <= 0 ||
          !Number.isFinite(clearance) || clearance < 0) throw Error("Invalid studio caster bounds");
      let floorY = Infinity;
      for (const center of centers) floorY = Math.min(floorY, center.y - radius - clearance);
      floor.position.y = floorY;
      while (fitted.centers.length < centers.length) fitted.centers.push(new THREE.Vector3());
      fitted.centers.length = centers.length; fitted.radius = radius;
      centers.forEach((c, i) => fitted.centers[i].copy(c));
      for (const { light, softness, direction } of casters) {
        const camera = light.shadow.camera;
        // Preserve the existing illumination direction; only shadow projection changes.
        light.position.copy(direction).multiplyScalar(20);
        light.updateMatrixWorld();
        camera.position.copy(light.position);
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
        // Square coverage keeps isotropic PCF softness. Padding exceeds each
        // light's cube-scaled filter footprint (wider for the softer fill), so
        // edge casters retain their penumbra.
        const padding = radius * Math.max(.12, 1.25 * softness / Math.sqrt(3));
        const half = Math.max(right - left, top - bottom) / 2 + padding;
        const cx = (left + right) / 2, cy = (bottom + top) / 2;
        camera.left = cx - half; camera.right = cx + half;
        camera.bottom = cy - half; camera.top = cy + half;
        camera.near = Math.max(.01, near - padding); camera.far = far + padding;
        camera.updateProjectionMatrix();
      }
      fitRadius = radius;
      for (const c of casters) updateRadius(c);
      if (contactOn) placeContact();
    },
    dispose() {
      releaseContact(); contactOn = false;
      floor.removeFromParent(); floor.geometry.dispose(); floor.material.dispose();
      lights.dispose();
      for (const [element, previous] of backgrounds) element.style.background = previous;
    },
  };
}
