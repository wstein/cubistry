import { presentationCameraRadius } from "@cubistry/cube-viewer";
/** Conservative world bounds include the whole row and every local turn sweep. */
export const clockBounds = [-4.3, 4.3].flatMap((x) =>
  [-1.5, 1.5].flatMap((y) => [-1.5, 1.5].map((z) => [x, y, z] as const)),
);
/** Conservative sphere is unchanged by any rigid presentation rotation. */
export const clockPresentationRadius = Math.max(...clockBounds.map(p => Math.hypot(...p)));
/** Historical argument shape retained for callers; angles never change fitting. */
export function clockCameraRadius(aspect: number, yaw: number, pitch: number, fov = 28): number {
  if (![yaw, pitch].every(Number.isFinite)) throw Error("Invalid clock camera");
  return presentationCameraRadius(aspect, clockPresentationRadius, fov);
}
