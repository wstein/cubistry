// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Plasticity of the names layout: one number in [0, 1] between the flat look that renders every token exactly (0: no specular,
 * no clearcoat, faces without shadows) and the depth of a glossy plastic cube. Plasticity never shifts the mean color of a flat
 * area: the shading it adds lowers the mean radiance by a modeled amount, which `plasticityGain` gives back as exposure.
 *
 * The mapping (what the numbers are is measured, see tests/browser/calendar7-names-color.spec.mjs and docs/CALENDAR_7X7.md):
 * - specular: three.js `specularIntensity` 0.2 p (the shared plastic has 1);
 * - clearcoat: 0.06 p (the shared plastic has 0.18);
 * - face shadows: for p > 0 the cube faces receive the shadow map at a strength (`shadow.intensity` of the key and the shadow
 *   fill, relative to the preset) of 0.3 + 0.5 p (the preset has 1). The strength never falls below 0.3 because the floor
 *   shadow shares the lights: its material opacity is raised by the same factor (`floorOpacityFactor`), and that reaches 1
 *   at a strength of 0.3.
 * The old look (Neutral tone mapping, exposure 2.6, shadows at 1, specular 1, clearcoat 0.18) is the comparison, not a value
 * of p: it shifts colors by up to 47 of 255.
 */
export const DEFAULT_PLASTICITY = 0.6;

/** Clamps to [0, 1] (also ±Infinity); NaN, as from garbage text, gives the default. */
export const clampPlasticity = (p: number): number => (Number.isNaN(p) ? DEFAULT_PLASTICITY : Math.min(1, Math.max(0, p)));

/** Parses `?plasticity=0.6`; absent or invalid gives the default. */
export const parsePlasticity = (text: string | null | undefined): number => (text === null || text === undefined || text.trim() === "" ? DEFAULT_PLASTICITY : clampPlasticity(Number(text)));

export interface PlasticityParts {
  readonly specular: number;
  readonly clearcoat: number;
  /** Faces receive the shadow map. */
  readonly faceShadows: boolean;
  /** Shadow strength of the lights relative to the preset (1). */
  readonly shadowStrength: number;
}

/** Floor of the shadow strength: the floor shadow keeps its darkness down to here. */
export const MIN_SHADOW_STRENGTH = 0.3;
/** Mean loss of radiance of a lit front face per unit of shadow strength (measured: 4.5% at 0.3, 7% at 0.5, 12.5% at 1 on white). */
export const SHADOW_LOSS = 0.105;
/** Diffuse loss to the specular and clearcoat layers (three.js energy conservation) per unit of specularIntensity and clearcoat. */
export const SPECULAR_LOSS = 0.03, CLEARCOAT_LOSS = 0.05;

export function plasticityParts(plasticity: number): PlasticityParts {
  const p = clampPlasticity(plasticity);
  return { specular: 0.2 * p, clearcoat: 0.06 * p, faceShadows: p > 0, shadowStrength: p > 0 ? MIN_SHADOW_STRENGTH + 0.5 * p : MIN_SHADOW_STRENGTH };
}

/** Exposure factor that gives back the radiance the plasticity takes from a flat area. */
/** `shadowMap`: whether the renderer's shadow map is on (the repo's test mode turns it off: then the faces lose nothing to shadows). */
export function plasticityGain(plasticity: number, shadowMap = true): number {
  const parts = plasticityParts(plasticity);
  const shadow = parts.faceShadows && shadowMap ? 1 - SHADOW_LOSS * parts.shadowStrength : 1;
  return 1 / (shadow * (1 - SPECULAR_LOSS * parts.specular - CLEARCOAT_LOSS * parts.clearcoat));
}

/** Opacity factor of the floor shadow material that keeps its darkness when the lights' shadow strength is `strength`. */
export const floorOpacityFactor = (strength: number): number => 1 / strength;
