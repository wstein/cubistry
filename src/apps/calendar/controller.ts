import {
  apply,
  demand,
  inverse,
  simplify,
  tokens,
  matches,
  sourcePose,
  sameState,
  type State,
  type Design,
  type Target,
} from "./model.ts";
export interface MoveCounts {
  readonly htm: number;
  readonly rotations: number;
}
export interface CalendarProgress {
  readonly completed: MoveCounts;
  readonly total: MoveCounts;
  readonly target: Target | null;
  readonly queued: Target | null;
}
/** HTM counts an outer-face token once, including a half turn. xyz are separate. */
export function countCalendarMoves(word: string): MoveCounts {
  let htm = 0,
    rotations = 0;
  for (const token of tokens(word)) {
    if (/^[xyz]/.test(token)) rotations++;
    else htm++;
  }
  return Object.freeze({ htm, rotations });
}
export interface CalendarPort {
  configure(design: Design, state: State): void;
  animate(from: State, token: string, to: State): Promise<void>;
}
/** One active physical route and one replaceable latest request. */
export class CalendarController {
  private state: State;
  private sourceWord: string;
  private desired: Target | null = null;
  private active = false;
  private failed = false;
  private completed: MoveCounts = { htm: 0, rotations: 0 };
  private total: MoveCounts = { htm: 0, rotations: 0 };
  private progressTarget: Target | null = null;
  current: Target;
  get busy(): boolean {
    return this.active;
  }
  get physicalState(): State {
    return this.state;
  }
  get progress(): CalendarProgress {
    return Object.freeze({
      completed: Object.freeze({ ...this.completed }),
      total: Object.freeze({ ...this.total }),
      target: this.progressTarget,
      queued: this.desired,
    });
  }
  readonly design: Design;
  private port: CalendarPort;
  private changed: (target: Target, busy: boolean, error?: unknown) => void;
  constructor(
    design: Design,
    initial: Target,
    port: CalendarPort,
    changed: (target: Target, busy: boolean, error?: unknown) => void,
  ) {
    this.design = design;
    this.port = port;
    this.changed = changed;
    this.state = sourcePose(design, initial);
    this.sourceWord = initial.word;
    this.current = initial;
    port.configure(design, this.state);
    changed(initial, false);
  }
  /** Estimates are exact for this playback policy, not globally shortest paths. */
  estimate(target: Target): MoveCounts | null {
    if (this.active || this.failed) return null;
    return countCalendarMoves(this.route(target));
  }
  private route(target: Target): string {
    return matches(this.state, target.cells)
      ? ""
      : simplify(inverse(this.sourceWord) + " " + target.word);
  }
  request(target: Target): void {
    demand(!this.failed, "Calendar stopped after a failed physical route");
    this.desired = target;
    if (!this.active) void this.drain();
    else this.changed(this.current, true);
  }
  private async drain(): Promise<void> {
    this.active = true;
    try {
      while (this.desired) {
        const target = this.desired;
        this.desired = null;
        const route = this.route(target),
          destination = sourcePose(this.design, target);
        this.progressTarget = target;
        this.completed = { htm: 0, rotations: 0 };
        this.total = countCalendarMoves(route);
        this.changed(this.current, true);
        for (const token of tokens(route)) {
          const next = apply(this.state, token);
          await this.port.animate(this.state, token, next);
          this.state = next;
          const cost = countCalendarMoves(token);
          this.completed = {
            htm: this.completed.htm + cost.htm,
            rotations: this.completed.rotations + cost.rotations,
          };
          this.changed(this.current, true);
        }
        if (route) {
          demand(
            sameState(this.state, destination) &&
              matches(this.state, target.cells),
            "Calendar endpoint disagrees with the verified route",
          );
          this.sourceWord = target.word;
        }
        this.current = target;
      }
    } catch (e) {
      this.failed = true;
      this.desired = null;
      this.active = false;
      this.changed(this.current, false, e);
      return;
    }
    this.active = false;
    this.changed(this.current, false);
  }
}
