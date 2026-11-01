/**
 * Per-print defaults of the Counter's Wrap and Leading Zero controls.
 *
 * The blank-top print's stored routes are cyclic (they include the 99->00
 * edge), so Wrap starts checked there; the titled print keeps Wrap off. On the
 * blank-top print the Leading Zero checkbox selects the physical LZ/NZ mode,
 * so its label says so; on the titled print it only masks the leading 0.
 */
export type CounterPrintId = "titled" | "blank-top";

/** Wrap's default for a print: on for the cyclic blank-top routes only. */
export const wrapDefault = (print: string): boolean => print === "blank-top";

/**
 * Wrap for a print: the user's explicit choice in this page session if there
 * is one (`null` means the user has not toggled Wrap), else the print default.
 */
export const wrapFor = (print: string, choice: boolean | null): boolean =>
  choice ?? wrapDefault(print);

/** Label of the Leading Zero checkbox on a print. */
export const leadingZeroLabel = (print: string): string =>
  print === "blank-top" ? "Leading zero mode (physical)" : "Leading Zero";
