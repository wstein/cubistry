interface DurationView { duration: number }
interface DurationControl { value: string; disabled: boolean }
/** The existing size-3 animator uses one duration; never change it midturn. */
export function syncDurationControl(control: DurationControl, viewer: DurationView | undefined, blocked: boolean): void {
  control.disabled = !viewer || blocked;
  if (viewer) control.value = String(viewer.duration);
}
export function changeDurationControl(control: DurationControl, viewer: DurationView | undefined, blocked: boolean): void {
  if (!viewer) return;
  const value = Number(control.value);
  if (!blocked && [75, 150, 300].includes(value)) viewer.duration = value;
  control.value = String(viewer.duration);
}
