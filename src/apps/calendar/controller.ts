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
  readonly planning: boolean;
  readonly route: "baseline" | "optimized" | "fallback";
}
export interface CalendarPlanningContext {
  readonly design: Design;
  readonly from: State;
  /** A legal print-source-to-actual-pose reference, not necessarily canonical. */
  readonly sourceWord: string;
  readonly target: Target;
  readonly fallbackWord: string;
}
export type CalendarRoutePlanner = (
  context: CalendarPlanningContext,
) => string | Promise<string>;
interface CheckedPlan {
  readonly word: string;
  readonly end: State;
  readonly route: CalendarProgress["route"];
}
interface PreparedPlan {
  readonly from: State;
  readonly sourceWord: string;
  readonly promise: Promise<CheckedPlan>;
  result: CheckedPlan | null;
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
  private planning = false;
  private routeKind: CalendarProgress["route"] = "baseline";
  private completed: MoveCounts = { htm: 0, rotations: 0 };
  private total: MoveCounts = { htm: 0, rotations: 0 };
  private progressTarget: Target | null = null;
  private prepared = new Map<Target, PreparedPlan>();
  private readonly planner?: CalendarRoutePlanner;
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
      planning: this.planning,
      route: this.routeKind,
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
    planner?: CalendarRoutePlanner,
  ) {
    this.design = design;
    this.port = port;
    this.changed = changed;
    this.planner = planner;
    this.state = sourcePose(design, initial);
    this.sourceWord = initial.word;
    this.current = initial;
    port.configure(design, this.state);
    changed(initial, false);
  }
  /** Exact policy estimate only after the same full-source plan is checked. */
  estimate(target: Target): MoveCounts | null {
    if (this.active || this.failed) return null;
    if (matches(this.state, target.cells)) return countCalendarMoves("");
    if (!this.planner)
      return countCalendarMoves(
        this.fallback(target, this.state, this.sourceWord),
      );
    const prepared = this.prepared.get(target);
    return prepared?.result && this.sameSource(prepared)
      ? countCalendarMoves(prepared.result.word)
      : null;
  }
  async prepare(target: Target): Promise<MoveCounts | null> {
    if (this.active || this.failed) return null;
    if (!this.planner || matches(this.state, target.cells))
      return this.estimate(target);
    const entry = this.preparedFor(target),
      plan = await entry.promise;
    return !this.active && this.sameSource(entry)
      ? countCalendarMoves(plan.word)
      : null;
  }
  private sameSource(entry: PreparedPlan): boolean {
    return (
      entry.sourceWord === this.sourceWord && sameState(entry.from, this.state)
    );
  }
  private fallback(target: Target, from: State, sourceWord: string): string {
    return matches(from, target.cells)
      ? ""
      : simplify(inverse(sourceWord) + " " + target.word);
  }
  private baseline(
    target: Target,
    from: State,
    sourceWord: string,
  ): CheckedPlan {
    const word = this.fallback(target, from, sourceWord),
      end = apply(from, word);
    demand(
      matches(end, target.cells),
      "Baseline calendar route failed its visible target",
    );
    return { word, end, route: "baseline" };
  }
  private preparedFor(target: Target): PreparedPlan {
    const existing = this.prepared.get(target);
    if (existing && this.sameSource(existing)) return existing;
    const from = this.state,
      sourceWord = this.sourceWord;
    let entry: PreparedPlan;
    const promise = this.plan(target, from, sourceWord).then((plan) => {
      entry.result = plan;
      return plan;
    });
    entry = { from, sourceWord, promise, result: null };
    this.prepared.delete(target);
    this.prepared.set(target, entry);
    while (this.prepared.size > 4)
      this.prepared.delete(this.prepared.keys().next().value!);
    return entry;
  }
  private async plan(
    target: Target,
    from: State,
    sourceWord: string,
  ): Promise<CheckedPlan> {
    const fallback = this.baseline(target, from, sourceWord);
    if (!this.planner || !fallback.word) return fallback;
    try {
      const word = await this.planner({
        design: this.design,
        from,
        sourceWord,
        target,
        fallbackWord: fallback.word,
      });
      demand(
        typeof word === "string" &&
          word.length <= Math.max(1000, fallback.word.length * 2),
        "Invalid calendar planner output",
      );
      const candidate = simplify(word);
      if (tokens(candidate).length < tokens(fallback.word).length) {
        const end = apply(from, candidate);
        demand(
          matches(end, target.cells),
          "Calendar planner missed the requested face",
        );
        return { word: candidate, end, route: "optimized" };
      }
    } catch {
      /* A solver failure cannot invalidate the independently checked fallback. */
    }
    return { ...fallback, route: "fallback" };
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
        const reference = this.sourceWord;
        this.progressTarget = target;
        this.completed = { htm: 0, rotations: 0 };
        this.total = { htm: 0, rotations: 0 };
        this.planning = Boolean(
          this.planner && !matches(this.state, target.cells),
        );
        let plan: CheckedPlan;
        if (this.planning) {
          this.changed(this.current, true);
          plan = await this.preparedFor(target).promise;
        } else plan = this.baseline(target, this.state, reference);
        this.planning = false;
        // A date selected during planning supersedes the result before any turn.
        if (this.desired) continue;
        this.routeKind = plan.route;
        this.total = countCalendarMoves(plan.word);
        this.changed(this.current, true);
        for (const token of tokens(plan.word)) {
          const next = apply(this.state, token);
          await this.port.animate(this.state, token, next);
          this.state = next;
          // Retain the real full-state reference even if this route is interrupted.
          this.sourceWord = simplify(this.sourceWord + " " + token);
          const cost = countCalendarMoves(token);
          this.completed = {
            htm: this.completed.htm + cost.htm,
            rotations: this.completed.rotations + cost.rotations,
          };
          this.changed(this.current, true);
          // Complete the active physical turn, then solve directly for the latest date.
          if (this.desired) break;
        }
        if (this.desired) continue;
        demand(
          sameState(this.state, plan.end) && matches(this.state, target.cells),
          "Calendar endpoint disagrees with its checked route",
        );
        const actualReference = this.sourceWord,
          canonical = sourcePose(this.design, target);
        this.sourceWord =
          sameState(this.state, canonical) &&
          tokens(target.word).length < tokens(actualReference).length
            ? target.word
            : actualReference;
        this.current = target;
      }
    } catch (e) {
      this.failed = true;
      this.desired = null;
      this.active = false;
      this.planning = false;
      this.changed(this.current, false, e);
      return;
    }
    this.active = false;
    this.changed(this.current, false);
  }
}
