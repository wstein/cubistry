import type { CubeState, DisplayTarget, PrintDefinition, Vec3 } from "@cubistry/cube-core";
import { rotate } from "@cubistry/cube-core";
import { CUBE_ROTATIONS, quarterIndex, slotKey } from "./geometry.ts";
import { appearanceSha256, type AppearanceMap } from "./map.ts";
import { checkPinnedMap, lookOf, orderOfTurns, type AppearancePolicy } from "./policy.ts";
import type { Turn } from "./tiles.ts";

/**
 * One constrained facelet slot of a goal. It names the reference asset and the quarter-turn index of its
 * up vector (`up`, counterclockwise against the face reference up), not a class: the class level comes from
 * the map and the policy when the goal is evaluated, so one goal serves identity, visual and twin judging.
 */
export interface GoalSlot {
  /** Canonical `x,y,z|nx,ny,nz` key: cubie position (doubled integer coordinates) and outward normal. */
  readonly slot: string;
  readonly asset: string;
  readonly up: Turn;
  /** `exact`: the picture must be upright as in the goal. `equivalent`: turns that look alike are accepted. */
  readonly matching: "exact" | "equivalent";
  /** Optional physical sticker id. In identity mode the very same sticker must sit there, upright as in the goal. */
  readonly sticker?: number;
}

/**
 * `cubistry.goal@2`: facelet-level appearance goal. `full` constrains every slot of the print (picture
 * cubes, owner decision D5); `display` constrains a subset (date, time, counter). Absent slots are free.
 * Whether the whole cube may be turned is a property of the judging policy, not of the goal.
 */
export interface AppearanceGoal {
  readonly schema: "cubistry.goal";
  readonly version: 2;
  readonly printId: string;
  /** Hash of the appearance map this goal was made for; `null` for identity goals. */
  readonly appearanceSha256: string | null;
  readonly scope: "full" | "display";
  readonly slots: readonly GoalSlot[];
}

interface Poses {
  readonly id: number;
  readonly p: Vec3;
  readonly n: Vec3;
  readonly up: Vec3;
}

/** Sticker poses of a state, computed like `stickerPoses` in cube-mechanics (kept local so this package stays pure). */
function posesOf(print: PrintDefinition, state: CubeState): Poses[] {
  if (state.printId !== print.id) throw new Error("State/print mismatch");
  return print.stickers.map((s) => {
    const c = state.cubies.find((v) => v.id === s.cubie);
    if (!c) throw new Error(`State lacks cubie ${s.cubie}`);
    return { id: s.id, p: c.position, n: rotate(s.normal, c.orientation), up: rotate(s.up, c.orientation) };
  });
}

/** Slot keys of every facelet of a print (the same set in every state). */
export function printSlots(print: PrintDefinition): string[] {
  return print.stickers
    .map((s) => slotKey(print.cubies.find((c) => c.id === s.cubie)!.position, s.normal))
    .sort();
}

export interface GoalOptions {
  readonly scope?: "full" | "display";
  /** Keep only matching slots (display goals). Requires `scope: "display"`. */
  readonly only?: (slot: string) => boolean;
  /** Default `equivalent`: symmetric pictures may be turned. */
  readonly matching?: "exact" | "equivalent";
  /** Pin the map the goal is made for. */
  readonly map?: AppearanceMap | null;
}

/** Goal from a reference state, typically the solved print. Slots carry sticker ids for strict identity. */
export function goalFromState(print: PrintDefinition, state: CubeState, o: GoalOptions = {}): AppearanceGoal {
  const scope = o.scope ?? "full";
  if (o.only && scope === "full") throw new Error("A full goal cannot drop slots; use scope display");
  const slots = posesOf(print, state)
    .map((s): GoalSlot => {
      const asset = print.stickers.find((v) => v.id === s.id)!.assetId;
      return {
        slot: slotKey(s.p, s.n),
        asset,
        up: quarterIndex(s.n, s.up),
        matching: o.matching ?? "equivalent",
        sticker: s.id,
      };
    })
    .filter((s) => !o.only || o.only(s.slot))
    .sort((a, b) => (a.slot < b.slot ? -1 : 1));
  return validateGoal(
    {
      schema: "cubistry.goal",
      version: 2,
      printId: print.id,
      appearanceSha256: o.map ? appearanceSha256(o.map) : null,
      scope,
      slots,
    },
    print,
  );
}

