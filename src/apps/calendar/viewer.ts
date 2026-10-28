import * as THREE from "three";
import { stickerArt } from "./artwork.ts";
import {
  cross,
  demand,
  apply,
  sameState,
  moveInfo,
  type V,
  type State,
  type Design,
} from "./model.ts";
const vector = (v: V) => new THREE.Vector3(...v);
const frame = (n: V, up: V) =>
  new THREE.Matrix4().makeBasis(vector(cross(up, n)), vector(up), vector(n));
/** Calendar-only 26-body viewer: one permanent texture per printed facelet. */
export class CalendarViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  private meshes = new Map<number, THREE.Group>();
  private resources: { dispose(): void }[] = [];
  private resize: ResizeObserver;
  private yaw = Math.PI / 24;
  private pitch = Math.PI / 30;
  private drag: { id: number; x: number; y: number } | null = null;
  private current: State | null = null;
  private print: State | null = null;
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
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(this.renderer.domElement);
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
        Math.sin(this.yaw) * Math.cos(this.pitch) * 12,
        Math.sin(this.pitch) * 12,
        Math.cos(this.yaw) * Math.cos(this.pitch) * 12,
      );
      this.camera.lookAt(0, 0, 0);
      this.renderer.render(this.scene, this.camera);
    });
  }
  private clear(): void {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh);
    this.meshes.clear();
    for (const r of this.resources) r.dispose();
    this.resources = [];
  }
  configure(design: Design, state: State): void {
    demand(!this.busy, "Cannot change the calendar print during a turn");
    this.clear();
    this.print = design.printing;
    this.current = state;
    const plastic = new THREE.MeshStandardMaterial({
      color: "#243d35",
      roughness: 0.65,
    });
    this.resources.push(plastic);
    const box = new THREE.BoxGeometry(0.99, 0.99, 0.99),
      plane = new THREE.PlaneGeometry(0.86, 0.86);
    this.resources.push(box, plane);
    const maps = new Map<string, THREE.MeshBasicMaterial>();
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
      ctx.font = `600 ${art.size}px "Counter Sans"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.image, 128, 133);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: texture });
      this.resources.push(texture, mat);
      maps.set(key, mat);
    }
    for (let id = 0; id < 26; id++) {
      const body = new THREE.Group();
      body.add(new THREE.Mesh(box, plastic));
      for (const s of design.printing.filter((s) => s.cubie === id)) {
        const role = s.image.match(/^[0-9]$/)
          ? "day"
          : s.slot < 3
            ? "weekday"
            : "month";
        const sticker = new THREE.Mesh(plane, maps.get(role + ":" + s.image)!);
        sticker.position.copy(vector(s.n).multiplyScalar(0.502));
        sticker.quaternion.setFromRotationMatrix(frame(s.n, s.up));
        sticker.userData.stickerId = s.id;
        body.add(sticker);
      }
      this.scene.add(body);
      this.meshes.set(id, body);
    }
    this.sync(state);
  }
  private sync(state: State): void {
    for (const [id, mesh] of this.meshes) {
      const src = this.print!.find((s) => s.cubie === id)!,
        dst = state.find((s) => s.id === src.id)!;
      mesh.position.copy(vector(dst.p).multiplyScalar(1.04));
      mesh.quaternion.setFromRotationMatrix(
        frame(dst.n, dst.up).multiply(frame(src.n, src.up).transpose()),
      );
    }
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
      selected = [...this.meshes].filter(([id]) => {
        const s = from.find((s) => s.cubie === id)!;
        return layer === null || s.p[axis] === layer;
      }),
      pivot = new THREE.Group();
    try {
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        this.scene.add(pivot);
        for (const [, mesh] of selected) pivot.add(mesh);
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / this.duration);
            pivot.rotation[(["x", "y", "z"] as const)[axis]] =
              ((turns * Math.PI) / 2) * p * p * (3 - 2 * p);
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      }
      for (const [, mesh] of selected) this.scene.add(mesh);
      this.scene.remove(pivot);
      this.current = to;
      this.sync(to);
    } finally {
      this.busy = false;
    }
  }
  destroy(): void {
    demand(!this.busy, "Cannot destroy an animating calendar");
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
