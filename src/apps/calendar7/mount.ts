// SPDX-License-Identifier: AGPL-3.0-or-later
/** DOM mount of the English 7x7 calendar mode (research candidate, not certified). */
import type { ModeInstance } from "../registry.ts";
import { parseDisplays, parseGraph } from "./graph.ts";
import { announce, buildModel, chainRange, chooseMonth, pageHtml, type YearMonth } from "./month-view.ts";

export interface MountEnv {
  /** Base URL of the site, ending in a slash. */
  base: string;
  fetchJson(url: string): Promise<unknown>;
  now(): Date;
  /** Current query string of the address bar, with the leading `?` or empty. */
  search(): string;
  /** Replaces the query of the address bar without a history entry. */
  replaceQuery(search: string): void;
  isCurrent(): boolean;
}

const MY_PARAMS = ["year", "month"];

export async function mountCalendar7(
  root: HTMLElement,
  params: URLSearchParams,
  env: MountEnv,
): Promise<ModeInstance | void> {
  root.innerHTML =
    '<div class="c7-live" role="status" aria-live="polite"></div><div class="c7-view"><p class="c7-loading">Loading the 7x7 calendar data…</p></div>';
  const view = root.querySelector(".c7-view") as HTMLElement;
  const live = root.querySelector(".c7-live") as HTMLElement;
  const [graphJson, displaysJson] = await Promise.all([
    env.fetchJson(`${env.base}calendar7/graph.v1.json`),
    env.fetchJson(`${env.base}calendar7/displays.v1.json`),
  ]);
  if (!env.isCurrent()) return;
  const graph = parseGraph(graphJson);
  const table = parseDisplays(displaysJson);
  const range = chainRange(graph);
  const d = env.now();
  const today: YearMonth = { year: d.getFullYear(), month: d.getMonth() + 1 };

  const show = (p: URLSearchParams, moveFocus: boolean): void => {
    const model = buildModel(graph, table, chooseMonth(p, today, range), today);
    view.innerHTML = pageHtml(model);
    live.textContent = announce(model);
    // The link that was clicked is gone after the re-render: keep the keyboard position at the new month.
    if (moveFocus) (view.querySelector("[data-focus]") as HTMLElement | null)?.focus();
  };
  show(params, false);

  // Navigation links are plain `?app=calendar7&year=&month=` links; follow them without a reload.
  const onClick = (e: Event): void => {
    const a = (e.target as Element | null)?.closest?.("a.c7-nav") as HTMLAnchorElement | null;
    if (!a || !root.contains(a)) return;
    e.preventDefault();
    const next = new URL(a.getAttribute("href") as string, "http://x/").searchParams;
    const keep = new URLSearchParams(env.search());
    for (const k of MY_PARAMS) keep.delete(k);
    for (const k of MY_PARAMS) if (next.has(k)) keep.set(k, next.get(k) as string);
    env.replaceQuery(`?${keep.toString()}`);
    show(next, true);
  };
  root.addEventListener("click", onClick);
  return { dispose: () => root.removeEventListener("click", onClick) };
}

/** The environment of a real page. */
export function browserMountEnv(base: string, isCurrent: () => boolean): MountEnv {
  return {
    base,
    fetchJson: async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    },
    now: () => new Date(),
    search: () => location.search,
    replaceQuery: (search) => history.replaceState(null, "", `${location.pathname}${search}${location.hash}`),
    isCurrent,
  };
}
