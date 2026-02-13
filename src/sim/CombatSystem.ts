import { computeChargeBurstDamage, applyChargeKnockback, consumeCharge, updateChargeState } from './combat/Charge';
import type { Soldier } from './Soldier';
import { SpatialHash } from './SpatialHash';
import type { Squad } from './Squad';
import { applyChargeCounter } from './rules/Counters';
import { computeDamage } from './rules/Damage';

export class CombatSystem {
  private readonly grid = new SpatialHash(30);
  private readonly aliveBuffer: Soldier[] = [];
  private readonly neighbors: Soldier[] = [];

  update(dt: number, squads: readonly Squad[]): void {
    this.aliveBuffer.length = 0;

    for (let squadIndex = 0; squadIndex < squads.length; squadIndex += 1) {
      const soldiers = squads[squadIndex].soldiers;
      for (let i = 0; i < soldiers.length; i += 1) {
        const soldier = soldiers[i];
        if (!soldier.alive) {
          continue;
        }

        if (soldier.attackCooldown > 0) {
          soldier.attackCooldown = Math.max(0, soldier.attackCooldown - dt);
        }

        updateChargeState(soldier, dt);
        this.aliveBuffer.push(soldier);
      }
    }

    this.grid.clear();
    for (let i = 0; i < this.aliveBuffer.length; i += 1) {
      this.grid.insert(this.aliveBuffer[i]);
    }

    for (let i = 0; i < this.aliveBuffer.length; i += 1) {
      const attacker = this.aliveBuffer[i];
      if (!attacker.alive) {
        continue;
      }

      const target = this.findNearestEnemyInRange(attacker);
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

  private findNearestEnemyInRange(attacker: Soldier): Soldier | null {
    const meleeRange = attacker.baseStats.meleeRange;
    const maxRangeSq = meleeRange * meleeRange;

    this.grid.queryNearby(attacker.position.x, attacker.position.y, this.neighbors);

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