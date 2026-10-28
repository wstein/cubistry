import * as THREE from "three";
import { CubeViewer } from "@cubistry/cube-viewer";
import { demand } from "@cubistry/cube-core";
/** One WebGL context, scene, camera and frame loop for the entire H–M–S row. */
export class ClockStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  private readonly resize: ResizeObserver;
  private yaw = 0;
  private pitch = 0.1;
  private radius = 12;
  private drag: { id: number; x: number; y: number } | null = null;
  private cubes: CubeViewer[] = [];
  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    host.append(el);
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "Live H M S clock. Three physical cubes in one scene. Drag to orbit all three.",
    );
    this.scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 6);
    this.scene.add(light);
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.radius =
        Math.max(1.75, 4.4 / this.camera.aspect) /
          Math.tan(THREE.MathUtils.degToRad(14)) +
        2.2;
    });
    this.resize.observe(host);
    el.addEventListener("pointerdown", (e) => {
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.yaw = Math.max(
        -0.5,
        Math.min(0.5, this.yaw - (e.clientX - this.drag.x) * 0.004),
      );
      this.pitch = Math.max(
        -0.4,
        Math.min(0.4, this.pitch + (e.clientY - this.drag.y) * 0.004),
      );
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    const release = () => {
      this.drag = null;
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
    this.renderer.setAnimationLoop(() => {
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
      resetCamera: () => {
        this.yaw = 0;
        this.pitch = 0.1;
      },
    });
    this.cubes.push(cube);
    return cube;
  }
  destroy(): void {
    demand(
      this.cubes.every((c) => !c.animating),
      "Cannot destroy a moving clock stage",
    );
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    for (const cube of this.cubes) cube.destroy();
    this.cubes = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
