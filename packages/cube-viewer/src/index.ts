import * as THREE from "three";
import {
  cross,
  demand,
  validatePrint,
  validateState,
  stateEquals,
  type Vec3,
  type PrintDefinition,
  type CubeState,
} from "@cubistry/cube-core";
import {
  stickerPoses,
  validatePresentation,
  FACE_LAYERS,
  type MovePresentation,
} from "@cubistry/cube-mechanics";
import type { LoadedAssets } from "@cubistry/cube-assets";
import {
  overriddenSticker,
  type FaceletImageOverride,
} from "./facelet-image.ts";
import { clampPitch, viewTurn } from "./orbit-input.ts";
const spacing = 0.52;
const vector = (a: Vec3) => new THREE.Vector3(...a);
const frame = (normal: Vec3, up: Vec3) =>
  new THREE.Matrix4().makeBasis(
    vector(cross(up, normal)),
    vector(up),
    vector(normal),
  );
/** Generic size-2 viewer. It cannot select counter values, solve, or advance physics. */
export const BASE_MOVE_DURATION_MS = 75;
export const MIN_ANIMATION_SPEED = BASE_MOVE_DURATION_MS / 2000;
export const MAX_ANIMATION_SPEED = 2;
export class CubeViewer {
  private animationSpeed = 1;
  setAnimationSpeed(speed: number): void {
    demand(
      Number.isFinite(speed) &&
        speed >= MIN_ANIMATION_SPEED &&
        speed <= MAX_ANIMATION_SPEED,
      "Invalid animation speed",
    );
    this.animationSpeed = speed;
  }
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(18, 1, 0.1, 100);
  private meshes: THREE.Group[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private print: PrintDefinition | null = null;
  private imageMaps = new Map<string, THREE.Texture>();
  private stickerMaterials = new Map<number, THREE.MeshStandardMaterial>();
  private faceletImageOverride: FaceletImageOverride | null = null;
  private presented: CubeState | null = null;
  private yaw = Math.PI / 18;
  private pitch = (7 * Math.PI) / 180;
  private radius = 10.5;
  private busy = false;
  private drag: {
    id: number;
    x: number;
    y: number;
    time: number;
    startX: number;
    startY: number;
  } | null = null;
  private readonly resize: ResizeObserver;
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
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(host);
    const el = this.renderer.domElement;
    el.setAttribute(
      "aria-label",
      "Physical cube viewer. Drag to orbit the camera.",
    );
    el.setAttribute("role", "img");
    el.addEventListener("pointerdown", (e) => {
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        time: e.timeStamp,
        startX: e.clientX,
        startY: e.clientY,
      };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      if (
        Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) <
        4
      )
        return;
      this.host.dispatchEvent(new Event("cube-camera-change"));
      const d = viewTurn(
        e.clientX - this.drag.x,
        e.clientY - this.drag.y,
        e.timeStamp - this.drag.time,
      );
      this.yaw -= d.yaw;
      this.pitch = clampPitch(this.pitch + d.pitch);
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        time: e.timeStamp,
        startX: this.drag.startX,
        startY: this.drag.startY,
      };
    });
    const release = () => (this.drag = null);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const previous = this.radius;
        this.radius = Math.max(6, Math.min(18, this.radius + e.deltaY * 0.005));
        if (this.radius !== previous)
          this.host.dispatchEvent(new Event("cube-camera-change"));
      },
      { passive: false },
    );
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
  resetCamera(): void {
    this.yaw = Math.PI / 18;
    this.pitch = (7 * Math.PI) / 180;
    this.radius = 10.5;
  }
  get presentedPrint(): PrintDefinition | null {
    return this.print;
  }
  /** Change screen formatting only, including during a turn; retain all geometry and physics. */
  setFaceletImageOverride(rule: FaceletImageOverride | null): void {
    demand(this.print && this.presented, "Viewer is not configured");
    if (rule)
      demand(
        this.imageMaps.has(rule.sourceAssetId) &&
          this.imageMaps.has(rule.replacementAssetId),
        "Unknown facelet image override",
      );
    this.faceletImageOverride = rule
      ? { ...rule, position: [...rule.position], normal: [...rule.normal] }
      : null;
    this.updateFaceletImage();
  }
  private updateFaceletImage(): void {
    if (!this.print || !this.presented) return;
    const selected = overriddenSticker(
      this.print,
      this.presented,
      this.faceletImageOverride,
    );
    for (const s of this.print.stickers) {
      const material = this.stickerMaterials.get(s.id)!;
      const asset =
        s.id === selected
          ? this.faceletImageOverride!.replacementAssetId
          : s.assetId;
      const map = this.imageMaps.get(asset)!;
      if (material.map !== map) {
        material.map = map;
        material.needsUpdate = true;
      }
    }
  }
  get presentedState(): CubeState | null {
    return this.presented;
  }
  get animating(): boolean {
    return this.busy;
  }
  configure(
    print: PrintDefinition,
    state: CubeState,
    assets: LoadedAssets,
  ): void {
    demand(!this.busy, "Cannot replace a print during a physical turn");
    demand(
      assets.textureOrigin === "bottom-left",
      "Unsupported texture upload origin",
    );
    validatePrint(print);
    validateState(state, print);
    for (const s of print.stickers)
      demand(
        assets.images.has(s.assetId) && assets.materials.has(s.materialId),
        "Viewer has an unresolved asset/material",
      );
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.meshes = [];
    this.materials = [];
    this.textures = [];
    this.faceletImageOverride = null;
    this.print = validatePrint(print);
    this.presented = validateState(state, this.print);
    this.stickerMaterials.clear();
    const maps = (this.imageMaps = new Map(
      [...assets.images].map(([id, image]) => {
        const t = new THREE.Texture(image);
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = false;
        t.needsUpdate = true;
        this.textures.push(t);
        return [id, t];
      }),
    ));
    const plasticDef = assets.materials.get("plastic");
    const plastic = new THREE.MeshStandardMaterial({
      color: plasticDef?.color ?? "#202329",
      roughness: plasticDef?.roughness ?? 0.45,
    });
    this.materials.push(plastic);
    for (const c of print.cubies) {
      const mesh = new THREE.Group();
      mesh.add(
        new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.99, 0.99), plastic),
      );
      for (const s of print.stickers.filter((s) => s.cubie === c.id)) {
        const materialDef = assets.materials.get(s.materialId)!;
        const material = new THREE.MeshStandardMaterial({
          map: maps.get(s.assetId),
          color: materialDef.color,
          roughness: materialDef.roughness,
        });
        this.materials.push(material);
        this.stickerMaterials.set(s.id, material);
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(0.87, 0.87),
          material,
        );
        plane.position.copy(vector(s.normal).multiplyScalar(0.501));
        plane.quaternion.setFromRotationMatrix(frame(s.normal, s.up));
        plane.userData.stickerId = s.id;
        mesh.add(plane);
      }
      this.scene.add(mesh);
      this.meshes[c.id] = mesh;
    }
    this.sync(state);
    this.updateFaceletImage();
  }
  private sync(state: CubeState): void {
    const print = this.print!;
    const poses = stickerPoses(print, state);
    for (const c of state.cubies) {
      const source = print.stickers.find((s) => s.cubie === c.id)!,
        target = poses.find((s) => s.id === source.id)!;
      const matrix = frame(target.n, target.up).multiply(
        frame(source.normal, source.up).transpose(),
      );
      this.meshes[c.id].position.copy(
        vector(c.position).multiplyScalar(spacing),
      );
      this.meshes[c.id].quaternion.setFromRotationMatrix(matrix);
    }
  }
  async animate(presentation: MovePresentation): Promise<void> {
    demand(this.print && this.presented, "Viewer is not configured");
    demand(!this.busy, "Viewer already animating");
    presentation = validatePresentation(presentation, this.print);
    demand(
      stateEquals(this.presented, presentation.from),
      "Viewer state is out of sync with authoritative controller",
    );
    this.busy = true;
    try {
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const [axis, layer, dir] = FACE_LAYERS[presentation.move.face],
          angle = (presentation.move.turns * dir * Math.PI) / 2;
        const selected = presentation.from.cubies.filter(
          (c) => c.position[axis] === layer,
        );
        const pivot = new THREE.Group();
        this.scene.add(pivot);
        for (const c of selected) pivot.add(this.meshes[c.id]);
        let previous = performance.now(),
          progress = 0;
        await new Promise<void>((resolve) => {
          const tick = (now: number) => {
            progress = Math.min(
              1,
              progress +
                ((now - previous) * this.animationSpeed) /
                  BASE_MOVE_DURATION_MS,
            );
            previous = now;
            const t = progress;
            pivot.rotation[(["x", "y", "z"] as const)[axis]] =
              angle * (t * t * (3 - 2 * t));
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        for (const c of selected) this.scene.add(this.meshes[c.id]);
        this.scene.remove(pivot);
      }
      this.presented = presentation.to;
      this.sync(presentation.to);
      this.updateFaceletImage();
    } finally {
      this.busy = false;
    }
  }
  destroy(): void {
    demand(!this.busy, "Cannot destroy an animating viewer");
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    for (const mesh of this.meshes)
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
