import type { IsCurrent } from "../chronocube/mode-switch.ts";

/**
 * The mode-facing API of the unified shell (docs/design/README.md: dock slots, status zone, primary action, readout,
 * Nerd drawer, hints, reference view). A mode never touches those regions of index.html itself: it receives a
 * `ModeShell` on mount (`MountContext.shell`) and fills the regions through it.
 *
 * Lifetime: `ShellHost.begin(isCurrent)` hands out one `ModeShell` per mount and empties every region first. Every
 * write of a `ModeShell` is dropped once its mode was replaced (`isCurrent()` is false, a newer `begin` happened, or
 * `dispose()` ran), so a mode that is superseded during an async init cannot put content into the next mode. The
 * router calls `dispose()` with the mode's own cleanup; nothing else has to be undone by the mode.
 */

export const SLOT_NUMBERS = [1, 2, 3, 4, 5] as const;
export type SlotNumber = (typeof SLOT_NUMBERS)[number];

/** What each slot is for, from the slot map of the design. A mode may use a more specific label. */
export const SLOT_ROLES: Readonly<Record<SlotNumber, string>> = {
  1: "Action",
  2: "Value",
  3: "Mode",
  4: "Motion",
  5: "Print & appearance",
};

/** Chip states; each maps to the design token `--s-<state>` (src/shell/tokens.css). */
export const STATUS_STATES = ["ready", "moving", "sync", "paused", "done", "warn", "error"] as const;
export type StatusState = (typeof STATUS_STATES)[number];

const STATUS_LABELS: Readonly<Record<StatusState, string>> = {
  ready: "Ready",
  moving: "Moving",
  sync: "Syncing",
  paused: "Paused",
  done: "Done",
  warn: "Warning",
  error: "Error",
};

/** Content of one dock slot: a label (the heading of the group) and either ready elements or a render function. */
export type SlotSpec =
  | { label: string; element: Node | readonly Node[]; render?: undefined }
  | { label: string; element?: undefined; render: (body: HTMLElement) => void | (() => void) };

export interface PrimaryActionSpec {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface PrimaryActionHandle {
  update(patch: { label?: string; disabled?: boolean }): void;
}

export interface ReadoutItem {
  /** Short caption such as "Hours". */
  role: string;
  value: string;
}

/** Content of the Nerd drawer. `render` runs only while the drawer is open and again on `refreshNerd()`. */
export interface NerdSpec {
  title: string;
  render: (body: HTMLElement) => void | (() => void);
}

export interface ModeShell {
  /** Fills slot `n` (1 to 5), replacing what it held. The label becomes the heading of the group. */
  setSlot(n: SlotNumber, spec: SlotSpec): void;
  clearSlot(n: SlotNumber): void;
  clearSlots(): void;

  /** The one berry button of the dock. A second call replaces the first. */
  setPrimaryAction(spec: PrimaryActionSpec): PrimaryActionHandle;
  clearPrimaryAction(): void;

  /**
   * Sets the status chip. Call it on state transitions only: a call with the same state and text writes nothing. The
   * status zone is a live region; do not put values that change per frame into `text`.
   */
  setStatus(state: StatusState, text?: string): void;
  clearStatus(): void;

  /** The readout bar under the stage: plain text, no live region. */
  setReadout(items: readonly ReadoutItem[]): void;
  updateReadout(index: number, value: string): void;
  clearReadout(): void;

  /** Content of the Nerd drawer; the drawer opens through the Nerd button, which appears only with content. */
  setNerd(spec: NerdSpec): void;
  /** Re-renders the drawer if it is open; does nothing while it is closed. */
  refreshNerd(): void;
  clearNerd(): void;

  /** A one-line hint over the stage (`null` hides it) and the "Reference view" button (`null` hides it). */
  setHint(text: string | null): void;
  setReferenceView(onActivate: (() => void) | null): void;

