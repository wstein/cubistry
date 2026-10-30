import { PerspectiveCamera, Vector3, Group } from "three";
import { rotatePresentation, cubePresentationRadius, fitPresentationCamera } from "../../packages/cube-viewer/src/presentation-rotation.ts";
/** Project the default presentation onto the front sticker plane, in CSS-free pixels. */
export function frontPoint(image, x, y) {
  const camera = new PerspectiveCamera(
    18,
    image.width / image.height,
    0.1,
    100,
  );
  const presentation = new Group();
  rotatePresentation(presentation, Math.PI / 18, (7 * Math.PI) / 180);
  fitPresentationCamera(camera, cubePresentationRadius(1));
  camera.updateMatrixWorld();
  const point = new Vector3(x, y, 1.021).applyQuaternion(presentation.quaternion).project(camera);
  return [
    Math.round(((point.x + 1) * image.width) / 2),
    Math.round(((1 - point.y) * image.height) / 2),
  ];
}
