import * as THREE from "three";
import { groupOrbit, groupZoom } from "./orbit.ts";
import { clockCameraRadius } from "./framing.ts";
import { CubeViewer, configurePresentationRenderer, createPresentationStudio } from "@cubistry/cube-viewer";
import { demand } from "@cubistry/cube-core";
/** One WebGL context, scene, camera and frame loop for the entire H–M–S row. */
export class ClockStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 1000);
  private readonly resize: ResizeObserver;
  private readonly studio: ReturnType<typeof createPresentationStudio>;
  private yaw = 0.2;
  private pitch = 0.16;
  private radius = 12;
  private zoom = 1;
  private drag: { id: number; x: number; y: number } | null = null;
  private cubes: CubeViewer[] = [];
  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    const el = this.renderer.domElement;
    host.append(el);
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "Live H M S clock. Three physical cubes in one scene. Drag to orbit all three.",
    );
    this.studio = createPresentationStudio(this.scene, 1, 4.3, host);
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(host);
    el.addEventListener("pointerdown", (e) => {
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      Object.assign(this, groupOrbit(this.yaw, this.pitch,
        e.clientX - this.drag.x, e.clientY - this.drag.y));
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    const release = () => {
      this.drag = null;
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoom = groupZoom(this.zoom, e.deltaY);
    }, { passive: false });
    this.renderer.setAnimationLoop(() => {
      this.radius = clockCameraRadius(
        this.camera.aspect,
        this.yaw,
        this.pitch,
        this.camera.fov,
      ) * this.zoom;
      this.camera.position.set(
        Math.sin(this.yaw) * Math.cos(this.pitch) * this.radius,
        Math.sin(this.pitch) * this.radius,
        Math.cos(this.yaw) * Math.cos(this.pitch) * this.radius,
      );
      this.camera.lookAt(0, 0, 0);
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
      scene: this.scene,
      camera: this.camera,
      position: [(index - 1) * 2.8, 0, 0],
      resetCamera: () => this.resetCamera(),
    });
    this.cubes.push(cube);
    return cube;
  }
  resetCamera(): void {
    this.yaw = 0.2;
    this.pitch = 0.16;
    this.zoom = 1;
    this.drag = null;
  }
  destroy(): void {
    demand(
      this.cubes.every((c) => !c.animating),
      "Cannot destroy a moving clock stage",
    );
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.studio.dispose();
    for (const cube of this.cubes) cube.destroy();
    this.cubes = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
