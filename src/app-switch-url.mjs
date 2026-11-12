import { appKeys, scopedParams, sharedParams } from "./apps/param-specs.ts";

// Setup parameters that belong to an application: the union of the `params` its modes declare in the mode catalog
// (src/apps/mode-catalog.ts) and of the applications that are not modes yet. Global keys (nerd, kiosk, speed) are not in it.
export const APP_SCOPED_PARAMS = scopedParams();

// The flat list the legacy single-cube page (src/main.mjs, ids such as "certified") has always dropped.
const LEGACY_SCOPED_PARAMS = ["val", "value", "duration", "year", "month"];

/**
 * Returns the path, query and hash to show after switching from `previous` to `target`. A parameter owned by some
 * app survives only when the previous and the target app both own it and it is not a per-mode value, so another app's date, unit, range, direction, language, padding,
 * cube or design cannot flow in. Global keys (nerd, kiosk, speed) and parameters no app owns stay. On the startup call (`initial`) or when
 * the application does not change, the URL is returned unchanged so deep links keep working. An id that is not in
 * the catalog (the legacy page keys) drops the flat legacy list.
 */
export function urlAfterAppSwitch(href, previous, target, initial = false) {
  const u = new URL(href);
  if (!initial && previous && previous !== target) {
    if (appKeys(previous) && appKeys(target)) {
      const keep = new Set(sharedParams(previous, target));
      for (const key of APP_SCOPED_PARAMS) if (!keep.has(key)) u.searchParams.delete(key);
    } else {
      for (const key of LEGACY_SCOPED_PARAMS) u.searchParams.delete(key);
    }
  }
  return u.pathname + u.search + u.hash;
}
