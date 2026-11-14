// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";

/**
 * Soft shoulder of the names layout: a tone curve that is the identity (a plain exposure scale, as Linear tone mapping) up to
 * `SHOULDER_START` and rolls off above it towards 1 instead of cutting at 1, so a highlight that the lights push past white
 * (the brighter top face, see names-exposure.ts) keeps some gradation and its channels keep their order, where Linear clips every
 * channel at 1 and a pastel turns white.
 *
 *   f(x) = x                                                           x <= s
 *   f(x) = s + (1 - s) (1 - exp(-(x - s) / (1 - s)))                   x >  s     (continuous and smooth at s, tends to 1)
 *
 * The curve cannot be exact below 1: a color token near white (the paper white is 1 after the exposure) lies on the roll-off
 * for x > s and renders `f(1)` instead of 1. With s = 0.95 that is 0.9816 (about 2 of 255 in sRGB), inside the color
 * tolerance of calendar7-names-color.spec (7 of 255). A later start costs the front less and the top face less protection.
 */
export const SHOULDER_START = 0.95;

/** The curve on one linear channel value after the exposure (the reference of the shader below). */
export function shoulder(x: number, start: number = SHOULDER_START): number {
  if (x <= start) return Math.max(0, x);
  const room = 1 - start;
  return start + room * (1 - Math.exp(-(x - start) / room));
}

/** GLSL of the same curve (`CustomToneMapping` of three.js applies the exposure itself). */
export const SHOULDER_GLSL = `vec3 CustomToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	float s = ${SHOULDER_START.toFixed(4)};
	float room = 1.0 - s;
	vec3 over = max( color - s, vec3( 0.0 ) );
	return max( color - over + room * ( vec3( 1.0 ) - exp( -over / room ) ), vec3( 0.0 ) );
}`;

const CUSTOM_STUB = "vec3 CustomToneMapping( vec3 color ) { return color; }";
let installed = false;

/**
 * Puts the shoulder in the place of three.js's empty `CustomToneMapping` (the only hook for a own curve; a renderer
 * with `THREE.CustomToneMapping` uses it, every other tone mapping is untouched). Idempotent; call before the first render with
 * `NAMES_TONE_MAPPING` (programs are compiled with the chunk of that time). The repo's other apps never select Custom.
 */
export function installNamesToneMapping(): void {
  if (installed) return;
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (!chunk.includes(CUSTOM_STUB)) throw new Error("three.js changed its CustomToneMapping stub: update names-tone.ts");
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(CUSTOM_STUB, SHOULDER_GLSL);
  installed = true;
}

export const NAMES_TONE_MAPPING = THREE.CustomToneMapping;
