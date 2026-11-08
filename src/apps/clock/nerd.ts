import type { NerdSpec } from "../shell/slot-api.ts";
import type { ClockStatisticsSnapshot } from "./statistics.ts";
import { formatMean } from "./statistics.ts";
import { CLOCK_UNIT_NAMES } from "./params.ts";

type Doc = Pick<Document, "createElement">;

export interface ClockNerd {
  spec: NerdSpec;
  /** Effective timing line of cube `index`: scheduled quarter and half turn, and whether it was fitted to live time. */
  setTiming(index: number, text: string): void;
  setStats(snapshot: ClockStatisticsSnapshot): void;
  setResetEnabled(enabled: boolean): void;
}

const UNIT_TITLE = { hours: "Hours", minutes: "Minutes", seconds: "Seconds" } as const;
const COLUMNS: readonly (readonly [string, string])[] = [
  ["Total HTM", "Total HTM"],
  ["Cube rotations", "Cube rotations"],
  ["Last tick", "Last tick HTM"],
  ["Max / tick", "Max HTM per tick"],
  ["Average / tick", "Average HTM per tick"],
];
const KINDS = ["session-moves", "session-rotations", "last-moves", "max-moves", "mean-moves"] as const;
const dash = (v: number | null): string => (v === null ? "—" : String(v));

/**
 * The Nerd drawer of the Live Clock: what the clock actually does (the effective quarter and half turn time per cube)
 * and the committed-moves table with "Reset session moves". It holds no control besides Reset: the preferred turn times
 * are dock slot 4. The drawer is built only while it is open; the latest values are kept and shown when it opens, and
 * updates while it is closed write nothing.
 */
export function createClockNerd(doc: Doc, handlers: { onReset(): void }): ClockNerd {
  let nodes = new Map<string, HTMLElement>();
  let timing: string[] = CLOCK_UNIT_NAMES.map(() => "");
  let stats: ClockStatisticsSnapshot | null = null;
  let resetEnabled = false;
  let resetButton: HTMLButtonElement | null = null;

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, id?: string): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (id) el.id = id;
    return el;
  };
  const keep = <T extends HTMLElement>(el: T): T => {
    if (el.id) nodes.set(el.id, el);
    return el;
  };
  const cell = (id: string, text: string): HTMLElement => keep(make("td", text, id));
  const write = (id: string, value: number | null, format: (v: number | null) => string = dash): void => {
    const node = nodes.get(id);
    if (!node) return;
    const text = format(value);
    if (node.textContent !== text) node.textContent = text;
    node.dataset.value = value === null ? "" : String(value);
  };
  const paintStats = (): void => {
    if (!stats) return;
    [...stats.units, stats.total].forEach((unit, i) => {
      const name = CLOCK_UNIT_NAMES[i] ?? "total";
      write(name + "-session-moves", unit.session.htm);
      write(name + "-session-rotations", unit.session.rotations);
      write(name + "-last-moves", unit.last);
      write(name + "-max-moves", unit.max);
      if (i < CLOCK_UNIT_NAMES.length) write(name + "-mean-moves", unit.mean, (v) => formatMean(v));
    });
  };
  const paintTiming = (index: number): void => {
    const node = nodes.get(CLOCK_UNIT_NAMES[index] + "-timing");
    if (node && node.textContent !== timing[index]) node.textContent = timing[index];
  };

  const render = (body: HTMLElement): (() => void) => {
    nodes = new Map();
    const speeds = make("section");
    speeds.className = "clock-nerd-timing";
    speeds.append(make("h3", "Effective quarter-turn time"));
    CLOCK_UNIT_NAMES.forEach((name) => {
      const row = make("p");
      row.className = "small";
      row.append(make("b", UNIT_TITLE[name] + ": "), keep(make("span", "", name + "-timing")));
      speeds.append(row);
    });

    const head = make("tr");
    head.append(...["Cube", ...COLUMNS.map(([t]) => t)].map((t, i) => {
      const th = make("th", t);
      th.setAttribute("scope", "col");
      if (i > 0) th.setAttribute("abbr", COLUMNS[i - 1][1]);
      return th;
    }));
    const thead = make("thead");
    thead.append(head);
    const tbody = make("tbody");
    CLOCK_UNIT_NAMES.forEach((name, i) => {
      const tr = make("tr");
      tr.dataset.unit = "HMS"[i];
      const th = make("th", UNIT_TITLE[name]);
      th.setAttribute("scope", "row");
      tr.append(th, ...KINDS.map((kind) => cell(`${name}-${kind}`, kind === "session-moves" || kind === "session-rotations" ? "0" : "—")));
      tbody.append(tr);
    });
    const total = make("tr");
    total.dataset.unit = "total";
    const totalHead = make("th", "Total");
    totalHead.setAttribute("scope", "row");
    const noMean = make("td");
    noMean.setAttribute("aria-label", "No average for the total");
    total.append(totalHead, ...KINDS.slice(0, 4).map((kind) => cell(`total-${kind}`, kind === "session-moves" || kind === "session-rotations" ? "0" : "—")), noMean);
    const tfoot = make("tfoot");
    tfoot.append(total);
    const table = make("table");
    table.className = "clock-move-table shell-nerd-table";
    const caption = make("caption", "Committed moves this session");
    table.append(caption, thead, tbody, tfoot);
    const section = keep(make("section", undefined, "clock-stats"));
    section.className = "clock-stats";
    section.setAttribute("role", "status");
    section.setAttribute("aria-live", "off");
    section.setAttribute("aria-label", "Clock moves");
    section.append(table);

    const reset = make("button", "Reset session moves", "reset-clock-moves");
    reset.className = "quiet clock-stats-reset";
    reset.setAttribute("type", "button");
    reset.disabled = !resetEnabled;
    reset.addEventListener("click", handlers.onReset);
    resetButton = reset;

    body.append(speeds, section, reset);
    timing.forEach((_, i) => paintTiming(i));
    paintStats();
    return () => {
      reset.removeEventListener("click", handlers.onReset);
      resetButton = null;
      nodes = new Map();
    };
  };

  return {
    spec: { title: "Live clock numbers", render },
    setTiming(index, text) {
      timing[index] = text;
      paintTiming(index);
    },
    setStats(snapshot) {
      stats = snapshot;
      paintStats();
    },
    setResetEnabled(enabled) {
      resetEnabled = enabled;
      if (resetButton) resetButton.disabled = !enabled;
    },
  };
}
