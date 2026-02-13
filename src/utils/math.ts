export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

export function rotateTowardAngle(current: number, target: number, maxDelta: number): number {
  const delta = shortestAngleDelta(current, target);
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
}

export function damp(value: number, factor: number): number {
  return value * factor;
}