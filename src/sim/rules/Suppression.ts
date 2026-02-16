import type { Projectile } from '../combat/Projectile';
import type { Soldier } from '../Soldier';
import { isFrontShieldedProjectileHit } from './RangedDamage';

export interface SuppressionTuning {
  enabled: boolean;
  stoneMoraleDamage: number;
  stoneMoraleDamageOnShieldFrontMult: number;
  maxSuppressionPerSecondPerSquad: number;
}

export interface SuppressionHitContext {
  projectile: Projectile;
  defender: Soldier;
  tuning: SuppressionTuning;
}

export function applySuppressionOnHit(context: SuppressionHitContext): number {
  const { projectile, defender, tuning } = context;
  if (!tuning.enabled || projectile.kind !== 'stone') {
    return 0;
  }

  let moraleDamage = tuning.stoneMoraleDamage * Math.max(0.1, projectile.suppressionMult);
  if (isFrontShieldedProjectileHit(projectile, defender)) {
    moraleDamage *= tuning.stoneMoraleDamageOnShieldFrontMult;
  }

  return defender.squad.applySuppression(
    moraleDamage,
    Math.max(0, tuning.maxSuppressionPerSecondPerSquad),
  );
}