/**
 * Adapter from `cubistry.target@1`: facelet -> slot, `assetId` -> asset, absent or `exact` matching stays
 * exact, `equivalent` stays equivalent. Slots carry no sticker ids, so identity mode behaves exactly like `matchesTarget`.
 */
export function goalFromTarget(printId: string, target: DisplayTarget, map: AppearanceMap | null = null): AppearanceGoal {
  const slots = target.facelets
    .map((f): GoalSlot => ({
      slot: slotKey(f.position, f.normal),
      asset: f.assetId,
      up: quarterIndex(f.normal, f.up),
      matching: f.matching === "equivalent" ? "equivalent" : "exact",
    }))
    .sort((a, b) => (a.slot < b.slot ? -1 : 1));
  return validateGoal({
    schema: "cubistry.goal",
    version: 2,
    printId,
    appearanceSha256: map ? appearanceSha256(map) : null,
    scope: "display",
    slots,
  });
}

const SLOT = /^-?\d+,-?\d+,-?\d+\|(?:-1,0,0|1,0,0|0,-1,0|0,1,0|0,0,-1|0,0,1)$/;
const ID = /^[A-Za-z0-9_-]{1,96}$/;
function need(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`Invalid appearance goal: ${message}`);
}

/** Strict ingress check (and, with a print, that the slots belong to it and a full goal covers all of them). */
export function validateGoal(value: unknown, print?: PrintDefinition): AppearanceGoal {
  need(typeof value === "object" && value !== null && !Array.isArray(value), "not an object");
  const g = value as Record<string, unknown>;
  const extra = Object.keys(g).filter(
    (k) => !["schema", "version", "printId", "appearanceSha256", "scope", "slots"].includes(k),
  );
  need(extra.length === 0, `unknown field ${extra[0]}`);
  need(g.schema === "cubistry.goal" && g.version === 2, "unsupported schema or version");
  need(typeof g.printId === "string" && ID.test(g.printId), "printId");
  need(g.appearanceSha256 === null || (typeof g.appearanceSha256 === "string" && /^[0-9a-f]{64}$/.test(g.appearanceSha256)), "appearanceSha256");
  need(g.scope === "full" || g.scope === "display", "scope");
  need(Array.isArray(g.slots) && g.slots.length > 0 && g.slots.length <= 294, "slots");
  const seen = new Set<string>();
  for (const raw of g.slots as unknown[]) {
    need(typeof raw === "object" && raw !== null, "slot");
    const s = raw as Record<string, unknown>;
    need(Object.keys(s).every((k) => ["slot", "asset", "up", "matching", "sticker"].includes(k)), "slot field");
    need(typeof s.slot === "string" && SLOT.test(s.slot) && !seen.has(s.slot), "slot key");
    seen.add(s.slot);
    need(typeof s.asset === "string" && ID.test(s.asset), "slot asset");
    need(s.up === 0 || s.up === 1 || s.up === 2 || s.up === 3, "slot up");
    need(s.matching === "exact" || s.matching === "equivalent", "slot matching");
    need(s.sticker === undefined || (Number.isInteger(s.sticker) && (s.sticker as number) >= 0), "slot sticker");
  }
  if (print) {
    need(g.printId === print.id, "goal belongs to another print");
    const all = new Set(printSlots(print));
    need([...seen].every((k) => all.has(k)), "slot outside the print");
    need(g.scope !== "full" || seen.size === all.size, "a full goal must constrain every slot of the print");
  }
  return structuredClone(value) as AppearanceGoal;
}

