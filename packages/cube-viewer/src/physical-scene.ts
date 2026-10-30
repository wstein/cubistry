import * as THREE from "three";
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
  private readonly geometries: THREE.BufferGeometry[];
  private readonly parent: THREE.Scene | THREE.Group;
  private readonly spacing: number;
  constructor(
    parent: THREE.Scene | THREE.Group,
    printed: readonly PhysicalStickerFrame[],
    materials: ReadonlyMap<number, THREE.Material>,
    plastic: THREE.Material,
    spacing: number,
    geometry: { body: THREE.BufferGeometry; sticker: THREE.BufferGeometry; stickerOffset: number },
  ) {
    demand(Number.isFinite(spacing) && spacing > 0, "Invalid viewer spacing");
    this.parent = parent;
    this.spacing = spacing;
    this.geometries = [geometry.body, geometry.sticker];
    for (const s of printed) {
      demand(materials.has(s.id), "Missing printed sticker material");
      let body = this.bodies.get(s.cubie);
      if (!body) {
        body = new THREE.Group();
        body.add(new THREE.Mesh(geometry.body, plastic));
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
      body.add(sticker);
    }
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
    for (const geometry of this.geometries) geometry.dispose();
  }
}
