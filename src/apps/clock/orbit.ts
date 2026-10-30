import { clampPitch } from "@cubistry/cube-viewer";
/** Rigid presentation rotation: bounded polar travel, unrestricted horizontal travel.
 * Wrapping yaw prevents precision loss after repeated complete revolutions. */
export function groupOrbit(yaw: number, pitch: number, dx: number, dy: number) {
  if (![yaw, pitch, dx, dy].every(Number.isFinite)) throw Error("Invalid group orbit");
  const tau = Math.PI * 2;
  return {
    yaw: ((yaw - dx * 0.004 + Math.PI) % tau + tau) % tau - Math.PI,
    pitch: clampPitch(pitch + dy * 0.004),
  };
}
export function groupZoom(zoom: number, delta: number): number {
  if (![zoom, delta].every(Number.isFinite)) throw Error("Invalid group zoom");
  return Math.max(0.8, Math.min(2, zoom * Math.exp(Math.max(-1000, Math.min(1000, delta)) * 0.001)));
}
