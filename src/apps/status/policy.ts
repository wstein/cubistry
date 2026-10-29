import {
  demand,
  deepFreeze,
  rotate,
  type CubeState,
  type LegalMove,
  type Rotation,
} from "@cubistry/cube-core";
import {
  applyMoves,
  matchesTarget,
  parseMove,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
import rawCatalog from "./policy-catalog.json" with { type: "json" };
import {
  CATEGORY_IDS,
  FRONT,
  displayTarget,
  frontSnapshot,
  type Snapshot,
  type StatusDefinition,
} from "./definition.ts";
const catalog = rawCatalog as unknown as {
  refs: Rotation[];
  poses: Rotation[];
  moves: string[];
  transitions: number[][];
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const mul = (a: Rotation, b: Rotation): Rotation =>
  b.map((v) => rotate(v, a)) as unknown as Rotation;
const transpose = (m: Rotation): Rotation =>
  [0, 1, 2].map((i) => m.map((v) => v[i])) as unknown as Rotation;
/** Zero-based rank used by the immutable reviewed four-corner certificate. */
export function rankFour(q: readonly number[]): number {
  demand(q.length === 4, "Four tracked corners required");
  const available = [0, 1, 2, 3, 4, 5, 6, 7];
  let p = 0,
    t = 0;
  q.forEach((v, i) => {
    demand(Number.isInteger(v) && v >= 0 && v < 24, "Invalid catalog pose");
    const digit = available.indexOf(Math.floor(v / 3));
    demand(digit >= 0, "Repeated tracked position");
    p = p * (8 - i) + digit;
    available.splice(digit, 1);
    t = t * 3 + (v % 3);
  });
  return p * 81 + t;
}
export interface QualityPlan {
  readonly moves: readonly LegalMove[];
  readonly state: CubeState;
  readonly bound: 6 | 7;
  readonly preserved: readonly number[];
}
/** App-specific finite witness consumer. Shared mechanics alone advance complete physical state. */
export class QualityPolicy {
  private readonly distances: Uint8Array;
  private readonly definition: StatusDefinition;
  private readonly goals: ReadonlyMap<number, number>;
  constructor(definition: StatusDefinition, distances: Uint8Array) {
    demand(
      distances.length === 136080 &&
        distances[66258] === 0 &&
        distances.every((d) => d <= 7),
      "Malformed quality distance certificate",
    );
    this.definition = definition;
    this.distances = distances.slice();
    const goals = new Map<number, number>();
    for (const sticker of definition.print.stickers) {
      const slot = CATEGORY_IDS.findIndex((c) =>
        sticker.assetId.startsWith(`quality-${c}-`),
      );
      demand(slot >= 0, "Unlabeled quality sticker");
      const qs = catalog.poses
        .map((p, q) => ({
          q,
          orientation: mul(p, transpose(catalog.refs[sticker.cubie])),
        }))
        .filter(
          ({ q, orientation }) =>
            same(
              definition.print.cubies[Math.floor(q / 3)].position,
              FRONT[slot],
            ) &&
            same(rotate(sticker.normal, orientation), [0, 0, 1]) &&
            same(rotate(sticker.up, orientation), [0, 1, 0]),
        );
      demand(qs.length === 1, "Quality sticker has no unique upright target");
      goals.set(sticker.id, qs[0].q);
    }
    this.goals = goals;
  }
  static async load(
    definition: StatusDefinition,
    basePath = "/",
    signal?: AbortSignal,
  ): Promise<QualityPolicy> {
    const catalogBytes = new TextEncoder().encode(
      JSON.stringify(rawCatalog, null, 2) + "\n",
    );
    demand(
      (await sha256(catalogBytes)) === definition.policy.catalogSHA256,
      "Quality catalog integrity check failed",
    );
    const response = await fetch(
      deploymentBasePath(basePath) + definition.policy.certificateURL.slice(1),
      {
        redirect: "error",
        credentials: "same-origin",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      },
    );
    demand(
      response.ok && response.body,
      "Quality certificate could not be loaded",
    );
    const reader = response.body.getReader(),
      parts: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        demand(size <= 136080, "Quality certificate exceeds limit");
        parts.push(value);
      }
    } catch (e) {
      await reader.cancel();
      throw e;
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const p of parts) {
      bytes.set(p, at);
      at += p.length;
    }
    demand(
      (await sha256(bytes)) === definition.policy.certificateSHA256,
      "Quality certificate integrity check failed",
    );
    return new QualityPolicy(definition, bytes);
  }
  plan(source: CubeState, requested: Snapshot): QualityPlan {
    const print = this.definition.print,
      target = displayTarget(requested),
      front = frontSnapshot(print, source),
      poses = stickerPoses(print, source);
    const changed = front
      ? front.map((s, i) => s !== requested[i]).filter(Boolean).length
      : 4;
    const preserve = front && changed === 1;
    const preserved: number[] = [];
    const choices = FRONT.map((position, i) => {
      if (preserve && front![i] === requested[i]) {
        const sticker = poses.find(
          (s) => same(s.p, position) && same(s.n, [0, 0, 1]),
        )!;
        preserved.push(sticker.id);
        return [print.stickers.find((s) => s.id === sticker.id)!];
      }
      return print.stickers.filter(
        (s) => s.assetId === `quality-${CATEGORY_IDS[i]}-${requested[i]}`,
      );
    });
    const bodyPose = new Map(
      source.cubies.map((b) => {
        const q = catalog.poses.findIndex((p) =>
          same(p, mul(b.orientation, catalog.refs[b.id])),
        );
        demand(q >= 0, "Committed body is outside reviewed catalog");
        return [b.id, q];
      }),
    );
    let best: { q: number[]; distance: number } | undefined;
    for (const a of choices[0])
      for (const b of choices[1])
        for (const c of choices[2])
          for (const d of choices[3]) {
            // A fixed target-twist offset commutes with every catalog action.
            // Normalize each chosen sticker's upright goal to canonical twist zero;
            // this changes certificate coordinates, never the complete physical state.
            const q = [a, b, c, d].map((s) => {
              const actual = bodyPose.get(s.cubie)!,
                goal = this.goals.get(s.id)!;
              return (
                actual - (actual % 3) + (((actual % 3) - (goal % 3) + 3) % 3)
              );
            });
            const distance = this.distances[rankFour(q)];
            if (!best || distance < best.distance) best = { q, distance };
          }
    demand(best, "No quality target copies");
    const bound = preserve ? 6 : 7;
    demand(
      best.distance <= bound,
      "Quality route exceeds reviewed policy bound",
    );
    const words: string[] = [];
    let q = best.q;
    while (this.distances[rankFour(q)] > 0) {
      const distance = this.distances[rankFour(q)],
        m = catalog.moves.findIndex(
          (_, m) =>
            this.distances[rankFour(q.map((v) => catalog.transitions[v][m]))] +
              1 ===
            distance,
        );
      demand(
        m >= 0 && words.length < bound,
        "Quality certificate has no bounded descending route",
      );
      words.push(catalog.moves[m]);
      q = q.map((v) => catalog.transitions[v][m]);
    }
    const moves = words.map(parseMove),
      state = applyMoves(source, moves);
    demand(
      matchesTarget(print, state, target),
      "Quality route failed shared physical endpoint validation",
    );
    const after = stickerPoses(print, state);
    for (const id of preserved) {
      const old = poses.find((s) => s.id === id)!,
        next = after.find((s) => s.id === id)!;
      demand(
        same(old.p, next.p) && same(old.n, next.n) && same(old.up, next.up),
        "Quality route changed a preserved front sticker",
      );
    }
    return deepFreeze({ moves, state, bound, preserved });
  }
}
