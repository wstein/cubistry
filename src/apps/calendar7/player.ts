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
import { applyBlockInPlace, type Block, groupBlocks } from "./blocks.ts";
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
   * `show` interrupts it.
   */
  turn(block: Block, before: Pose, ms: number): Promise<void>;
}

export type PlayerStatus = "idle" | "playing" | "paused";
export interface PlayerSnapshot {
  /** Chain node index the cube shows, or is turning to. */
  readonly index: number;
  readonly status: PlayerStatus;
  /** Blocks of the current step already played, and blocks in the step (a block is one animation); 0 and 0 when idle. */
  readonly done: number;
  readonly total: number;
  /** Month node the current step starts from; equals `index` when idle. */
  readonly from: number;
  readonly speed: number;
}

export class StateMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateMismatchError";
  }
}

/** Duration of one block (one animation) at 1x. A wide block turns as long as a single layer: it is one move. */
export const BASE_MOVE_MS = 90;
/** Nominal speeds: 90 ms per block at 1x; a frame is about 17 ms, so 8x is one frame per block when the display keeps up. */
export const SPEEDS = [0.5, 1, 2, 4, 8] as const;
export const DEFAULT_SPEED = 2;
/** The page plays rule-c blocks (the middle slice counts as a move) unless the viewer turns it off; see `blocks.ts`. */
export const DEFAULT_SLICE = true;

export interface PlayerOptions {
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
}

interface Plan {
  readonly from: number;
  readonly target: number;
  /** The stored word of the step, grouped into blocks (display only; same state as the word). */
  readonly blocks: readonly Block[];
  done: number;
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
  }

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
      index: p ? p.target : this.index,
      status: this.status,
      done: p ? p.done : 0,
      total: p ? p.blocks.length : 0,
      from: p ? p.from : this.index,
      speed: this.speed,
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
    const blocks = groupBlocks(this.stepMoves(this.index, target), { slice: this.slice });
    this.plan = { from: this.index, target, blocks, done: 0 };
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
    for (let i = plan.done; i < plan.blocks.length; i++) applyBlockInPlace(this.pose, plan.blocks[i]);
    this.view.show(this.pose);
    this.index = plan.target;
    this.check(plan.target);
    this.notify();
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
        if (plan.done >= plan.blocks.length) break;
        const block = plan.blocks[plan.done];
        await this.view.turn(block, this.pose, BASE_MOVE_MS / this.speed);
        if (this.disposed || this.generation !== mine || this.plan !== plan) return;
        applyBlockInPlace(this.pose, block);
        plan.done++;
        this.notify();
      }
      if (this.plan && this.generation === mine && !this.disposed && this.plan.done >= this.plan.blocks.length) {
        const plan = this.plan;
        this.plan = null;
        this.status = "idle";
        this.index = plan.target;
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
