// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * English 7x7 calendar cube, step player (research candidate, not certified). DOM-free: the 3D view is injected
 * as a `StageView`, time comes from the view's own turn animation, so the whole state machine runs under node.
 *
 * The player owns ONE pose, the pose the view shows: it starts at a chain node, a step plays the stored move word
 * of the edge (forward) or its inverse (backward) move by move, and every step that ends (played, skipped,
 * interrupted by the next navigation, or jumped under reduced motion) is checked against the chain: the SHA-256
 * state digest of the pose must equal the stored hash of the target node. A mismatch throws `StateMismatchError`;
 * the view is never left showing a state the engine does not know.
 */
import { applyBlockInPlace, type Block } from "./blocks.ts";
import { alignmentText, findAlignments, playedBlocks, rotationBlock, type RotationPlacement } from "./deferral.ts";
import {
  applyMoveInPlace,
  clonePose,
  inverseMoves,
  type Move,
  type Pose,
  type Printing,
  stateDigest,
} from "./engine.ts";
import type { Graph } from "./graph.ts";

/** What the player needs from the 3D scene. */
export interface StageView {
  /** Shows `pose` at once and ends a turn in progress (its promise then resolves). */
  show(pose: Pose): void;
  /**
   * Turns one block (several layers of one axis and exponent together, or one layer, or the whole cube) of `before`
   * over `ms` milliseconds as ONE animation and leaves the cube showing the pose after the block.
   * Reads `before` synchronously; the caller may change it once the promise has settled. Resolves early when
   * `show` interrupts it. `ease` (default smoothstep) maps the progress of the time to the fraction turned; the player passes none, so
   * every turn, whole-cube rotations included, uses the same easing.
   */
  turn(block: Block, before: Pose, ms: number, ease?: (p: number) => number): Promise<void>;
}

export type PlayerStatus = "idle" | "playing" | "paused";
/** `orientation`: free prefix; `blocks`: grouped turns; `alignment`: free suffix; `idle`: no step. */
export type PlayerPhase = "idle" | "orientation" | "blocks" | "alignment";
export interface PlayerSnapshot {
  /** Frozen while a step plays; controls choose the next step. */
  readonly orientation: RotationPlacement;
  readonly slice: boolean;
  /** Chain node index the cube shows, or is turning to. */
  readonly index: number;
  readonly status: PlayerStatus;
  /**
   * Blocks of the current step already played, and blocks in the step (a block is one animation); 0 and 0 when idle.
   * With deferred rotations these are layer blocks only; the end alignment is a separate final phase, not counted.
   */
  readonly done: number;
  readonly total: number;
  /** Month node the current step starts from; equals `index` when idle. */
  readonly from: number;
  /** Milliseconds per turn, one of `SPEEDS`. */
  readonly speed: number;
  readonly phase: PlayerPhase;
  /**
   * The end alignment: `at the end` while a deferred step plays its blocks, then the found rotation (`x+, y2`), `none`
   * when no rotation is needed or the step does not defer rotations. After a step it stays until the next one.
   */
  readonly alignment: string;
}

export class StateMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateMismatchError";
  }
}

/**
 * Offered speeds: milliseconds per quarter turn, the repository's Rotation Speed stops (100, 250, 500 ms and 1 s). A block
 * lasts the speed times its quarter turns (a half turn takes twice as long), whatever its kind: single layer, wide block,
 * middle slice, whole-cube rotation (x, y, z) or end alignment.
 */
export const SPEEDS = [100, 250, 500, 1000] as const;
export const DEFAULT_SPEED = 250;
/** Duration of a block at `speed` ms per quarter turn: the quarter turns of the block (1 or 2; the sign is the direction) times the speed. */
export const blockMs = (block: Block, speed: number): number => speed * Math.abs(block.angle);
/** The page plays rule-c blocks (the middle slice counts as a move) unless the viewer turns it off; see `blocks.ts`. */
export const DEFAULT_SLICE = true;
/** Compatibility default for callers of the older defer option. The page selects DEFAULT_ORIENTATION explicitly. */
export const DEFAULT_DEFER = true;
export const DEFAULT_ORIENTATION: RotationPlacement = "before";
/** Duration of the alignment under reduced motion, if the preference turns on while a step is playing. */
export const REDUCED_ALIGN_MS = 150;