  /** `target.addEventListener` that is skipped for a stale mode and removed on dispose. */
  listen(target: EventTarget, type: string, handler: (event: Event) => void, options?: AddEventListenerOptions): void;
  /** Runs `fn` once on dispose, last registered first. */
  onDispose(fn: () => void): void;
  /** Empties what this shell put into the regions (unless a newer mode owns them) and ends all writes. */
  dispose(): void;
}

/** The elements of index.html that the shell drives. */
export interface ShellRegions {
  status: HTMLElement;
  primary: HTMLElement;
  slots: Readonly<Record<SlotNumber, HTMLElement>>;
  readout: HTMLElement;
  nerd: HTMLElement;
  /** The Nerd button; hidden unless a mode set nerd content. May be null on pages without one. */
  nerdToggle: HTMLElement | null;
  hints: HTMLElement;
  reference: HTMLElement;
}

export interface ShellHost {
  /** Empties every region and returns the shell of the new mount; earlier shells stop working. */
  begin(isCurrent: IsCurrent): ModeShell;
  /** Empties every region and ends the shell of the running mode. */
  reset(): void;
  /** Removes the host's own listeners. */
  destroy(): void;
}

type Doc = Pick<Document, "createElement">;

/** Locates the regions by their `data-region` / `data-slot` markers (index.html). Throws when one is missing. */
export function findShellRegions(root: Pick<ParentNode, "querySelector">): ShellRegions {
  const need = (selector: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`shell region missing: ${selector}`);
    return el;
  };
  const slots = Object.fromEntries(SLOT_NUMBERS.map((n) => [n, need(`[data-slot="${n}"]`)])) as Record<SlotNumber, HTMLElement>;
  return {
    status: need('[data-region="status-zone"]'),
    primary: need('[data-region="primary-action"]'),
    slots,
    readout: need('[data-region="readout"]'),
    nerd: need('[data-region="nerd-drawer"]'),
    nerdToggle: root.querySelector<HTMLElement>("#nerd-toggle"),
    hints: need('[data-region="hints"]'),
    reference: need('[data-region="reference-view"]'),
  };
}

const NOOP_HANDLE: PrimaryActionHandle = { update: () => {} };

/** A shell that accepts every call and does nothing; used when a mode runs without a host (node tests). */
export function createInertShell(): ModeShell {
  return {
    setSlot: () => {},
    clearSlot: () => {},
    clearSlots: () => {},
    setPrimaryAction: () => NOOP_HANDLE,
    clearPrimaryAction: () => {},
    setStatus: () => {},
    clearStatus: () => {},
    setReadout: () => {},
    updateReadout: () => {},
    clearReadout: () => {},
    setNerd: () => {},
    refreshNerd: () => {},
    clearNerd: () => {},
    setHint: () => {},
    setReferenceView: () => {},
    listen: () => {},
    onDispose: () => {},
    dispose: () => {},
  };
}

function assertSlot(n: number): asserts n is SlotNumber {
  if (!SLOT_NUMBERS.includes(n as SlotNumber)) throw new RangeError(`slot must be 1 to 5, got ${n}`);
}

export interface ShellHostOptions {
  /** The drawer starts open (URL parameter `nerd=1`); it shows as soon as a mode gives it content. */
  nerdOpen?: boolean;
}

/** True for the URL parameter `nerd=1`; any other value leaves the drawer closed. */
export function nerdOpenFromSearch(search: string): boolean {
  return new URLSearchParams(search).get("nerd") === "1";
}

