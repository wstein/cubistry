import type { ModeShell } from "../shell/slot-api.ts";

/** Step intervals of the 1/10-Second Counter in milliseconds; 250 ms is the default quarter-turn time. */
export const TENTH_STEP_INTERVALS = [50, 100, 250, 500] as const;

const INTERVAL_LABELS: Readonly<Record<(typeof TENTH_STEP_INTERVALS)[number], string>> = {
  50: "50 ms (Fast)",
  100: "100 ms",
  250: "250 ms (Default)",
  500: "500 ms",
};

export interface TenthControlHandlers {
  /** Jumps to a digit 0 to 9. */
  set(value: number): void;
  /** Walks `count` steps; negative walks back. Already multiplied by the direction setting. */
  step(count: number): void;
  setStepInterval(ms: number): void;
}

type Doc = Pick<Document, "createElement">;

/**
 * Fills the dock slots of the 1/10-Second Counter: 1 Step (-5 / +5), 2 Value (0 to 9), 3 Mode (direction),
 * 4 Motion (step speed). Slot 5 stays empty: this cube has no print or appearance entry in the design. Listeners go
 * through `shell.listen`, so they end with the mode.
 */
export function mountTenthControls(shell: ModeShell, doc: Doc, handlers: TenthControlHandlers): void {
  let direction = 1;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, id?: string): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (id) el.id = id;
    return el;
  };
  const button = (text: string, id: string | undefined, onClick: () => void): HTMLButtonElement => {
    const b = make("button", text, id);
    b.setAttribute("type", "button");
    shell.listen(b, "click", onClick);
    return b;
  };
  const select = (id: string, label: string, options: readonly [string, string][], selected: string, onChange: (value: string) => void): HTMLElement => {
    const field = make("div");
    field.className = "shell-field";
    const lab = make("label", label);
    lab.setAttribute("for", id);
    const sel = make("select", undefined, id);
    for (const [value, text] of options) {
      const option = make("option", text);
      option.setAttribute("value", value);
      sel.append(option);
    }
    sel.value = selected;
    shell.listen(sel, "change", () => onChange(sel.value));
    field.append(lab, sel);
    return field;
  };

  const steps = make("div");
  steps.className = "shell-btn-row";
  steps.append(
    button("-5 Steps", "tenth-step-minus5", () => handlers.step(-5 * direction)),
    button("+5 Steps", "tenth-step-plus5", () => handlers.step(5 * direction)),
  );
  shell.setSlot(1, { label: "Step", element: steps });

  const grid = make("div");
  grid.className = "shell-quick-grid";
  for (let n = 0; n <= 9; n++) {
    const b = button(String(n), undefined, () => handlers.set(n));
    b.dataset.val = String(n);
    grid.append(b);
  }
  const help = make("p", "Period-1 {L, D, B} sequence with fast responsive stepping.");
  help.className = "small";
  shell.setSlot(2, { label: "Value", element: [grid, help] });

  shell.setSlot(3, {
    label: "Direction",
    element: select("tenth-direction-toggle", "Direction", [["1", "Forward (+1)"], ["-1", "Reverse (-1)"]], "1", (v) => {
      direction = Number(v);
    }),
  });

  shell.setSlot(4, {
    label: "Step speed",
    element: select(
      "tenth-speed-select",
      "Quarter-turn time",
      TENTH_STEP_INTERVALS.map((ms) => [String(ms), INTERVAL_LABELS[ms]] as [string, string]),
      "250",
      (v) => handlers.setStepInterval(Number(v)),
    ),
  });
}
