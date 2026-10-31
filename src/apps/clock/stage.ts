import * as THREE from "three";
import { groupZoom } from "./orbit.ts";
import { clockCameraRadius, clockCubeRadius, clockPresentationScale, clockWorldCenters } from "./framing.ts";
import { bindSmartRotation, type SmartRotationBinding, rotatePresentation, CubeViewer, configurePresentationRenderer, createPresentationStudio, bindLightingSwitches, type LightingSwitches, DEFAULT_APPEARANCE, installAppearanceControls, type ViewerAppearance } from "@cubistry/cube-viewer";
import { demand } from "@cubistry/cube-core";
/** One WebGL context, scene, camera and frame loop for the entire H–M–S row. */
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
  private readonly casterCenters = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private zoom = 1;
  private rotation?: SmartRotationBinding;
  private cubes: CubeViewer[] = [];
  constructor(host: HTMLElement) {
    this.presentation.name = "clock-presentation";
    this.scene.add(this.presentation);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    const el = this.renderer.domElement;
    host.append(el);
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "Live H M S clock. Three physical cubes in one scene. Drag to rotate the entire arrangement.",
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
  createCube(host: HTMLElement, index: number): CubeViewer {
    demand(
      Number.isInteger(index) &&
        index >= 0 &&
        index < 3 &&
        this.cubes.length === index,
      "Clock cubes must be H M S in order",
    );
    const cube = new CubeViewer(host, {
      renderer: this.renderer,
      scene: this.presentation,
      camera: this.camera,
      position: [(index - 1) * 2.8, 0, 0],
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
    this.radius = clockCameraRadius(this.camera.aspect, 0, 0, this.camera.fov) * this.zoom;
    this.camera.position.set(0, 0, this.radius);
    this.camera.lookAt(0, 0, 0);
    // Very narrow viewports can require a distance beyond the initial far plane.
    this.camera.far = Math.max(100, this.radius + 2.8 + clockCubeRadius + 1);
    this.camera.updateProjectionMatrix();
    this.updatePresentationBounds();
  }
  private updatePresentationBounds(): void {
    const scale = clockPresentationScale(this.camera.aspect, this.presentation.quaternion, this.camera.fov);
    this.presentation.scale.setScalar(scale);
    clockWorldCenters(this.presentation.quaternion, scale, this.casterCenters);
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
