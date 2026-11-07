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
  timer.set(text).then(onDone, (err: Error) => onError(err.message));
}
