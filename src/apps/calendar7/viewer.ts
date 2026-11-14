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
  type LayerProfile,
  PhysicalCubeScene,
  PRESENTATION_PRESET,
  type FaceEdgeColors,
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
import { type HomeFace, faceEdgeFillsByHome, faceFillsByHome, homeFacesOf, schemeForHome, usesHomeTints } from "./home-tint.ts";
import { type ColorScheme, type BannerStyle, DEFAULT_SCHEME, namesGround, parseBannerStyle, schemeById, withBannerStyle } from "./schemes.ts";
import { CALENDAR7_SIZE, outerLayerWidth, bodyWidthFor, STANDARD_EXPOSURE, halfEdgeOf, layerWidthsOf, namesBodySize, unitGridTileOf } from "./geometry.ts";
import { type Layout, type NameWords, NAME_WORDS, printNameWords } from "./layout.ts";
import { drawFace, drawSticker, drawWrongCell, type FaceTile, isBannerClass, PLASTIC, tileCanvasSize, tileEdgeColors, tileRoles, type Surface, type WrongCellContext } from "./sticker-art.ts";
import type { LoadedFont } from "./fonts.ts";
import { drawFontSticker } from "./font-art.ts";
import { MoveTween } from "./tween.ts";
import { NAMES_DIRECTIONAL_SHARE, applyNamesLightRig, namesExposure } from "./names-exposure.ts";
import { NAMES_TONE_MAPPING, installNamesToneMapping } from "./names-tone.ts";
import { DEFAULT_PLASTICITY, clampPlasticity, floorOpacityFactor, plasticityGain, plasticityParts } from "./names-plasticity.ts";

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

/**
 * Layer profile of a layout (the names layout: thick outer layers of the 7x7): the widths and the body geometry of a cubie
 * of a given cell (its layer widths) with the 0.01 mm gap and the preset bevel. The standard layout has none (unit pitch).
 */
export function layerProfileFor(layout: Layout): LayerProfile | undefined {
  const widths = layerWidthsOf(layout);
  if (!widths) return undefined;
  return { widths, body: (cell) => { const [x, y, z] = namesBodySize(cell); return new RoundedBoxGeometry(x, y, z, 1, PRESENTATION_PRESET.bodyRadius); } };
}

/** Body color of the cut faces and the core: the day fill; the names layout shows it as its near-white. */
const bodyFill = (scheme: ColorScheme, layout: Layout): string => (layout === "names" ? namesGround(scheme.dayFill) : scheme.dayFill);

/** Fill of every printed tile (sticker id to color): what the exterior faces show and the cut faces next to them take (miter). */
export function faceFills(printing: Printing, scheme: ColorScheme, layout: Layout, _wrong: ReadonlySet<number> = new Set()): Map<number, string> {
  const fills = new Map<number, string>();
  for (let i = 0; i < STICKERS; i++) fills.set(i + 1, tileRoles(scheme, printing.text[i], printing.ink[i], layout).fill);
  return fills;
}

/**
 * Names layout: the colors along the edges of every tile that has a white margin or the banner (`tileEdgeColors`: the colors
 * as drawn on the tile, the unit cell, the banner with its strips and the bands). A cut face next to an edge takes the color
 * of the tile along that edge, so the red of the banner and the white of the strips and bands are continuous across the cubie
 * edges. `tiles` are the face tiles of the stickers (`unitGridTileOf`, the pose the cube is built from).
 */
export function faceEdgeFills(printing: Printing, scheme: ColorScheme, layout: Layout, tiles: readonly (FaceTile | undefined)[]): Map<number, FaceEdgeColors> {
  const edges = new Map<number, FaceEdgeColors>();
  if (layout !== "names") return edges;
  const ground = namesGround(scheme.dayFill);
  for (let i = 0; i < STICKERS; i++) {
    const tile = tiles[i];
    if (!tile) continue;
    const colors = tileEdgeColors(tileRoles(scheme, printing.text[i], printing.ink[i], layout), ground, tile);
    if (colors) edges.set(i + 1, colors);
  }
  return edges;
}

/** True when the active scheme colors the stones by their home face and the home faces are known. */
const homeActive = (scheme: ColorScheme, homes?: readonly HomeFace[]): boolean => usesHomeTints(scheme) && homes?.length === STICKERS;

/** Camera distance relative to the fit of the bounding sphere: the cube fills the picture, the sphere keeps some air. */
const ZOOM = 0.9;

