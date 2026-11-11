// SPDX-License-Identifier: AGPL-3.0-or-later
/** Page body of the names layout for any date (display only, print B). Pure HTML strings, DOM-free. */
import { ANY_FIRST_YEAR, ANY_LAST_YEAR, GREGORIAN_FROM_YEAR, bestEffortSentence, namesCells, type AnyState, type AnyChoice } from "./anydate.ts";
import { ANY_DISPLAY_ONLY_NOTICE } from "./layout.ts";
import { esc, MONTH_NAMES_EN, monthLabel, sheetHtml, ymKey, type PageModel, type ChainRange, type YearMonth } from "./month-view.ts";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const NO_STATE_LEAD = "No state for this date with the print.";
/** Month table of a best-effort page: the cube is the display, so the table is text for screen readers only (visually hidden). */
export const HIDDEN_SHEET_CLASS = "c7-sr-only";

/** The model of an any-date page. `range` is only carried for the shared model type. */
export function anyDateModel(choice: AnyChoice, state: AnyState | null, today: YearMonth, range: ChainRange): PageModel {
  if (choice.kind === "invalid") return { choice, range, today, layout: "names", prev: null, next: null };
  const { ym } = choice;
  return {
    choice,
    range,
    today,
    layout: "names",
    cells: namesCells(ym.year, ym.month),
    anyDate: state ? { kind: state.kind, key: state.config.key, ...(state.kind === "best-effort" ? { wrong: state.wrong } : {}) } : undefined,
    prev: null,
    next: null,
  };
}

/** Year and month inputs: the date can be entered here as well as in the URL (`?year=&month=`). */
export function dateFormHtml(ym: YearMonth | null): string {
  const months = MONTH_NAMES_EN.map((name, i) => `<option value="${i + 1}"${ym && ym.month === i + 1 ? " selected" : ""}>${name}</option>`).join("");
  return (
    `<form class="c7-date-form" data-c7-date-form>` +
    `<label>Year <input type="number" name="year" min="${ANY_FIRST_YEAR}" max="${ANY_LAST_YEAR}" step="1" required value="${ym ? ym.year : ""}"></label> ` +
    `<label>Month <select name="month">${months}</select></label> ` +
    `<button type="submit" class="c7-btn">Show</button></form>`
  );
}

const configText = (key: string): string => {
  const [month, weekday, days] = key.split("-").map(Number);
  return `${MONTH_NAMES_EN[month - 1]}, the 1st on a ${WEEKDAY_NAMES[weekday]}, ${days} days`;
};

export function anyDatePageHtml(model: PageModel): string {
  const { choice } = model;
  if (choice.kind !== "ok")
    return (
      `<div class="c7-page" data-c7-any><p class="c7-unavailable" role="alert" tabindex="-1" data-focus>Invalid month: ${esc(choice.kind === "invalid" ? choice.reason : "")}.</p>` +
      `${dateFormHtml(null)}</div>`
    );
  const any = model.anyDate;
  const label = monthLabel(choice.ym);
  const verdict =
    any?.kind === "best-effort"
      ? `<p class="c7-best-effort" role="status" data-c7-best-effort>${esc(bestEffortSentence(any.wrong ?? []))}</p>`
      : any && any.kind !== "state"
        ? `<p class="c7-unavailable" role="alert" data-c7-no-state="${any.kind}">${NO_STATE_LEAD}</p>`
        : "";
  const sheet = sheetHtml(model.cells ?? [], `7x7 calendar sheet, ${label}`);
  const calendar =
    choice.ym.year < GREGORIAN_FROM_YEAR
      ? " The Gregorian calendar starts in October 1582; this month is shown by the same rules (proleptic Gregorian calendar)."
      : "";
  return (
    `<div class="c7-page" data-c7-any><h2 class="c7-month" tabindex="-1" data-focus data-month="${ymKey(choice.ym)}">${esc(label)}</h2>` +
    verdict +
    (any?.kind === "best-effort" ? `<div class="${HIDDEN_SHEET_CLASS}" data-c7-sheet-hidden>${sheet}</div>` : sheet) +
    dateFormHtml(choice.ym) +
    `<p class="c7-range" data-c7-any-range>${esc(ANY_DISPLAY_ONLY_NOTICE)} Board configuration: ${esc(any ? configText(any.key) : "")}. ` +
    `Years ${ANY_FIRST_YEAR} to ${ANY_LAST_YEAR}.${calendar} Print B is not frozen. Research candidate, not certified.</p></div>`
  );
}
