import type {
  CalendarPlanningContext,
  CalendarRoutePlanner,
  CalendarReferenceContext,
} from "./controller.ts";
import { apply, sameState, type State, type Target } from "./model.ts";
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
  interimWord?: string;
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
  private references = new Map<
    Target,
    {
      from: State;
      end: State;
      fromReferenceWord: string;
      endReferenceWord: string;
    }
  >();
  diagnostics: Readonly<Record<string, unknown>> | null = null;
  constructor(
    createWorker: () => PlanningWorker = () =>
      new Worker(new URL("./optimizer-worker.ts", import.meta.url), {
        type: "module",
      }),
    timeoutMs = 8000,
  ) {
    this.createWorker = createWorker;
    this.timeoutMs = timeoutMs;
    this.plan.cancelPlanning = () => {
      this.pending?.reject(Error("Calendar planning superseded"));
      this.pending = null;
      if (this.active) this.finish(Error("Calendar planning superseded"));
    };
    this.plan.compactReference = ({
      state,
      target,
      referenceWord,
    }: CalendarReferenceContext) => {
      const record = this.references.get(target);
      return record && sameState(record.from, state)
        ? record.fromReferenceWord
        : record && sameState(record.end, state)
          ? record.endReferenceWord
          : referenceWord;
    };
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
        if (typeof data.interimWord === "string") {
          request.interimWord = data.interimWord;
          this.retainReferences(request, data.interimWord, data.references);
          return;
        }
        if (data.diagnostics && typeof data.diagnostics === "object")
          this.diagnostics = Object.freeze({ ...data.diagnostics });
        if (typeof data.word === "string")
          this.retainReferences(request, data.word, data.references);
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
  private retainReferences(
    request: Request,
    word: string,
    value: unknown,
  ): void {
    if (!value || typeof value !== "object") return;
    const reference = value as {
      fromReferenceWord?: unknown;
      endReferenceWord?: unknown;
    };
    if (
      typeof reference.fromReferenceWord !== "string" ||
      typeof reference.endReferenceWord !== "string" ||
      reference.fromReferenceWord.length > 8192 ||
      reference.endReferenceWord.length > 8192
    )
      return;
    try {
      this.references.delete(request.context.target);
      this.references.set(request.context.target, {
        from: request.context.from,
        end: apply(request.context.from, word),
        fromReferenceWord: reference.fromReferenceWord,
        endReferenceWord: reference.endReferenceWord,
      });
      while (this.references.size > 4)
        this.references.delete(this.references.keys().next().value!);
    } catch {
      /* The controller still validates every returned route and reference. */
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
      if (request.interimWord !== undefined && !this.disposed) {
        this.diagnostics = Object.freeze({
          backendUsed: "direct",
          solverStatus: error.message.includes("deadline")
            ? "deadline"
            : error.message.includes("superseded")
              ? "superseded"
              : "worker-failure",
        });
        request.resolve(request.interimWord);
      } else request.reject(error);
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
