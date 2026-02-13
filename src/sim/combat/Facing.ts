import { Vec2 } from '../../utils/vec2';
import type { Soldier } from '../Soldier';

const SPEED_EPSILON_SQ = 4;

export function getFacing(unit: Soldier, out: Vec2): Vec2 {
  const speedSq = unit.velocity.lenSq();
  if (speedSq > SPEED_EPSILON_SQ) {
    const invLen = 1 / Math.sqrt(speedSq);
    out.x = unit.velocity.x * invLen;
    out.y = unit.velocity.y * invLen;
    unit.lastFacing.copy(out);
    return out;
  }

  const squadFacing = unit.squad.facing;
  if (!Number.isFinite(unit.lastFacing.x) || !Number.isFinite(unit.lastFacing.y)) {
    unit.lastFacing.set(Math.cos(squadFacing), Math.sin(squadFacing));
  }

  if (Math.abs(unit.lastFacing.x) + Math.abs(unit.lastFacing.y) > 0.0001) {
    out.copy(unit.lastFacing).normalize();
  } else {
    out.set(Math.cos(squadFacing), Math.sin(squadFacing));
  }

  return out;
}

function angleThresholdDot(arcDeg: number): number {
  const halfArc = (arcDeg * Math.PI) / 360;
  return Math.cos(halfArc);
}

export function isBehind(
  attackerPos: Vec2,
  defenderPos: Vec2,
  defenderFacing: Vec2,
  rearAngleDeg = 120,
): boolean {
  const toAttackerX = attackerPos.x - defenderPos.x;
  const toAttackerY = attackerPos.y - defenderPos.y;
  const lenSq = toAttackerX * toAttackerX + toAttackerY * toAttackerY;
  if (lenSq <= 0.00001) {
    return false;
  }

  const invLen = 1 / Math.sqrt(lenSq);
  const dot = defenderFacing.x * (toAttackerX * invLen) + defenderFacing.y * (toAttackerY * invLen);
  return dot <= -angleThresholdDot(rearAngleDeg);
}

export function isFlank(
  attackerPos: Vec2,
  defenderPos: Vec2,
  defenderFacing: Vec2,
  flankAngleDeg = 120,
): boolean {
  const toAttackerX = attackerPos.x - defenderPos.x;
  const toAttackerY = attackerPos.y - defenderPos.y;
  const lenSq = toAttackerX * toAttackerX + toAttackerY * toAttackerY;
  if (lenSq <= 0.00001) {
    return false;
  }

  const invLen = 1 / Math.sqrt(lenSq);
  const dot = defenderFacing.x * (toAttackerX * invLen) + defenderFacing.y * (toAttackerY * invLen);
  const sideThreshold = angleThresholdDot(flankAngleDeg);
  return Math.abs(dot) < sideThreshold;
}
