export type ModeCleanup = (() => void) | void | null | undefined;
/** True while the init that received it is still the latest mode switch. */
export type IsCurrent = () => boolean;

/** Wraps a callback so that it does nothing once the mode that created it was replaced. */
export function whenCurrent<A extends unknown[], R>(
  isCurrent: IsCurrent,
  fn: (...args: A) => R,
): (...args: A) => R | undefined {
  return (...args) => (isCurrent() ? fn(...args) : undefined);
}

/** Runs mode init functions one switch at a time and owns the active mode's cleanup. */
export function createModeSwitcher(
  onError: (err: Error) => void = () => {},
  onCleanupError: (err: Error) => void = () => {},
) {
  let cleanup: ModeCleanup = null;
  let generation = 0;
  const runCleanup = (fn: ModeCleanup) => {
    try {
      fn?.();
    } catch (e) {
      onCleanupError(e as Error);
    }
  };
  return {
    /**
     * Cleans up the active mode, calls `prepare`, then awaits `init(isCurrent)`. Resolves true when `init` finished and
     * is still the latest switch. An init that is superseded while it awaits runs its own cleanup and reports
     * nothing, so it can neither leak a timer nor write an error into the newer mode.
     */
    async switchTo(
      init: (isCurrent: IsCurrent) => Promise<ModeCleanup>,
      prepare: () => void = () => {},
    ): Promise<boolean> {
      const mine = ++generation;
      runCleanup(cleanup);
      cleanup = null;
      prepare();
      try {
        const result = await init(() => mine === generation);
        if (mine !== generation) {
          runCleanup(result);
          return false;
        }
        cleanup = result;
        return true;
      } catch (err) {
        if (mine === generation) onError(err as Error);
        return false;
      }
    },
  };
}
