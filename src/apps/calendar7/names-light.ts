// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";

/**
 * Lighting of the names layout: one global rig for every face, no light or material that depends on the face. The studio's key, the
 * hemisphere light and the ambient light are set to the values below while the layout is "names", and a weak raking directional light
 * (no shadow) is added; the other layouts and apps keep the studio's own values (`apply(false)` restores them).
 *
 * The key stands low and frontal (about 21 degrees above the horizon), so the front face is lit from nearly head on and the seams
 * between the cubies and the bevels show (a flat look has a bevel depth of 0.5 luma levels, this rig 19); the light that does not
 * depend on a direction is all ambient (the hemisphere light, which lights a top face more than a front face, is off), so the top
 * face is not washed out; the raking light grazes the front face from the left. Values: the experiment's rig V4c (hemisphere 0.3, ambient 0.5)
 * with one tuning round on the hemisphere and ambient light (docs/CALENDAR_7X7.md, "Global light of the names layout", has both
 * measurements). Exposure (names-exposure.ts) is the one global scalar that follows the faces that look at the camera.
 */
export const NAMES_KEY = { position: [1, 2.5, 6.5] as const, intensity: 2.4 };
export const NAMES_HEMISPHERE_INTENSITY = 0;
export const NAMES_AMBIENT_INTENSITY = 0.8;
export const NAMES_RAKING = { position: [-8, 1.5, 1.5] as const, intensity: 0.9 };

export interface StudioLights { ambient: THREE.AmbientLight; hemisphere: THREE.HemisphereLight; key: THREE.DirectionalLight }

/**
 * The lights of `addPresentationLighting` found in `scene`: the first ambient light, the first hemisphere light and the key, which is
 * the first directional light that casts a shadow (the key is created before the shadow fill; asserted in tests/calendar7-names-light.test.mjs).
 */
export function findStudioLights(scene: THREE.Object3D): StudioLights {
  let ambient: THREE.AmbientLight | undefined, hemisphere: THREE.HemisphereLight | undefined, key: THREE.DirectionalLight | undefined;
  scene.traverse((o) => {
    if ((o as THREE.AmbientLight).isAmbientLight) ambient ??= o as THREE.AmbientLight;
    else if ((o as THREE.HemisphereLight).isHemisphereLight) hemisphere ??= o as THREE.HemisphereLight;
    else if ((o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow) key ??= o as THREE.DirectionalLight;
  });
  if (!ambient || !hemisphere || !key) throw new Error("names-light.ts: the studio lights (ambient, hemisphere, shadow key) were not found in the scene");
  return { ambient, hemisphere, key };
}

/** The global names rig on top of the studio lights of one scene. */
export class NamesLighting {
  private readonly studio: StudioLights;
  private readonly raking = new THREE.DirectionalLight(0xffffff, 0);
  private readonly saved: { keyPosition: THREE.Vector3; keyIntensity: number; hemisphere: number; ambient: number };
  private readonly scene: THREE.Object3D;
  private on = false;

  constructor(scene: THREE.Object3D) {
    this.scene = scene;
    this.studio = findStudioLights(scene);
    const { key, hemisphere, ambient } = this.studio;
    this.saved = { keyPosition: key.position.clone(), keyIntensity: key.intensity, hemisphere: hemisphere.intensity, ambient: ambient.intensity };
    this.raking.name = "names-raking-light";
    this.raking.castShadow = false;
    this.raking.position.set(...NAMES_RAKING.position);
    this.raking.visible = false;
    scene.add(this.raking);
  }

  get active(): boolean { return this.on; }

  /** True: the global rig of the names layout; false: the studio's own values (the raking light is hidden, so no light and no shader counts it). */
  apply(on: boolean): void {
    this.on = on;
    const { key, hemisphere, ambient } = this.studio;
    if (on) {
      key.position.set(...NAMES_KEY.position);
      key.intensity = NAMES_KEY.intensity;
      hemisphere.intensity = NAMES_HEMISPHERE_INTENSITY;
      ambient.intensity = NAMES_AMBIENT_INTENSITY;
      this.raking.intensity = NAMES_RAKING.intensity;
    } else {
      key.position.copy(this.saved.keyPosition);
      key.intensity = this.saved.keyIntensity;
      hemisphere.intensity = this.saved.hemisphere;
      ambient.intensity = this.saved.ambient;
      this.raking.intensity = 0;
    }
    this.raking.visible = on;
  }

  dispose(): void {
    this.apply(false);
    this.scene.remove(this.raking);
  }
}
