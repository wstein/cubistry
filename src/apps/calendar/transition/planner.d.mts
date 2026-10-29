import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import type { State, Target } from "../model.ts";
export function createTransitionOptimizer(options: {
  printing: State;
  kpuzzle: KPuzzle;
  KPattern: typeof KPattern;
  solve: (
    pattern: KPattern,
  ) => Promise<{ toString(): string; invert(): { toString(): string } }>;
  corrections: readonly { word: string; equivalentWords?: readonly string[] }[];
}): {
  plan(
    from: State,
    target: Target,
    fallbackWord: string,
    options?: {
      maxAttempts?: number;
      timeBudgetMs?: number;
    },
  ): Promise<{ word: string }>;
};

export function appendCenterRepair(
  prefix: string,
  repairWord: string,
  equivalentWords?: readonly string[],
): {
  word: string;
  repairOffset: number;
  repairVariant: number;
  repairHTM: number;
  repairBoundarySavings: number;
};
