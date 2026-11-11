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
  it('anchors the cursor at the center of the viewport', () => {
    const scroll = getCameraScrollForZoom(500, 300, 960, 540, 0, 0, 1920, 1080, 2);
    expect(scroll).toEqual({ x: -460, y: -240 });
    expect((960 - 960) / 2 + scroll.x + 960).toBe(500);
    expect((540 - 540) / 2 + scroll.y + 540).toBe(300);
  });

  it('anchors an off-center cursor with a non-zero viewport origin', () => {
    const scroll = getCameraScrollForZoom(500, 300, 500, 260, 100, 60, 800, 600, 2);
    expect(scroll).toEqual({ x: 120, y: 20 });
    expect((500 - 100 - 400) / 2 + scroll.x + 400).toBe(500);
    expect((260 - 60 - 300) / 2 + scroll.y + 300).toBe(300);
  });

  it('supports a non-default camera origin', () => {
    const scroll = getCameraScrollForZoom(500, 300, 300, 180, 0, 0, 800, 600, 2, 0, 0);
    expect(scroll).toEqual({ x: 350, y: 210 });
  });
});