export interface PlayerOptions {
  readonly orientation?: RotationPlacement;
  readonly graph: Graph;
  readonly printing: Printing;
  /** The pose of chain node 0. Not modified. */
  readonly root: Pose;
  readonly view: StageView;
  readonly reducedMotion: () => boolean;
  readonly onChange?: (snapshot: PlayerSnapshot) => void;
  /** Called when a step fails the digest check or the view throws while playing. */
  readonly onError?: (error: Error) => void;
  /** Group the steps with rule c (blocks may contain the middle layer). Default false: the blocks of one side. */
  readonly slice?: boolean;
  /** Move the whole-cube rotations of a step to the end and find the alignment there. Default false: rotations stay in place. */
  readonly defer?: boolean;
}

interface Plan {
  readonly orientation: RotationPlacement;
  readonly slice: boolean;
  readonly from: number;
  readonly target: number;
  /** The stored word of the step, grouped into blocks (display only; same state as the word). */
  readonly blocks: readonly Block[];
  done: number;
  /** Deferred rotations: the alignment found at the end of the blocks (moves still to turn start at `alignDone`), else null. */
  readonly defer: boolean;
  align: readonly Move[] | null;
  alignDone: number;
  /** The alignment the deferral predicts (empty without deferral); the digest search must find the same one. */
  readonly expected: readonly Move[];
}

export class Calendar7Player {
  private readonly graph: Graph;
  private readonly printing: Printing;
  private readonly root: Pose;
  private readonly view: StageView;
  private readonly reducedMotion: () => boolean;
  private readonly onChange?: (snapshot: PlayerSnapshot) => void;
  private readonly onError?: (error: Error) => void;
  private pose: Pose;
  private index = -1;
  private plan: Plan | null = null;
  private status: PlayerStatus = "idle";
  private speed: number = DEFAULT_SPEED;
  /** Generation of the loop that is playing, or -1. */
  private loopFor = -1;
  private disposed = false;
  private slice: boolean;
  private orientation: RotationPlacement;
  private lastAlignment = "none";
  /** Bumped whenever the running loop must stop; a loop that wakes with an older value leaves. */
  private generation = 0;

  constructor(options: PlayerOptions) {
    this.graph = options.graph;
    this.printing = options.printing;
    this.root = options.root;
    this.view = options.view;
    this.reducedMotion = options.reducedMotion;
    this.onChange = options.onChange;
    this.onError = options.onError;
    this.pose = clonePose(options.root);
    this.slice = options.slice ?? false;
    this.orientation = options.orientation ?? (options.defer ? "after" : "stored");
  }

  /** True when the whole-cube rotations of a step are moved to the end alignment. */
  get alignAtEnd(): boolean {
    return this.orientation === "after";
  }
  /** Chooses it for the NEXT step; a step in progress keeps its plan. */
  setDefer(on: boolean): void {
    this.orientation = on ? "after" : "stored";
  }

  setOrientation(orientation: RotationPlacement): void {
    if (!["before", "after", "stored"].includes(orientation)) throw new RangeError("unknown orientation placement");
    this.orientation = orientation;
  }

  /** Exact animation blocks of the frozen current plan. */
  get stepBlocks(): readonly Block[] { return this.plan?.blocks ?? []; }

  get stepAlignment(): readonly Move[] { return this.plan?.expected ?? []; }

  /** True when steps are grouped with rule c. */
  get middleSlice(): boolean {
    return this.slice;
  }
  /** Chooses the grouping of the NEXT step; a step in progress keeps its blocks. */
  setSlice(on: boolean): void {
    this.slice = on;
  }

  get snapshot(): PlayerSnapshot {
    const p = this.plan;
    return {
      orientation: p?.orientation ?? this.orientation,
      slice: p?.slice ?? this.slice,
      index: p ? p.target : this.index,
      status: this.status,
      done: p ? p.done : 0,
      total: p ? p.blocks.length : 0,
      from: p ? p.from : this.index,
      speed: this.speed,
      phase: !p ? "idle" : p.orientation === "before" && p.alignDone < p.expected.length ? "orientation" : p.defer && p.done >= p.blocks.length ? "alignment" : "blocks",
      alignment: p ? (p.orientation === "before" ? alignmentText(p.expected) : p.defer ? (p.align ? alignmentText(p.align) : "at the end") : "none") : this.lastAlignment,
    };
  }
  /** The pose the view shows right now (a copy). */
  get shownPose(): Pose {
    return clonePose(this.pose);
  }
  get ready(): boolean {
    return this.index >= 0;
  }

