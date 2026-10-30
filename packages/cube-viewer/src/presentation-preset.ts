import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** Bounded presentation quality, shared by every current 2×2/3×3 consumer.
 * Shared cube geometry and one bounded shadow map per scene. */
export const PRESENTATION_PRESET = Object.freeze({
  version: 1,
  cubiePitch: 1,
  bodyWidth: 0.99,
  bodyRadius: 0.055,
  bevelSegments: 3,
  stickerWidth: 0.87,
  stickerRadius: 0.055,
  stickerCurveSegments: 4,
  stickerOffset: 0.502,
  maxPixelRatio: 2,
  shadowMapSize: 1024,
  shadowSoftness: 0.1,
  shadowOpacity: 0.28,
  plasticClearcoat: 0.18,
  stickerClearcoat: 0.12,
  ambientIntensity: 0.45,
  hemisphereIntensity: 1.1,
  keyIntensity: 2.8,
  fillIntensity: 0.85,
  rimIntensity: 1.3,
});

export function createPresentationGeometry() {
  const p = PRESENTATION_PRESET;
  const body = new RoundedBoxGeometry(p.bodyWidth, p.bodyWidth, p.bodyWidth,
    p.bevelSegments, p.bodyRadius);
  const h = p.stickerWidth / 2, r = p.stickerRadius;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const sticker = new THREE.ShapeGeometry(shape, p.stickerCurveSegments);
  // ShapeGeometry defaults to world-coordinate UVs. Preserve the complete
  // immutable image frame: local +x is image right and local +y is print up.
  const positions = sticker.getAttribute("position");
  const uv = sticker.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, THREE.MathUtils.clamp(positions.getX(i) / p.stickerWidth + 0.5, 0, 1),
      THREE.MathUtils.clamp(positions.getY(i) / p.stickerWidth + 0.5, 0, 1));
  return { body, core: new THREE.BoxGeometry(1, 1, 1), sticker, stickerOffset: p.stickerOffset };
}

export function createPlasticMaterial(color = "#202329", roughness = 0.45) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0,
    clearcoat: PRESENTATION_PRESET.plasticClearcoat, clearcoatRoughness: 0.35 });
}
export function createStickerMaterial(map: THREE.Texture, color = "#ffffff", roughness = 0.65) {
  return new THREE.MeshPhysicalMaterial({ map, color, roughness, metalness: 0,
    clearcoat: PRESENTATION_PRESET.stickerClearcoat, clearcoatRoughness: 0.55 });
}
export function presentationPixelRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0
    ? Math.min(PRESENTATION_PRESET.maxPixelRatio, ratio) : 1;
}
export function configurePresentationRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setPixelRatio(presentationPixelRatio(devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral compresses bright highlights while retaining printed image colors.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  // PCF honors the key radius; PCFSoft ignores that setting.
  renderer.shadowMap.type = THREE.PCFShadowMap;
}
/** Called once by the owner of a scene, including a shared multi-cube viewport. */
export function addPresentationLighting(scene: THREE.Scene | THREE.Group, shadowExtent = 4, softness: number = PRESENTATION_PRESET.shadowSoftness) {
  const p = PRESENTATION_PRESET;
  const lights: THREE.Light[] = [];
  const ambient = new THREE.AmbientLight(0xffffff, p.ambientIntensity);
  scene.add(ambient); lights.push(ambient);
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x77808d, p.hemisphereIntensity);
  scene.add(hemisphere); lights.push(hemisphere);
  for (const [position, intensity] of [
    [[3, 5, 6], p.keyIntensity],
    [[-4, 1, 2], p.fillIntensity],
    [[1, 3, -4], p.rimIntensity],
  ] as const) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    light.position.set(position[0], position[1], position[2]);
    if (intensity === p.keyIntensity) {
      light.castShadow = true;
      light.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
      Object.assign(light.shadow.camera, {
        left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent,
        near: 0.1, far: 40,
      });
      light.shadow.camera.updateProjectionMatrix();
      light.shadow.bias = -0.0002;
      light.shadow.normalBias = 0.01;
      // Fixed 17-tap PCF work, broader world-space penumbra. Convert to
      // texels so the single-cube and three-cube rigs have equal softness.
      light.shadow.radius = Math.max(2, Math.min(24,
        softness * p.shadowMapSize / (2 * shadowExtent)));
    }
    scene.add(light); lights.push(light);
  }
  return { dispose() {
    for (const light of lights) {
      light.removeFromParent();
      if (light instanceof THREE.DirectionalLight) light.shadow.map?.dispose();
    }
  } };
}
