// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * English 7x7 calendar cube, 3D view (research candidate, not certified).
 *
 * Not a new renderer: it is the same composition as the 3x3 calendar viewer (src/apps/calendar/viewer.ts), built from
 * the exported, size-neutral parts of @cubistry/cube-viewer (PhysicalCubeScene, the presentation geometry, plastic and
 * sticker materials, studio lighting, camera fitting, smart rotation). Only `CubeViewer` itself is limited to the
 * 2x2 print/state contract (@cubistry/cube-core validates size 2 only), so it is not used here.
 *
 * The scene holds the 218 surface bodies with 294 stickers of `engine.ts` and draws the sticker texts from the
 * printing (text and ink). A pose of the engine maps one to one to a sticker frame: position, normal, up.
 * One engine move turns the bodies of one layer (or all bodies, for a whole-cube rotation) about its axis; the right
 * handed quarter turn of the engine is the right handed rotation of the scene (x to y to z, front = +z).
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  bindSmartRotation,
  configurePresentationRenderer,
  createPlasticMaterial,
  createPresentationGeometry,
  createPresentationStudio,
  createStickerMaterial,
  cubePresentationRadius,
  fitPresentationCamera,
  PhysicalCubeScene,
  PRESENTATION_PRESET,
  type PhysicalStickerFrame,
  rotatePresentation,
  type SmartRotationBinding,
} from "@cubistry/cube-viewer";
import { type Block, expand } from "./blocks.ts";
import {
  applyMoves,
  CUBIES,
  type Pose,
  type Printing,
  STICKERS,
} from "./engine.ts";
import type { StageView } from "./player.ts";
import { type ColorScheme, DEFAULT_SCHEME, namesGround, schemeById } from "./schemes.ts";
import { bodyWidthFor, exposureFor } from "./geometry.ts";
import type { Layout } from "./layout.ts";
import { drawFace, drawSticker, PLASTIC, tileRoles, type Surface, TEXTURE } from "./sticker-art.ts";
import type { LoadedFont } from "./fonts.ts";
import { drawFontSticker } from "./font-art.ts";
import { MoveTween } from "./tween.ts";

/**
 * The presentation geometry with a lighter body: 218 bodies at the preset's three bevel segments are 588 triangles each
 * (128,184 in all); one segment keeps the rounded edge profile of the preset at a fifth of the cost.
 */
function lightGeometry(layout: Layout) {
  const geometry = createPresentationGeometry();
  const p = PRESENTATION_PRESET;
  const width = bodyWidthFor(layout); // standard: the preset's .99; names: pitch minus 0.01 mm (geometry.ts)
  geometry.body.dispose();
  return { ...geometry, body: new RoundedBoxGeometry(width, width, width, 1, p.bodyRadius) };
}

/** Body color of the cut faces and the core: the day fill; the names layout shows it as its near-white. */
const bodyFill = (scheme: ColorScheme, layout: Layout): string => (layout === "names" ? namesGround(scheme.dayFill) : scheme.dayFill);

/** Fill of every printed tile (sticker id to color): what the exterior faces show and the cut faces next to them take (miter). */
function faceFills(printing: Printing, scheme: ColorScheme, layout: Layout): Map<number, string> {
  const fills = new Map<number, string>();
  for (let i = 0; i < STICKERS; i++) fills.set(i + 1, tileRoles(scheme, printing.text[i], printing.ink[i], layout).fill);
  return fills;
}

/** Camera distance relative to the fit of the bounding sphere: the cube fills the picture, the sphere keeps some air. */
const ZOOM = 0.9;

