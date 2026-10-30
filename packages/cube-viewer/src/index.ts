import * as THREE from "three";
import {
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
import { animateTimedProgress, type MotionTimingSource } from "./motion-timing.ts";
export type { MotionTiming, MotionTimingSource } from "./motion-timing.ts";
import { PhysicalCubeScene } from "./physical-scene.ts";
import {
  createPresentationGeometry, createPlasticMaterial, createStickerMaterial,
  configurePresentationRenderer, addPresentationLighting,
} from "./presentation-preset.ts";
export {
  PRESENTATION_PRESET, createPresentationGeometry, createPlasticMaterial,
  createStickerMaterial, configurePresentationRenderer, addPresentationLighting,
} from "./presentation-preset.ts";
export { PhysicalCubeScene, stickerFrame, type PhysicalStickerFrame } from "./physical-scene.ts";
const spacing = 0.52;
/** Physical-state viewer: no target selection, solver or mechanics ownership. */
export const BASE_MOVE_DURATION_MS = 75;
export const MIN_ANIMATION_SPEED = BASE_MOVE_DURATION_MS / 2000;
export const MAX_ANIMATION_SPEED = BASE_MOVE_DURATION_MS / 10;
/** A caller-owned viewport can render several independent physical cubes. */
export interface SharedCubeViewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly position: Vec3;
  readonly resetCamera?: () => void;
}
export class CubeViewer {
  private animationSpeed = 1;
  private durationUnit: "move" | "quarter-turn" = "move";
  setAnimationSpeed(
    speed: number,
    durationUnit: "move" | "quarter-turn" = "move",
  ): void {
    demand(
      Number.isFinite(speed) &&
        speed >= MIN_ANIMATION_SPEED &&
        speed <= MAX_ANIMATION_SPEED,
      "Invalid animation speed",
    );
    demand(
      ["move", "quarter-turn"].includes(durationUnit),
      "Invalid animation duration unit",
    );
    this.animationSpeed = speed;
    this.durationUnit = durationUnit;
  }
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene | THREE.Group;
  readonly camera: THREE.PerspectiveCamera;
  private cube: PhysicalCubeScene | null = null;
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
  private destroyed = false;
  private drag: {
    id: number;
    x: number;
    y: number;
    time: number;
    startX: number;
    startY: number;
  } | null = null;
  private readonly resize: ResizeObserver | null = null;
  private readonly shared: boolean;
  private readonly resetSharedCamera?: () => void;
  readonly host: HTMLElement;
  constructor(host: HTMLElement, viewport?: SharedCubeViewport) {
    this.host = host;
    this.shared = Boolean(viewport);
    this.scene = viewport ? new THREE.Group() : new THREE.Scene();
    this.camera =
      viewport?.camera ?? new THREE.PerspectiveCamera(18, 1, 0.1, 100);
    this.resetSharedCamera = viewport?.resetCamera;
    if (viewport) {
      demand(
        viewport.position.length === 3 &&
          viewport.position.every(Number.isFinite),
        "Invalid cube placement",
      );
      this.renderer = viewport.renderer;
      this.scene.position.set(...viewport.position);
      viewport.scene.add(this.scene);
      return;
    }
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    host.append(this.renderer.domElement);
    addPresentationLighting(this.scene);
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
    if (this.shared) {
      this.resetSharedCamera?.();
      return;
    }
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
    this.cube?.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
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
    const plastic = createPlasticMaterial(plasticDef?.color, plasticDef?.roughness);
    this.materials.push(plastic);
    for (const s of print.stickers) {
      const materialDef = assets.materials.get(s.materialId)!;
      const material = createStickerMaterial(maps.get(s.assetId)!, materialDef.color, materialDef.roughness);
      this.materials.push(material);
      this.stickerMaterials.set(s.id, material);
    }
    this.cube = new PhysicalCubeScene(this.scene,
      print.stickers.map((s) => ({ ...s, p: print.cubies.find((c) => c.id === s.cubie)!.position, n: s.normal })),
      this.stickerMaterials, plastic, spacing,
      createPresentationGeometry());
    this.sync(state);
    this.updateFaceletImage();
  }
  private sync(state: CubeState): void {
    this.cube!.sync(stickerPoses(this.print!, state));
  }

  async animate(presentation: MovePresentation, timing?: MotionTimingSource): Promise<void> {
    demand(this.print && this.presented, "Viewer is not configured");
    demand(!this.busy, "Viewer already animating");
    presentation = validatePresentation(presentation, this.print);
    demand(
      stateEquals(this.presented, presentation.from),
      "Viewer state is out of sync with authoritative controller",
    );
    this.busy = true;
    const moveDuration = () =>
      BASE_MOVE_DURATION_MS / this.animationSpeed *
      (this.durationUnit === "quarter-turn" ? Math.abs(presentation.move.turns) : 1);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let turn: ReturnType<PhysicalCubeScene["beginTurn"]> | undefined;
    try {
      if (!reducedMotion) {
        const [axis, layer, dir] = FACE_LAYERS[presentation.move.face],
          angle = (presentation.move.turns * dir * Math.PI) / 2;
        const selected = presentation.from.cubies.filter(
          (c) => c.position[axis] === layer,
        );
        turn = this.cube!.beginTurn(selected.map((c) => c.id), axis, angle);
        if (timing) {
          await animateTimedProgress(timing, moveDuration,
            (t) => turn!.update(t * t * (3 - 2 * t)));
        } else {
        let previous = performance.now(),
          progress = 0;
        await new Promise<void>((resolve) => {
          const tick = (frameAt: number) => {
            const now = Math.max(frameAt, performance.now());
            progress = Math.min(
              1,
              progress +
                Math.max(0, now - previous) / moveDuration(),
            );
            previous = now;
            const t = progress;
            turn!.update(t * t * (3 - 2 * t));
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        }
        turn.dispose();
        turn = undefined;
      }
      if (reducedMotion && timing?.())
        await animateTimedProgress(timing, moveDuration, () => {});
      this.presented = presentation.to;
      this.sync(presentation.to);
      this.updateFaceletImage();
      // Timed endpoint and the controller/UI commit must share the next paint.
      if (timing && !this.shared) this.renderer.render(this.scene, this.camera);
    } finally {
      // A rejected presentation must not strand meshes beneath a turn pivot.
      if (turn) {
        turn.dispose();
        this.sync(this.presented!);
      }
      this.busy = false;
    }
  }
  destroy(): void {
    if (this.destroyed) return;
    demand(!this.busy, "Cannot destroy an animating viewer");
    this.destroyed = true;
    if (!this.shared) this.renderer.setAnimationLoop(null);
    this.resize?.disconnect();
    this.scene.removeFromParent();
    this.cube?.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    if (!this.shared) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }
}
