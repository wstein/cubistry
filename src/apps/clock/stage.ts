import * as THREE from "three";
import { groupOrbit, groupZoom } from "./orbit.ts";
import { clockPresentationRadius } from "./framing.ts";
import { installPresentationDrag, rotatePresentation, fitPresentationCamera, CubeViewer, configurePresentationRenderer, createPresentationStudio, DEFAULT_APPEARANCE, installAppearanceControls, type ViewerAppearance } from "@cubistry/cube-viewer";
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
  private yaw = 0.2;
  private pitch = 0.16;
  private radius = 12;
  private zoom = 1;
  private cancelDrag?: () => void;
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
    this.studio = createPresentationStudio(this.scene, 1, 4.3, host, clockPresentationRadius);
    this.appearanceControls = installAppearanceControls(host, (value) => {
      this.appearance = value;
      for (const cube of this.cubes) cube.setAppearance(value);
    });
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.fitCamera();
    });
    this.resize.observe(host);
    this.cancelDrag = installPresentationDrag(el, (dx, dy) => {
      Object.assign(this, groupOrbit(this.yaw, this.pitch, dx, dy));
    });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoom = groupZoom(this.zoom, e.deltaY);
      this.fitCamera();
    }, { passive: false });
    this.fitCamera();
    this.renderer.setAnimationLoop(() => {
      rotatePresentation(this.presentation, this.yaw, this.pitch);
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
    this.yaw = 0.2;
    this.pitch = 0.16;
    this.cancelDrag?.();
    rotatePresentation(this.presentation, this.yaw, this.pitch);
  }
  private fitCamera(): void {
    this.radius = fitPresentationCamera(this.camera, clockPresentationRadius, this.zoom);
  }
  destroy(): void {
    demand(
      this.cubes.every((c) => !c.animating),
      "Cannot destroy a moving clock stage",
    );
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.studio.dispose();
    this.appearanceControls.dispose();
    for (const cube of this.cubes) cube.destroy();
    this.cubes = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
