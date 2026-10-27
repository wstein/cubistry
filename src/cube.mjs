// Compatibility facade for the frozen v1 proof generator and replay tests.
// Physics is implemented once in the typed shared mechanics module.
export {
  FACE_LAYERS as FACES,
  POSITIONS,
  ROTATIONS,
  dot,
  cross,
  eq,
  rotate,
  quarter,
} from "@cubistry/cube-mechanics";
export { AXES as UNITS } from "@cubistry/cube-core";
export {
  solved,
  move,
  apply,
  inverse,
  FRONT,
  front,
  assertDisplay,
} from "./apps/counter/legacy.ts";
