import { demand, type LegalMove } from "@cubistry/cube-core";
import { countHtmMoves, type MoveProgress } from "../shared/playback.ts";

/** Committed move counts in the calendar's convention: HTM and xyz kept apart. */
export interface MoveCounts {
  readonly htm: number;
  readonly rotations: number;
}
export const NO_MOVES: MoveCounts = Object.freeze({ htm: 0, rotations: 0 });
/**
 * HTM counts an outer-face token once, including a half turn; whole-cube
 * rotations are counted separately. A `LegalMove` can only name an outer face,
 * so HSM clock routes never contain x/y/z rotations.
 */
export const countClockMoves = (moves: readonly LegalMove[]): MoveCounts =>
  Object.freeze({ htm: countHtmMoves(moves), rotations: 0 });

export interface ClockUnitStatistics {
  /** Moves committed by this cube since the session started or was reset. */
  readonly session: MoveCounts;
  /** HTM committed for this cube's latest completed display change. */
  readonly last: number | null;
  /** Largest HTM cost of one completed display change this session. */
  readonly max: number | null;
  /** Completed display changes this session. */
  readonly changes: number;
  /**
   * Exact mean HTM per completed change (total cost / changes); null before
   * the first. Always null for the grand total, which shows no mean.
   */
  readonly mean: number | null;
}
export interface ClockStatisticsSnapshot {
  readonly units: readonly ClockUnitStatistics[];
  readonly total: ClockUnitStatistics;
  /** Increments whenever any displayed number may have changed. */
  readonly revision: number;
}
/** Mean for display: a fixed two decimals, rounded only here. Null is a dash. */
export const formatMean = (value: number | null): string =>
  value === null ? "—" : value.toFixed(2);
const add = (a: MoveCounts, b: MoveCounts): MoveCounts =>
  Object.freeze({ htm: a.htm + b.htm, rotations: a.rotations + b.rotations });
const settled = (status: MoveProgress["status"]) =>
  status === "completed" || status === "stopped";
const moving = (status: MoveProgress["status"] | null) =>
  status === "playing" || status === "stopping";

/**
 * Session move statistics for the H–M–S clock, fed only by committed moves.
 *
 * Each physical commit increments `MoveProgress.sessionTotal` exactly once in
 * the shared playback loop, so planned, superseded or unplayed moves never
 * appear here. A cube's change cost is every move it committed since its
 * previous completed display change, including turns of an interrupted route.
 * Changes that complete before the same `closeTick()` form one clock tick.
 *
 * A cube's mean is over the same completed costs as its last and max, so
 * zero-cost changes count: two integers (cost sum, change count), no history.
 * The grand total row has no mean.
 */
export class ClockMoveStatistics {
  private readonly count: number;
  private session: MoveCounts[] = [];
  private pending: number[] = [];
  private last: (number | null)[] = [];
  private max: (number | null)[] = [];
  private changes: number[] = [];
  private cost: number[] = [];
  private seenTotal: (number | null)[] = [];
  private seenStatus: (MoveProgress["status"] | null)[] = [];
  private open: number[] = [];
  private tickLast: number | null = null;
  private tickMax: number | null = null;
  private ticks = 0;
  private revision = 0;
  constructor(count = 3) {
    demand(Number.isInteger(count) && count > 0, "Invalid clock unit count");
    this.count = count;
    this.reset();
    this.seenTotal = Array(count).fill(null);
    this.seenStatus = Array(count).fill(null);
  }
  private unit(index: number): void {
    demand(
      Number.isInteger(index) && index >= 0 && index < this.count,
      "Invalid clock unit",
    );
  }
  /** Zero every counter. Moves of a change already in flight are not carried over. */
  reset(): void {
    this.session = Array(this.count).fill(NO_MOVES);
    this.pending = Array(this.count).fill(0);
    this.last = Array(this.count).fill(null);
    this.max = Array(this.count).fill(null);
    this.changes = Array(this.count).fill(0);
    this.cost = Array(this.count).fill(0);
    this.open = [];
    this.tickLast = null;
    this.tickMax = null;
    this.ticks = 0;
    this.revision++;
  }
  /** Record moves that one cube has physically committed. */
  commit(index: number, counts: MoveCounts): void {
    this.unit(index);
    demand(
      Number.isInteger(counts.htm) &&
        counts.htm >= 0 &&
        Number.isInteger(counts.rotations) &&
        counts.rotations >= 0,
      "Invalid committed move counts",
    );
    if (!counts.htm && !counts.rotations) return;
    this.session[index] = add(this.session[index], counts);
    this.pending[index] += counts.htm;
    this.revision++;
  }
  /** Record that one cube completed its latest requested display change. */
  settle(index: number): void {
    this.unit(index);
    const cost = this.pending[index];
    this.pending[index] = 0;
    this.last[index] = cost;
    this.max[index] = Math.max(this.max[index] ?? 0, cost);
    this.changes[index]++;
    this.cost[index] += cost;
    this.open.push(cost);
    this.revision++;
  }
  /** Group every change completed since the previous call into one clock tick. */
  closeTick(): void {
    if (!this.open.length) return;
    const cost = this.open.reduce((n, c) => n + c, 0);
    this.open = [];
    this.tickLast = cost;
    this.tickMax = Math.max(this.tickMax ?? 0, cost);
    this.ticks++;
    this.revision++;
  }
  /**
   * Feed a controller's progress notification. Commits are the increase of its
   * committed session total; a change completes when playback leaves motion.
   */
  observe(index: number, progress: MoveProgress): void {
    this.unit(index);
    // A controller starts at zero committed moves, so the first report is
    // compared against zero and cannot swallow an early commit.
    const seen = this.seenTotal[index] ?? 0;
    if (progress.sessionTotal > seen)
      this.commit(index, { htm: progress.sessionTotal - seen, rotations: 0 });
    // A smaller total is a controller reset or reinstall: only rebase.
    this.seenTotal[index] = progress.sessionTotal;
    if (settled(progress.status) && moving(this.seenStatus[index]))
      this.settle(index);
    this.seenStatus[index] = progress.status;
  }
  snapshot(): ClockStatisticsSnapshot {
    const units = this.session.map((session, i) =>
      Object.freeze({
        session,
        last: this.last[i],
        max: this.max[i],
        changes: this.changes[i],
        mean: this.changes[i] ? this.cost[i] / this.changes[i] : null,
      }),
    );
    return Object.freeze({
      units: Object.freeze(units),
      total: Object.freeze({
        session: this.session.reduce(add, NO_MOVES),
        last: this.tickLast,
        max: this.tickMax,
        changes: this.ticks,
        mean: null,
      }),
      revision: this.revision,
    });
  }
}
