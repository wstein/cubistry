// SPDX-License-Identifier: AGPL-3.0-or-later
/** Month-only picker. Browsing never changes the calendar until a month is chosen. */
import { MONTH_NAMES_EN, monthLabel, type YearMonth } from "./month-view.ts";

const validYear = (year: number): boolean => Number.isInteger(year) && year >= 1 && year <= 9999;
const validMonth = (month: number): boolean => Number.isInteger(month) && month >= 1 && month <= 12;
const decadeOf = (year: number): number => Math.floor(year / 10) * 10;
const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

export class MonthPickerModel {
  value: YearMonth | null;
  readonly today: YearMonth;
  year: number;
  decade: number;
  open = false;
  mode: "months" | "years" = "months";
  focusMonth: number;
  focusYear: number;

  constructor(value: YearMonth | null, today: YearMonth) {
    this.value = value ? { ...value } : null;
    this.today = { ...today };
    this.year = value?.year ?? today.year;
    this.decade = decadeOf(this.year);
    this.focusYear = this.year;
    this.focusMonth = value?.month ?? today.month;
  }
  show(): void {
    this.open = true;this.mode = "months";
    this.year = this.value?.year ?? this.today.year;this.focusYear = this.year;
    this.focusMonth = this.value?.month ?? this.today.month;this.decade = decadeOf(this.year);
  }
  showYears(): void { this.mode = "years";this.decade = decadeOf(this.year);this.focusYear = this.year; }
  browse(direction: number): void {
    if (this.mode === "months") { this.year = clamp(this.year + direction, 1, 9999);this.focusYear = this.year; }
    else { this.decade = clamp(this.decade + direction * 10, 0, 9990);this.focusYear = clamp(this.decade + (this.year % 10), Math.max(1, this.decade), this.decade + 9); }
  }
  chooseDecade(decade: number): void {
    if (!Number.isInteger(decade) || decade < 0 || decade > 9990 || decade % 10 !== 0) return;
    this.decade = decade;this.focusYear = clamp(decade + (this.year % 10), Math.max(1, decade), decade + 9);
  }
  chooseYear(year: number): void { if (validYear(year)) { this.year = year;this.focusYear = year;this.mode = "months"; } }
  jump(value: string): boolean {
    if (!/^\d{1,4}$/.test(value) || !validYear(Number(value))) return false;
    this.year = Number(value);this.focusYear = this.year;this.decade = decadeOf(this.year);return true;
  }
  chooseMonth(month: number): YearMonth | null {
    if (!validMonth(month)) return null;
    this.value = { year: this.year, month };this.open = false;return { ...this.value };
  }
  chooseToday(): YearMonth { this.value = { ...this.today };this.open = false;return { ...this.today }; }
}

export function gridTarget(key: string, value: number, min: number, max: number, columns: number): number | null {
  const offset = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : key === "ArrowUp" ? -columns : key === "ArrowDown" ? columns : null;
  if (key === "Home") return min;
  if (key === "End") return max;
  return offset === null ? null : clamp(value + offset, min, max);
}

const action = (name: string, value: number, text: string, attrs = ""): string => `<button type="button" data-c7-picker-action="${name}" data-value="${value}"${attrs}>${text}</button>`;
/** Dialog contents only; ids are local to the single Calendar7 picker. */
export function pickerHtml(m: MonthPickerModel): string {
  const years = m.mode === "years";
  const first = Math.max(1, m.decade), last = m.decade + 9;
  const disabledPrev = years ? m.decade === 0 : m.year === 1;
  const disabledNext = years ? m.decade === 9990 : m.year === 9999;
  const header = `<div class="c7-picker-header">${action("previous", -1, "‹", ` aria-label="Previous ${years ? "decade" : "year"}"${disabledPrev ? " disabled" : ""}`)}` +
    (years ? `<span class="c7-picker-range">${first}–${last}</span>` : action("years", m.year, String(m.year), ' aria-label="Choose year"')) +
    action("next", 1, "›", ` aria-label="Next ${years ? "decade" : "year"}"${disabledNext ? " disabled" : ""}`) + `</div>`;
  const rail = years ? `<nav class="c7-picker-decades" aria-label="Decades">${Array.from({length: 7}, (_, i) => clamp(m.decade - 30, 0, 9930) + i * 10).map(d => action("decade", d, `${Math.max(1, d)}–${d + 9}`, d === m.decade ? ' aria-current="true"' : "")).join("")}</nav>` : "";
  const cellList = years
    ? Array.from({length: last - first + 1}, (_, i) => first + i).map(y => action("year", y, String(y), ` role="gridcell" aria-label="${y}" aria-selected="${m.value?.year === y}" tabindex="${m.focusYear === y ? 0 : -1}"`))
    : MONTH_NAMES_EN.map((name, i) => action("month", i + 1, name, ` role="gridcell" aria-label="${name} ${m.year}" aria-selected="${m.value?.year === m.year && m.value.month === i + 1}" tabindex="${m.focusMonth === i + 1 ? 0 : -1}"`));
  const columns = years ? 4 : 3;
  const rows = Array.from({length: Math.ceil(cellList.length / columns)}, (_, row) => `<div role="row">${cellList.slice(row * columns, (row + 1) * columns).join("")}</div>`).join("");
  return header + `<div class="c7-picker-body">${rail}<div class="c7-picker-grid c7-picker-${m.mode}" role="grid" aria-label="${years ? `Years ${first} to ${last}` : `Months in ${m.year}`}">${rows}</div></div>` +
    `<div class="c7-picker-footer">${years ? `<label>Jump to year <input type="number" data-c7-picker-year min="1" max="9999" step="1" value="${m.year}" aria-label="Jump to year"></label>` : ""}<button type="button" data-c7-picker-action="today">Today</button></div>`;
}

