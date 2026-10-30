import { createCube3Design, apply, inverse, sameState, exactGoal, tokens, type State, type Cube3Design } from "./model.ts";
import { ExactPictureSolver } from "./solver.ts";
export interface Cube3View {
  configure(design: Cube3Design, state: State, artwork: ReadonlyMap<number, HTMLCanvasElement>): void;
  animate(from: State, token: string, to: State): Promise<void>;
}
export class Cube3Controller {
  readonly design = createCube3Design();
  private state: State = this.design.printing;
  private entries: string[] = [];
  private cursor = 0;
  private turns = 0;
  private busy = false;
  private frozen = false;
  private generation = 0;
  private message = "Ready. Every tile and center orientation must match.";
  private readonly viewer: Cube3View;
  private readonly artwork: () => ReadonlyMap<number, HTMLCanvasElement>;
  private readonly changed: () => void;
  private readonly solver: Pick<ExactPictureSolver, "solve" | "cancel" | "dispose">;
  constructor(viewer: Cube3View, artwork: () => ReadonlyMap<number, HTMLCanvasElement>, changed: () => void,
    solver: Pick<ExactPictureSolver, "solve" | "cancel" | "dispose"> = new ExactPictureSolver()) {
    this.viewer = viewer; this.artwork = artwork; this.changed = changed; this.solver = solver;
    viewer.configure(this.design, this.state, artwork());
  }
  get snapshot() { return { state: this.state, exact: exactGoal(this.design, this.state), busy: this.busy, frozen: this.frozen,
    message: this.message, history: [...this.entries], cursor: this.cursor, turns: this.turns }; }
  async play(word: string, source = "manual"): Promise<void> {
    if (this.busy || this.frozen) return;
    const moves = tokens(word);
    if (moves.length > 100) throw Error("Use at most 100 moves at a time.");
    const generation = ++this.generation; this.busy = true; this.message = `Playing ${source}.`; this.changed();
    try { await this.run(moves, source, generation); }
    finally { this.busy = false; this.changed(); }
  }
  private async run(moves: string[], source: string, generation: number): Promise<void> {
    try {
      for (const token of moves) {
        if (generation !== this.generation) break;
        const from = this.state, to = apply(from, token);
        await this.viewer.animate(from, token, to); this.state = to; this.turns++;
        if (source === "undo") this.cursor--;
        else if (source === "redo") this.cursor++;
        else { this.entries = this.entries.slice(0, this.cursor); this.entries.push(token); this.cursor++; }
        this.changed();
      }
      if (generation === this.generation) this.message = exactGoal(this.design, this.state) ? "Exact target verified, including all six centers." : "Ready. Picture target not yet exact.";
    } catch (error) {
      this.frozen = true; this.message = "Animation failed. Physical playback is stopped; reload this page to recover."; throw error;
    }
  }
  undo(): Promise<void> { return this.cursor ? this.play(inverse(this.entries[this.cursor - 1]), "undo") : Promise.resolve(); }
  redo(): Promise<void> { return this.cursor < this.entries.length ? this.play(this.entries[this.cursor], "redo") : Promise.resolve(); }
  async solve(): Promise<void> {
    if (this.busy || this.frozen) return;
    if (exactGoal(this.design, this.state)) { this.message = "Already at the exact target, including centers."; this.changed(); return; }
    const generation = ++this.generation, from = this.state; this.busy = true;
    this.message = "Finding a verified exact route (up to 20 seconds). Center corrections can be long."; this.changed();
    try {
      const word = await this.solver.solve(this.design, from);
      if (generation !== this.generation) return;
      if (!sameState(this.state, from) || !sameState(apply(from, word), this.design.printing)) throw Error("Unavailable: exact replay verification failed.");
      this.message = `Playing ${tokens(word).length} verified moves. No shortest-path claim.`; this.changed();
      await this.run(tokens(word), "solve", generation);
    } catch (error) {
      if (generation === this.generation && !this.frozen) this.message = error instanceof Error ? error.message : "Unavailable: exact solving failed. Your puzzle is unchanged.";
    } finally { this.busy = false; this.changed(); }
  }
  cancel(): void {
    this.generation++; this.solver.cancel();
    this.message = "Cancelled. Any active legal turn finishes before playback stops."; this.changed();
  }
  restore(): void {
    if (this.busy || this.frozen) return;
    this.viewer.configure(this.design, this.design.printing, this.artwork());
    this.state = this.design.printing; this.entries = []; this.cursor = 0; this.turns = 0;
    this.message = "Target restored. Your pictures and crop settings are retained."; this.changed();
  }
  dispose(): void { this.cancel(); this.solver.dispose(); }
}