export class Calendar7Viewer implements StageView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly presentation = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.1, 200);
  private readonly studio: ReturnType<typeof createPresentationStudio>;
  private readonly resize: ResizeObserver;
  private readonly rotation: SmartRotationBinding;
  private cube: PhysicalCubeScene | null = null;
  private resources: { dispose(): void }[] = [];
  private printing: Printing | null = null;
  private pose: Pose | null = null;
  private surface: Surface = "face";
  /** Front layout of the print this cube was built from; the names layout adds the `band` tile and the row 1 line (sticker-art.ts). */
  private layout: Layout = "standard";
  /** A scheme was chosen during a move on a stickerless cube: the body color waits for the end of the move. */
  private bodyStale = false;
  /** The color scheme of the labels (`setScheme`); the default scheme until one is chosen. */
  private scheme: ColorScheme = DEFAULT_SCHEME;
  private font: LoadedFont | null = null;
  /** One entry per distinct texture of the current build: redrawn in place when the scheme changes. */
  private art: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; text: string; ink: string }[] = [];
  /** Reused every sync: frames are rewritten in place, so a move allocates no frame objects. */
  private frames: { id: number; cubie: number; p: number[]; n: number[]; up: number[] }[] = [];
  private readonly tween = new MoveTween();
  private dirty = true;
  private destroyed = false;
  private readonly lastQuaternion = new THREE.Quaternion();
  /** Marks of the pieces on the turning layer (indexed by piece id), reused for every move. */
  private readonly onLayer = new Uint8Array(CUBIES + 1);

  /** `panel` receives the rotation mode selector of the smart rotation. */
  constructor(host: HTMLElement, panel: HTMLElement) {
    this.presentation.name = "cube-presentation";
    this.scene.add(this.presentation);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    host.append(this.renderer.domElement);
    const extent = 3.5;
    this.studio = createPresentationStudio(this.scene, extent, extent, host, cubePresentationRadius(extent));
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      fitPresentationCamera(this.camera, cubePresentationRadius(extent), ZOOM);
      this.dirty = true;
    });
    this.resize.observe(host);
    const el = this.renderer.domElement;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "7x7 calendar cube. Drag to rotate the cube.");
    rotatePresentation(this.presentation, 0.3, 0.22);
    this.rotation = bindSmartRotation(el, this.presentation, { sensitivity: 0.006, panel });
    fitPresentationCamera(this.camera, cubePresentationRadius(extent), ZOOM);
    this.lastQuaternion.copy(this.presentation.quaternion);
    // On-demand rendering: an idle cube costs only the rotation step, never a 500-mesh draw.
    this.renderer.setAnimationLoop((now: number) => this.frame(now));
  }

  private frame(now: number): void {
    if (this.destroyed) return;
    this.rotation.step();
    if (!this.presentation.quaternion.equals(this.lastQuaternion)) {
      this.lastQuaternion.copy(this.presentation.quaternion);
      this.dirty = true;
    }
    if (this.tween.tick(now)) this.dirty = true;
    if (this.dirty) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }
  }

  setLabel(text: string): void {
    this.renderer.domElement.setAttribute("aria-label", `${text}. Drag to rotate the cube.`);
  }
  resetView(): void {
    this.rotation.reset();
  }

  /** The scheme that is drawn now. */
  get currentScheme(): ColorScheme {
    return this.scheme;
  }

  /**
   * Chooses the color scheme by id (an unknown id or null gives the default scheme; never throws). The textures of the
   * current cube are redrawn in place (no new canvas, texture or material, nothing to dispose). The cut faces and core
   * take the day fill in place; during a move that color update waits until its endpoint.
   * A scheme chosen before `configure` is used by it. The same scheme again does nothing.
   */
  setScheme(id: string | null | undefined): void {
    if (this.destroyed) return;
    const next = schemeById(id);
    if (next === this.scheme) return;
    this.scheme = next;
    if (!this.printing || !this.pose) return;
    this.bodyStale = true;
    for (const a of this.art) {
      this.draw(a.canvas, a.text, a.ink);
      a.texture.needsUpdate = true;
    }
    this.applyBodyColor();
    this.dirty = true;
  }

  /** Updates a stickerless cube whose body color is stale; only between moves, with the pose the cube shows. */
  private applyBodyColor(): void {
    if (!this.bodyStale || this.tween.running || !this.printing || !this.pose || this.destroyed) return;
    this.cube?.setBodyColor(bodyFill(this.scheme, this.layout));
    if (this.layout === "names") this.cube?.setFaceColors(faceFills(this.printing, this.scheme, this.layout));
    this.bodyStale = false;
  }

  /** Font changes redraw in place, including an active pivot, without rebuilding. */
  setFont(font: LoadedFont): void {
    if (this.destroyed || this.font === font) return;
    this.font = font;
    for (const a of this.art) { this.draw(a.canvas, a.text, a.ink); a.texture.needsUpdate = true; }
    this.dirty = true;
  }

  private draw(canvas: HTMLCanvasElement, text: string, ink: string): void {
    if (this.font) { drawFontSticker(canvas.getContext("2d") as CanvasRenderingContext2D, text, ink, this.font, this.scheme, this.surface, undefined, this.layout); return; }
    const art = this.surface === "face" ? drawFace : drawSticker;
    art(canvas.getContext("2d") as CanvasRenderingContext2D, text, ink, undefined, this.scheme, this.layout);
  }

  private clear(): void {
    this.art = [];
    this.cube?.dispose();
    this.cube = null;
    for (const r of this.resources) r.dispose();
    this.resources = [];
  }

  /**
   * Builds the stickerless Calendar7 cube. The legacy surface argument is accepted but cannot restore stickers.
   * This rendering policy does not change the state schema or any other viewer.
   */
  configure(printing: Printing, pose: Pose, _surface: Surface = "face", layout: Layout = "standard"): void {
    const surface: Surface = "face";
    // A new print replaces the cube: a turn in progress ends first (its pivot belongs to the old cube).
    this.tween.cancel();
    this.layout = layout;
    this.renderer.toneMappingExposure = exposureFor(layout); // 1 (the shared value) except in the names layout
    this.clear();
    this.bodyStale = false;
    this.printing = printing;
    this.pose = pose;
    this.surface = surface;
    const plastic = createPlasticMaterial(PLASTIC, 0.55);
    this.resources.push(plastic);
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const materials = new Map<number, THREE.Material>();
    const byKey = new Map<string, THREE.Material>();
    for (let i = 0; i < STICKERS; i++) {
      const key = `${printing.ink[i]}|${printing.text[i]}`; // one surface per configure: the key needs no surface
      let material = byKey.get(key);
      if (!material) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = TEXTURE;
        this.draw(canvas, printing.text[i], printing.ink[i]);
        const texture = new THREE.CanvasTexture(canvas);
        this.art.push({ canvas, texture, text: printing.text[i], ink: printing.ink[i] });
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = anisotropy;
        material = createStickerMaterial(texture);
        this.resources.push(texture, material);
        byKey.set(key, material);
      }
      materials.set(i + 1, material);
    }
    this.frames = Array.from({ length: STICKERS }, (_, i) => ({
      id: i + 1,
      cubie: printing.piece[i],
      p: [0, 0, 0],
      n: [0, 0, 0],
      up: [0, 0, 0],
    }));
    this.writeFrames(pose);
    const faceColors = faceFills(printing, this.scheme, layout);
    this.cube = new PhysicalCubeScene(
      this.presentation,
      this.frames as unknown as readonly PhysicalStickerFrame[],
      materials,
      plastic,
      1,
      lightGeometry(layout),
      faceColors,
      // Stickerless: the body is the day background (owner decision); with stickers it is the plastic frame between them.
      { bodyColor: bodyFill(this.scheme, layout), coreColor: bodyFill(this.scheme, layout), miterCutFaces: layout === "names" }, // names layout: cut faces colored as on a real cube (cut-faces.ts)
    );
    // A sticker is a flat sheet on its body: it needs no shadow of its own (halves the shadow pass).
    this.presentation.traverse((o) => {
      if (o.userData.stickerId !== undefined) (o as THREE.Mesh).castShadow = false;
    });
    // The scene hides the sticker meshes and gives each cubie face the label texture (the cut faces take bodyColor: the day fill when stickerless).
    this.cube.setConstruction("stickerless");
    this.cube.sync(this.frames as unknown as readonly PhysicalStickerFrame[]);
    this.dirty = true;
  }

  private writeFrames(pose: Pose): void {
    for (let i = 0; i < STICKERS; i++) {
      const f = this.frames[i];
      const o = 3 * i;
      for (let k = 0; k < 3; k++) {
        f.p[k] = pose.pos[o + k];
        f.n[k] = pose.normal[o + k];
        f.up[k] = pose.up[o + k];
      }
    }
  }

  show(pose: Pose): void {
    if (this.destroyed || !this.cube) return;
    this.tween.cancel();
    this.sync(pose);
  }

  private sync(pose: Pose): void {
    this.pose = pose;
    this.writeFrames(pose);
    this.cube?.sync(this.frames as unknown as readonly PhysicalStickerFrame[]);
    this.dirty = true;
  }

  /** One block is ONE tween: every layer of the block turns together about the axis by the same angle. */
  turn(block: Block, before: Pose, ms: number, ease?: (p: number) => number): Promise<void> {
    if (this.destroyed || !this.cube) return Promise.resolve();
    this.tween.cancel();
    const { axis, lo, hi, angle: q } = block;
    const whole = block.kind === "rotation";
    const pieces: number[] = [];
    this.onLayer.fill(0);
    for (let i = 0; i < STICKERS; i++) {
      const at = before.pos[3 * i + axis];
      // A block is a contiguous range of layers (a middle-slice block includes layer 0), so a range test selects exactly its layers.
      if (!whole && (at < lo || at > hi)) continue;
      const piece = (this.printing as Printing).piece[i];
      if (!this.onLayer[piece]) {
        this.onLayer[piece] = 1;
        pieces.push(piece);
      }
    }
    const turn = this.cube.beginTurn(pieces, axis, (q * Math.PI) / 2);
    // A middle-slice block expands to the rotation plus the inverse outer turns: the state of the slab turn animated above.
    const after = applyMoves(before, expand([block]));
    this.dirty = true;
    return this.tween.begin(
      ms,
      (progress) => turn.update(progress),
      (completed) => {
        // Release the pivot and put every body at its final frame in the same tick: no frame shows the gap.
        turn.dispose();
        if (completed) this.sync(after);
        this.applyBodyColor();
      },
      performance.now(),
      ease,
    );
  }

  destroy(): void {
    if (this.destroyed) return;
    this.tween.cancel();
    this.destroyed = true;
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.rotation.dispose();
    this.studio.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
