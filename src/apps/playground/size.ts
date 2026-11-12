import { CAPABILITY } from "./model.ts";

/** The cube sizes of the Picture Cube size control (owner decision 2026-11-10: segment control 2 to 7). */
export const CUBE_SIZES: readonly number[] = [2, 3, 4, 5, 6, 7];
/**
 * The sizes this page can turn. The shared mechanics and viewer run size 2 only (`CAPABILITY.size`); a larger size is
 * offered in the control but disabled until an engine for it is in the page.
 */
export const PLAYABLE_SIZES: readonly number[] = [CAPABILITY.size];
/** The owner default is 3; it moves there with the change that makes 3 playable. */
export const DEFAULT_SIZE = CAPABILITY.size;

export interface SizeChoice {
  /** The size the page shows and plays: always one of `PLAYABLE_SIZES`. */
  size: number;
  /** The valid size the URL asked for, or null when there was none or it was invalid. */
  requested: number | null;
  /** A short sentence for the page when the request could not be followed, else "". */
  note: string;
}

/** Notes that the size control shows next to the segments. Derived from `CUBE_SIZES` and `PLAYABLE_SIZES`. */
export const sizeNote = (): string => {
  const pending = CUBE_SIZES.filter((n) => !PLAYABLE_SIZES.includes(n));
  if (pending.length === 0) return "";
  const first = pending[0];
  const last = pending[pending.length - 1];
  const range = first === last ? String(first) : `${first} to ${last}`;
  const playable = PLAYABLE_SIZES.map((n) => `${n}×${n}`).join(", ");
  return `Sizes ${range} are not playable yet. This page turns the ${playable} only.`;
};

/** Reads the value of `size=`: a whole number from 2 to 7 is valid, anything else falls back to the default. */
export function resolveSize(raw: string | null): SizeChoice {
  if (raw === null) return { size: DEFAULT_SIZE, requested: null, note: "" };
  const n = /^[2-7]$/.test(raw) ? Number(raw) : null;
  if (n === null)
    return {
      size: DEFAULT_SIZE,
      requested: null,
      note: `size= must be a whole number from 2 to 7. Showing ${DEFAULT_SIZE}×${DEFAULT_SIZE}.`,
    };
  if (PLAYABLE_SIZES.includes(n)) return { size: n, requested: n, note: "" };
  return {
    size: DEFAULT_SIZE,
    requested: n,
    note: `${n}×${n} is not playable yet. Showing ${DEFAULT_SIZE}×${DEFAULT_SIZE}.`,
  };
}

/** The query string with `size=` set to `size`; other parameters are kept. */
export function sizeSearch(search: string, size: number): string {
  const params = new URLSearchParams(search);
  params.set("size", String(size));
  return `?${params}`;
}
