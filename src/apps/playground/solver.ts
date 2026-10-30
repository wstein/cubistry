import { TABLE_URL, TABLE_SHA256 } from "@puzlwerk/solver-2x2";
import {
  createCounterSolver,
  type CounterSolver,
} from "../../adapters/puzlwerk-2x2.ts";
import { sha256 } from "@cubistry/cube-assets";
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
  let reload = false;
  return () =>
    (cached ??= (async () => {
      const signal = AbortSignal.timeout(timeoutMs);
      const response = await fetcher(TABLE_URL, {
        signal,
        redirect: "error",
        credentials: "same-origin",
        cache: reload ? "reload" : "default",
      });
      const html = /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
        response.headers.get("content-type") ?? "",
      );
      if (!response.ok || html || !response.body) {
        await response.body?.cancel().catch(() => {});
        throw new PlaygroundError("Unavailable", !response.ok
          ? `Solver table request failed (HTTP ${response.status}). Try again.`
          : html ? "Solver table request returned HTML instead of binary data. Check the asset path and try again."
          : "Solver table response has no body. Try again.");
      }
      const expected = 1837112;
      // Content-Length describes the encoded transfer. Fetch yields decoded
      // bytes, so bound/count those bytes instead, including gzip responses.
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
              "Unavailable",
              "Solver table exceeds its pinned decoded size. Try again.",
            );
          chunks.push(value);
        }
        if (size !== expected)
          throw new PlaygroundError("Unavailable", "Truncated solver table. Try again.");
        const bytes = new Uint8Array(size);
        let at = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, at);
          at += chunk.length;
        }
        if (await sha256(bytes) !== TABLE_SHA256)
          throw new PlaygroundError("Unavailable", "Solver table SHA-256 integrity mismatch. Try again.");
        signal.throwIfAborted();
        return bytes;
      } finally {
        await reader.cancel().catch(() => {});
      }
    })().catch((error) => {
      cached = undefined;
      reload = true;
      if (error instanceof PlaygroundError ||
          error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
        throw error;
      throw new PlaygroundError("Unavailable",
        `Solver table initialization failed: ${error instanceof Error ? error.message : "Transfer failed. Try again."}`);
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
  if (/^(?:Solver table\b|Invalid table length\b|The optimal 2×2 solver table\b)/.test(message))
    return { code: "Unavailable", message };
  return {
    code: /SHA-256|checksum|integrity|replay|incompatible|mismatch|Unsupported.*move|Invalid/.test(
      message,
    )
      ? "Invalid"
      : "Unavailable",
    message,
  };
}