  /** Stored move word from node `from` to the adjacent node `to`: the edge forward, its inverse backward. */
  stepMoves(from: number, to: number): readonly Move[] {
    if (to === from + 1) return this.graph.edges[from].moves;
    if (to === from - 1) return inverseMoves(this.graph.edges[to].moves);
    throw new RangeError(`node ${to} is not adjacent to node ${from}`);
  }

  private check(node: number): void {
    const want = this.graph.nodes[node].hash;
    const got = stateDigest(this.printing, this.pose);
    if (got !== want)
      throw new StateMismatchError(`state digest of the cube differs from the stored hash of node ${node}`);
  }

  private notify(): void {
    if (!this.disposed) this.onChange?.(this.snapshot);
  }

  /** Walks the stored edges from the nearer known pose (the root or the shown pose) to `target`; no animation. */
  private walkTo(target: number): void {
    if (!(target >= 0 && target < this.graph.nodes.length)) throw new RangeError(`node ${target} is outside the chain`);
    let at = 0;
    let pose = clonePose(this.root);
    if (this.index >= 0 && Math.abs(target - this.index) < target) {
      at = this.index;
      pose = clonePose(this.pose);
    }
    while (at < target) for (const m of this.graph.edges[at++].moves) applyMoveInPlace(pose, m);
    while (at > target) for (const m of inverseMoves(this.graph.edges[--at].moves)) applyMoveInPlace(pose, m);
    this.pose = pose;
  }

  /** Shows node `target` at once (first display, a jump, or reduced motion) and checks the digest. */
  jump(target: number): void {
    if (this.disposed) return;
    this.settle();
    this.walkTo(target);
    this.lastAlignment = "none";
    this.view.show(this.pose);
    this.index = target;
    this.check(target);
    this.status = "idle";
    this.notify();
  }

  /**
   * Goes to node `target`. An adjacent node plays the step (a jump under reduced motion); anything else jumps.
   * A step in progress is first brought to its end state.
   */
  go(target: number): void {
    if (this.disposed) return;
    if (!(target >= 0 && target < this.graph.nodes.length)) throw new RangeError(`node ${target} is outside the chain`);
    if (this.index < 0 || this.reducedMotion()) {
      this.jump(target);
      return;
    }
    this.settle();
    if (target === this.index) return;
    if (Math.abs(target - this.index) !== 1) {
      this.jump(target);
      return;
    }
    const orientation = this.orientation;
    const { blocks, alignment } = playedBlocks(this.stepMoves(this.index, target), { slice: this.slice, orientation });
    this.plan = { orientation, slice: this.slice, from: this.index, target, blocks, done: 0, defer: orientation === "after", align: orientation === "before" ? alignment : null, alignDone: 0, expected: alignment };
    this.status = "playing";
    this.notify();
    void this.run();
  }

  /** Brings a step in progress to its end state at once and checks it. */
  skip(): void {
    this.settle();
  }

  private settle(): void {
    const plan = this.plan;
    if (!plan) return;
    this.generation++;
    this.plan = null;
    this.status = "idle";
    if (plan.orientation === "before")
      for (let i = plan.alignDone; i < plan.expected.length; i++) applyMoveInPlace(this.pose, plan.expected[i]);
    for (let i = plan.done; i < plan.blocks.length; i++) applyBlockInPlace(this.pose, plan.blocks[i]);
    let failure: Error | null = null;
    if (plan.defer) {
      try {
        const align = this.alignmentOf(plan);
        for (let i = plan.alignDone; i < align.length; i++) applyMoveInPlace(this.pose, align[i]);
        this.lastAlignment = alignmentText(align);
      } catch (error) {
        failure = error as Error;
      }
    } else this.lastAlignment = plan.orientation === "before" ? alignmentText(plan.expected) : "none";
    this.view.show(this.pose);
    this.index = plan.target;
    if (failure) {
      this.notify();
      throw failure;
    }
    this.check(plan.target);
    this.notify();
  }

