export interface CameraScroll {
  x: number;
  y: number;
}

const CAMERA_ZOOM_STEP = 1.1;

/** Calculate a bounded zoom level from a mouse-wheel delta. */
export function getNextCameraZoom(
  currentZoom: number,
  deltaY: number,
  minimumZoom: number,
  maximumZoom: number,
): number {
  if (![currentZoom, deltaY, minimumZoom, maximumZoom].every(Number.isFinite)) {
    return currentZoom;
  }
  if (currentZoom <= 0 || minimumZoom <= 0 || maximumZoom < minimumZoom || deltaY === 0) {
    return currentZoom;
  }

  const nextZoom = deltaY < 0
    ? currentZoom * CAMERA_ZOOM_STEP
    : currentZoom / CAMERA_ZOOM_STEP;
  return Math.min(maximumZoom, Math.max(minimumZoom, nextZoom));
}

/**
 * Keep the same world point beneath the cursor after a Phaser camera zoom.
 * Phaser applies zoom around the camera origin (0.5 by default), not the
 * viewport's top-left corner, so the viewport center must be included.
 */
export function getCameraScrollForZoom(
  worldX: number,
  worldY: number,
  pointerX: number,
  pointerY: number,
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  nextZoom: number,
  originX = 0.5,
  originY = 0.5,
): CameraScroll {
  if (
    ![worldX, worldY, pointerX, pointerY, viewportX, viewportY,
      viewportWidth, viewportHeight, nextZoom, originX, originY].every(Number.isFinite) ||
    nextZoom <= 0
  ) {
    return { x: 0, y: 0 };
  }

  const originOffsetX = viewportWidth * originX;
  const originOffsetY = viewportHeight * originY;

  return {
    x: worldX - (pointerX - viewportX - originOffsetX) / nextZoom - originOffsetX,
    y: worldY - (pointerY - viewportY - originOffsetY) / nextZoom - originOffsetY,
  };
}
