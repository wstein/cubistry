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
  bindSmartRotation, type SmartRotationBinding, rotatePresentation, cubePresentationRadius, fitPresentationCamera,
  PhysicalCubeScene, createPresentationGeometry, createPlasticMaterial,
  createStickerMaterial, configurePresentationRenderer, createPresentationStudio,
  DEFAULT_APPEARANCE, validateAppearance, installAppearanceControls, type ViewerAppearance,
} from "@cubistry/cube-viewer";
/** Existing 26-body size-3 viewer; Calendar glyphs are the default artwork. */
export class CalendarViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly presentation = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  private appearance: ViewerAppearance = DEFAULT_APPEARANCE;
  private plastic?: THREE.MeshPhysicalMaterial;
  private appearanceControls: ReturnType<typeof installAppearanceControls>;
  private cube: PhysicalCubeScene | null = null;
  private artworkTextures = new Map<number, THREE.CanvasTexture>();
  private studio: ReturnType<typeof createPresentationStudio>;
  private resources: { dispose(): void }[] = [];
  private resize: ResizeObserver;
  private radius = 14.1;
  private rotation?: SmartRotationBinding;
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
    this.presentation.name = "cube-presentation";
    this.scene.add(this.presentation);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    host.append(this.renderer.domElement);
    this.studio = createPresentationStudio(this.scene, 1.5, 1.5, host, cubePresentationRadius(1.5));
    this.appearanceControls = installAppearanceControls(host, (value) => this.setAppearance(value));
    this.appearanceControls.setDefaultColor("#243d35");
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.radius = fitPresentationCamera(this.camera, cubePresentationRadius(1.5));
    });
    this.resize.observe(host);
    const el = this.renderer.domElement;
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "Physical 3 by 3 calendar cube. Drag to rotate the cube.",
    );
    rotatePresentation(this.presentation, .2, .18);
    this.rotation = bindSmartRotation(el, this.presentation, { sensitivity: .007, panel: this.appearanceControls.panel });
    this.radius = fitPresentationCamera(this.camera, cubePresentationRadius(1.5));
    this.renderer.setAnimationLoop(() => {
      this.rotation?.step();
      this.renderer.render(this.scene, this.camera);
    });
  }
  setAppearance(value: ViewerAppearance): void {
    this.appearance = validateAppearance(value);
    this.plastic?.color.set(this.appearance.frameColor ?? "#243d35");
    this.cube?.setConstruction(this.appearance.construction);
  }
  resetReferenceView(): void {
    this.rotation?.reset();
  }
  private clear(): void {
    this.cube?.dispose();
    this.cube = null;
    for (const r of this.resources) r.dispose();
    this.resources = [];
    this.artworkTextures.clear();
  }
  configure(design: Pick<Design, "id" | "printing">, state: State, artwork?: ReadonlyMap<number, HTMLCanvasElement>): void {
    demand(!this.busy, "Cannot change the calendar print during a turn");
    if (artwork) demand(artwork.size === design.printing.length && design.printing.every(s => artwork.has(s.id)), "Incomplete picture artwork");
    this.clear();
    this.current = state;
    const plastic = createPlasticMaterial("#243d35", 0.65);
    this.resources.push(plastic);
    this.plastic = plastic;
    let materials = new Map<number, THREE.Material>();
    if (artwork) {
      for (const s of design.printing) {
        const texture = new THREE.CanvasTexture(artwork.get(s.id)!);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = createStickerMaterial(texture);
        this.artworkTextures.set(s.id, texture);
        this.resources.push(texture, material);
        materials.set(s.id, material);
      }
    } else {
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
    materials = new Map<number, THREE.Material>();
    for (const s of design.printing) {
      const role = s.image.match(/^[0-9]$/) ? "day" : s.slot < 3 ? "weekday" : "month";
      materials.set(s.id, maps.get(role + ":" + s.image)!);
    }
    }
    this.cube = new PhysicalCubeScene(this.presentation, design.printing, materials, plastic, 1,
      createPresentationGeometry(), new Map(design.printing.map(s => [s.id, "#fffdf6"])));
    this.setAppearance(this.appearance);
    this.sync(state);
  }
  /** Refresh pixels only; texture objects, source frames, and active layer pivots survive. */
  updateArtwork(artwork: ReadonlyMap<number, HTMLCanvasElement>): void {
    demand(this.artworkTextures.size > 0 && artwork.size === this.artworkTextures.size &&
      [...this.artworkTextures.keys()].every(id => artwork.has(id)), "Incomplete picture artwork");
    for (const [id, texture] of this.artworkTextures) {
      texture.image = artwork.get(id)!;
      texture.needsUpdate = true;
    }
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
    this.rotation?.dispose();
    this.studio.dispose();
    this.appearanceControls.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