  /**
   * The end alignment of a deferred step, found once the blocks are played: the one of the 24 whole-cube orientations that
   * turns the shown state into the stored target. None, or more than one, is a mismatch.
   */
  private alignmentOf(plan: Plan): readonly Move[] {
    if (plan.align) return plan.align;
    const found = findAlignments(this.printing, this.pose, this.graph.nodes[plan.target].hash);
    if (found.length !== 1)
      throw new StateMismatchError(
        `no whole-cube orientation turns the cube into the stored state of node ${plan.target} (${found.length} of 24 match)`,
      );
    const word = found[0].moves;
    if (alignmentText(word) !== alignmentText(plan.expected))
      throw new StateMismatchError(
        `the alignment found by digest (${alignmentText(word)}) differs from the deferred rotations (${alignmentText(plan.expected)})`,
      );
    return (plan.align = word);
  }

  private finished(plan: Plan): boolean {
    return plan.done >= plan.blocks.length && (plan.orientation !== "before" || plan.alignDone >= plan.expected.length) && (!plan.defer || (plan.align !== null && plan.alignDone >= plan.align.length));
  }

  play(): void {
    if (this.disposed || !this.plan || this.status === "playing") return;
    this.status = "playing";
    this.notify();
    void this.run();
  }
  pause(): void {
    if (this.disposed || !this.plan || this.status !== "playing") return;
    this.status = "paused";
    this.notify();
  }
  setSpeed(speed: number): void {
    if (!(SPEEDS as readonly number[]).includes(speed)) throw new RangeError(`speed ${speed} is not offered`);
    this.speed = speed;
    this.notify();
  }

  private async run(): Promise<void> {
    const mine = this.generation;
    if (this.loopFor === mine) return;
    this.loopFor = mine;
    try {
      while (this.plan && this.status === "playing" && this.generation === mine && !this.disposed) {
        const plan = this.plan;
        if (plan.orientation === "before" && plan.alignDone < plan.expected.length) {
          const move = plan.expected[plan.alignDone];
          const reduced = this.reducedMotion();
          await this.view.turn(rotationBlock(move), this.pose, reduced ? REDUCED_ALIGN_MS : blockMs(rotationBlock(move), this.speed));
          if (this.disposed || this.generation !== mine || this.plan !== plan) return;
          applyMoveInPlace(this.pose, move);
          plan.alignDone++;
          this.notify();
        } else if (plan.done < plan.blocks.length) {
          const block = plan.blocks[plan.done];
          await this.view.turn(block, this.pose, blockMs(block, this.speed));
          if (this.disposed || this.generation !== mine || this.plan !== plan) return;
          applyBlockInPlace(this.pose, block);
          plan.done++;
          this.notify();
        } else if (plan.defer) {
          // Final phase: the alignment, one or two whole-cube rotations of the model, timed and eased like a layer turn (speed times quarter turns).
          const first = plan.align === null;
          const align = this.alignmentOf(plan);
          if (first && align.length > 0) this.notify(); // no transient phase for an identity alignment
          if (plan.alignDone >= align.length) break;
          const move = align[plan.alignDone];
          const reduced = this.reducedMotion();
          await this.view.turn(rotationBlock(move), this.pose, reduced ? REDUCED_ALIGN_MS : blockMs(rotationBlock(move), this.speed));
          if (this.disposed || this.generation !== mine || this.plan !== plan) return;
          applyMoveInPlace(this.pose, move);
          plan.alignDone++;
          this.notify();
        } else break;
      }
      if (this.plan && this.generation === mine && !this.disposed && this.finished(this.plan)) {
        const plan = this.plan;
        this.plan = null;
        this.status = "idle";
        this.index = plan.target;
        this.lastAlignment = plan.align ? alignmentText(plan.align) : "none";
        this.check(plan.target);
        this.notify();
      }
    } catch (error) {
      this.generation++;
      this.status = "paused";
      this.onError?.(error as Error);
    } finally {
      if (this.loopFor === mine) this.loopFor = -1;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.plan = null;
    this.status = "idle";
  }
}