export interface MonthPickerOptions { today: YearMonth; onSelect(ym: YearMonth): void; }
/** A persistent host prevents application re-renders from replacing a focused picker input. */
export class MonthPicker {
  readonly model: MonthPickerModel;
  private readonly host: HTMLElement;
  private readonly trigger: HTMLButtonElement;
  private readonly dialog: HTMLElement;
  private readonly options: MonthPickerOptions;
  private alive = true;
  private request = 0;
  private painting = false;

  constructor(host: HTMLElement, value: YearMonth | null, options: MonthPickerOptions) {
    this.host = host;this.options = options;this.model = new MonthPickerModel(value, options.today);
    host.innerHTML = `<button type="button" class="c7-picker-trigger" data-c7-picker-action="toggle" aria-label="Choose month and year" aria-haspopup="dialog" aria-expanded="false" aria-controls="c7-month-popup"><span data-c7-picker-label></span><span aria-hidden="true">▦</span></button><div id="c7-month-popup" class="c7-picker-popup" role="dialog" aria-label="Choose calendar month" hidden></div>`;
    this.trigger = host.querySelector(".c7-picker-trigger") as HTMLButtonElement;
    this.dialog = host.querySelector(".c7-picker-popup") as HTMLElement;
    // Layout containment in the studio makes fixed descendants relative to the stage.
    // Keep this viewport-positioned overlay outside that containing/clipping block.
    host.ownerDocument.body.appendChild(this.dialog);
    this.updateLabel();
    host.addEventListener("click", this.onClick);host.addEventListener("keydown", this.onKey);host.addEventListener("change", this.onYear);
    host.addEventListener("pointerdown", this.onPointerDown);host.addEventListener("focusout", this.onFocusOut);
    this.dialog.addEventListener("click", this.onClick);this.dialog.addEventListener("keydown", this.onKey);this.dialog.addEventListener("change", this.onYear);
    this.dialog.addEventListener("pointerdown", this.onPointerDown);this.dialog.addEventListener("focusout", this.onFocusOut);
    host.ownerDocument.addEventListener("pointerdown", this.onOutside);
    host.ownerDocument.addEventListener("scroll", this.position, true);host.ownerDocument.defaultView?.addEventListener("resize", this.position);
  }
  setValue(value: YearMonth | null): void {
    this.request++;this.model.value = value ? { ...value } : null;this.updateLabel();
    // A navigation elsewhere closes the old browsing transaction without stealing its focus.
    this.close(false);
  }
  private updateLabel(): void {
    const text = this.model.value ? monthLabel(this.model.value) : "Choose month";
    const label = this.host.querySelector("[data-c7-picker-label]");if (label) label.textContent = text;
    this.trigger.setAttribute("aria-label", this.model.value ? `Choose month and year: ${text}` : "Choose month and year");
  }
  private paint(focus = true): void {
    this.painting = true;
    try { this.dialog.innerHTML = pickerHtml(this.model); } finally { this.painting = false; }
    this.dialog.hidden = !this.model.open;this.trigger.setAttribute("aria-expanded", String(this.model.open));
    this.position();
    if (focus && this.model.open) this.dialog.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')?.focus({preventScroll:true});
  }
  private readonly position = (): void => {
    const win = this.host.ownerDocument.defaultView;
    if (!win || !this.model.open) return;
    const rect = this.trigger.getBoundingClientRect();
    const below = win.innerHeight - rect.bottom - 12, above = rect.top - 12;
    const upward = below < Math.min(this.dialog.scrollHeight, 320) && above > below;
    this.dialog.style.maxHeight = `${Math.max(96, Math.min(win.innerHeight - 16, upward ? above : below))}px`;
    this.dialog.style.left = `${Math.max(8, Math.min(rect.left, win.innerWidth - this.dialog.offsetWidth - 8))}px`;
    this.dialog.style.top = `${upward ? Math.max(8, rect.top - this.dialog.offsetHeight - 6) : Math.max(8, rect.bottom + 6)}px`;
  };
  private close(focus: boolean): void {
    this.model.open = false;this.dialog.hidden = true;this.trigger.setAttribute("aria-expanded", "false");
    if (focus) this.trigger.focus({preventScroll:true});
  }
  private owns(node: Node): boolean { return this.host.contains(node) || this.dialog.contains(node); }
  private commit(value: YearMonth | null): void {
    if (!value) return;
    this.updateLabel();this.close(true);const request = ++this.request;
    // Finish the click/blur dispatch before the host application changes its page content.
    queueMicrotask(() => { if (this.alive && request === this.request) this.options.onSelect(value); });
  }
  private readonly onClick = (event: Event): void => {
    const el = (event.target as Element | null)?.closest?.("[data-c7-picker-action]") as HTMLButtonElement | null;
    if (!this.alive || !el || !this.owns(el) || el.disabled) return;
    event.preventDefault();this.request++;
    const input = this.dialog.querySelector<HTMLInputElement>("[data-c7-picker-year]");
    if (input && input === this.host.ownerDocument.activeElement) this.model.jump(input.value.trim());
    const name = el.getAttribute("data-c7-picker-action"), value = Number(el.getAttribute("data-value"));
    if (name === "toggle") { if (this.model.open) this.close(true);else { this.model.show();this.paint(); }return; }
    if (name === "month") return this.commit(this.model.chooseMonth(value));
    if (name === "today") return this.commit(this.model.chooseToday());
    if (name === "years") this.model.showYears();
    else if (name === "year") this.model.chooseYear(value);
    else if (name === "decade") this.model.chooseDecade(value);
    else if (name === "previous" || name === "next") this.model.browse(value);
    else return;
    this.paint();
  };
  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.alive || !this.model.open) return;
    if (event.key === "Tab") {
      const cells = [...this.dialog.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)')];
      const active = this.host.ownerDocument.activeElement;
      if (event.shiftKey && active === cells[0]) { event.preventDefault();this.request++;this.close(true);return; }
      if (!event.shiftKey && active === cells.at(-1)) {
        event.preventDefault();this.request++;this.close(false);
        const outside = [...this.host.ownerDocument.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
          .filter(el => !this.dialog.contains(el) && el.tabIndex >= 0 && !el.hasAttribute("disabled") && el.getClientRects().length > 0);
        (outside[outside.indexOf(this.trigger) + 1] ?? this.trigger).focus({preventScroll:true});return;
      }
    }
    if (event.key === "Enter" && (event.target as Element | null)?.hasAttribute?.("data-c7-picker-year")) { event.preventDefault();this.onYear(event);return; }
    if (event.key === "Escape") { event.preventDefault();this.request++;this.close(true);return; }
    const el = (event.target as Element | null)?.closest?.('[role="gridcell"]');
    if (!el || !this.dialog.contains(el)) return;
    const years = this.model.mode === "years";
    const current = Number(el.getAttribute("data-value"));
    const next = gridTarget(event.key, current, years ? Math.max(1, this.model.decade) : 1, years ? this.model.decade + 9 : 12, years ? 4 : 3);
    if (next === null) return;
    event.preventDefault();if (years) this.model.focusYear = next;else this.model.focusMonth = next;this.paint();
  };
  private readonly onYear = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (!this.alive || !this.model.open || this.painting || !input?.hasAttribute?.("data-c7-picker-year") || !this.owns(input)) return;
    if (!this.model.jump(input.value.trim())) { input.setAttribute("aria-invalid", "true");return; }
    input.removeAttribute("aria-invalid");const request = ++this.request;
    queueMicrotask(() => { if (this.alive && request === this.request && this.model.open) this.paint(); });
  };
  private readonly onPointerDown = (event: PointerEvent): void => {
    // Keep the year field mounted until the subsequent button click is handled. A blur/change
    // followed by a DOM replacement between pointerdown and click would otherwise lose that click.
    const el = (event.target as Element | null)?.closest?.("[data-c7-picker-action]");
    const active = this.host.ownerDocument.activeElement;
    if (el && this.owns(el) && active?.hasAttribute("data-c7-picker-year")) event.preventDefault();
  };
  private readonly onFocusOut = (event: FocusEvent): void => {
    if (!this.painting && this.model.open && event.relatedTarget && !this.owns(event.relatedTarget as Node)) { this.request++;this.close(false); }
  };
  private readonly onOutside = (event: Event): void => {
    if (this.model.open && !this.owns(event.target as Node)) { this.request++;this.close(false); }
  };
  dispose(): void {
    this.alive = false;this.request++;this.close(false);
    this.host.removeEventListener("click", this.onClick);this.host.removeEventListener("keydown", this.onKey);this.host.removeEventListener("change", this.onYear);
    this.host.removeEventListener("pointerdown", this.onPointerDown);this.host.removeEventListener("focusout", this.onFocusOut);
    this.dialog.removeEventListener("click", this.onClick);this.dialog.removeEventListener("keydown", this.onKey);this.dialog.removeEventListener("change", this.onYear);
    this.dialog.removeEventListener("pointerdown", this.onPointerDown);this.dialog.removeEventListener("focusout", this.onFocusOut);
    this.host.ownerDocument.removeEventListener("pointerdown", this.onOutside);
    this.host.ownerDocument.removeEventListener("scroll", this.position, true);this.host.ownerDocument.defaultView?.removeEventListener("resize", this.position);
    this.dialog.remove();
  }
}
