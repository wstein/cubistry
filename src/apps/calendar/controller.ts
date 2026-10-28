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
  current: Target;
  get busy(): boolean {
    return this.active;
  }
  get physicalState(): State {
    return this.state;
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
  request(target: Target): void {
    demand(!this.failed, "Calendar stopped after a failed physical route");
    this.desired = target;
    if (!this.active) void this.drain();
  }
  private async drain(): Promise<void> {
    this.active = true;
    this.changed(this.current, true);
    try {
      while (this.desired) {
        const target = this.desired;
        this.desired = null;
        if (!matches(this.state, target.cells)) {
          const route = simplify(inverse(this.sourceWord) + " " + target.word),
            destination = sourcePose(this.design, target);
          for (const token of tokens(route)) {
            const next = apply(this.state, token);
            await this.port.animate(this.state, token, next);
            this.state = next;
          }
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
