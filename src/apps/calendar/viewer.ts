import * as THREE from "three";
import { stickerArt } from "./artwork.ts";
import {
  demand,
  apply,
  sameState,
  moveInfo,
  type State,
  type Design,
} from "./model.ts";
import {
  PhysicalCubeScene, createPresentationGeometry, createPlasticMaterial,
  createStickerMaterial, configurePresentationRenderer, createPresentationStudio,
} from "@cubistry/cube-viewer";
/** Calendar-only 26-body viewer: one permanent texture per printed facelet. */
export class CalendarViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  private cube: PhysicalCubeScene | null = null;
  private studio: ReturnType<typeof createPresentationStudio>;
  private resources: { dispose(): void }[] = [];
  private resize: ResizeObserver;
  private yaw = 0.2;
  private pitch = 0.18;
  private radius = 14.1;
  private drag: { id: number; x: number; y: number } | null = null;
  private current: State | null = null;
  private busy = false;
  duration = 100;
  get presentedState(): State | null {
    return this.current;
  }
  get animating(): boolean {
    return this.busy;
  }
  readonly host: HTMLElement;
  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    host.append(this.renderer.domElement);
    this.studio = createPresentationStudio(this.scene, 1.5, 1.5, host);
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      // Fit the entire turn/orbit envelope, including at narrow aspect ratios.
      const halfVertical = THREE.MathUtils.degToRad(this.camera.fov / 2),
        halfHorizontal = Math.atan(Math.tan(halfVertical) * this.camera.aspect);
      this.radius =
        (2.7 * 1.08) / Math.sin(Math.min(halfVertical, halfHorizontal));
    });
    this.resize.observe(host);
    const el = this.renderer.domElement;
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "Physical 3 by 3 calendar cube. Drag to orbit.",
    );
    el.addEventListener("pointerdown", (e) => {
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.yaw -= (e.clientX - this.drag.x) * 0.007;
      this.pitch = Math.max(
        -1.2,
        Math.min(1.2, this.pitch + (e.clientY - this.drag.y) * 0.007),
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
  resetReferenceView(): void {
    this.yaw = 0.2;
    this.pitch = 0.18;
  }
  private clear(): void {
    this.cube?.dispose();
    this.cube = null;
    for (const r of this.resources) r.dispose();
    this.resources = [];
  }
  configure(design: Design, state: State): void {
    demand(!this.busy, "Cannot change the calendar print during a turn");
    this.clear();
    this.current = state;
    const plastic = createPlasticMaterial("#243d35", 0.65);
    this.resources.push(plastic);
    const maps = new Map<string, THREE.MeshPhysicalMaterial>();
    for (const s of design.printing) {
      const role = s.image.match(/^[0-9]$/)
        ? "day"
        : design.id === "de-a"
          ? s.slot < 3
            ? "weekday"
            : "month"
          : s.slot < 3
            ? "weekday"
            : "month";
      const key = role + ":" + s.image;
      if (maps.has(key)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, 256, 256);
      const art = stickerArt(s);
      ctx.fillStyle = art.color;
      ctx.font = `${art.weight} ${art.size}px "Counter Sans"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.image, 128, 133);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = createStickerMaterial(texture);
      this.resources.push(texture, mat);
      maps.set(key, mat);
    }
    const materials = new Map<number, THREE.Material>();
    for (const s of design.printing) {
      const role = s.image.match(/^[0-9]$/) ? "day" : s.slot < 3 ? "weekday" : "month";
      materials.set(s.id, maps.get(role + ":" + s.image)!);
    }
    this.cube = new PhysicalCubeScene(this.scene, design.printing, materials, plastic, 1,
      createPresentationGeometry());
    this.sync(state);
  }
  private sync(state: State): void {
    this.cube!.sync(state);
  }

  async animate(from: State, token: string, to: State): Promise<void> {
    demand(
      this.current &&
        sameState(this.current, from) &&
        sameState(apply(from, token), to),
      "Invalid or discontinuous calendar presentation",
    );
    demand(!this.busy, "Calendar viewer already animating");
    this.busy = true;
    const { axis, layer, turns } = moveInfo(token),
      selected = [...new Set(from.filter((s) => layer === null || s.p[axis] === layer).map((s) => s.cubie))];
    let turn: ReturnType<PhysicalCubeScene["beginTurn"]> | undefined;
    try {
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        turn = this.cube!.beginTurn(selected, axis, (turns * Math.PI) / 2);
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / this.duration);
            turn!.update(p * p * (3 - 2 * p));
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      }
      turn?.dispose();
      turn = undefined;
      this.current = to;
      this.sync(to);
    } finally {
      if (turn) {
        turn.dispose();
        this.sync(this.current!);
      }
      this.busy = false;
    }
  }
  destroy(): void {
    demand(!this.busy, "Cannot destroy an animating calendar");
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.studio.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
