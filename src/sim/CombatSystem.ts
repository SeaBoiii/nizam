import { computeChargeBurstDamage, applyChargeKnockback, consumeCharge, updateChargeState } from './combat/Charge';
import type { Soldier } from './Soldier';
import type { SpatialHash } from './SpatialHash';
import { applyChargeCounter } from './rules/Counters';
import { computeDamage } from './rules/Damage';

export class CombatSystem {
  private readonly neighbors: Soldier[] = [];

  update(dt: number, aliveUnits: readonly Soldier[], spatialGrid: SpatialHash): void {
    for (let i = 0; i < aliveUnits.length; i += 1) {
      const soldier = aliveUnits[i];
      if (!soldier.alive) {
        continue;
      }

      if (soldier.attackCooldown > 0) {
        soldier.attackCooldown = Math.max(0, soldier.attackCooldown - dt);
      }

      updateChargeState(soldier, dt);
    }

    for (let i = 0; i < aliveUnits.length; i += 1) {
      const attacker = aliveUnits[i];
      if (!attacker.alive) {
        continue;
      }

      const target = this.findNearestEnemyInRange(attacker, spatialGrid);
      if (target === null || !target.alive) {
        continue;
      }

      let burstResolved = false;
      if (attacker.chargeState === 'charging' && attacker.chargeReady && attacker.chargeCooldown <= 0) {
        let burst = computeChargeBurstDamage(attacker);
        burst = applyChargeCounter(attacker, target, burst);
        burst = computeDamage(attacker, target, burst);

        target.applyDamage(burst);
        applyChargeKnockback(attacker, target);
        consumeCharge(attacker);
        burstResolved = true;
      }

      if (burstResolved || attacker.attackCooldown > 0 || !target.alive) {
        continue;
      }

      const baseDamage = attacker.baseStats.attackDamage;
      const finalDamage = computeDamage(attacker, target, baseDamage);
      target.applyDamage(finalDamage);

      const attackRate = Math.max(0.2, attacker.baseStats.attackRate);
      attacker.attackCooldown = 1 / attackRate;
    }
  }

  private findNearestEnemyInRange(attacker: Soldier, spatialGrid: SpatialHash): Soldier | null {
    const meleeRange = attacker.baseStats.meleeRange;
    const maxRangeSq = meleeRange * meleeRange;

    spatialGrid.queryRadius(attacker.position.x, attacker.position.y, meleeRange + 2, this.neighbors);

    let nearest: Soldier | null = null;
    let nearestDistSq = maxRangeSq;

    for (let i = 0; i < this.neighbors.length; i += 1) {
      const candidate = this.neighbors[i];
      if (!candidate.alive || candidate === attacker || candidate.team === attacker.team) {
        continue;
      }

      const dx = candidate.position.x - attacker.position.x;
      const dy = candidate.position.y - attacker.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > nearestDistSq) {
        continue;
      }

      nearestDistSq = distSq;
      nearest = candidate;
    }

    return nearest;
  }
}