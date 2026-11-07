export type HostView = { view: "landing" } | { view: "app"; id: string };

/**
 * Decides what index.html shows for a query string: a registered `app` id mounts that mode, anything else (no
 * parameter, an empty or unknown id, a legacy key such as `application`) shows the landing page.
 */
export function resolveHostView(search: string, ids: readonly string[]): HostView {
  const id = new URLSearchParams(search).get("app");
  return id && ids.includes(id) ? { view: "app", id } : { view: "landing" };
}
