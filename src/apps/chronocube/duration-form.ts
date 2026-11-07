/** The part of MsTimer the studio duration form uses. */
export interface DurationTimer {
  set(text: string): Promise<void>;
}

/** Apply the typed Countdown duration; report a rejected duration through `onError`. */
export function applyDuration(
  timer: DurationTimer,
  text: string,
  onDone: () => void,
  onError: (message: string) => void,
): void {
  // MsTimer.set throws synchronously on a rejected duration, so the call sits inside the try.
  try {
    timer.set(text).then(onDone, (err: Error) => onError(err.message));
  } catch (err) {
    onError((err as Error).message);
  }
}
