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
 * Keep the same world point beneath the cursor after a camera zoom.
 * Pointer and viewport coordinates are expressed in Phaser's game-space pixels.
 */
export function getCameraScrollForZoom(
  worldX: number,
  worldY: number,
  pointerX: number,
  pointerY: number,
  viewportX: number,
  viewportY: number,
  nextZoom: number,
): CameraScroll {
  if (!Number.isFinite(nextZoom) || nextZoom <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: worldX - (pointerX - viewportX) / nextZoom,
    y: worldY - (pointerY - viewportY) / nextZoom,
  };
}
