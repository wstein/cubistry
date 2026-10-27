// Port of CubeAssembler viewTurn/clampPitch, MIT Copyright 2026 Werner Stein.
// Source d62d1715e041c6b808fcce08c597fcb4a3ce5c98; adjacent license is retained.
export const pitchLimit = Math.PI / 2 - 0.05;
export const clampPitch = (pitch: number): number =>
  Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
export function viewTurn(dx: number, dy: number, elapsedMs: number) {
  const speed = 0.008,
    capped = (n: number) => Math.max(-0.006, Math.min(0.006, n)),
    elapsed = Math.max(8, elapsedMs);
  return {
    yaw: dx * speed,
    pitch: dy * speed,
    yawVelocity: capped((dx * speed) / elapsed),
    pitchVelocity: capped((dy * speed) / elapsed),
  };
}
