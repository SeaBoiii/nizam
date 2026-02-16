import { Vec2 } from '../../utils/vec2';
import type { Soldier } from '../Soldier';
import { getFacing, isBehind, isFlank } from '../combat/Facing';
import type { Projectile } from '../combat/Projectile';
import {
  RANGED_ARMOR_REDUCTION_MULTIPLIER,
  RANGED_FLANK_MULTIPLIER,
  RANGED_REAR_MULTIPLIER,
  RANGED_SHIELD_FRONT_MULTIPLIER,
  STONE_ARMOR_REDUCTION_MULTIPLIER,
} from './Constants';

const MIN_DAMAGE = 1;
const defenderFacingBuffer = new Vec2();
const sourcePointBuffer = new Vec2();

function resolveProjectileSourcePoint(projectile: Projectile, defender: Soldier, out: Vec2): Vec2 {
  const velLenSq = projectile.vel.lenSq();
  let sourceX = defender.position.x;
  let sourceY = defender.position.y;
  if (velLenSq > 0.00001) {
    const invLen = 1 / Math.sqrt(velLenSq);
    sourceX += (-projectile.vel.x * invLen) * 10;
    sourceY += (-projectile.vel.y * invLen) * 10;
  }
  out.set(sourceX, sourceY);
  return out;
}

export function isFrontShieldedProjectileHit(projectile: Projectile, defender: Soldier): boolean {
  if (!defender.tags.has('shield')) {
    return false;
  }
  getFacing(defender, defenderFacingBuffer);
  resolveProjectileSourcePoint(projectile, defender, sourcePointBuffer);
  if (isBehind(sourcePointBuffer, defender.position, defenderFacingBuffer)) {
    return false;
  }
  if (isFlank(sourcePointBuffer, defender.position, defenderFacingBuffer)) {
    return false;
  }
  return true;
}

export function computeRangedDamage(projectile: Projectile, defender: Soldier, baseDamage: number): number {
  getFacing(defender, defenderFacingBuffer);
  resolveProjectileSourcePoint(projectile, defender, sourcePointBuffer);
  const behind = isBehind(sourcePointBuffer, defender.position, defenderFacingBuffer);
  const flank = !behind && isFlank(sourcePointBuffer, defender.position, defenderFacingBuffer);
  const shieldFront = defender.tags.has('shield') && !behind && !flank;

  let amount = baseDamage;

  if (behind) {
    amount *= RANGED_REAR_MULTIPLIER;
  } else if (flank) {
    amount *= RANGED_FLANK_MULTIPLIER;
  } else if (shieldFront) {
    amount *= RANGED_SHIELD_FRONT_MULTIPLIER;
  }

  const armorReductionMult =
    projectile.kind === 'stone' ? STONE_ARMOR_REDUCTION_MULTIPLIER : RANGED_ARMOR_REDUCTION_MULTIPLIER;
  const armorEffectiveness = Math.max(0.2, defender.squad.perkMods.armorEffectivenessMult);
  amount -= defender.baseStats.armor * armorReductionMult * armorEffectiveness;
  return Math.max(MIN_DAMAGE, amount);
}
