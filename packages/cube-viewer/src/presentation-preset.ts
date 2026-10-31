import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** Bounded presentation quality, shared by every current 2×2/3×3 consumer.
 * Shared cube geometry and two bounded shadow maps per scene (key and shadow fill). */
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
  shadowSoftness: 0.14,
  shadowOpacity: 0.3,
  plasticClearcoat: 0.18,
  stickerClearcoat: 0.12,
  ambientIntensity: 0.3,
  hemisphereIntensity: 0.65,
  /** Steep key (about 64 degrees above the horizon): shorter, rounder shadows. */
  keyPosition: Object.freeze([1.5, 7, 3] as const),
  keyIntensity: 2.8,
  fillIntensity: 0.85,
  rimIntensity: 1.3,
  /** Second, weaker, softer shadow caster opposite the key (no per-cube maps). */
  shadowFillIntensity: 1.0,
  /** Shadow fill = key rotated about Y by this azimuth (negative x side), nearly coincident. */
  shadowFillAzimuthDegrees: 25,
  /** Elevation offset of the shadow fill relative to the key, in degrees. */
  shadowFillElevationDelta: 0,
  /** World-space penumbra per half-cube extent; larger than shadowSoftness. */
  shadowFillSoftness: 0.18,
  /** PCF radius caps in texels: the fill may blur wider than the key. */
  shadowRadiusMax: 24,
  /** Optional light-only tint; off keeps every light exactly white. */
  colorTemperatureDefault: false,
  warmKeyColor: "#fff3e3",
  coolFillColor: "#eaf1ff",
  /** Optional soft blob directly under each cube; off unless switched on. */
  contactShadowDefault: true,
  contactShadowColor: "#302b26",
  contactShadowOpacity: 0.5,
  /** Plane side as a multiple of the presentation radius (footprint of the blob). */
  contactShadowScale: 2.2,
  /** Cap on the blob side as a multiple of the nearest neighbor distance: the blobs fade to zero at
   * their rim, so at 1.0 neighboring blobs touch but never overlap into one band (clock). */
  contactShadowSpacingLimit: 1.0,
  /** Height above the receiver, avoiding z-fighting with the shadow floor. */
  contactShadowLift: 0.004,
  contactShadowTextureSize: 64,
  /** Opt-in: larger shadow maps and a slightly harder, cleaner edge. */
  fineShadowEdgesDefault: false,
  fineShadowMapSize: 2048,
  fineShadowSoftnessScale: 0.65,
  shadowFillRadiusMax: 32,
  /** Darkness weight of the shadow fill's shadow (LightShadow.intensity). */
  shadowFillShadowIntensity: 0.55,
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
  return { body, core: new THREE.SphereGeometry(1, 48, 24), sticker, stickerOffset: p.stickerOffset };
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
/** Radius in shadow-map texels giving a world-space penumbra of `softness`. */
export function shadowRadiusTexels(softness: number, frustumWidth: number,
  max: number = PRESENTATION_PRESET.shadowRadiusMax, mapSize: number = PRESENTATION_PRESET.shadowMapSize): number {
  // The texel caps are defined at the base map size; scale them so the
  // world-space limit stays the same for other map sizes.
  return Math.max(2, Math.min(max * mapSize / PRESENTATION_PRESET.shadowMapSize, softness * mapSize / frustumWidth));
}
/** Position of the shadow fill: the key rotated about Y by the (negative) azimuth,
 * keeping its distance, with an optional elevation offset. */
export function shadowFillPositionFromKey(key: readonly [number, number, number],
  azimuthDegrees: number = PRESENTATION_PRESET.shadowFillAzimuthDegrees,
  elevationDelta: number = PRESENTATION_PRESET.shadowFillElevationDelta): [number, number, number] {
  const horizontal = Math.hypot(key[0], key[2]), length = Math.hypot(key[0], key[1], key[2]);
  const azimuth = Math.atan2(key[0], key[2]) - THREE.MathUtils.degToRad(azimuthDegrees);
  const elevation = Math.atan2(key[1], horizontal) + THREE.MathUtils.degToRad(elevationDelta);
  return [length * Math.cos(elevation) * Math.sin(azimuth), length * Math.sin(elevation),
    length * Math.cos(elevation) * Math.cos(azimuth)];
}
function configureShadowCaster(light: THREE.DirectionalLight, shadowExtent: number, softness: number,
  maxRadius: number = PRESENTATION_PRESET.shadowRadiusMax) {
  const p = PRESENTATION_PRESET;
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
  light.shadow.radius = shadowRadiusTexels(softness, 2 * shadowExtent, maxRadius);
}
/** Called once by the owner of a scene, including a shared multi-cube viewport.
 * Exactly two lights cast shadows: the key and the softer shadow fill. */
export function addPresentationLighting(scene: THREE.Scene | THREE.Group, shadowExtent = 4, softness: number = PRESENTATION_PRESET.shadowSoftness) {
  const p = PRESENTATION_PRESET;
  const lights: THREE.Light[] = [];
  const add = <T extends THREE.Light>(light: T): T => { scene.add(light); lights.push(light); return light; };
  add(new THREE.AmbientLight(0xffffff, p.ambientIntensity));
  add(new THREE.HemisphereLight(0xffffff, 0x77808d, p.hemisphereIntensity));
  const directional = (position: readonly [number, number, number], intensity: number) => {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    light.position.set(position[0], position[1], position[2]);
    return add(light);
  };
  const key = directional(p.keyPosition, p.keyIntensity);
  configureShadowCaster(key, shadowExtent, softness);
  const fill = directional([-4, 1, 2], p.fillIntensity);
  const rim = directional([1, 3, -4], p.rimIntensity);
  const shadowFill = directional(shadowFillPositionFromKey(p.keyPosition), p.shadowFillIntensity);
  configureShadowCaster(shadowFill, shadowExtent, softness * p.shadowFillSoftness / p.shadowSoftness,
    p.shadowFillRadiusMax);
  shadowFill.shadow.intensity = p.shadowFillShadowIntensity;
  /** Tints light colors only (key warm, fill and shadow fill cool); never materials. */
  const setColorTemperature = (on: boolean) => {
    key.color.set(on ? p.warmKeyColor : 0xffffff);
    fill.color.set(on ? p.coolFillColor : 0xffffff);
    shadowFill.color.set(on ? p.coolFillColor : 0xffffff);
  };
  if (p.colorTemperatureDefault) setColorTemperature(true);
  return { key, fill, rim, shadowFill, setColorTemperature, dispose() {
    for (const light of lights) {
      light.removeFromParent();
      if (light instanceof THREE.DirectionalLight) light.shadow.map?.dispose();
    }
  } };
}
