// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from "three";
import { bodyArtworkKey, orientBodyArtwork, planarBodyUv, sourceFaceIndex } from "./body-artwork.ts";
import type { Construction } from "./appearance.ts";
import { cross, demand, dot, type Vec3 } from "@cubistry/cube-core";
import { layerCenters, layerEdge, layerIndexOf, type LayerWidths, validateLayerWidths } from "./layer-widths.ts";
import { PROJECTED_FACES, STICKER_SHARE, faceOfNormal, stickerWindow, type FaceKey, type StickerWindow } from "./projected-uv.ts";
import { type CutEdgeColor, cutFaceEdges, type EdgeProfile, type EdgeStop, cutPatternKey, cutPatternTexture, type FaceUvAxes, faceUvAxes, flatCutColor } from "./cut-faces.ts";

/** Render-only projection of canonical sticker frames; never an authoritative state. */
export interface PhysicalStickerFrame {
  readonly id: number;
  readonly cubie: number;
  readonly p: Vec3;
  readonly n: Vec3;
  readonly up: Vec3;
}
export const stickerFrame = (normal: Vec3, up: Vec3): THREE.Matrix4 =>
  new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...cross(up, normal)),
    new THREE.Vector3(...up),
    new THREE.Vector3(...normal),
  );

/** Core ball diameter as a share of the full cube edge length. */
export const CORE_DIAMETER_RATIO = 0.8;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
/** Neutral dark gray; the visible core of a stickerless cube. */
export const DEFAULT_CORE_COLOR = "#3a3d42";
/** An edge of an exterior face in its texture orientation (the sticker's right and up). */
export type FaceEdgeName = "left" | "right" | "top" | "bottom";
/** Colors of single edges of an exterior face that differ from its face color (a printed margin along that edge). */
export type FaceEdgeColors = Partial<Record<FaceEdgeName, string | readonly EdgeStop[]>>;
export interface StickerlessBodyOptions {
  /** Explicit color for every inward cut face. Absent: follow the bordering face. */
  readonly bodyColor?: string | null;
  /** Stickerless core color. Absent: DEFAULT_CORE_COLOR. */
  readonly coreColor?: string;
  /**
   * Colors the cut faces as a real cube is made: a cut face next to an exterior face carries the color of that face (the
   * `faceColors` of the scene), split diagonally where it borders two exterior faces of different colors; a cut face that
   * touches no exterior face keeps `bodyColor`. Default off: every cut face is `bodyColor` (or follows its bordering face).
   * `setFaceColors` follows a change of the face colors.
   */
  readonly miterCutFaces?: boolean;
  /**
   * Miter mode: colors of single edges of exterior faces (sticker id to edge colors) that differ from the face color, e.g. a
   * white strip along one edge of a red face. A cut face takes the color of the edge it borders, not of the whole face.
   */
  readonly faceEdgeColors?: ReadonlyMap<number, FaceEdgeColors>;
}
/**
 * Layer-width profile (opt-in): the cubies are boxes of the layer widths of their position instead of unit cubes. The
 * absent profile is the historical unit pitch, byte for byte. `body` builds the body geometry of a cubie of the given cell
 * size (the layer widths of its position); the caller owns the gap and the bevel. The scene disposes what `body` returns.
 * The positions of the frames stay layer coordinates of the mechanics (unit steps, centered).
 */
export interface LayerProfile {
  readonly widths: LayerWidths;
  readonly body: (cell: readonly [number, number, number]) => THREE.BufferGeometry;
}
/**
 * Projected picture mode: the whole image of every face. One texture per face (caller-owned, origin bottom-left as the asset
 * loader delivers); the scene maps it per sticker with a texture transform (see projected-uv.ts), no per-sticker bitmaps.
 */
export interface PictureProjection {
  readonly faces: ReadonlyMap<FaceKey, THREE.Texture>;
}
/** Share of a cell that the UV range of a body face covers (the rounded box is `bodyWidth` of the pitch wide). */
const BODY_SHARE = 0.99;
export interface PhysicalSceneOptions extends StickerlessBodyOptions {
  readonly layers?: LayerProfile;
}
/** Size-neutral scene adapter. Callers validate prints, state and legal moves.
 * Textures/materials and animation deadlines stay caller-owned. */
