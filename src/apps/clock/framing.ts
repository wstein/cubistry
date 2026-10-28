/** Conservative world bounds include the whole row and every local turn sweep. */
export const clockBounds = [-4.3, 4.3].flatMap((x) =>
  [-1.5, 1.5].flatMap((y) => [-1.5, 1.5].map((z) => [x, y, z] as const)),
);
/** Fit all eight bounds corners against the current camera basis, with margin.
 * Fitting in camera coordinates also covers the permitted simultaneous yaw/pitch.
 */
export function clockCameraRadius(
  aspect: number,
  yaw: number,
  pitch: number,
  fov = 28,
): number {
  if (
    ![aspect, yaw, pitch, fov].every(Number.isFinite) ||
    aspect <= 0 ||
    fov <= 0 ||
    fov >= 180
  )
    throw Error("Invalid clock camera");
  const sy = Math.sin(yaw),
    cy = Math.cos(yaw),
    sp = Math.sin(pitch),
    cp = Math.cos(pitch),
    tanV = Math.tan((fov * Math.PI) / 360),
    tanH = tanV * aspect;
  let radius = 0;
  for (const [x, y, z] of clockBounds) {
    const depth = x * sy * cp + y * sp + z * cy * cp,
      right = x * cy - z * sy,
      up = -x * sy * sp + y * cp - z * cy * sp;
    radius = Math.max(
      radius,
      depth + Math.abs(right) / tanH,
      depth + Math.abs(up) / tanV,
    );
  }
  return Math.max(6, radius) * 1.08;
}
