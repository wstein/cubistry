// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Snapshot, StatusDefinition } from "./definition.ts";

/** URL parameter of the CI Quality Cube mode (`index.html?app=ci`): quarter-turn time in milliseconds. */
export const SPEED_PARAM = "speed";
/** The quarter-turn times the speed control offers, in milliseconds. */
export const SPEED_CHOICES = [2000, 1000, 500, 250, 100, 50, 10] as const;
export const DEFAULT_TURN_MS = 250;

/** What the URL asks for: the quarter-turn time and the snapshot the cube is requested to show after loading. */
export interface StatusParams {
  readonly turnMs: number;
  readonly snapshot: Snapshot;
}

type Shape = Pick<StatusDefinition, "categories" | "states" | "initial">;

/**
 * Reads the parameters of the mode: `speed=<ms>` and one parameter per category (`build`, `test`, `analyze`, `review`)
 * with a state id. A missing, repeated-invalid, unknown or non-listed value falls back to the default of that one
 * parameter (250 ms; the initial state of the category); it never fails and never affects the other parameters.
 */
export function parseStatusParams(params: URLSearchParams, definition: Shape): StatusParams {
  const speed = params.get("speed");
  const turnMs = (SPEED_CHOICES as readonly number[]).find((choice) => String(choice) === speed) ?? DEFAULT_TURN_MS;
  const snapshot = definition.categories.map((category, i) => {
    const value = params.get(category.id);
    return definition.states.some((state) => state.id === value) ? (value as string) : definition.initial[i];
  });
  return { turnMs, snapshot: Object.freeze(snapshot) };
}

/** The query that `parseStatusParams` reads back to the same value; defaults are left out. */
export function serializeStatusParams(value: StatusParams, definition: Shape): URLSearchParams {
  const out = new URLSearchParams();
  if (value.turnMs !== DEFAULT_TURN_MS) out.set(SPEED_PARAM, String(value.turnMs));
  definition.categories.forEach((category, i) => {
    if (value.snapshot[i] !== definition.initial[i]) out.set(category.id, value.snapshot[i]);
  });
  return out;
}
