import type { Soldier } from '../Soldier';
import { getFacing, isBehind, isFlank } from '../combat/Facing';
import { Vec2 } from '../../utils/vec2';

const REAR_MULTIPLIER = 1.6;
const FLANK_MULTIPLIER = 1.25;
const SHIELD_FRONT_MULTIPLIER = 0.9;
const ARMOR_REDUCTION = 0.5;
const MIN_DAMAGE = 1;

const defenderFacingBuffer = new Vec2();

export function computeDamage(attacker: Soldier, defender: Soldier, baseDamage: number): number {
  getFacing(defender, defenderFacingBuffer);

  let amount = baseDamage;

  if (isBehind(attacker.position, defender.position, defenderFacingBuffer)) {
    amount *= REAR_MULTIPLIER;
  } else if (isFlank(attacker.position, defender.position, defenderFacingBuffer)) {
    amount *= FLANK_MULTIPLIER;
  } else if (defender.tags.has('shield')) {
    amount *= SHIELD_FRONT_MULTIPLIER;
  }

  amount -= defender.baseStats.armor * ARMOR_REDUCTION;
  return Math.max(MIN_DAMAGE, amount);
}