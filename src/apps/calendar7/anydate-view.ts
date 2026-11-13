// SPDX-License-Identifier: AGPL-3.0-or-later
/** Page body of the names layout for any date (display only, print B). Pure HTML strings, DOM-free. */
import { ANY_FIRST_YEAR, ANY_LAST_YEAR, GREGORIAN_FROM_YEAR, bestEffortSentence, cellWhere, namesCells, type AnyState, type AnyChoice } from "./anydate.ts";
import { ANY_DISPLAY_ONLY_NOTICE, DEMO_DISPLAY_ONLY_NOTICE, NAME_WORDS, type NameWords } from "./layout.ts";
import { esc, HIDDEN_SHEET_CLASS, MONTH_NAMES_EN, monthLabel, sheetHtml, ymKey, type PageModel, type ChainRange, type YearMonth } from "./month-view.ts";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const NO_STATE_LEAD = "No state for this date with the print.";
export { HIDDEN_SHEET_CLASS };

/** The model of an any-date page. `range` is only carried for the shared model type. */
export function anyDateModel(choice: AnyChoice, state: AnyState | null, today: YearMonth, range: ChainRange, words: NameWords = NAME_WORDS): PageModel {
  if (choice.kind === "invalid") return { choice, range, today, layout: "names", prev: null, next: null };
  const { ym } = choice;
  return {
    choice,
    range,
    today,
    layout: "names",
    cells: namesCells(ym.year, ym.month, words),
    anyDate: state ? { kind: state.kind, key: state.config.key, ...(state.kind === "best-effort" ? { wrong: state.wrong } : {}) } : undefined,
    prev: null,
    next: null,
  };
}

/** Legacy form renderer for external callers; the mounted app uses the persistent month picker. */
export function dateFormHtml(ym: YearMonth | null): string {
  const months = MONTH_NAMES_EN.map((name, i) => `<option value="${i + 1}"${ym && ym.month === i + 1 ? " selected" : ""}>${name}</option>`).join("");
  return (
    `<form class="c7-date-form" data-c7-date-form>` +
    `<label>Year <input type="number" name="year" min="${ANY_FIRST_YEAR}" max="${ANY_LAST_YEAR}" step="1" required value="${ym ? ym.year : ""}"></label> ` +
    `<label>Month <select name="month">${months}</select></label> ` +
    `</form>`
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
      `</div>`
    );
  const any = model.anyDate;
  const label = monthLabel(choice.ym);
  const mismatch = model.longChain
    ? `Preview mismatch: ${ (any?.wrong ?? []).map(([r, c]) => `cell ${cellWhere(r, c)}`).join("; ") } differs.`
    : bestEffortSentence(any?.wrong ?? []);
  const verdict =
    any?.kind === "best-effort"
      ? `<p class="c7-best-effort" role="status" data-c7-best-effort>${esc(mismatch)}</p>`
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
    `<p class="c7-range" data-c7-any-range>${esc(model.longChain ? DEMO_DISPLAY_ONLY_NOTICE : ANY_DISPLAY_ONLY_NOTICE)} Board configuration: ${esc(any ? configText(any.key) : "")}. ` +
    `Years ${ANY_FIRST_YEAR} to ${ANY_LAST_YEAR}.${calendar} ${model.longChain ? "Same print D. Move reachability is unverified. Print D is not frozen." : "Print B is not frozen."} Research candidate, not certified.</p></div>`
  );
}