export class PhysicalCubeScene {
  private readonly bodies = new Map<number, THREE.Group>();
  private readonly references = new Map<number, { id: number; inverse: THREE.Matrix4 }>();
  private readonly shells = new Map<number, { mesh: THREE.Mesh; stickerless: THREE.Material[]; base: THREE.BufferGeometry; key: string; extent: Vec3; image: ReadonlySet<number> }>();
  /** Projected stickerless look: body geometries with planar UV on the image faces, by body variant key (see body-artwork.ts). */
  private readonly planarBodies = new Map<string, THREE.BufferGeometry>();
  private construction: Construction = "stickered";
  private projecting = false;
  private readonly artwork: { id: number; surface: THREE.MeshStandardMaterial; source: THREE.MeshStandardMaterial; fallback: string; projected?: boolean }[] = [];
  private readonly stickers: THREE.Mesh[] = [];
  /** Projected picture mode: every sticker with its tile material, normal and cubie position; the clones this scene made. */
  private readonly stickerInfo = new Map<number, { mesh: THREE.Mesh; base: THREE.Material; n: Vec3; up: Vec3; p: Vec3 }>();
  private projectionTextures: THREE.Texture[] = [];
  private projectionMaterials: THREE.Material[] = [];
  private axisCoordinates: number[][] = [[], [], []];
  private readonly bodyVariants = new Map<string, THREE.BufferGeometry>();
  /** Layer profile: one body geometry per cell size. */
  private readonly cellBodies = new Map<string, THREE.BufferGeometry>();
  private readonly cores: THREE.Mesh[] = [];
  /** Stickerless core: visible only in seams; never follows a frame color. */
  private readonly coreMaterial: THREE.MeshStandardMaterial;
  private readonly cutMaterials = new Map<string, THREE.Material>();
  private bodyColor: string | null;
  /** Miter mode (`StickerlessBodyOptions.miterCutFaces`): face colors by sticker id, the cut slots and the pooled materials. */
  private readonly miter: boolean;
  private readonly faceColorOf = new Map<number, string>();
  private readonly edgeColorOf = new Map<number, FaceEdgeColors>();
  private uvAxes: readonly FaceUvAxes[] = [];
  private readonly miterSlots: { materials: THREE.Material[]; index: number; ids: (number | null)[]; edges: (FaceEdgeName | null)[]; dirs: (readonly number[] | null)[] }[] = [];
  private readonly miterMaterials = new Map<string, THREE.Material>();
  private readonly miterTextures: THREE.Texture[] = [];
  private readonly faceMaterials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[];
  private readonly parent: THREE.Scene | THREE.Group;
  private readonly spacing: number;
  /** Layer profile: the center of every layer along an axis (scene units, before spacing); null: unit pitch. */
  private readonly layers: { widths: LayerWidths; centers: number[]; body: LayerProfile["body"] } | null;
  private readonly plastic: THREE.Material;
  constructor(
    parent: THREE.Scene | THREE.Group,
    printed: readonly PhysicalStickerFrame[],
    materials: ReadonlyMap<number, THREE.Material>,
    plastic: THREE.Material,
    spacing: number,
    geometry: { body: THREE.BufferGeometry; core?: THREE.BufferGeometry; sticker: THREE.BufferGeometry; stickerOffset: number },
    faceColors: ReadonlyMap<number, string> = new Map(),
    options: PhysicalSceneOptions = {},
  ) {
    demand(Number.isFinite(spacing) && spacing > 0, "Invalid viewer spacing");
    this.parent = parent;
    this.plastic = plastic;
    const coreColor = options.coreColor ?? DEFAULT_CORE_COLOR;
    demand(HEX_COLOR.test(coreColor), "Invalid core color");
    demand(options.bodyColor == null || HEX_COLOR.test(options.bodyColor), "Invalid body color");
    this.bodyColor = options.bodyColor ?? null;
    this.miter = options.miterCutFaces === true;
    if (this.miter) this.uvAxes = faceUvAxes(geometry.body);
    for (const [id, color] of faceColors) this.faceColorOf.set(id, color);
    for (const [id, edges] of options.faceEdgeColors ?? []) this.edgeColorOf.set(id, edges);
    // The core belongs to construction, never a selected frame color.
    this.coreMaterial = this.neutralPlastic(coreColor) as THREE.MeshStandardMaterial;
    this.spacing = spacing;
    if (options.layers) validateLayerWidths(options.layers.widths);
    this.layers = options.layers ? { widths: options.layers.widths, centers: layerCenters(options.layers.widths), body: options.layers.body } : null;
    this.axisCoordinates = [0, 1, 2].map((axis) => [...new Set(printed.map((s) => s.p[axis]))].sort((a, b) => a - b));
    this.geometries = [geometry.body, geometry.sticker, ...(geometry.core ? [geometry.core] : [])];
    for (const s of printed) {
      demand(materials.has(s.id), "Missing printed sticker material");
      let body = this.bodies.get(s.cubie);
      if (!body) {
        body = new THREE.Group();
        const sourceFaces = printed.filter(face => face.cubie === s.cubie);
        // Layer profile: the cell (layer widths of the position at construction, in the local axes of the body) decides the box.
        const cell = this.cellAt(s.p);
        const cellKey = cell ? cell.join(",") : "";
        let base = geometry.body;
        if (cell) {
          let sized = this.cellBodies.get(cellKey);
          if (!sized) { sized = this.layers!.body(cell); this.cellBodies.set(cellKey, sized); this.geometries.push(sized); }
          base = sized;
        }
        const key = cellKey + "|" + bodyArtworkKey(sourceFaces);
        let bodyGeometry = this.bodyVariants.get(key);
        if (!bodyGeometry) {
          bodyGeometry = orientBodyArtwork(base, sourceFaces);
          this.bodyVariants.set(key, bodyGeometry);
          if (bodyGeometry !== base) this.geometries.push(bodyGeometry);
        }
        const shell = new THREE.Mesh(bodyGeometry, plastic);
        shell.castShadow = shell.receiveShadow = true;
        body.add(shell);
        // Box/RoundedBox geometry groups are +X,-X,+Y,-Y,+Z,-Z. These
        // materials belong to immutable LOCAL source faces, never world axes.
        const faceMaterials: THREE.Material[] = Array(6).fill(null);
        const sourceIds = Array(6).fill(null);
        const exterior: { index: number; color: string }[] = [];
        for (const face of sourceFaces) {
          const index = sourceFaceIndex(face.n);
          const material = plastic instanceof THREE.MeshStandardMaterial
            ? plastic.clone() : new THREE.MeshPhysicalMaterial();
          const art = materials.get(face.id);
          const fallback = art instanceof THREE.MeshStandardMaterial ? `#${art.color.getHexString()}` : "#fffdf6";
          const color = faceColors.get(face.id) ?? fallback;
          material.color.set(color);
          if (art instanceof THREE.MeshStandardMaterial)
            this.artwork.push({ id: face.id, surface: material, source: art, fallback: color });
          faceMaterials[index] = material; sourceIds[index] = face.id;
          exterior.push({ index, color });
          this.faceMaterials.push(material);
        }
        // Inward-facing cut faces take the color of a bordering exterior face
        // (or the explicit body color), like real stickerless cubes.
        for (let index = 0; index < 6; index++) {
          if (faceMaterials[index]) continue;
          if (!this.miter) { faceMaterials[index] = this.cutMaterial(index, exterior); continue; }
          for (const face of sourceFaces) if (!this.faceColorOf.has(face.id)) this.faceColorOf.set(face.id, exterior.find(e => e.index === sourceFaceIndex(face.n))!.color);
          // The texture edge of each exterior face that borders this cut face (its direction from the face center: the cut face's normal).
          const edges: (FaceEdgeName | null)[] = Array(6).fill(null), dirs: (readonly number[] | null)[] = Array(6).fill(null);
          const t3 = [0, 0, 0]; t3[index >> 1] = (index & 1) === 0 ? 1 : -1; const toward = t3 as unknown as Vec3;
          for (const face of sourceFaces) {
            const right = cross(face.up, face.n), d = (v: Vec3) => dot(v, toward);
            const k = sourceFaceIndex(face.n);
            edges[k] = d(face.up) === 1 ? "top" : d(face.up) === -1 ? "bottom" : d(right) === 1 ? "right" : d(right) === -1 ? "left" : null;
            dirs[k] = edges[k] === "left" || edges[k] === "right" ? face.up : right; // the stops of a side edge run up, of a top or bottom edge to the right
          }
          this.miterSlots.push({ materials: faceMaterials, index, ids: sourceIds, edges, dirs });
          faceMaterials[index] = this.miterMaterial(index, sourceIds, edges, dirs, exterior);
        }
        shell.userData.sourceFaceStickerIds = sourceIds;
        this.shells.set(s.cubie, { mesh: shell, stickerless: faceMaterials, base: bodyGeometry, key,
          extent: (cell ?? [1, 1, 1]).map(c => BODY_SHARE * c) as unknown as Vec3,
          image: new Set(sourceFaces.map(face => sourceFaceIndex(face.n))) });
        this.bodies.set(s.cubie, body);
        this.references.set(s.cubie, {
          id: s.id,
          inverse: stickerFrame(s.n, s.up).transpose(),
        });
        parent.add(body);
      }
      const sticker = new THREE.Mesh(geometry.sticker, materials.get(s.id));
      sticker.position.set(...s.n).multiplyScalar(geometry.stickerOffset);
      sticker.quaternion.setFromRotationMatrix(stickerFrame(s.n, s.up));
      const cell = this.cellAt(s.p);
      if (cell) {
        // The sticker lies on the face of its box and covers the face in proportion to the cell: right and up extents.
        const axisOf = (v: Vec3) => v.findIndex(c => c !== 0);
        const normalAxis = axisOf(s.n);
        sticker.position.set(...s.n).multiplyScalar(geometry.stickerOffset - 0.5 + cell[normalAxis] / 2);
        sticker.scale.set(cell[axisOf(cross(s.up, s.n))], cell[axisOf(s.up)], 1);
      }
      sticker.userData.stickerId = s.id;
      this.stickerInfo.set(s.id, { mesh: sticker, base: materials.get(s.id)!, n: s.n, up: s.up, p: s.p });
      sticker.castShadow = sticker.receiveShadow = true;
      body.add(sticker);
      this.stickers.push(sticker);
    }
    if (geometry.core && printed.length) {
      // One static core ball at the cube center, as in real cubes: it never
      // follows layer turns. Unit-pitch cubies span +-0.5 around their centers.
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const s of printed) for (let axis = 0; axis < 3; axis++) {
        lo[axis] = Math.min(lo[axis], s.p[axis] * spacing); hi[axis] = Math.max(hi[axis], s.p[axis] * spacing);
      }
      // Layer profile: the core is centered in the cube whose edge is the sum of the layer widths.
      const half = this.layers ? layerEdge(this.layers.widths) * spacing / 2 : Math.max(...hi.map((v, axis) => (v - lo[axis]) / 2)) + 0.5;
      const core = new THREE.Mesh(geometry.core, plastic);
      core.userData.plasticCore = true;
      core.castShadow = core.receiveShadow = true;
      core.scale.setScalar(half * CORE_DIAMETER_RATIO); // radius = ratio * edge / 2 = ratio * half edge
      core.position.set(...(this.layers ? [0, 0, 0] : hi.map((v, axis) => (v + lo[axis]) / 2)) as [number, number, number]);
      parent.add(core);
      this.cores.push(core);
    }
    this.refreshArtwork();
  }
  /** Layer profile: the box (layer widths of the position `p`) of a cubie; null without a profile. */
  private cellAt(p: Vec3): [number, number, number] | null {
    const layers = this.layers;
    return layers ? p.map(c => layers.widths[layerIndexOf(layers.widths.length, c)]) as [number, number, number] : null;
  }
  /** Layer profile: the scene position (before spacing) of the cubie center at the layer coordinates `p`. */
  private worldAt(p: Vec3): Vec3 {
    const layers = this.layers;
    return layers ? p.map(c => layers.centers[layerIndexOf(layers.widths.length, c)]) as unknown as Vec3 : p;
  }
  /** Live screen-only formatting follows its existing source material, including
   * image overrides during turns. Texture ownership remains with the caller. */
  refreshArtwork(): void {
    for (const { surface, source, fallback, projected } of this.artwork) {
      if (projected) continue; // a projected body face keeps its own windowed image
      if (surface.map !== source.map) { surface.map = source.map; surface.needsUpdate = true; }
      if (source.map) surface.color.copy(source.color);
      else surface.color.set(fallback);
    }
  }
  /**
   * Projected picture mode on (a projection) or off (null: the caller's per-sticker tile materials are restored exactly).
   * Stickers show their window of their face's image; in the stickerless construction the exterior body faces carry the same
   * window. The image is the full face extent, so it reaches the sticker edge on the outer border; only the gaps, bevels and
   * seams cut it away and the sticker outline comes from the sticker geometry (the window is the sticker's own UV, no mask).
   * Projected stickers and body faces are white so that the image shows undimmed.
   */
  setPictureProjection(projection: PictureProjection | null): void {
    this.clearProjection();
    this.projecting = projection !== null;
    if (!projection) { this.updateBodyUv(); this.refreshArtwork(); return; }
    const n = this.axisCoordinates[0].length;
    demand(this.axisCoordinates.every((c) => c.length === n), "Picture projection needs a cube");
    const widths = this.layers?.widths ?? Array<number>(n).fill(1);
    demand(widths.length === n, "Layer widths do not fit the cube");
    const windowOf = (info: { n: Vec3; up: Vec3; p: Vec3 }, share: number): { face: FaceKey; win: StickerWindow } => {
      const face = faceOfNormal(info.n);
      demand(PROJECTED_FACES[face].up.every((c, i) => c === info.up[i]), "Picture projection needs the cube model's face frame");
      const texture = projection.faces.get(face);
      demand(texture !== undefined, `Picture projection needs the face image of ${face}`);
      const index = info.p.map((c, axis) => this.axisCoordinates[axis].indexOf(c)) as unknown as Vec3;
      return { face, win: stickerWindow(widths, share, face, index) };
    };
    for (const info of this.stickerInfo.values()) {
      const { face, win } = windowOf(info, STICKER_SHARE);
      const material = info.base.clone() as THREE.MeshStandardMaterial;
      material.map = this.windowedTexture(projection.faces.get(face)!, win);
      material.color.set("#ffffff");
      this.projectionMaterials.push(material);
      info.mesh.material = material;
    }
    for (const entry of this.artwork) {
      const info = this.stickerInfo.get(entry.id)!;
      const { face, win } = windowOf(info, BODY_SHARE);
      entry.surface.map = this.windowedTexture(projection.faces.get(face)!, win);
      entry.surface.color.set("#ffffff");
      entry.surface.needsUpdate = true;
      entry.projected = true;
    }
    this.updateBodyUv();
  }
  /**
   * Stickerless and projected: the image faces of the bodies take planar UV (the linear window of the projection is exact);
   * every other look keeps Three's arc-length UV of the body.
   */
  private updateBodyUv(): void {
    const planar = this.projecting && this.construction === "stickerless";
    for (const shell of this.shells.values()) {
      if (!planar) { shell.mesh.geometry = shell.base; continue; }
      const key = `${shell.key}|${shell.extent.join(",")}|${[...shell.image].sort().join("")}`; // the image faces differ between cubies of one orientation key
      let geometry = this.planarBodies.get(key);
      if (!geometry) { geometry = planarBodyUv(shell.base, shell.extent, shell.image); this.planarBodies.set(key, geometry); this.geometries.push(geometry); }
      shell.mesh.geometry = geometry;
    }
  }
  /** A clone of a face texture with the window as texture transform; the clone shares the face's image (one GPU upload). */
  private windowedTexture(face: THREE.Texture, win: StickerWindow): THREE.Texture {
    const texture = face.clone();
    texture.offset.set(win.offsetU, win.offsetV);
    texture.repeat.set(win.scaleU, win.scaleV);
    // The shared image was uploaded with the face texture; a clone must not bump the shared source version.
    texture.version = Math.max(1, face.version);
    this.projectionTextures.push(texture);
    return texture;
  }
  private clearProjection(): void {
    for (const info of this.stickerInfo.values()) info.mesh.material = info.base;
    for (const entry of this.artwork) if (entry.projected) { entry.projected = false; entry.surface.map = null; entry.surface.needsUpdate = true; }
    for (const material of this.projectionMaterials) material.dispose();
    for (const texture of this.projectionTextures) texture.dispose();
    this.projectionMaterials = []; this.projectionTextures = [];
  }
  /** Update only this scene's cut faces and core; printed materials and geometry stay owned in place.
   * Only a scene built with an explicit body color has one cut color to replace: without it the cut
   * faces follow their bordering exterior faces, so this does nothing. */
  setBodyColor(color: string): void {
    if (this.bodies.size === 0 || this.bodyColor === null) return;
    demand(HEX_COLOR.test(color), "Invalid body color");
    this.coreMaterial.color.set(color);
    const materials = [...this.cutMaterials.values()];
    this.cutMaterials.clear();
    for (const material of materials) {
      (material as THREE.MeshStandardMaterial).color.set(color);
      this.cutMaterials.set(color, material);
    }
    this.bodyColor = color;
  }
  /** Miter mode: the exterior colors changed (sticker id to color); every cut face takes the new colors in place. */
  setFaceColors(colors: ReadonlyMap<number, string>, edgeColors?: ReadonlyMap<number, FaceEdgeColors>): void {
    if (!this.miter) return;
    for (const color of colors.values()) demand(HEX_COLOR.test(color), "Invalid face color");
    for (const edges of edgeColors?.values() ?? []) for (const spec of Object.values(edges)) for (const color of typeof spec === "string" ? [spec] : spec.map(stop => stop.color)) demand(HEX_COLOR.test(color), "Invalid face edge color");
    for (const [id, color] of colors) this.faceColorOf.set(id, color);
    if (edgeColors) { this.edgeColorOf.clear(); for (const [id, edges] of edgeColors) this.edgeColorOf.set(id, edges); }
    for (const slot of this.miterSlots) slot.materials[slot.index] = this.miterMaterial(slot.index, slot.ids, slot.edges, slot.dirs, []);
  }
  /** The material of cut face `index` of a cubie whose exterior faces carry the sticker ids `ids` (null: a cut face). */
  private miterMaterial(index: number, ids: readonly (number | null)[], edgeNames: readonly (FaceEdgeName | null)[], dirs: readonly (readonly number[] | null)[], exterior: readonly { index: number; color: string }[]): THREE.Material {
    const specs = ids.map((id, k) => (id !== null && edgeNames[k] ? this.edgeColorOf.get(id)?.[edgeNames[k]!] : undefined));
    const profiles: (EdgeProfile | null)[] = specs.map((spec, k) => (spec && typeof spec !== "string" && dirs[k] ? { stops: spec, dir: dirs[k]! } : null));
    const edges = cutFaceEdges(index, ids.map((id, k) => (id === null ? null : (typeof specs[k] === "string" ? specs[k] as string : specs[k] ? (specs[k] as readonly EdgeStop[])[0].color : undefined) ?? this.faceColorOf.get(id) ?? null)), this.uvAxes, profiles);
    if (edges.length === 0) return this.cutMaterial(index, exterior);
    const flat = flatCutColor(edges);
    const key = flat ?? cutPatternKey(edges);
    let material = this.miterMaterials.get(key);
    if (!material) {
      material = this.neutralPlastic(flat ?? "#ffffff");
      if (flat === null) {
        const texture = cutPatternTexture(edges as readonly CutEdgeColor[]);
        (material as THREE.MeshStandardMaterial).map = texture;
        this.miterTextures.push(texture);
      }
      this.miterMaterials.set(key, material);
    }
    return material;
  }
  /** Stickerless core color; takes effect immediately, including during a turn. */
  setCoreColor(color: string): void {
    demand(HEX_COLOR.test(color), "Invalid core color");
    this.coreMaterial.color.set(color);
  }
  private neutralPlastic(color: string): THREE.Material {
    const material = this.plastic instanceof THREE.MeshStandardMaterial
      ? this.plastic.clone() : new THREE.MeshPhysicalMaterial();
    (material as THREE.MeshStandardMaterial).color.set(color);
    (material as THREE.MeshStandardMaterial).map = null;
    this.faceMaterials.push(material);
    return material;
  }
  /** Bounded: one shared material per distinct color, never per cubie face. */
  private cutMaterial(index: number, exterior: readonly { index: number; color: string }[]): THREE.Material {
    let color = this.bodyColor;
    if (!color) {
      // Prefer an exterior face that borders this cut face (different axis);
      // fall back to the only remaining exterior face, e.g. a center's back.
      const border = exterior.find(face => (face.index >> 1) !== (index >> 1)) ?? exterior[0];
      color = border?.color ?? DEFAULT_CORE_COLOR;
    }
    let material = this.cutMaterials.get(color);
    if (!material) { material = this.neutralPlastic(color); this.cutMaterials.set(color, material); }
    return material;
  }
  /** Materials change in place, including during a turn; source frames stay fixed. */
  setConstruction(construction: Construction): void {
    demand(["stickered", "stickerless"].includes(construction), "Invalid cube construction");
    this.construction = construction;
    this.updateBodyUv();
    for (const { mesh, stickerless } of this.shells.values())
      mesh.material = construction === "stickerless" ? stickerless : this.plastic;
    for (const core of this.cores)
      core.material = construction === "stickerless" ? this.coreMaterial : this.plastic;
    for (const sticker of this.stickers) sticker.visible = construction === "stickered";
    this.refreshArtwork();
  }
  sync(poses: readonly PhysicalStickerFrame[]): void {
    const byId = new Map(poses.map((s) => [s.id, s]));
    for (const [id, body] of this.bodies) {
      const ref = this.references.get(id)!;
      const target = byId.get(ref.id);
      demand(target && target.cubie === id, "Missing physical body frame");
      body.position.set(...this.worldAt(target.p)).multiplyScalar(this.spacing);
      body.quaternion.setFromRotationMatrix(
        stickerFrame(target.n, target.up).multiply(ref.inverse),
      );
    }
  }
  /** Legal layer selection and angle come from the caller's existing mechanics. */
  beginTurn(cubies: readonly number[], axis: number, angle: number) {
    demand(Number.isInteger(axis) && axis >= 0 && axis < 3 && Number.isFinite(angle),
      "Invalid viewer turn");
    demand(cubies.every((id) => this.bodies.has(id)), "Unknown turning body");
    const pivot = new THREE.Group();
    this.parent.add(pivot);
    for (const id of cubies) pivot.add(this.bodies.get(id)!);
    return {
      update: (progress: number) => {
        pivot.rotation[(["x", "y", "z"] as const)[axis]] = angle * progress;
      },
      dispose: () => {
        for (const id of cubies) this.parent.add(this.bodies.get(id)!);
        pivot.removeFromParent();
      },
    };
  }
  dispose(): void {
    for (const core of this.cores) core.removeFromParent();
    for (const body of this.bodies.values()) body.removeFromParent();
    this.bodies.clear();
    this.references.clear();
    this.shells.clear();
    this.cores.length = 0;
    this.stickers.length = 0;
    this.clearProjection();
    this.stickerInfo.clear();
    this.artwork.length = 0;
    this.bodyVariants.clear();
    this.cellBodies.clear();
    this.miterSlots.length = 0;
    this.miterMaterials.clear();
    for (const texture of this.miterTextures) texture.dispose();
    this.miterTextures.length = 0;
    for (const material of this.faceMaterials) material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
  }
}
