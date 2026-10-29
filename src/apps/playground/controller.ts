import {
  deepFreeze,
  stateEquals,
  validateState,
  type CubeState,
  type LegalMove,
} from "@cubistry/cube-core";
import {
  applyMoves,
  parseAlg,
  serializeMove,
  inverseMoves,
  presentMove,
  type MovePresentation,
} from "@cubistry/cube-mechanics";
import type { LoadedAssets } from "@cubistry/cube-assets";
import {
  classify,
  fullGoal,
  scramble,
  type PlaygroundDesign,
} from "./model.ts";
import {
  createPlaygroundSolver,
  solverFailure,
  type SolverFactory,
  type FailureCode,
} from "./solver.ts";
export interface PlaygroundViewer {
  configure: (
    print: PlaygroundDesign["print"],
    state: CubeState,
    assets: LoadedAssets,
  ) => void;
  animate: (presentation: MovePresentation) => Promise<void>;
  readonly presentedState: CubeState | null;
}
type Session = { design: PlaygroundDesign; assets: LoadedAssets };
type HistoryEntry = { move: LegalMove; source: string };
type Command =
  | { kind: "word"; moves: readonly LegalMove[]; source: string }
  | { kind: "solve" }
  | { kind: "session"; session: Session };
type QueuedMove = {
  move: LegalMove;
  source: string;
  direction?: "undo" | "redo";
};
export type SolverStatus =
  | "Idle"
  | "Loading"
  | "Playing"
  | "Verified"
  | "Cancelled"
  | FailureCode;
