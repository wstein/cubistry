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
  for (const key of Object.keys(PARAM_SPECS)) {
    const present = names(key).find((n) => query.has(n));
    if (present === undefined) continue;
    if (!owned.includes(key) && !GLOBAL_PARAMS.includes(key)) {
      route.foreign.push(present);
      continue;
    }
    const value = PARAM_SPECS[key].parse(query.get(present) as string);
    if (value === undefined) route.invalid.push(key);
    else route.setup[key] = value;
  }
  return route;
}

/** The single serializer: `app` first, then the setup in spec order under canonical keys, defaults left out. */
export function serializeRoute(route: { app: string; setup: Readonly<Record<string, ParamValue>> }): string {
  const query = new URLSearchParams({ [APP_PARAM]: route.app });
  for (const [key, spec] of Object.entries(PARAM_SPECS)) {
    const value = route.setup[key];
    if (value === undefined || value === spec.default) continue;
    query.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return `?${query}`;
}
