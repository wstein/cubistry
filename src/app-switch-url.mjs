// Setup parameters that belong to the application that wrote them.
// They must not survive a switch to another application.
export const APP_SCOPED_PARAMS = ["val", "value", "duration"];

/**
 * Returns the path, query and hash to show after switching from `previous` to
 * `target`. On first load (`previous` empty) or when the application does not
 * change, the URL is returned unchanged so deep links keep working.
 */
export function urlAfterAppSwitch(href, previous, target) {
  const u = new URL(href);
  if (previous && previous !== target) {
    for (const key of APP_SCOPED_PARAMS) u.searchParams.delete(key);
  }
  return u.pathname + u.search + u.hash;
}