/** Product command history, while all physical transitions remain shared mechanics. */
export class PlaygroundController {
  private session: Session;
  private state: CubeState;
  private entries: HistoryEntry[] = [];
  private cursor = 0;
  private states: CubeState[] = [];
  private queue: QueuedMove[] = [];
  private pending: Command | null = null;
  private pumping = false;
  private turning = false;
  private generation = 0;
  private solverStatus: SolverStatus = "Idle";
  private message = "Ready. Exact physical target.";
  private frozen = false;
  private solveGoal: CubeState | null = null;
  private turns = 0;
  private viewer: PlaygroundViewer;
  private changed: () => void;
  private solverFactory: SolverFactory;
  constructor(
    viewer: PlaygroundViewer,
    session: Session,
    changed: () => void = () => {},
    solverFactory: SolverFactory = createPlaygroundSolver,
  ) {
    this.viewer = viewer;
    this.changed = changed;
    this.solverFactory = solverFactory;
    this.session = session;
    this.state = session.design.target;
    this.states = [this.state];
    viewer.configure(session.design.print, this.state, session.assets);
  }
  get snapshot() {
    return deepFreeze({
      state: this.state,
      style: this.session.design.style,
      history: [...this.entries],
      cursor: this.cursor,
      turns: this.turns,
      busy:
        this.turning ||
        this.queue.length > 0 ||
        this.pending !== null ||
        this.solverStatus === "Loading",
      turning: this.turning,
      queued: this.queue.length,
      solverStatus: this.solverStatus,
      message: this.message,
      frozen: this.frozen,
      ...classify(this.session.design, this.state),
    });
  }
  private emit() {
    this.changed();
  }
  private available() {
    if (this.frozen) {
      this.message = "Turn failed. Reload to start a new session.";
      this.emit();
      return false;
    }
    return true;
  }
  private rejectBusy() {
    if (!this.available()) return true;
    if (this.snapshot.busy) {
      this.message =
        "Busy. Cancel or let the current word finish before manual input or undo/redo.";
      this.emit();
      return true;
    }
    return false;
  }
  manual(notation: string) {
    if (this.rejectBusy()) return false;
    let moves: readonly LegalMove[];
    try {
      moves = parseAlg(notation);
      if (moves.length < 1 || moves.length > 100)
        throw Error("Enter 1–100 legal face turns: R L U D F B with ' or 2.");
    } catch (error) {
      this.message =
        "Invalid: " +
        (error instanceof Error ? error.message : "Invalid notation");
      this.emit();
      return false;
    }
    this.replace({ kind: "word", moves, source: "Manual" });
    return true;
  }
  scramble(seed: number, count: number) {
    if (!this.available()) return false;
    let moves: readonly LegalMove[];
    try {
      moves = scramble(seed, count);
    } catch (error) {
      this.message =
        "Invalid: " +
        (error instanceof Error ? error.message : "Invalid scramble");
      this.emit();
      return false;
    }
    this.replace({ kind: "word", moves, source: `Scramble ${seed}/${count}` });
    return true;
  }
  undo() {
    if (this.rejectBusy() || this.cursor === 0) return false;
    this.generation++;
    this.solverStatus = "Idle";
    this.message = "Undo · legal inverse turn";
    this.queue = [
      {
        move: inverseMoves([this.entries[this.cursor - 1].move])[0],
        source: "Undo",
        direction: "undo",
      },
    ];
    void this.pump();
    return true;
  }
  redo() {
    if (this.rejectBusy() || this.cursor === this.entries.length) return false;
    this.generation++;
    this.solverStatus = "Idle";
    this.message = "Redo · original legal turn";
    this.queue = [
      {
        move: this.entries[this.cursor].move,
        source: "Redo",
        direction: "redo",
      },
    ];
    void this.pump();
    return true;
  }
  solve() {
    if (!this.available()) return;
    this.replace({ kind: "solve" });
  }
  newSession(session: Session) {
    if (!this.available()) return;
    this.replace({ kind: "session", session });
  }
  cancel() {
    if (!this.available()) return;
    this.generation++;
    this.queue = [];
    this.pending = null;
    this.solveGoal = null;
    this.solverStatus = "Cancelled";
    this.message = this.turning
      ? "Cancelling after the active legal turn."
      : "Cancelled. Completed moves remain in history.";
    this.emit();
  }
  private replace(command: Command) {
    this.generation++;
    this.queue = [];
    this.pending = command;
    this.solveGoal = null;
    this.solverStatus = "Idle";
    this.message = this.turning
      ? "Finishing the active legal turn before the new request."
      : "Preparing request.";
    void this.pump();
    this.emit();
  }
  private async prepareSolve() {
    const generation = this.generation,
      source = this.state,
      design = this.session.design;
    this.solverStatus = "Loading";
    this.message = "Loading solver · exact physical target";
    this.emit();
    try {
      const solver = await this.solverFactory(design.print);
      if (
        generation !== this.generation ||
        !stateEquals(source, this.state) ||
        design !== this.session.design
      )
        return;
      const result = solver.solve(source, design.target);
      // Treat the adapter as a capability boundary, then independently parse and
      // replay its returned legal word against all body poses and sticker frames.
      const moves = parseAlg(result.map(serializeMove).join(" "));
      if (moves.length > 128) throw Error("Invalid excessive solver word");
      if (!fullGoal(design, applyMoves(source, moves)))
        throw Error("Solver failed complete physical replay");
      if (generation !== this.generation || !stateEquals(source, this.state))
        return;
      this.solveGoal = design.target;
      this.solverStatus = "Playing";
      this.message = `Verified legal route · ${moves.length} HTM · playing to exact target`;
      this.queue = moves.map((move) => ({ move, source: "Solve" }));
      void this.pump();
      this.emit();
    } catch (error) {
      if (generation !== this.generation) return;
      const failure = solverFailure(error);
      this.solverStatus = failure.code;
      this.message = `${failure.code}: ${failure.message}`;
      this.emit();
    }
  }
  private async pump() {
    if (this.pumping || this.frozen) return;
    this.pumping = true;
    try {
      while (!this.frozen) {
        if (this.pending) {
          const command = this.pending;
          this.pending = null;
          if (command.kind === "session") {
            // A design change is an explicit new physical puzzle, never a reskin.
            this.viewer.configure(
              command.session.design.print,
              command.session.design.target,
              command.session.assets,
            );
            this.session = command.session;
            this.state = command.session.design.target;
            this.entries = [];
            this.cursor = 0;
            this.states = [this.state];
            this.turns = 0;
            this.message = "New physical puzzle session. History cleared.";
            this.emit();
          } else if (command.kind === "solve") {
            void this.prepareSolve();
          } else {
            this.queue = command.moves.map((move) => ({
              move,
              source: command.source,
            }));
            this.message = `${command.source} · playing recorded legal word`;
          }
        }
        const next = this.queue.shift();
        if (!next) {
          if (this.solveGoal) {
            if (
              !stateEquals(this.state, this.solveGoal) ||
              !fullGoal(this.session.design, this.state)
            )
              throw Error(
                "Committed solve endpoint failed complete physical replay",
              );
            this.solveGoal = null;
            this.solverStatus = "Verified";
            this.message =
              "Solved · exact physical target verified after playback.";
          }
          if (this.solverStatus === "Cancelled")
            this.message = "Cancelled. Completed moves remain in history.";
          else if (this.message.includes("playing recorded legal word"))
            this.message = this.message.replace(
              "playing recorded legal word",
              "completed legal word",
            );
          else if (this.message.startsWith("Busy."))
            this.message = "Ready. Completed moves remain in history.";
          break;
        }
        this.turning = true;
        this.emit();
        const presentation = presentMove(this.state, next.move);
        await this.viewer.animate(presentation);
        // No commit, history update, or cursor advance until the legal turn
        // resolves AND the viewer reports precisely the expected endpoint.
        if (
          !this.viewer.presentedState ||
          !stateEquals(presentation.to, this.viewer.presentedState)
        )
          throw Error("Viewer endpoint mismatch");
        validateState(presentation.to, this.session.design.print);
        if (next.direction) {
          const cursor = this.cursor + (next.direction === "undo" ? -1 : 1);
          if (!stateEquals(presentation.to, this.states[cursor]))
            throw Error("History endpoint mismatch");
          this.cursor = cursor;
        } else {
          this.entries = this.entries.slice(0, this.cursor);
          this.states = this.states.slice(0, this.cursor + 1);
          this.entries.push({ move: next.move, source: next.source });
          this.cursor++;
          this.states.push(presentation.to);
        }
        this.state = presentation.to;
        this.turns++;
        this.turning = false;
        this.emit();
      }
    } catch (error) {
      this.frozen = true;
      this.generation++;
      this.queue = [];
      this.pending = null;
      this.solveGoal = null;
      this.solverStatus = "Invalid";
      this.message = `Turn failed: ${error instanceof Error ? error.message : "Unknown viewer failure"}. Reload to start a new session.`;
    } finally {
      this.turning = false;
      this.pumping = false;
      this.emit();
    }
  }
}
