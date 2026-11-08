import type { ModeShell } from "../shell/slot-api.ts";
import type { Lettering } from "../hsm/lettering.ts";
import { CLOCK_SPEED_CHOICES_MS, CLOCK_UNIT_NAMES } from "./params.ts";

type Doc = Pick<Document, "createElement">;

export interface ClockControlOptions {
  /** IANA name of the browser's time zone, shown read-only. */
  zone: string;
  /** Preferred quarter-turn time per cube in milliseconds, in the order hours, minutes, seconds. */
  speeds: readonly [number, number, number];
  lettering: Lettering;
  /** A cube's preferred quarter-turn time changed. */
  onSpeed(index: number, ms: number): void;
  onLettering(value: Lettering): void;
}

export interface ClockControls {
  /** The selects start disabled and open when the cubes are ready. */
  setEnabled(enabled: boolean): void;
  /** Shows a lettering the mode set itself (for example after a failed change). */
  setLettering(value: Lettering): void;
}

const UNIT_LABEL = { hours: "Hours", minutes: "Minutes", seconds: "Seconds" } as const;
const SPEED_LABEL = (ms: number): string => (ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`);
const LETTERING_CHOICES: readonly (readonly [Lettering, string])[] = [
  ["symbols", "Large H / M / S"],
  ["words-pascal", "Small Hour / Min / Sec"],
  ["words", "Small hour / min / sec"],
];

/**
 * Fills the dock slots of the Live H-M-S Clock from the design's slot map: 2 Time zone (read-only), 4 Move time per
 * cube, 5 Label style. Slot 1 (Pause / Resume) and slot 3 (12 / 24-hour) are new features of the design that the Clock
 * page never had; they stay empty. Listeners go through `shell.listen`, so they end with the mode.
 */
export function mountClockControls(shell: ModeShell, doc: Doc, options: ClockControlOptions): ClockControls {
  const selects: HTMLSelectElement[] = [];
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, id?: string): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (id) el.id = id;
    return el;
  };
  const field = (label: string, select: HTMLSelectElement): HTMLElement => {
    const wrap = make("div");
    wrap.className = "shell-field";
    const lab = make("label", label);
    lab.setAttribute("for", select.id);
    wrap.append(lab, select);
    return wrap;
  };
  const choose = <T extends string>(id: string, choices: readonly (readonly [T, string])[], value: string): HTMLSelectElement => {
    const select = make("select", undefined, id);
    for (const [v, text] of choices) {
      const option = make("option", text);
      option.setAttribute("value", v);
      select.append(option);
    }
    select.value = value;
    select.disabled = true;
    selects.push(select);
    return select;
  };

  const zone = make("output", options.zone, "clock-zone");
  zone.className = "small";
  shell.setSlot(2, { label: "Time zone", element: zone });

  const speedFields = CLOCK_UNIT_NAMES.map((name, index) => {
    const select = choose(
      name + "-speed",
      CLOCK_SPEED_CHOICES_MS.map((ms) => [String(ms), SPEED_LABEL(ms)] as const),
      String(options.speeds[index]),
    );
    shell.listen(select, "change", () => options.onSpeed(index, Number(select.value)));
    return field(`${UNIT_LABEL[name]}: quarter-turn time`, select);
  });
  shell.setSlot(4, { label: "Move time, per cube", element: speedFields });

  const lettering = choose("clock-lettering", LETTERING_CHOICES, options.lettering);
  shell.listen(lettering, "change", () => options.onLettering(lettering.value as Lettering));
  shell.setSlot(5, { label: "Label style", element: field("Sticker lettering", lettering) });

  return {
    setEnabled(enabled) {
      for (const select of selects) select.disabled = !enabled;
    },
    setLettering(value) {
      lettering.value = value;
    },
  };
}