export interface Match {
  readonly matches: boolean;
  /** The whole-cube rotation under which the goal holds (identity preferred), or null. */
  readonly frame: number | null;
}

export interface Matcher {
  /** Does the sticker, lying at world pose (p, n, up), satisfy the goal? True when the slot is unconstrained. */
  accepts(stickerId: number, p: Vec3, n: Vec3, up: Vec3): boolean;
  evaluate(state: CubeState): Match;
  matches(state: CubeState): boolean;
}

/** Compiles a goal for repeated evaluation. Throws when a pinned map is missing or different. */
export function makeMatcher(
  print: PrintDefinition,
  goal: AppearanceGoal,
  map: AppearanceMap | null,
  policy: AppearancePolicy,
): Matcher {
  if (goal.printId !== print.id) throw new Error("Goal and print do not match");
  checkPinnedMap(goal.appearanceSha256, map, policy);
  const stickers = new Map(print.stickers.map((s) => [s.id, s] as const));
  const slots = new Map(goal.slots.map((s) => [s.slot, s] as const));
  const goalLook = new Map(
    goal.slots.map((s) => {
      const src = print.stickers.find((v) => v.assetId === s.asset);
      // A goal asset the print does not use still resolves through the map; without a map it is its own class.
      return [s.slot, lookOf({ assetId: s.asset, equivalentQuarterTurns: src?.equivalentQuarterTurns ?? [0] }, map, policy)] as const;
    }),
  );
  const accepts = (stickerId: number, p: Vec3, n: Vec3, up: Vec3): boolean => {
    const key = slotKey(p, n);
    const gs = slots.get(key);
    if (!gs) return true;
    const s = stickers.get(stickerId);
    if (!s) throw new Error(`Unknown sticker ${stickerId}`);
    const q = quarterIndex(n, up);
    if (policy.mode === "identity") {
      if (gs.sticker !== undefined) return s.id === gs.sticker && q === gs.up;
      if (s.assetId !== gs.asset) return false;
      if (gs.matching === "exact") return q === gs.up;
      const period = 4 / orderOfTurns(s.equivalentQuarterTurns);
      return ((((q - gs.up) % period) + period) % period) === 0;
    }
    const lo = lookOf(s, map, policy),
      lg = goalLook.get(key)!;
    if (lo.cls !== lg.cls) return false;
    const period = gs.matching === "exact" ? 4 : 4 / lo.order;
    return ((((lo.tau + q) - (lg.tau + gs.up)) % period) + period) % period === 0;
  };
  const evaluate = (state: CubeState): Match => {
    const poses = posesOf(print, state);
    const frames = policy.wholeCubeRotation ? CUBE_ROTATIONS : CUBE_ROTATIONS.slice(0, 1);
    for (let f = 0; f < frames.length; f++) {
      const g = frames[f];
      let constrained = 0;
      const ok = poses.every((s) => {
        const [p, n, up] = f === 0 ? [s.p, s.n, s.up] : [rotate(s.p, g), rotate(s.n, g), rotate(s.up, g)];
        if (slots.has(slotKey(p, n))) constrained++;
        return accepts(s.id, p, n, up);
      });
      // Each constrained slot needs a sticker (matchesTarget's "some sticker at the slot").
      if (ok && constrained === slots.size) return { matches: true, frame: f };
    }
    return { matches: false, frame: null };
  };
  return { accepts, evaluate, matches: (state) => evaluate(state).matches };
}

/** The visual predicate: does `state` look like `goal` under `map` and `policy`? */
export function matchesAppearance(
  print: PrintDefinition,
  state: CubeState,
  goal: AppearanceGoal,
  map: AppearanceMap | null,
  policy: AppearancePolicy,
): boolean {
  return makeMatcher(print, goal, map, policy).matches(state);
}

