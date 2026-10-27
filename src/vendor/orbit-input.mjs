// Adapted from CubeAssembler TurnAnimation.res (MIT), Copyright 2026 Werner Stein.
// Upstream d62d1715e041c6b808fcce08c597fcb4a3ce5c98, viewTurn/clampPitch.
// Original license: CUBE_ASSEMBLER_LICENSE.txt. Camera movement never turns cubies.
export const pitchLimit = Math.PI / 2 - 0.05;
export const clampPitch = (p) => Math.max(-pitchLimit, Math.min(pitchLimit, p));
export function viewTurn(dx, dy, elapsedMs) {
  const speed = 0.008,
    capped = (v) => Math.max(-0.006, Math.min(0.006, v)),
    elapsed = Math.max(8, elapsedMs);
  return {
    yaw: dx * speed,
    pitch: dy * speed,
    yawVelocity: capped((dx * speed) / elapsed),
    pitchVelocity: capped((dy * speed) / elapsed),
  };
}