/** Cache key of one sticker texture: marked cells, print, tile and (Rubik-Tint) the home face each get their own texture. */
export function textureKey(wrong: boolean, ink: string, text: string, tile: ReturnType<typeof unitGridTileOf> | undefined, home?: HomeFace): string {
  return `${wrong ? "wrong|" : ""}${ink}|${text}${tile ? `|${tile.w}x${tile.h}|${tile.band.l},${tile.band.r},${tile.band.t},${tile.band.b}` : ""}${home !== undefined ? `|home:${home}` : ""}`;
}

export class Calendar7Viewer implements StageView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly presentation = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.1, 200);
  private studio: ReturnType<typeof createPresentationStudio>;
  private readonly host: HTMLElement;
  /** Half the cube edge in scene units: the studio (floor, shadow frustum) and the camera fit follow it. */
  private extent = halfEdgeOf("standard");
  private readonly resize: ResizeObserver;
  private readonly rotation: SmartRotationBinding;
  private cube: PhysicalCubeScene | null = null;
  private resources: { dispose(): void }[] = [];
  private printing: Printing | null = null;
  private pose: Pose | null = null;
  private surface: Surface = "face";
  /** Front layout of the print this cube was built from; the names layout adds the `band` tile and the row 1 line (sticker-art.ts). */
  private layout: Layout = "standard";
  /** Plasticity of the names layout (names-plasticity.ts); the standard layout has the shared plastic. */
  private plasticity = DEFAULT_PLASTICITY;
  private plastic: THREE.MeshPhysicalMaterial | null = null;
  /** A scheme was chosen during a move on a stickerless cube: the body color waits for the end of the move. */
  private bodyStale = false;
  /** 0-based sticker indices drawn as the differing cell (best effort); empty for an exact state. */
  private wrongIds: ReadonlySet<number> = new Set();
  /** The color scheme of the labels (`setScheme`); the default scheme until one is chosen. */
  private baseScheme: ColorScheme = DEFAULT_SCHEME;
  private bannerStyle: BannerStyle = "theme";
  private scheme: ColorScheme = DEFAULT_SCHEME;
  private font: LoadedFont | null = null;
  /** One entry per distinct texture of the current build: redrawn in place when the scheme changes. */
  /** Face tile of every sticker at the pose the cube was built from (undefined without a layer profile). */
  private tiles: (FaceTile | undefined)[] = [];
  /** Home face of every sticker (`setHomePose`, the identity pose of the print); empty until set. Only the Rubik-Tint scheme reads it. */
  private homes: HomeFace[] = [];
  /** Home face of the sticker a canvas was drawn for (set only while the cube is built per home face). */
  private homeOf = new WeakMap<HTMLCanvasElement, HomeFace>();
  /** The cube was built with one texture per home face (the active scheme colors the stones by their home face). */
  private builtByHome = false;
  /** The active scheme crossed the home-tint boundary during a move: the cube is rebuilt at its end. */
  private homeStale = false;
  private art: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; text: string; ink: string; tile?: FaceTile; wrong?: boolean }[] = [];
  /** Sticker meshes of the cells that differ from the board (best effort): their screen position is published as `data-c7-wrong`. */
  private wrongMeshes: THREE.Object3D[] = [];
  /** Reused every sync: frames are rewritten in place, so a move allocates no frame objects. */
  private frames: { id: number; cubie: number; p: number[]; n: number[]; up: number[] }[] = [];
  private readonly tween = new MoveTween();
  private dirty = true;
  private destroyed = false;
  private readonly lastQuaternion = new THREE.Quaternion();
  /** The shared presentation tone mapping (read from the renderer at construction); the names layout uses the soft shoulder of names-tone.ts (a plain exposure scale up to its start). */
  private readonly standardToneMapping: THREE.ToneMapping;
  /** Marks of the pieces on the turning layer (indexed by piece id), reused for every move. */
  private readonly onLayer = new Uint8Array(CUBIES + 1);

  /** `panel` receives the rotation mode selector of the smart rotation. */
  constructor(host: HTMLElement, panel: HTMLElement) {
    this.presentation.name = "cube-presentation";
    this.scene.add(this.presentation);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configurePresentationRenderer(this.renderer);
    this.standardToneMapping = this.renderer.toneMapping;
    host.append(this.renderer.domElement);
    this.host = host;
    this.studio = createPresentationStudio(this.scene, this.extent, this.extent, host, cubePresentationRadius(this.extent));
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      fitPresentationCamera(this.camera, cubePresentationRadius(this.extent), ZOOM);
      this.dirty = true;
    });
    this.resize.observe(host);
    const el = this.renderer.domElement;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "7x7 calendar cube. Drag to rotate the cube.");
    rotatePresentation(this.presentation, 0.3, 0.22);
    this.rotation = bindSmartRotation(el, this.presentation, { sensitivity: 0.006, panel });
    fitPresentationCamera(this.camera, cubePresentationRadius(this.extent), ZOOM);
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
      this.syncExposure();
      this.renderer.render(this.scene, this.camera);
      this.publishWrong();
    }
  }

  /**
   * Plasticity of the names layout, 0 to 1 (names-plasticity.ts); the default is `DEFAULT_PLASTICITY`. The standard layout ignores it.
   * Sets specular and clearcoat of every plastic, whether the faces receive the shadow map, the strength of the cube shadow
   * (the floor shadow keeps its darkness) and the exposure that gives back what the shading takes from a flat area.
   */
  setPlasticity(value: number): void {
    this.plasticity = clampPlasticity(value);
    this.applyPlasticity();
    this.syncExposure();
    this.dirty = true;
  }

  private applyPlasticity(): void {
    const names = this.layout === "names", parts = plasticityParts(this.plasticity);
    if (names) this.presentation.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      o.receiveShadow = parts.faceShadows;
      for (const m of [].concat((o as THREE.Mesh).material as never) as THREE.Material[]) {
        if (!(m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) continue;
        (m as THREE.MeshPhysicalMaterial).specularIntensity = parts.specular;
        (m as THREE.MeshPhysicalMaterial).clearcoat = parts.clearcoat;
      }
    });
    if (names && this.plastic) { this.plastic.specularIntensity = parts.specular; this.plastic.clearcoat = parts.clearcoat; }
    // The lights' shadow strength (the preset's value times `strength`) and the floor opacity that keeps the cube shadow's darkness.
    const strength = names ? parts.shadowStrength : 1;
    this.scene.traverse((o) => {
      const light = o as THREE.DirectionalLight;
      if (light.isDirectionalLight && light.castShadow) light.shadow.intensity = ((light.userData.c7ShadowBase ??= light.shadow.intensity) as number) * strength;
    });
    const floor = this.studio.floor.material;
    floor.opacity = ((floor.userData.c7OpacityBase ??= floor.opacity) as number) * floorOpacityFactor(strength);
  }

  /** The names layout follows the face that looks at the camera (names-exposure.ts); the standard layout keeps the shared value. */
  syncExposure(): void {
    this.renderer.toneMappingExposure = this.layout === "names" ? namesExposure(this.scene, this.presentation.quaternion, this.camera) * plasticityGain(this.plasticity, this.renderer.shadowMap.enabled, NAMES_DIRECTIONAL_SHARE) : STANDARD_EXPOSURE;
  }

  /**
   * Test hook and proof for readers: the screen position of each differing cell (center and radius in CSS pixels of the
   * canvas, whether its face looks at the camera and the cosine of its viewing angle) as JSON in `data-c7-wrong`, updated with every drawn frame.
   */
  private publishWrong(): void {
    if (!this.wrongMeshes.length) return;
    this.scene.updateMatrixWorld();
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const world = new THREE.Vector3(), normal = new THREE.Vector3(), quaternion = new THREE.Quaternion(), edge = new THREE.Vector3();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const half = outerLayerWidth(CALENDAR7_SIZE) / 2;
    const cells = this.wrongMeshes.map((mesh) => {
      mesh.getWorldPosition(world);
      normal.set(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(quaternion));
      const cos = normal.dot(edge.copy(this.camera.position).sub(world).normalize());
      const facing = cos > 0;
      edge.copy(world).addScaledVector(right, half).project(this.camera);
      const center = world.clone().project(this.camera);
      const x = ((center.x + 1) / 2) * w, y = ((1 - center.y) / 2) * h;
      return { id: mesh.userData.stickerId, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round(Math.abs(((edge.x + 1) / 2) * w - x) * 10) / 10, facing, cos: Math.round(cos * 1000) / 1000 };
    });
    this.renderer.domElement.setAttribute("data-c7-wrong", JSON.stringify(cells));
  }

  setLabel(text: string): void {
    this.renderer.domElement.setAttribute("aria-label", `${text}. Drag to rotate the cube.`);
  }
  resetView(): void {
    this.rotation.reset();
  }

  /** The scheme that is drawn now. */
  get currentScheme(): ColorScheme {
    return this.baseScheme;
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
    if (next === this.baseScheme) return;
    this.baseScheme = next;
    this.redrawScheme();
  }

  /** Selects a banner shape without replacing any cube, pose, material or texture. */
  setBannerStyle(style: BannerStyle): void {
    if (this.destroyed) return;
    const next = parseBannerStyle(style);
    if (next === this.bannerStyle) return;
    this.bannerStyle = next;
    this.redrawScheme();
  }

  private redrawScheme(): void {
    this.scheme = this.layout === "names" ? withBannerStyle(this.baseScheme, this.bannerStyle) : this.baseScheme;
    if (!this.printing || !this.pose) return;
    if (homeActive(this.baseScheme, this.homes) !== Boolean(this.builtByHome)) { // the textures are shared per print, not per home face: build the cube again
      this.homeStale = this.bodyStale = true;
      this.applyBodyColor();
      return;
    }
    this.bodyStale = true;
    for (const a of this.art) {
      this.draw(a.canvas, a.text, a.ink, a.tile, a.wrong);
      a.texture.needsUpdate = true;
    }
    this.applyBodyColor();
    this.dirty = true;
  }

  private fills(printing: Printing, layout: Layout): Map<number, string> {
    return homeActive(this.baseScheme, this.homes) ? faceFillsByHome(printing, this.scheme, layout, this.homes) : faceFills(printing, this.scheme, layout, this.wrongIds);
  }

  private edgeFills(printing: Printing, layout: Layout): Map<number, FaceEdgeColors> {
    return homeActive(this.baseScheme, this.homes) ? faceEdgeFillsByHome(printing, this.scheme, layout, this.tiles, this.homes) : faceEdgeFills(printing, this.scheme, layout, this.tiles);
  }

  /**
   * The identity pose of the print (the names data): its sticker normals are the home faces the Rubik-Tint scheme colors by; null
   * when the solved pose is not known (every stone then shows the tint of the white face). Call it before `configure`; it takes
   * effect with the next build (a cube that exists keeps its textures).
   */
  setHomePose(root: Pose | null): void {
    if (!this.destroyed) this.homes = root ? homeFacesOf(root) : [];
  }

  /** Updates a stickerless cube whose body color is stale; only between moves, with the pose the cube shows. */
  private applyBodyColor(): void {
    if (!this.bodyStale || this.tween.running || !this.printing || !this.pose || this.destroyed) return;
    if (this.homeStale) {
      this.homeStale = false;
      this.configure(this.printing, this.pose, "face", this.layout, [...this.wrongIds]);
      return;
    }
    this.cube?.setBodyColor(bodyFill(this.scheme, this.layout));
    if (this.layout === "names") this.cube?.setFaceColors(this.fills(this.printing, this.layout), this.edgeFills(this.printing, this.layout));
    this.bodyStale = false;
  }

  /** Font changes redraw in place, including an active pivot, without rebuilding. */
  setFont(font: LoadedFont): void {
    if (this.destroyed || this.font === font) return;
    this.font = font;
    for (const a of this.art) { this.draw(a.canvas, a.text, a.ink, a.tile, a.wrong); a.texture.needsUpdate = true; }
    this.dirty = true;
  }

  private nameWords: NameWords = NAME_WORDS;

  private draw(canvas: HTMLCanvasElement, text: string, ink: string, tile?: FaceTile, wrong = false): void {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const scheme = schemeForHome(this.scheme, this.homeOf?.get(canvas)); // the tint of the stone's home face (Rubik-Tint only)
    if (this.font) drawFontSticker(ctx, text, ink, this.font, scheme, this.surface, undefined, this.layout, tile, this.nameWords);
    else if (this.surface === "face") drawFace(ctx, text, ink, undefined, scheme, this.layout, tile, this.nameWords);
    else drawSticker(ctx, text, ink, undefined, scheme, this.layout);
    if (wrong) drawWrongCell(ctx as unknown as WrongCellContext, canvas.width, canvas.height, tile);
  }

  /** The studio and the camera follow the cube size of the layout (the names layout is a larger cube: thick outer layers). */
  private fitExtent(layout: Layout): void {
    const extent = halfEdgeOf(layout);
    if (extent === this.extent) return;
    this.extent = extent;
    this.studio.dispose();
    this.studio = createPresentationStudio(this.scene, extent, extent, this.host, cubePresentationRadius(extent));
    fitPresentationCamera(this.camera, cubePresentationRadius(extent), ZOOM);
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
  configure(printing: Printing, pose: Pose, _surface: Surface = "face", layout: Layout = "standard", wrong: readonly number[] = []): void {
    const surface: Surface = "face";
    // A new print replaces the cube: a turn in progress ends first (its pivot belongs to the old cube).
    this.tween.cancel();
    this.layout = layout;
    this.scheme = layout === "names" ? withBannerStyle(this.baseScheme, this.bannerStyle) : this.baseScheme;
    this.fitExtent(layout);
    // The names layout: its colors are the scheme tokens (geometry.ts), so it has its own light rig (the top face is not much brighter
    // than the front: names-exposure.ts) and the soft shoulder tone mapping at its own exposure; otherwise the shared tone mapping and exposure 1.
    installNamesToneMapping();
    applyNamesLightRig(this.scene, layout === "names" ? NAMES_DIRECTIONAL_SHARE : 1);
    this.renderer.toneMapping = layout === "names" ? NAMES_TONE_MAPPING : this.standardToneMapping;
    this.syncExposure();
    this.clear();
    this.bodyStale = false;
    this.wrongIds = new Set(wrong);
    this.wrongMeshes = [];
    this.renderer.domElement.removeAttribute("data-c7-wrong");
    this.printing = printing;
    this.nameWords = layout === "names" ? printNameWords(printing) : NAME_WORDS;
    this.pose = pose;
    this.surface = surface;
    const plastic = createPlasticMaterial(PLASTIC, 0.55);
    this.plastic = plastic;
    this.resources.push(plastic);
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const materials = new Map<number, THREE.Material>();
    const byKey = new Map<string, THREE.Material>();
    const widths = layerWidthsOf(layout);
    const byHome = homeActive(this.baseScheme, this.homes);
    this.builtByHome = byHome;
    this.homeStale = false;
    this.tiles = [];
    for (let i = 0; i < STICKERS; i++) {
      // Layer profile: a tile is as large as the face of its cubie (the texture is 192 px per unit of width), so the key has the size too.
      const tile = widths ? unitGridTileOf(pose.pos.subarray(3 * i, 3 * i + 3), pose.normal.subarray(3 * i, 3 * i + 3), pose.up.subarray(3 * i, 3 * i + 3), widths) : undefined;
      this.tiles[i] = tile;
      const isWrong = this.wrongIds.has(i);
      const key = textureKey(isWrong, printing.ink[i], printing.text[i], tile, byHome ? this.homes[i] : undefined); // one surface per configure: the key needs no surface
      let material = byKey.get(key);
      if (!material) {
        const canvas = document.createElement("canvas");
        [canvas.width, canvas.height] = tileCanvasSize(tile);
        if (byHome) this.homeOf.set(canvas, this.homes[i]);
        this.draw(canvas, printing.text[i], printing.ink[i], tile, isWrong);
        const texture = new THREE.CanvasTexture(canvas);
        this.art.push({ canvas, texture, text: printing.text[i], ink: printing.ink[i], tile, wrong: isWrong });
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
    const faceColors = this.fills(printing, layout);
    this.cube = new PhysicalCubeScene(
      this.presentation,
      this.frames as unknown as readonly PhysicalStickerFrame[],
      materials,
      plastic,
      1,
      lightGeometry(layout),
      faceColors,
      // Stickerless: the body is the day background (owner decision); with stickers it is the plastic frame between them.
      { bodyColor: bodyFill(this.scheme, layout), coreColor: bodyFill(this.scheme, layout), miterCutFaces: layout === "names", faceEdgeColors: this.edgeFills(printing, layout), layers: layerProfileFor(layout) }, // names layout: cut faces colored as on a real cube (cut-faces.ts)
    );
    // A sticker is a flat sheet on its body: it needs no shadow of its own (halves the shadow pass).
    this.presentation.traverse((o) => {
      if (o.userData.stickerId !== undefined) (o as THREE.Mesh).castShadow = false;
    });
    // The scene hides the sticker meshes and gives each cubie face the label texture (the cut faces take bodyColor: the day fill when stickerless).
    this.cube.setConstruction("stickerless");
    this.applyPlasticity();
    this.cube.sync(this.frames as unknown as readonly PhysicalStickerFrame[]);
    this.presentation.traverse((o) => {
      if (o.userData.stickerId !== undefined && this.wrongIds.has(o.userData.stickerId - 1)) this.wrongMeshes.push(o);
    });
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
