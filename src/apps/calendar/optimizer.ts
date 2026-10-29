import type {
  CalendarPlanningContext,
  CalendarRoutePlanner,
} from "./controller.ts";
export interface PlanningWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}
interface Request {
  readonly id: number;
  readonly context: CalendarPlanningContext;
  readonly resolve: (word: string) => void;
  readonly reject: (error: Error) => void;
}
/** At most one solve and one replaceable pending request; hard worker deadline. */
export class CalendarOptimizer {
  private worker: PlanningWorker | null = null;
  private active: Request | null = null;
  private pending: Request | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private serial = 0;
  private disposed = false;
  private readonly createWorker: () => PlanningWorker;
  private readonly timeoutMs: number;
  constructor(
    createWorker: () => PlanningWorker = () =>
      new Worker(new URL("./optimizer-worker.ts", import.meta.url), {
        type: "module",
      }),
    timeoutMs = 8000,
  ) {
    this.createWorker = createWorker;
    this.timeoutMs = timeoutMs;
  }
  readonly plan: CalendarRoutePlanner = (context) =>
    new Promise((resolve, reject) => {
      if (this.disposed) return reject(Error("Calendar optimizer disposed"));
      const request = { id: ++this.serial, context, resolve, reject };
      if (this.active) {
        this.pending?.reject(Error("Calendar planning request superseded"));
        this.pending = request;
      } else this.start(request);
    });
  private start(request: Request): void {
    this.active = request;
    try {
      if (!this.worker) this.worker = this.createWorker();
      const worker = this.worker;
      worker.onmessage = ({ data }) => {
        if (
          this.worker !== worker ||
          this.active?.id !== request.id ||
          request.id !== data?.id
        )
          return;
        this.finish(
          typeof data.word === "string"
            ? null
            : Error("Calendar optimizer failed"),
          data.word,
        );
      };
      worker.onerror = () => {
        if (this.worker === worker && this.active?.id === request.id)
          this.finish(Error("Calendar solver worker failed"));
      };
      worker.onmessageerror = () => {
        if (this.worker === worker && this.active?.id === request.id)
          this.finish(Error("Calendar solver message failed"));
      };
      this.timer = setTimeout(() => {
        if (this.active?.id === request.id)
          this.finish(Error("Calendar solver deadline exceeded"));
      }, this.timeoutMs);
      worker.postMessage({ id: request.id, context: request.context });
    } catch {
      this.finish(Error("Calendar solver worker unavailable"));
    }
  }
  private finish(error: Error | null, word = ""): void {
    const request = this.active;
    if (!request) return;
    this.active = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (error) {
      this.worker?.terminate();
      this.worker = null;
      request.reject(error);
    } else request.resolve(word);
    const next = this.pending;
    this.pending = null;
    if (next) this.start(next);
  }
  dispose(): void {
    this.disposed = true;
    this.pending?.reject(Error("Calendar optimizer disposed"));
    this.pending = null;
    this.finish(Error("Calendar optimizer disposed"));
    this.worker?.terminate();
    this.worker = null;
  }
}
