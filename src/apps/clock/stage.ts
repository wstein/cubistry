import * as THREE from "three";
import { groupZoom } from "./orbit.ts";
import { clockCameraRadius, clockCenters, clockCentersFor, clockCubeCount, clockCubeRadius, clockPresentationScale, clockRowExtent, clockWorldCenters } from "./framing.ts";
import { bindSmartRotation, type SmartRotationBinding, rotatePresentation, CubeViewer, configurePresentationRenderer, createPresentationStudio, bindLightingSwitches, type LightingSwitches, DEFAULT_APPEARANCE, installAppearanceControls, type ViewerAppearance } from "@cubistry/cube-viewer";
import { demand } from "@cubistry/cube-core";
const THREE_CUBE_LABEL =
  "Live H M S clock. Three physical cubes in one scene. Drag to rotate the entire arrangement.";
const TWO_CUBE_LABEL =
  "Two physical cubes in one scene. Drag to rotate the entire arrangement.";
export interface ClockStageOptions {
  /** Cubes in the row: 2 or 3 (default 3, the H–M–S clock). Other values are rejected. */
  readonly cubes?: number;
  /** Accessible name of the canvas; defaults to a description of the row. */
  readonly label?: string;
}
/**
 * One WebGL context, scene, camera and frame loop for an entire row of two or
 * three cubes (the H–M–S clock uses three).
 */
export class ClockStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly presentation = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 1000);
  private readonly resize: ResizeObserver;
  private appearance: ViewerAppearance = DEFAULT_APPEARANCE;
  private readonly appearanceControls: ReturnType<typeof installAppearanceControls>;
  private readonly studio: ReturnType<typeof createPresentationStudio>;
  private readonly lightingSwitches: LightingSwitches;
  private radius = 12;
  /** Row centers; unset only on bare prototype instances, which use the three-cube row. */
  private readonly layout?: readonly number[];
  private readonly casterCenters: THREE.Vector3[];
  private zoom = 1;
  private rotation?: SmartRotationBinding;
  private cubes: CubeViewer[] = [];
  constructor(host: HTMLElement, options: ClockStageOptions = {}) {
    // Validate before any renderer or DOM work.
    const count = clockCubeCount(options.cubes ?? 3);
    this.layout = clockCentersFor(count);
    this.casterCenters = this.layout.map(() => new THREE.Vector3());
    this.presentation.name = "clock-presentation";
    this.scene.add(this.presentation);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    const el = this.renderer.domElement;
    host.append(el);
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      options.label ?? (count === 3 ? THREE_CUBE_LABEL : TWO_CUBE_LABEL),
    );
    this.studio = createPresentationStudio(this.scene, 1, 4.3, host);
    this.appearanceControls = installAppearanceControls(host, (value) => {
      this.appearance = value;
      for (const cube of this.cubes) cube.setAppearance(value);
    });
    this.lightingSwitches = bindLightingSwitches(this.appearanceControls.panel, this.studio);
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.fitCamera();
    });
    this.resize.observe(host);
    rotatePresentation(this.presentation, .2, .16);
    this.rotation = bindSmartRotation(el, this.presentation, { sensitivity: .004, panel: this.appearanceControls.panel });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.rotation?.interact();
      this.zoom = groupZoom(this.zoom, e.deltaY);
      this.fitCamera();
    }, { passive: false });
    this.fitCamera();
    this.renderer.setAnimationLoop(() => {
      this.rotation?.step();
      this.updatePresentationBounds();
      this.renderer.render(this.scene, this.camera);
    });
  }
  /** Cube centers of this stage's row, left to right. */
  get centers(): readonly number[] {
    return this.layout ?? clockCenters;
  }
  createCube(host: HTMLElement, index: number): CubeViewer {
    const centers = this.centers;
    demand(
      Number.isInteger(index) &&
        index >= 0 &&
        index < centers.length &&
        this.cubes.length === index,
      centers.length === 3
        ? "Clock cubes must be H M S in order"
        : "Stage cubes must be created left to right",
    );
    const cube = new CubeViewer(host, {
      renderer: this.renderer,
      scene: this.presentation,
      camera: this.camera,
      position: [centers[index], 0, 0],
      resetCamera: () => this.resetCamera(),
      onDefaultPlasticColor: (color) => { if (index === 0) this.appearanceControls.setDefaultColor(color); },
    });
    cube.setAppearance(this.appearance);
    this.cubes.push(cube);
    return cube;
  }
  resetCamera(): void {
    this.rotation?.reset();
  }
  private fitCamera(): void {
    const centers = this.centers;
    this.radius = clockCameraRadius(this.camera.aspect, 0, 0, this.camera.fov, centers) * this.zoom;
    this.camera.position.set(0, 0, this.radius);
    this.camera.lookAt(0, 0, 0);
    // Very narrow viewports can require a distance beyond the initial far plane.
    this.camera.far = Math.max(100, this.radius + clockRowExtent(centers) + clockCubeRadius + 1);
    this.camera.updateProjectionMatrix();
    this.updatePresentationBounds();
  }
  private updatePresentationBounds(): void {
    const centers = this.centers;
    const scale = clockPresentationScale(this.camera.aspect, this.presentation.quaternion, this.camera.fov, centers);
    this.presentation.scale.setScalar(scale);
    clockWorldCenters(this.presentation.quaternion, scale, this.casterCenters, centers);
    this.studio.fitCasters(this.casterCenters, clockCubeRadius * scale, .08 * scale);
  }
  destroy(): void {
    demand(
      this.cubes.every((c) => !c.animating),
      "Cannot destroy a moving clock stage",
    );
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.rotation?.dispose();
    this.lightingSwitches.dispose();
    this.studio.dispose();
    this.appearanceControls.dispose();
    for (const cube of this.cubes) cube.destroy();
    this.cubes = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
