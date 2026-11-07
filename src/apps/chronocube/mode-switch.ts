export type ModeCleanup = (() => void) | void | null | undefined;

/** Runs mode init functions one switch at a time and owns the active mode's cleanup. */
export function createModeSwitcher(
  onError: (err: Error) => void = () => {},
  onCleanupError: (err: Error) => void = () => {},
) {
  let cleanup: ModeCleanup = null;
  const runCleanup = (fn: ModeCleanup) => {
    try {
      fn?.();
    } catch (e) {
      onCleanupError(e as Error);
    }
  };
  return {
    /**
     * Cleans up the active mode, calls `prepare`, then awaits `init`. Resolves true when `init` finished.
     */
    async switchTo(
      init: () => Promise<ModeCleanup>,
      prepare: () => void = () => {},
    ): Promise<boolean> {
      runCleanup(cleanup);
      cleanup = null;
      prepare();
      try {
        cleanup = await init();
        return true;
      } catch (err) {
        onError(err as Error);
        return false;
      }
    },
  };
}
