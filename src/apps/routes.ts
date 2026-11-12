import { GLOBAL_PARAMS, PARAM_SPECS, appKeys, names, type ParamValue } from "./param-specs.ts";
import type { AppRegistry } from "./registry.ts";
import { APP_PARAM } from "./router.ts";

export type { ParamValue };

export interface Route {
  app: { id: string; known: boolean };
  /** Parsed, canonical setup of the app plus the global flags. */
  setup: Record<string, ParamValue>;
  /** Names present in the URL that belong to another app and are not part of this setup. */
  foreign: string[];
  /** Names whose value is invalid for their type; the mode default applies. */
  invalid: string[];
}

/** The single parser of `index.html?app=<id>&<setup>`. Unknown apps resolve to `fallback` and keep only global flags. */
export function parseRoute(search: string, registry: AppRegistry, fallback: string): Route {
  const query = new URLSearchParams(search);
  const raw = query.get(APP_PARAM);
  const known = !!raw && registry.has(raw);
  const id = known ? raw : fallback;
  const owned = known ? (appKeys(id, registry.list()) ?? []) : [];
  const route: Route = { app: { id, known }, setup: {}, foreign: [], invalid: [] };
  // Owned and global specs first: they claim their URL names, so a name another app uses differently (`font`) is not
  // reported as foreign for the app that owns it.
  const claimed = new Set<string>();
  const mine = (key: string) => owned.includes(key) || GLOBAL_PARAMS.includes(key);
  for (const key of Object.keys(PARAM_SPECS).filter(mine)) {
    const present = names(key).find((n) => query.has(n));
    if (present === undefined) continue;
    claimed.add(present);
    const value = PARAM_SPECS[key].parse(query.get(present) as string);
    if (value === undefined) route.invalid.push(key);
    else route.setup[key] = value;
  }
  for (const key of Object.keys(PARAM_SPECS).filter((k) => !mine(k))) {
    const present = names(key).find((n) => query.has(n) && !claimed.has(n));
    if (present !== undefined && !route.foreign.includes(present)) route.foreign.push(present);
  }
  return route;
}

/** The single serializer: `app` first, then the setup in spec order under their canonical URL names, defaults left out. */
export function serializeRoute(route: { app: string; setup: Readonly<Record<string, ParamValue>> }): string {
  const query = new URLSearchParams({ [APP_PARAM]: route.app });
  for (const [key, spec] of Object.entries(PARAM_SPECS)) {
    const value = route.setup[key];
    if (value === undefined || value === spec.default) continue;
    query.set(spec.name ?? key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return `?${query}`;
}
