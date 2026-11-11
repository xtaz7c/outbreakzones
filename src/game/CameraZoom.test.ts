import { describe, expect, it } from 'vitest';
import { getCameraScrollForZoom, getNextCameraZoom } from './CameraZoom';

describe('getNextCameraZoom', () => {
  it('zooms in with the wheel moving up and out moving down', () => {
    expect(getNextCameraZoom(1, -100, 0.5, 2.5)).toBeCloseTo(1.1);
    expect(getNextCameraZoom(1, 100, 0.5, 2.5)).toBeCloseTo(1 / 1.1);
  });

  it('respects the minimum and maximum zoom', () => {
    expect(getNextCameraZoom(2.5, -100, 0.5, 2.5)).toBe(2.5);
    expect(getNextCameraZoom(0.5, 100, 0.5, 2.5)).toBe(0.5);
  });

  it('does not change zoom for a zero wheel delta or invalid bounds', () => {
    expect(getNextCameraZoom(1, 0, 0.5, 2.5)).toBe(1);
    expect(getNextCameraZoom(1, -100, 2, 1)).toBe(1);
  });
});

describe('getCameraScrollForZoom', () => {
  it('keeps the cursor world point stationary across zoom levels', () => {
    const scroll = getCameraScrollForZoom(500, 300, 400, 200, 0, 0, 2);
    expect(scroll).toEqual({ x: 300, y: 200 });
    expect(scroll.x + 400 / 2).toBe(500);
    expect(scroll.y + 200 / 2).toBe(300);
  });

  it('accounts for a non-zero camera viewport origin', () => {
    expect(getCameraScrollForZoom(500, 300, 500, 260, 100, 60, 2))
      .toEqual({ x: 300, y: 200 });
  });
});
