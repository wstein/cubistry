// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { LayerProfile } from "./physical-scene.ts";

/** Bounded presentation quality, shared by every current 2×2/3×3 consumer.
 * Shared cube geometry and two bounded shadow maps per scene (key and shadow fill). */
export const PRESENTATION_PRESET = Object.freeze({
  version: 1,
  cubiePitch: 1,
  bodyWidth: 0.99,
  bodyRadius: 0.055,
  /** Smaller 2×2 bevels reduce the visible seam without closing the turn clearance. */
  size2BodyRadius: 0.03,
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
  /** Second, weaker, softer shadow caster a few degrees of azimuth beside the key (no per-cube maps). */
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
  /** Soft blob directly under each cube; on by default, switchable (nothing is allocated while off). */
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

/**
 * Bevel radius of a body in inner-layer units (pitch 1). 2x2 and 3x3 keep their historical radii. A larger cube keeps the
 * millimeter radius of the 3x3 at the same cube edge (owner decision 2026-11-14): r = bodyRadius * edge / 3, where `edge` is the
 * edge of the whole cube in inner layers (N for the unit pitch, the sum of the layer widths with a layer profile).
 */
export function bodyRadiusFor(size: number = 3, edge: number = size): number {
  const p = PRESENTATION_PRESET;
  return size === 2 ? p.size2BodyRadius : size <= 3 ? p.bodyRadius : p.bodyRadius * edge / 3;
}
/** Sticker corner radius: the body radius rule with the sticker radius (2x2 keeps 0.055). */
export function stickerRadiusFor(size: number = 3, edge: number = size): number {
  const p = PRESENTATION_PRESET;
  return size <= 3 ? p.stickerRadius : p.stickerRadius * edge / 3;
}
/**
 * Side of a sticker on a cell of width `cell` (inner layers): the preset share of the cell, and never wider than the flat part of
 * the body face less a 0.01 margin (a larger bevel radius shrinks the sticker; N <= 3 keeps 0.87 exactly).
 */
export function stickerSideFor(cell: number, radius: number): number {
  const p = PRESENTATION_PRESET, side = p.stickerWidth * cell;
  return radius <= p.stickerRadius ? side : Math.min(side, cell - (1 - p.bodyWidth) - 2 * radius - 0.01);
}
/** A rounded-rectangle sticker of the world size `width` x `height` with corner radius `radius` on both axes; UV spans 0..1 over its extent. */
export function createStickerGeometry(width: number, height: number, radius: number, curveSegments: number = PRESENTATION_PRESET.stickerCurveSegments): THREE.ShapeGeometry {
  const hx = width / 2, hy = height / 2, r = radius;
  const shape = new THREE.Shape();
  shape.moveTo(-hx + r, -hy);
  shape.lineTo(hx - r, -hy);
  shape.quadraticCurveTo(hx, -hy, hx, -hy + r);
  shape.lineTo(hx, hy - r);
  shape.quadraticCurveTo(hx, hy, hx - r, hy);
  shape.lineTo(-hx + r, hy);
  shape.quadraticCurveTo(-hx, hy, -hx, hy - r);
  shape.lineTo(-hx, -hy + r);
  shape.quadraticCurveTo(-hx, -hy, -hx + r, -hy);
  const sticker = new THREE.ShapeGeometry(shape, curveSegments);
  // ShapeGeometry defaults to world-coordinate UVs. Preserve the complete
  // immutable image frame: local +x is image right and local +y is print up.
  const positions = sticker.getAttribute("position");
  const uv = sticker.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, THREE.MathUtils.clamp(positions.getX(i) / width + 0.5, 0, 1),
      THREE.MathUtils.clamp(positions.getY(i) / height + 0.5, 0, 1));
  sticker.userData.size = [width, height]; // exact (the float32 positions are not)
  return sticker;
}

/** `size`: cube size N (default 3); `edge`: cube edge in inner layers when it is not N (layer profile). */
export function createPresentationGeometry(size?: number, edge?: number) {
  const p = PRESENTATION_PRESET;
  const body = new RoundedBoxGeometry(p.bodyWidth, p.bodyWidth, p.bodyWidth, p.bevelSegments, bodyRadiusFor(size, edge));
  const radius = stickerRadiusFor(size, edge);
  const side = stickerSideFor(1, radius);
  const sticker = createStickerGeometry(side, side, radius);
  return { body, core: new THREE.SphereGeometry(1, 48, 24), sticker, stickerOffset: p.stickerOffset };
}

/**
 * Layer profile of the preset for the widths of an N-cube: a body per cell (preset gap and bevel radius of the cube edge) and a
 * sticker per cell (right x up size of the cell, same corner radius on both axes), so no sticker is stretched.
 */
export function presentationLayerProfile(widths: readonly number[]): LayerProfile {
  const p = PRESENTATION_PRESET, n = widths.length, edge = widths.reduce((a, b) => a + b, 0);
  const radius = bodyRadiusFor(n, edge), sticker = stickerRadiusFor(n, edge), gap = 1 - p.bodyWidth;
  return {
    widths,
    body: (cell) => new RoundedBoxGeometry(cell[0] - gap, cell[1] - gap, cell[2] - gap, p.bevelSegments, Math.min(radius, (Math.min(...cell) - gap) / 2)),
    sticker: (w, h) => createStickerGeometry(stickerSideFor(w, sticker), stickerSideFor(h, sticker), sticker),
  };
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
/** localStorage key of the opt-in low-effects test mode (never set by the application itself). */
export const LOW_EFFECTS_STORAGE_KEY = "cubistry-lowfx";
/** Drawing-buffer pixel ratio forced by the low-effects mode `"1"` (test only). */
export const lowEffectsPixelRatio = 0.5;
export interface PresentationEffects {
  /** False only in the low-effects test modes; the renderer shadow map is then disabled. */
  shadows: boolean;
  /** Forced pixel ratio, or null to keep the production (device) ratio. */
  pixelRatio: number | null;
}
/** Parses the opt-in test flag: `"shadows"` disables only the shadow map, `"1"` also forces
 * `lowEffectsPixelRatio`. Absent storage, a throwing storage (private mode) and any other value
 * give the unchanged production behavior. */
export function presentationEffects(storage?: Pick<Storage, "getItem"> | null): PresentationEffects {
  let flag: string | null = null;
  try { flag = storage?.getItem(LOW_EFFECTS_STORAGE_KEY) ?? null; } catch { flag = null; }
  if (flag === "shadows") return { shadows: false, pixelRatio: null };
  if (flag === "1") return { shadows: false, pixelRatio: lowEffectsPixelRatio };
  return { shadows: true, pixelRatio: null };
}
function browserStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
export function configurePresentationRenderer(renderer: THREE.WebGLRenderer,
  storage: Pick<Storage, "getItem"> | null = browserStorage()): void {
  const effects = presentationEffects(storage);
  renderer.setPixelRatio(effects.pixelRatio ?? presentationPixelRatio(devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral compresses bright highlights while retaining printed image colors.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  // Low-effects test mode only disables the renderer shadow map; the lights keep castShadow.
  renderer.shadowMap.enabled = effects.shadows;
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
