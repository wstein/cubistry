import * as THREE from "three";
import type { Construction } from "./appearance.ts";
import { cross, demand, type Vec3 } from "@cubistry/cube-core";

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

/** Size-neutral scene adapter. Callers validate prints, state and legal moves.
 * Textures/materials and animation deadlines stay caller-owned. */
export class PhysicalCubeScene {
  private readonly bodies = new Map<number, THREE.Group>();
  private readonly references = new Map<number, { id: number; inverse: THREE.Matrix4 }>();
  private readonly shells = new Map<number, { mesh: THREE.Mesh; stickerless: THREE.Material[] }>();
  private readonly faceMaterials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[];
  private readonly parent: THREE.Scene | THREE.Group;
  private readonly spacing: number;
  private readonly plastic: THREE.Material;
  constructor(
    parent: THREE.Scene | THREE.Group,
    printed: readonly PhysicalStickerFrame[],
    materials: ReadonlyMap<number, THREE.Material>,
    plastic: THREE.Material,
    spacing: number,
    geometry: { body: THREE.BufferGeometry; core?: THREE.BufferGeometry; sticker: THREE.BufferGeometry; stickerOffset: number },
    faceColors: ReadonlyMap<number, string> = new Map(),
  ) {
    demand(Number.isFinite(spacing) && spacing > 0, "Invalid viewer spacing");
    this.parent = parent;
    this.plastic = plastic;
    this.spacing = spacing;
    this.geometries = [geometry.body, geometry.sticker, ...(geometry.core ? [geometry.core] : [])];
    for (const s of printed) {
      demand(materials.has(s.id), "Missing printed sticker material");
      let body = this.bodies.get(s.cubie);
      if (!body) {
        body = new THREE.Group();
        const shell = new THREE.Mesh(geometry.body, plastic);
        shell.castShadow = shell.receiveShadow = true;
        body.add(shell);
        // Box/RoundedBox geometry groups are +X,-X,+Y,-Y,+Z,-Z. These
        // materials belong to immutable LOCAL source faces, never world axes.
        const faceMaterials: THREE.Material[] = Array(6).fill(plastic);
        const sourceIds = Array(6).fill(null);
        for (const face of printed.filter((face) => face.cubie === s.cubie)) {
          const axis = face.n.findIndex(component => component !== 0);
          const index = axis * 2 + (face.n[axis] < 0 ? 1 : 0);
          const material = plastic instanceof THREE.MeshStandardMaterial
            ? plastic.clone() : new THREE.MeshPhysicalMaterial();
          const art = materials.get(face.id);
          const fallback = art instanceof THREE.MeshStandardMaterial ? `#${art.color.getHexString()}` : "#fffdf6";
          material.color.set(faceColors.get(face.id) ?? fallback);
          faceMaterials[index] = material; sourceIds[index] = face.id;
          this.faceMaterials.push(material);
        }
        shell.userData.sourceFaceStickerIds = sourceIds;
        this.shells.set(s.cubie, { mesh: shell, stickerless: faceMaterials });
        if (geometry.core) {
          // Seal internal seams/junctions without squaring the approved exterior
          // bevels. Exterior sides retreat beneath the rounded shell; internal
          // cut faces meet at half the physical pitch, as in CubeAssembler.
          // A 0.0005-unit internal overlap avoids floating-point cracks at
          // exact four-piece junctions during interpolated rotations.
          const min = [-0.5005, -0.5005, -0.5005], max = [0.5005, 0.5005, 0.5005];
          for (const face of printed.filter((face) => face.cubie === s.cubie))
            for (let axis = 0; axis < 3; axis++) {
              if (face.n[axis] === 1) max[axis] = 0.43;
              if (face.n[axis] === -1) min[axis] = -0.43;
            }
          const core = new THREE.Mesh(geometry.core, plastic);
          core.userData.plasticCore = true;
          core.castShadow = core.receiveShadow = true;
          core.scale.set(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
          core.position.set((max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2);
          body.add(core);
        }
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
      sticker.userData.stickerId = s.id;
      sticker.castShadow = sticker.receiveShadow = true;
      body.add(sticker);
    }
  }
  /** Materials change in place, including during a turn; source frames stay fixed. */
  setConstruction(construction: Construction): void {
    demand(["stickered", "stickerless"].includes(construction), "Invalid cube construction");
    for (const { mesh, stickerless } of this.shells.values())
      mesh.material = construction === "stickerless" ? stickerless : this.plastic;
  }
  sync(poses: readonly PhysicalStickerFrame[]): void {
    const byId = new Map(poses.map((s) => [s.id, s]));
    for (const [id, body] of this.bodies) {
      const ref = this.references.get(id)!;
      const target = byId.get(ref.id);
      demand(target && target.cubie === id, "Missing physical body frame");
      body.position.set(...target.p).multiplyScalar(this.spacing);
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
    for (const body of this.bodies.values()) body.removeFromParent();
    this.bodies.clear();
    this.references.clear();
    this.shells.clear();
    for (const material of this.faceMaterials) material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
  }
}
