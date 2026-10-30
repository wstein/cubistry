import { verifyExactWord } from "./solver-core.ts";
import type { Cube3Design, State } from "./model.ts";
export interface SolverWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}
/** Each bounded request owns a worker and its nested ordinary-solver workers. */
export class ExactPictureSolver {
  private worker: SolverWorker | null = null;
  private reject: ((error: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly createWorker: () => SolverWorker;
  private readonly timeoutMs: number;
  private disposed = false;
  constructor(createWorker: () => SolverWorker = () => new Worker(new URL("./solver-worker.ts", import.meta.url), { type: "module" }), timeoutMs = 20000) {
    this.createWorker = createWorker; this.timeoutMs = timeoutMs;
  }
  solve(design: Cube3Design, from: State): Promise<string> {
    this.cancel();
    return new Promise((resolve, reject) => {
      if (this.disposed) { reject(Error("Unavailable: exact solver has been closed.")); return; }
      const snapshot = structuredClone(from);
      this.reject = reject;
      const finish = (error?: Error, word?: string) => {
        if (this.reject !== reject) return;
        this.release(); if (error) reject(error); else resolve(word!);
      };
      try {
        const worker = this.createWorker(); this.worker = worker;
        worker.onmessage = event => {
          if (this.worker !== worker) return;
          try {
            if (event.data?.error) throw Error(String(event.data.error));
            finish(undefined, verifyExactWord(design, snapshot, event.data?.word));
          } catch (error) { finish(Error(`Unavailable: ${error instanceof Error ? error.message : "exact route was not verified"}`)); }
        };
        worker.onerror = worker.onmessageerror = () => finish(Error("Unavailable: exact solver worker failed. Retry Solve."));
        this.timer = setTimeout(() => finish(Error("Timeout: no verified exact route within 20 seconds. Retry Solve or restore the target.")), this.timeoutMs);
        worker.postMessage({ design, from: snapshot });
      } catch { finish(Error("Unavailable: exact solver could not start. Your puzzle is unchanged.")); }
    });
  }
  cancel(): void {
    const reject = this.reject;
    this.release(); reject?.(Error("Cancelled: exact solving stopped."));
  }
  private release(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.reject = null;
    if (this.worker) { this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null; this.worker.terminate(); }
    this.worker = null;
  }
  dispose(): void { this.disposed = true; this.cancel(); }
}
