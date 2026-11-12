// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Shared dock-slot controls that replace a `<select>`: a row of tappable chips (a radio group) for a small fixed set of
 * states and a stop slider for an ordered scale. Both take the document, the element factory and `shell.listen` from the
 * caller, so a mode's listeners end with the mode and node tests can run them with a small fake DOM.
 */

type Doc = Pick<Document, "createElement">;
type Listen = (target: EventTarget, type: string, handler: (event: Event) => void) => void;

export interface ChipOption {
  value: string;
  /** Visible word; color is never the only carrier of the state. */
  label: string;
  /** Visible symbol (decorative for assistive technology; the label carries the name). */
  symbol: string;
  /** Optional tone name; src/shell/shell.css maps `data-tone` to a color. */
  tone?: string;
}

export interface ChipGroupOptions {
  /** Id of the radio group element. */
  id: string;
  label: string;
  options: readonly ChipOption[];
  value: string;
  onChange(value: string): void;
}

export interface ChipGroup {
  /** The labeled field to put into a dock slot. */
  element: HTMLElement;
  /** The radio group (carries `id`, `role="radiogroup"`, `data-value`, `aria-disabled`). */
  group: HTMLElement;
  /** Shows a value without calling `onChange`. */
  set(value: string): void;
  setDisabled(disabled: boolean): void;
}

/**
 * One chip per option, exactly one checked. Click or tap selects; the arrow keys move the selection (and focus) like a
 * native radio group, wrapping at the ends; Home and End jump. Only the checked chip is in the tab order.
 */
export function createChipGroup(doc: Doc, listen: Listen, options: ChipGroupOptions): ChipGroup {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, id?: string): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (id) el.id = id;
    return el;
  };
  const element = make("div");
  element.className = "shell-field";
  const caption = make("span", options.label, `${options.id}-label`);
  caption.className = "shell-field-label";
  const group = make("div", undefined, options.id);
  group.className = "shell-chip-row";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", caption.id);
  element.append(caption, group);

  let current = options.value;
  const chips = options.options.map((option) => {
    const chip = make("button", undefined, `${options.id}-${option.value}`);
    chip.setAttribute("type", "button");
    chip.setAttribute("role", "radio");
    chip.className = "shell-choice";
    chip.dataset.value = option.value;
    if (option.tone) chip.dataset.tone = option.tone;
    const symbol = make("span", option.symbol);
    symbol.className = "shell-choice-symbol";
    symbol.setAttribute("aria-hidden", "true");
    const word = make("span", option.label);
    chip.append(symbol, word);
    group.append(chip);
    return { option, chip };
  });
  const paint = (): void => {
    group.dataset.value = current;
    for (const { option, chip } of chips) {
      const on = option.value === current;
      chip.setAttribute("aria-checked", String(on));
      chip.setAttribute("tabindex", on ? "0" : "-1");
      chip.dataset.checked = String(on);
    }
  };
  const choose = (index: number, focus: boolean): void => {
    const { option, chip } = chips[(index + chips.length) % chips.length];
    if (focus) chip.focus();
    if (option.value === current) return;
    current = option.value;
    paint();
    options.onChange(option.value);
  };
  chips.forEach(({ chip }, index) => {
    listen(chip, "click", () => choose(index, false));
    listen(chip, "keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      const at = chips.findIndex((c) => c.option.value === current);
      const target =
        key === "ArrowRight" || key === "ArrowDown" ? at + 1
        : key === "ArrowLeft" || key === "ArrowUp" ? at - 1
        : key === "Home" ? 0
        : key === "End" ? chips.length - 1
        : null;
      if (target === null) return;
      event.preventDefault();
      choose(target, true);
    });
  });
  paint();
  return {
    element,
    group,
    set(value) {
      if (!chips.some((c) => c.option.value === value)) return;
      current = value;
      paint();
    },
    setDisabled(next) {
      group.setAttribute("aria-disabled", String(next));
      for (const { chip } of chips) chip.disabled = next;
    },
  };
}

export interface StopSliderOptions {
  /** Id of the range input. */
  id: string;
  label: string;
  /** The stops in slider order, left (slow) to right (fast). */
  stops: readonly number[];
  value: number;
  /** Text at the two ends, for example "slow" and "fast". */
  ends: readonly [string, string];
  format(stop: number): string;
  onChange(stop: number): void;
}

export interface StopSlider {
  element: HTMLElement;
  input: HTMLInputElement;
  /** Shows a stop without calling `onChange`; a value that is not a stop is ignored. */
  set(stop: number): void;
  setDisabled(disabled: boolean): void;
}

/**
 * A range input that snaps to the given stops (its value is the stop index, so the arrow keys move one stop). The
 * current stop is shown as text and exposed as `data-value` and `aria-valuetext`.
 */
export function createStopSlider(doc: Doc, listen: Listen, options: StopSliderOptions): StopSlider {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, id?: string): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (id) el.id = id;
    return el;
  };
  const element = make("div");
  element.className = "shell-field";
  const caption = make("label", options.label);
  caption.setAttribute("for", options.id);
  const input = make("input", undefined, options.id);
  input.setAttribute("type", "range");
  input.setAttribute("min", "0");
  input.setAttribute("max", String(options.stops.length - 1));
  input.setAttribute("step", "1");
  input.className = "shell-stop-slider";
  const reading = make("output", undefined, `${options.id}-value`);
  reading.className = "shell-stop-value";
  const ends = make("div");
  ends.className = "shell-stop-ends";
  ends.append(make("span", options.ends[0]), reading, make("span", options.ends[1]));
  element.append(caption, input, ends);

  let current = options.value;
  const paint = (): void => {
    const index = options.stops.indexOf(current);
    input.value = String(index);
    input.dataset.value = String(current);
    input.setAttribute("aria-valuetext", options.format(current));
    reading.textContent = options.format(current);
  };
  listen(input, "input", () => {
    const stop = options.stops[Number(input.value)];
    if (stop === undefined || stop === current) return;
    current = stop;
    paint();
    options.onChange(stop);
  });
  paint();
  return {
    element,
    input,
    set(stop) {
      if (!options.stops.includes(stop)) return;
      current = stop;
      paint();
    },
    setDisabled(disabled) {
      input.disabled = disabled;
    },
  };
}
