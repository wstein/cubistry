/** Compiling protocol sketches only; not solver/codec implementations. */
import type {
  CubeState,
  DisplayTarget,
  LegalMove,
  PrintDefinition,
} from "../../../packages/cube-core/src/index.ts";
export type Goal =
  | {
      readonly kind: "classical-solved";
      readonly frame: "exact" | "modulo-global-rotation";
    }
  | {
      readonly kind: "image-target";
      readonly frame: "exact";
      readonly target: DisplayTarget;
    };
export interface SolverCapability {
  readonly size: number;
  readonly goalKind: Goal["kind"];
  readonly frame: Goal["frame"];
  readonly backend: string;
  readonly metric: "HTM" | "QTM";
  readonly optimality: "optimal" | "best-known" | "unknown";
}
export interface SolveRequest {
  readonly print: PrintDefinition;
  readonly state: CubeState;
  readonly goal: Goal;
  readonly budget: {
    readonly coldStartMs: number;
    readonly searchMs: number;
    readonly maxMemoryBytes: number;
  };
  readonly signal: AbortSignal;
}
export type SolveResult =
  | { readonly status: "unsupported"; readonly reason: string }
  | {
      readonly status: "timeout" | "cancelled" | "unknown";
      readonly reason: string;
    }
  | {
      readonly status: "solution";
      readonly moves: readonly LegalMove[];
      readonly backend: string;
      readonly metric: "HTM" | "QTM";
      readonly optimality: "optimal" | "best-known" | "unknown";
      readonly replayVerified: boolean;
    };
export interface SolverAdapter {
  readonly capabilities: readonly SolverCapability[];
  solve(request: SolveRequest): Promise<SolveResult>;
}
export type CodecResult<T> =
  | { readonly status: "lossless"; readonly value: T }
  | {
      readonly status: "lossy";
      readonly value: T;
      readonly losses: readonly (
        | "sticker-identities"
        | "image-assets"
        | "local-up-frames"
        | "center-identities"
        | "color-scheme"
      )[];
    }
  | { readonly status: "unsupported"; readonly reason: string };
export interface CodecAdapter {
  readonly conventionVersion: string;
  readonly supportedSizes: readonly number[];
  encode(print: PrintDefinition, state: CubeState): CodecResult<string>;
  decode(
    text: string,
  ): CodecResult<{ print: PrintDefinition; state: CubeState }>;
}
export function negotiate(
  capabilities: readonly SolverCapability[],
  size: number,
  goal: Goal,
): SolverCapability | undefined {
  return capabilities.find(
    (c) =>
      c.size === size && c.goalKind === goal.kind && c.frame === goal.frame,
  );
}
