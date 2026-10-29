import { TABLE_URL } from "@puzlwerk/solver-2x2";
import {
  createCounterSolver,
  type CounterSolver,
} from "../../adapters/puzlwerk-2x2.ts";
import type { PrintDefinition } from "@cubistry/cube-core";
export type FailureCode =
  | "Unsupported"
  | "NoPath"
  | "Invalid"
  | "Timeout"
  | "Unavailable";
export class PlaygroundError extends Error {
  readonly code: FailureCode;
  constructor(code: FailureCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PlaygroundError";
  }
}
/** App resource boundary. Provider verifies pinned table integrity before use. */
export function tableLoader(fetcher: typeof fetch = fetch, timeoutMs = 10000) {
  let cached: Promise<Uint8Array> | undefined;
  return () =>
    (cached ??= (async () => {
      const signal = AbortSignal.timeout(timeoutMs);
      const response = await fetcher(TABLE_URL, {
        signal,
        redirect: "error",
        credentials: "same-origin",
      });
      if (!response.ok)
        throw new PlaygroundError(
          "Unavailable",
          "Solver table could not be loaded.",
        );
      const expected = 1837112;
      const length = response.headers.get("content-length");
      if (length && Number(length) !== expected)
        throw new PlaygroundError("Invalid", "Unexpected solver table size.");
      if (!response.body)
        throw new PlaygroundError("Invalid", "Solver table has no body.");
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          signal.throwIfAborted();
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > expected)
            throw new PlaygroundError(
              "Invalid",
              "Solver table exceeds its pinned size.",
            );
          chunks.push(value);
        }
        if (size !== expected)
          throw new PlaygroundError("Invalid", "Truncated solver table.");
        const bytes = new Uint8Array(size);
        let at = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, at);
          at += chunk.length;
        }
        return bytes;
      } finally {
        await reader.cancel().catch(() => {});
      }
    })().catch((error) => {
      cached = undefined;
      throw error;
    }));
}
const load = tableLoader();
export type SolverFactory = (print: PrintDefinition) => Promise<CounterSolver>;
export const createPlaygroundSolver: SolverFactory = (print) => {
  if (print.topology.kind !== "cube" || print.topology.size !== 2)
    return Promise.reject(
      new PlaygroundError(
        "Unsupported",
        "Only the shared physical 2×2 profile is supported.",
      ),
    );
  return createCounterSolver(print, load);
};
export function solverFailure(error: unknown): {
  code: FailureCode;
  message: string;
} {
  if (error instanceof PlaygroundError)
    return { code: error.code, message: error.message };
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return {
      code: "Timeout",
      message: "Solver preparation timed out. Try again.",
    };
  const message =
    error instanceof Error ? error.message : "Solver unavailable.";
  return {
    code: /SHA-256|checksum|integrity|replay|incompatible|mismatch|Unsupported.*move|Invalid/.test(
      message,
    )
      ? "Invalid"
      : "Unavailable",
    message,
  };
}
