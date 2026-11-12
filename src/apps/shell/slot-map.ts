import { SLOT_NUMBERS, type SlotNumber } from "./slot-api.ts";

/**
 * Which dock slots each mode fills, copied from the slot map of the design (docs/design/README.md, "Slot map"); the
 * table test tests/shell-slot-map.test.mjs compares both. `null` is a dash in the design: the slot stays hidden.
 */
export interface SlotMapRow {
  /** First column of the design table. */
  designRow: string;
  /** Mode ids that share the row. */
  modes: readonly string[];
  /** False for rows whose application has no mode in the registry yet. */
  registered: boolean;
  /** Slots 1 to 5, in order. */
  slots: readonly [string | null, string | null, string | null, string | null, string | null];
}

export const SLOT_MAP: readonly SlotMapRow[] = [
  {
    designRow: "Live H-M-S Clock",
    modes: ["clock"],
    registered: true,
    slots: ["Pause / Resume", "Time zone (read-only)", "12 / 24-hour", "Move time, per cube", "Label style"],
  },
  {
    designRow: "H-M Wall Clock",
    modes: ["hm-clock"],
    registered: true,
    slots: ["Pause / Resume", "Time zone", "12 / 24-hour", "Move time, per cube", "Label style"],
  },
  {
    designRow: "M/S Timer & Stopwatch",
    modes: ["ms-timer"],
    registered: true,
    slots: ["Start / Pause / Resume", "Duration MM:SS.d, Set, Reset", "Countdown / Stopwatch", "Move time", "Leading zero"],
  },
  {
    designRow: "60-Minute Workshop Timer",
    modes: ["timer"],
    registered: true,
    slots: ["Start / Pause", "Minutes, Set, Reset", "Countdown / Stopwatch", "Move time", "Leading zero"],
  },
  {
    designRow: "5-Second Precision Timer",
    modes: ["five-second-timer"],
    registered: true,
    slots: ["Start / Pause", "Seconds, Set, Reset", "Countdown / Stopwatch", "Move time", null],
  },
  {
    designRow: "Counter 0-99",
    modes: ["counter"],
    registered: true,
    slots: ["Run / Stop", "Value, Set", "Stop after, Wrap", "Move time", "Leading zero"],
  },
  {
    designRow: "1/10-Second Counter",
    modes: ["tenth"],
    registered: true,
    slots: ["Run / Stop", "Value, Set", "Stop after, Wrap", "Move time", null],
  },
  {
    designRow: "H/M/S, M/S, H/M Counters",
    modes: ["hsm-counter", "ms-counter", "hm-one-cube"],
    registered: true,
    slots: ["Run / Stop", "Value, Set", "Unit, Stop after, Wrap", "Move time", "Leading zero"],
  },
  {
    designRow: "Calendar",
    modes: ["calendar"],
    registered: true,
    slots: ["Today", "Show date", "Sticker language DE / EN", "Move time", "Display font"],
  },
  {
    designRow: "Picture Cube (2×2 to 7×7)",
    modes: ["playground"],
    registered: true,
    slots: ["Scramble / Solve", "18 turn buttons", "Cube size 2-7, Undo, Redo", "Move time", "Design, Your pictures"],
  },
  {
    designRow: "CI Quality Cube",
    modes: ["ci"],
    registered: true,
    slots: ["Refresh status", "Workflow list", null, null, null],
  },
];

/**
 * Modes whose slots differ from the design row, accepted by the owner. `slots` are the labels the mode sets today,
 * `omitted` the design entries it does not have. The design row stays in `SLOT_MAP` (it is compared with the design).
 */
export interface AcceptedDeviation {
  slots: readonly [string | null, string | null, string | null, string | null, string | null];
  omitted: readonly string[];
  decision: string;
}

export const ACCEPTED_DEVIATIONS: Readonly<Record<string, AcceptedDeviation>> = {
  tenth: {
    slots: ["Step", "Value", "Direction", "Step speed", null],
    omitted: ["Run / Stop", "Stop after", "Wrap"],
    decision: "owner decision 5, 2026-11-08",
  },
  ci: {
    slots: ["Simulated events", "Workflow", null, null, null],
    omitted: ["Refresh status", "Workflow list"],
    decision: "owner decision 2026-11-12: local simulation has no external refresh or workflow list",
  },
};

/**
 * Registered modes that the design's slot map does not cover. `calendar7` is a research candidate (plain HTML, no
 * cube stage); it fills no slot until the design gives it a row.
 */
export const NO_DESIGN_ROW: readonly string[] = ["calendar7"];

/** `migrated`: the mode fills its slots through `ModeShell`. `pending`: it still renders its own HUD controls. */
export type MigrationStatus = "pending" | "migrated";

export const MIGRATION: Readonly<Record<string, MigrationStatus>> = {
  clock: "pending",
  "ms-timer": "pending",
  "hm-clock": "pending",
  tenth: "migrated",
  counter: "pending",
  timer: "pending",
  "five-second-timer": "pending",
  "hsm-counter": "pending",
  "ms-counter": "pending",
  "hm-one-cube": "pending",
  calendar: "pending",
  calendar7: "pending",
  ci: "migrated",
  playground: "migrated",
};

/** The slot numbers the design fills for a mode (also for modes that are not in the registry yet). */
export function slotsOf(modeId: string): SlotNumber[] {
  if (NO_DESIGN_ROW.includes(modeId)) return [];
  const row = SLOT_MAP.find((r) => r.modes.includes(modeId));
  if (!row) throw new Error(`unknown mode ${JSON.stringify(modeId)}`);
  return SLOT_NUMBERS.filter((n) => row.slots[n - 1] !== null);
}