export function createShellHost(regions: ShellRegions, doc: Doc, options: ShellHostOptions = {}): ShellHost {
  /** Identifies the shell that owns the regions; a new `begin` replaces it. */
  let owner: object | null = null;
  /** The shell of the running mode, ended by the next `begin` even if the router's cleanup never ran. */
  let active: ModeShell | null = null;

  // Per-region state of the running mode.
  const slotCleanup = new Map<SlotNumber, () => void>();
  let primaryButton: HTMLElement | null = null;
  let primaryOff: (() => void) | null = null;
  let status: { state: StatusState; text: string } | null = null;
  let readoutValues: string[] = [];
  let readoutNodes: HTMLElement[] = [];
  let nerdSpec: NerdSpec | null = null;
  let nerdCleanup: (() => void) | null = null;
  let nerdOpen = options.nerdOpen === true;
  let hintText: string | null = null;
  let referenceHandler: (() => void) | null = null;

  const make = (tag: string, className?: string, text?: string): HTMLElement => {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const runCleanup = (fn: (() => void) | null | undefined) => {
    try {
      fn?.();
    } catch (err) {
      console.warn("shell cleanup failed:", err);
    }
  };

  // ----- slots
  function clearSlot(n: SlotNumber): void {
    runCleanup(slotCleanup.get(n));
    slotCleanup.delete(n);
    const section = regions.slots[n];
    if (section.hasAttribute("aria-labelledby") || section.children.length > 0 || !section.hidden) {
      section.replaceChildren();
      section.removeAttribute("aria-labelledby");
      section.removeAttribute("role");
      section.hidden = true;
    }
  }
  function fillSlot(n: SlotNumber, spec: SlotSpec): void {
    if (typeof spec?.label !== "string" || spec.label.trim() === "") throw new TypeError("a slot needs a label");
    if ((spec.element === undefined) === (spec.render === undefined)) {
      throw new TypeError("a slot takes exactly one of element and render");
    }
    clearSlot(n);
    const section = regions.slots[n];
    const heading = make("h2", "shell-slot-label", spec.label);
    heading.id = `shell-slot-${n}-label`;
    const body = make("div", "shell-slot-body");
    section.dataset.role = SLOT_ROLES[n];
    section.setAttribute("role", "group");
    section.setAttribute("aria-labelledby", heading.id);
    section.replaceChildren(heading, body);
    if (spec.render) {
      const cleanup = spec.render(body);
      if (typeof cleanup === "function") slotCleanup.set(n, cleanup);
    } else {
      body.append(...(Array.isArray(spec.element) ? spec.element : [spec.element as Node]));
    }
    section.hidden = false;
  }

  // ----- primary action
  function clearPrimary(): void {
    primaryOff?.();
    primaryOff = null;
    primaryButton = null;
    if (regions.primary.children.length > 0 || !regions.primary.hidden) {
      regions.primary.replaceChildren();
      regions.primary.hidden = true;
    }
  }

  // ----- status
  function clearStatusChip(): void {
    status = null;
    if (regions.status.children.length > 0) regions.status.replaceChildren();
  }

  // ----- readout
  function clearReadoutBar(): void {
    readoutValues = [];
    readoutNodes = [];
    if (regions.readout.children.length > 0 || !regions.readout.hidden) {
      regions.readout.replaceChildren();
      regions.readout.hidden = true;
    }
  }

  // ----- nerd drawer
  /** Child-index path from the drawer to the focused element inside it, or null when focus is elsewhere. */
  function focusPath(): number[] | null {
    const active = regions.nerd.ownerDocument?.activeElement;
    if (!active || active === regions.nerd || !regions.nerd.contains(active)) return null;
    const path: number[] = [];
    for (let node: Element | null = active; node && node !== regions.nerd; node = node.parentElement) {
      const parent: Element | null = node.parentElement;
      if (!parent) return null;
      path.unshift(Array.prototype.indexOf.call(parent.children, node));
    }
    return path;
  }
  /** Re-renders the open drawer and gives focus and scroll position back; a redraw must not cost the viewer their place. */
  function redrawNerd(): void {
    const path = focusPath();
    const tag = (regions.nerd.ownerDocument?.activeElement as Element | null | undefined)?.tagName;
    const top = regions.nerd.scrollTop;
    drawNerd();
    let target: Element | null = regions.nerd;
    for (const i of path ?? []) target = target?.children[i] ?? null;
    if (path && target && target !== regions.nerd && target.tagName === tag) (target as HTMLElement).focus({ preventScroll: true });
    regions.nerd.scrollTop = top;
  }
  function drawNerd(): void {
    runCleanup(nerdCleanup);
    nerdCleanup = null;
    const visible = nerdSpec !== null && nerdOpen;
    regions.nerdToggle?.setAttribute("aria-pressed", String(nerdOpen));
    if (regions.nerdToggle) regions.nerdToggle.hidden = nerdSpec === null;
    if (!visible || !nerdSpec) {
      if (regions.nerd.children.length > 0) regions.nerd.replaceChildren();
      regions.nerd.hidden = true;
      return;
    }
    const title = make("h2", "shell-nerd-title", nerdSpec.title);
    const body = make("div", "shell-nerd-body");
    regions.nerd.replaceChildren(title, body);
    const cleanup = nerdSpec.render(body);
    if (typeof cleanup === "function") nerdCleanup = cleanup;
    regions.nerd.hidden = false;
  }
  const onNerdToggle = () => {
    nerdOpen = !nerdOpen;
    drawNerd();
  };
  regions.nerdToggle?.addEventListener("click", onNerdToggle);

  // ----- hints and reference view
  function drawHint(): void {
    if (hintText) {
      regions.hints.textContent = hintText;
      regions.hints.hidden = false;
    } else if (!regions.hints.hidden) {
      regions.hints.textContent = "";
      regions.hints.hidden = true;
    }
  }
  const onReference = () => referenceHandler?.();
  regions.reference.addEventListener("click", onReference);

  /** Empties every region. The Nerd open state is the viewer's choice and survives. */
  function wipe(): void {
    for (const n of SLOT_NUMBERS) clearSlot(n);
    clearPrimary();
    clearStatusChip();
    clearReadoutBar();
    nerdSpec = null;
    drawNerd();
    hintText = null;
    drawHint();
    referenceHandler = null;
    regions.reference.hidden = true;
  }

  function begin(isCurrent: IsCurrent): ModeShell {
    const token = {};
    active?.dispose();
    wipe();
    owner = token;
    let disposed = false;
    const disposers: Array<() => void> = [];
    const live = () => !disposed && owner === token && isCurrent();
    /** Wraps a write so that it runs only while this shell's mode is the running one. */
    const w =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A): void => {
        if (live()) fn(...args);
      };

    const shell: ModeShell = {
      setSlot(n, spec) {
        assertSlot(n);
        // Only a live shell validates the spec: a stale init must not throw into the new mode.
        if (live()) fillSlot(n, spec);
      },
      clearSlot(n) {
        assertSlot(n);
        if (live()) clearSlot(n);
      },
      clearSlots: w(() => SLOT_NUMBERS.forEach(clearSlot)),

      setPrimaryAction(spec) {
        if (!live()) return NOOP_HANDLE;
        clearPrimary();
        const button = make("button", "shell-primary-btn", spec.label);
        button.setAttribute("type", "button");
        if (spec.disabled) button.setAttribute("disabled", "");
        const onClick = () => {
          if (live()) spec.onClick();
        };
        button.addEventListener("click", onClick);
        primaryOff = () => button.removeEventListener("click", onClick);
        primaryButton = button;
        regions.primary.replaceChildren(button);
        regions.primary.hidden = false;
        return {
          update(patch) {
            if (!live() || primaryButton !== button) return;
            if (patch.label !== undefined && patch.label !== button.textContent) button.textContent = patch.label;
            if (patch.disabled !== undefined) {
              if (patch.disabled) button.setAttribute("disabled", "");
              else button.removeAttribute("disabled");
            }
          },
        };
      },
      clearPrimaryAction: w(clearPrimary),

      setStatus(state, text) {
        if (!STATUS_STATES.includes(state)) throw new TypeError(`unknown status state ${JSON.stringify(state)}`);
        if (!live()) return;
        const label = text ?? STATUS_LABELS[state];
        if (status && status.state === state && status.text === label) return;
        const chip = make("span", "shell-chip", label);
        chip.dataset.state = state;
        regions.status.replaceChildren(chip);
        status = { state, text: label };
      },
      clearStatus: w(clearStatusChip),

      setReadout: w((items: readonly ReadoutItem[]) => {
        clearReadoutBar();
        if (items.length === 0) return;
        readoutNodes = items.map((item) => {
          const value = make("span", "shell-readout-value", item.value);
          const cell = make("div", "shell-readout-item");
          cell.append(make("span", "shell-readout-role", item.role), value);
          regions.readout.append(cell);
          return value;
        });
        readoutValues = items.map((i) => i.value);
        regions.readout.hidden = false;
      }),
      updateReadout: w((index: number, value: string) => {
        const node = readoutNodes[index];
        if (!node || readoutValues[index] === value) return;
        readoutValues[index] = value;
        node.textContent = value;
      }),
      clearReadout: w(clearReadoutBar),

      setNerd: w((spec: NerdSpec) => {
        nerdSpec = spec;
        drawNerd();
      }),
      refreshNerd: w(() => {
        if (nerdSpec && nerdOpen) redrawNerd();
      }),
      clearNerd: w(() => {
        nerdSpec = null;
        drawNerd();
      }),

      setHint: w((text: string | null) => {
        hintText = text;
        drawHint();
      }),
      setReferenceView: w((onActivate: (() => void) | null) => {
        referenceHandler = onActivate && (() => live() && onActivate());
        regions.reference.hidden = onActivate === null;
      }),

      listen(target, type, handler, options) {
        if (disposed) return;
        const guarded = (event: Event) => {
          if (live()) handler(event);
        };
        target.addEventListener(type, guarded, options);
        disposers.push(() => target.removeEventListener(type, guarded, options));
      },
      onDispose(fn) {
        if (disposed) {
          runCleanup(fn);
          return;
        }
        disposers.push(fn);
      },
      dispose() {
        if (disposed) return;
        const ownsRegions = owner === token;
        disposed = true;
        if (ownsRegions) {
          wipe();
          owner = null;
        }
        for (const fn of disposers.splice(0).reverse()) runCleanup(fn);
      },
    };
    active = shell;
    return shell;
  }

  return {
    begin,
    reset() {
      active?.dispose();
      active = null;
      owner = null;
      wipe();
    },
    destroy() {
      active?.dispose();
      active = null;
      owner = null;
      regions.nerdToggle?.removeEventListener("click", onNerdToggle);
      regions.reference.removeEventListener("click", onReference);
    },
  };
}
