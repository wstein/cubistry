import { PerspectiveCamera, Vector3 } from "three";
/** Project the specified default camera onto the front sticker plane, in CSS-free pixels. */
export function frontPoint(image, x, y) {
  const camera = new PerspectiveCamera(
    18,
    image.width / image.height,
    0.1,
    100,
  );
  const yaw = (10 * Math.PI) / 180,
    pitch = (7 * Math.PI) / 180,
    radius = 10.5;
  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * radius,
    Math.sin(pitch) * radius,
    Math.cos(yaw) * Math.cos(pitch) * radius,
  );
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(x, y, 1.021).project(camera);
  return [
    Math.round(((point.x + 1) * image.width) / 2),
    Math.round(((1 - point.y) * image.height) / 2),
  ];
}
