export const PLATE_HALF_WIDTH = 0.708;
export const SCALE = 100;
export const VIEW = { left: -170, right: 170, top: 460, bottom: 40 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toSvgX(plateX: number) {
  return clamp(plateX * SCALE, VIEW.left, VIEW.right);
}

export function toSvgY(plateZ: number) {
  return -clamp(plateZ * SCALE, VIEW.bottom, VIEW.top);
}
