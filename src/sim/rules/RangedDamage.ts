import { Vec2 } from '../../utils/vec2';
import type { Soldier } from '../Soldier';
import { getFacing, isBehind, isFlank } from '../combat/Facing';
import type { Projectile } from '../combat/Projectile';
import {
  RANGED_ARMOR_REDUCTION_MULTIPLIER,
  RANGED_FLANK_MULTIPLIER,
  RANGED_REAR_MULTIPLIER,
  RANGED_SHIELD_FRONT_MULTIPLIER,
} from './Constants';

const MIN_DAMAGE = 1;
const defenderFacingBuffer = new Vec2();
const sourcePointBuffer = new Vec2();

export function computeRangedDamage(projectile: Projectile, defender: Soldier, baseDamage: number): number {
  getFacing(defender, defenderFacingBuffer);

  const velLenSq = projectile.vel.lenSq();
  let sourceX = defender.position.x;
  let sourceY = defender.position.y;
  if (velLenSq > 0.00001) {
    const invLen = 1 / Math.sqrt(velLenSq);
    sourceX += (-projectile.vel.x * invLen) * 10;
    sourceY += (-projectile.vel.y * invLen) * 10;
  }
  sourcePointBuffer.set(sourceX, sourceY);

  let amount = baseDamage;

  if (isBehind(sourcePointBuffer, defender.position, defenderFacingBuffer)) {
    amount *= RANGED_REAR_MULTIPLIER;
  } else if (isFlank(sourcePointBuffer, defender.position, defenderFacingBuffer)) {
    amount *= RANGED_FLANK_MULTIPLIER;
  } else if (defender.tags.has('shield')) {
    amount *= RANGED_SHIELD_FRONT_MULTIPLIER;
  }

  const armorEffectiveness = Math.max(0.2, defender.squad.perkMods.armorEffectivenessMult);
  amount -= defender.baseStats.armor * RANGED_ARMOR_REDUCTION_MULTIPLIER * armorEffectiveness;
  return Math.max(MIN_DAMAGE, amount);
}
