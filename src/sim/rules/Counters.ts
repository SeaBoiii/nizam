import { clamp } from '../../utils/math';
import type { Soldier } from '../Soldier';

const CAVALRY_VS_SPEAR_BURST_MULTIPLIER = 0.4;
const CAVALRY_VS_SPEAR_COUNTER_DAMAGE = 8;
const CAVALRY_VS_SPEAR_COUNTER_SLOW = 0.86;

export function applyChargeCounter(
  attacker: Soldier,
  defender: Soldier,
  burstDamage: number,
): number {
  if (!attacker.tags.has('cavalry') || !defender.tags.has('spear')) {
    return burstDamage;
  }

  const spearCounterMult = Math.max(0.4, defender.squad.perkMods.spearCounterDamageMult);
  attacker.applyDamage(CAVALRY_VS_SPEAR_COUNTER_DAMAGE * spearCounterMult);
  attacker.velocity.scale(CAVALRY_VS_SPEAR_COUNTER_SLOW);

  const burstMultiplier = clamp(CAVALRY_VS_SPEAR_BURST_MULTIPLIER / spearCounterMult, 0.1, 1);
  return burstDamage * burstMultiplier;
}
